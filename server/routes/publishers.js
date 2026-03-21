import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { buildBookHtml, tiptapToHtml } from '../utils/tiptapToHtml.js';
import { FileFlowClient, getFileFlowToken, ensureBookFolders } from '../services/fileflow.js';

const router = express.Router({ mergeParams: true });

// ── Helper: fetch book + chapters ─────────────────────────────────────────────
async function fetchBookFull(bookId) {
  const { data: book, error } = await supabase
    .from('books')
    .select(`
      id, title, subtitle, description, cover_image_url, status,
      author:profiles!books_author_id_fkey(id, display_name, email)
    `)
    .eq('id', bookId)
    .single();
  if (error) throw error;

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, title, content, order_index, word_count')
    .eq('book_id', bookId)
    .order('order_index');

  return {
    ...book,
    author_name: book.author?.display_name || '',
    author_email: book.author?.email || '',
    chapters: chapters || [],
  };
}

// ── Helper: build or reuse EPUB in FileFlow ───────────────────────────────────
async function getOrBuildEpub(bookId, book, userId) {
  let Epub;
  try { Epub = (await import('epub-gen')).default; }
  catch { throw new Error('EPUB generation requires epub-gen. Run: npm install epub-gen'); }

  const { default: fs } = await import('fs');
  const { default: os } = await import('os');
  const { default: path } = await import('path');

  const tmpFile = path.join(os.tmpdir(), `bookflow_${bookId}_${Date.now()}.epub`);
  await new Epub({
    title: book.title || 'Untitled',
    author: book.author_name || 'Unknown',
    cover: book.cover_image_url || undefined,
    lang: 'en',
    output: tmpFile,
    content: book.chapters.map(ch => ({
      title: ch.title || 'Chapter',
      data: `<h1>${ch.title || ''}</h1>${tiptapToHtml(ch.content)}`,
    })),
  }).promise;

  const epubBuffer = fs.readFileSync(tmpFile);
  fs.unlinkSync(tmpFile);

  const token = await getFileFlowToken(userId);
  if (token) {
    const folders = await ensureBookFolders(bookId, book.title, token);
    const client = new FileFlowClient(token);
    const fileRecord = await client.uploadBuffer(
      epubBuffer,
      `${(book.title || 'book').replace(/[^a-z0-9]/gi, '_')}.epub`,
      'application/epub+zip',
      folders.backups_folder_id
    );
    return { buffer: epubBuffer, fileflow_file_id: fileRecord.id };
  }

  return { buffer: epubBuffer, fileflow_file_id: null };
}

// ── Helper: record submission ─────────────────────────────────────────────────
async function recordSubmission(bookId, userId, platform, data = {}) {
  const { data: record, error } = await supabase
    .from('publisher_submissions')
    .insert({
      book_id: bookId,
      submitted_by: userId,
      platform,
      status: data.status || 'submitted',
      submission_id: data.submission_id || null,
      publisher_url: data.publisher_url || null,
      metadata: data.metadata || {},
    })
    .select()
    .single();

  if (error) console.error('[publishers] Failed to record submission:', error.message);
  return record;
}

