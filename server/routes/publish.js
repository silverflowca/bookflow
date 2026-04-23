import express from 'express';
import nodemailer from 'nodemailer';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { buildSnapshot } from './versions.js';

const router = express.Router({ mergeParams: true });

// Generate a URL-safe slug from a title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

// Ensure slug is unique by appending a counter if needed
async function uniqueSlug(base, bookId) {
  let slug = base;
  let attempt = 0;
  while (true) {
    const { data } = await supabase
      .from('books')
      .select('id')
      .eq('slug', slug)
      .neq('id', bookId)
      .single();
    if (!data) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

// POST /api/books/:bookId/publish
router.post('/', authenticate, requireRole(['owner']), async (req, res) => {
  const bookId = req.params.bookId;

  try {
    // Generate slug from book title if not already set
    let slug = req.book.slug;
    if (!slug) {
      const base = generateSlug(req.book.title || 'untitled');
      slug = await uniqueSlug(base, bookId);
    }

    // Create publish snapshot
    const snapshot = await buildSnapshot(bookId);
    await supabase.from('book_versions').insert({
      book_id: bookId,
      version_number: 0,
      label: 'Published',
      snapshot,
      created_by: req.user.id,
      trigger: 'publish',
    });

    // Update book
    const { data, error } = await supabase
      .from('books')
      .update({
        status: 'published',
        visibility: 'public',
        slug,
        published_at: new Date().toISOString(),
        review_status: 'none',
      })
      .eq('id', bookId)
      .select('id, title, slug, share_token, status, visibility, published_at')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/unpublish
router.post('/unpublish', authenticate, requireRole(['owner']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('books')
      .update({ status: 'draft', visibility: 'private' })
      .eq('id', req.params.bookId)
      .select('id, status, visibility')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/books/:slug — public reader (no auth)
// Mounted at /api/public, so path is /books/:slug
router.get('/books/:slug', async (req, res) => {
  try {
    const { data: book, error } = await supabase
      .from('books')
      .select(`
        id, title, subtitle, description, cover_image_url, published_at, slug,
        author:profiles!books_author_id_fkey(id, display_name, avatar_url, bio)
      `)
      .eq('slug', req.params.slug)
      .eq('status', 'published')
      .single();

    if (error || !book) return res.status(404).json({ error: 'Book not found' });

    const { data: chapters } = await supabase
      .from('chapters')
      .select('id, title, content, order_index, word_count, estimated_read_time_minutes')
      .eq('book_id', book.id)
      .eq('status', 'published')
      .order('order_index');

    res.json({ ...book, chapters: chapters || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/books/share/:token — private share token reader (no auth)
// Mounted at /api/public, so path is /books/share/:token
router.get('/books/share/:token', async (req, res) => {
  try {
    const { data: book, error } = await supabase
      .from('books')
      .select(`
        id, title, subtitle, description, cover_image_url, published_at, slug, share_token,
        author:profiles!books_author_id_fkey(id, display_name, avatar_url, bio)
      `)
      .eq('share_token', req.params.token)
      .single();

    if (error || !book) return res.status(404).json({ error: 'Book not found' });

    const { data: chapters } = await supabase
      .from('chapters')
      .select('id, title, content, order_index, word_count, estimated_read_time_minutes')
      .eq('book_id', book.id)
      .order('order_index');

    res.json({ ...book, chapters: chapters || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/invite — email a reader invite
router.post('/invite', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  const { emails, message } = req.body;
  if (!emails?.length) return res.status(400).json({ error: 'No emails provided' });

  try {
    // Get book + sender profile
    const { data: book } = await supabase
      .from('books')
      .select('id, title, slug, share_token, visibility')
      .eq('id', req.params.bookId)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', req.user.id)
      .single();

    const origin = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:5177';
    const readUrl = book.slug
      ? `${origin}/read/${book.slug}`
      : book.share_token
        ? `${origin}/read/share/${book.share_token}`
        : `${origin}/book/${book.id}`;

    const senderName = profile?.display_name || 'A BookFlow author';

    // Set up transporter
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
      // No SMTP configured — return the link for manual sharing
      return res.json({ ok: true, manual: true, url: readUrl });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const personalNote = message ? `<p style="margin:16px 0;font-style:italic;color:#555;">"${message}"</p>` : '';

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 8px;">${book.title}</h2>
        <p style="color:#666;margin:0 0 16px;">${senderName} invited you to read their book on BookFlow.</p>
        ${personalNote}
        <a href="${readUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Read Now →</a>
        <p style="margin-top:24px;font-size:12px;color:#999;">Or copy this link: ${readUrl}</p>
      </div>`;

    const emailList = Array.isArray(emails) ? emails : [emails];
    await Promise.all(emailList.map(to =>
      transporter.sendMail({
        from: `"${senderName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: `${senderName} invited you to read "${book.title}"`,
        html,
      })
    ));

    res.json({ ok: true, sent: emailList.length });
  } catch (err) {
    console.error('Invite email error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