// ── GET /api/books/:bookId/submissions ────────────────────────────────────────
router.get('/:bookId/submissions', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('publisher_submissions')
      .select('*')
      .eq('book_id', req.params.bookId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/books/:bookId/submissions/:submissionId ───────────────────────
router.delete('/:bookId/submissions/:submissionId', authenticate, requireRole(['owner']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('publisher_submissions')
      .delete()
      .eq('id', req.params.submissionId)
      .eq('book_id', req.params.bookId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/books/:bookId/submit/draft2digital ──────────────────────────────
// Draft2Digital API: https://api.draft2digital.com/book
router.post('/:bookId/submit/draft2digital', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  const { api_token, genres, isbn, language = 'en', price, territories = 'WORLD' } = req.body;

  if (!api_token) return res.status(400).json({ error: 'api_token is required' });

  try {
    const book = await fetchBookFull(req.params.bookId);
    if (!book.title) return res.status(400).json({ error: 'Book must have a title before submitting' });

    const { buffer: epubBuffer } = await getOrBuildEpub(req.params.bookId, book, req.user.id);

    // Build multipart form for D2D API
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('title', book.title);
    form.append('authors', JSON.stringify([{ name: book.author_name, role: 'author' }]));
    if (book.subtitle) form.append('subtitle', book.subtitle);
    if (book.description) form.append('description', book.description);
    form.append('language', language);
    if (genres?.length) form.append('categories', JSON.stringify(genres));
    if (isbn) form.append('isbn', isbn);
    if (price != null) form.append('price', String(price));
    form.append('territories', territories);
    form.append('epub', epubBuffer, {
      filename: `${(book.title || 'book').replace(/[^a-z0-9]/gi, '_')}.epub`,
      contentType: 'application/epub+zip',
    });

    const d2dRes = await fetch('https://api.draft2digital.com/book', {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${api_token}`,
      },
      body: form,
    });

    const d2dBody = await d2dRes.json().catch(() => ({}));

    if (!d2dRes.ok) {
      await recordSubmission(req.params.bookId, req.user.id, 'draft2digital', {
        status: 'failed',
        metadata: { error: d2dBody, http_status: d2dRes.status },
      });
      return res.status(d2dRes.status).json({ error: d2dBody.message || 'Draft2Digital submission failed', details: d2dBody });
    }

    const submission = await recordSubmission(req.params.bookId, req.user.id, 'draft2digital', {
      status: 'submitted',
      submission_id: String(d2dBody.id || d2dBody.book_id || ''),
      publisher_url: d2dBody.url || `https://www.draft2digital.com/book/${d2dBody.id}`,
      metadata: d2dBody,
    });

    res.json({ submission, publisher_response: d2dBody });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/books/:bookId/submit/smashwords ─────────────────────────────────
// Smashwords API: https://api.smashwords.com/api/v1/
router.post('/:bookId/submit/smashwords', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  const { api_token, genres, isbn, language = 'en', price = 0, adult = false } = req.body;

  if (!api_token) return res.status(400).json({ error: 'api_token is required' });

  try {
    const book = await fetchBookFull(req.params.bookId);
    if (!book.title) return res.status(400).json({ error: 'Book must have a title before submitting' });

    const { buffer: epubBuffer } = await getOrBuildEpub(req.params.bookId, book, req.user.id);

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('title', book.title);
    form.append('author', book.author_name);
    if (book.description) form.append('description', book.description);
    form.append('language', language);
    form.append('price', String(price));
    form.append('adult', adult ? '1' : '0');
    if (isbn) form.append('isbn', isbn);
    if (genres?.length) form.append('category', genres[0]);
    form.append('file', epubBuffer, {
      filename: `${(book.title || 'book').replace(/[^a-z0-9]/gi, '_')}.epub`,
      contentType: 'application/epub+zip',
    });

    const swRes = await fetch('https://api.smashwords.com/api/v1/books', {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`:${api_token}`).toString('base64')}`,
      },
      body: form,
    });

    const swBody = await swRes.json().catch(() => ({}));

    if (!swRes.ok) {
      await recordSubmission(req.params.bookId, req.user.id, 'smashwords', {
        status: 'failed',
        metadata: { error: swBody, http_status: swRes.status },
      });
      return res.status(swRes.status).json({ error: swBody.message || 'Smashwords submission failed', details: swBody });
    }

    const submission = await recordSubmission(req.params.bookId, req.user.id, 'smashwords', {
      status: 'submitted',
      submission_id: String(swBody.id || swBody.book_id || ''),
      publisher_url: swBody.url || `https://www.smashwords.com/books/view/${swBody.id}`,
      metadata: swBody,
    });

    res.json({ submission, publisher_response: swBody });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/books/:bookId/submit/manual ─────────────────────────────────────
// Record a manual submission (user submitted via external tool)
router.post('/:bookId/submit/manual', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  const { platform_name, submission_id, publisher_url, note } = req.body;

  try {
    const submission = await recordSubmission(req.params.bookId, req.user.id, 'manual', {
      status: 'submitted',
      submission_id: submission_id || null,
      publisher_url: publisher_url || null,
      metadata: { platform_name, note },
    });
    res.json({ submission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
