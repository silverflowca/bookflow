import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { buildSnapshot } from './versions.js';
import { buildBookHtml, tiptapToHtml } from '../utils/tiptapToHtml.js';
import { FileFlowClient, getFileFlowToken, ensureBookFolders } from '../services/fileflow.js';

const router = express.Router({ mergeParams: true });

async function fetchBookFull(bookId) {
  const { data: book, error } = await supabase
    .from('books')
    .select(`
      id, title, subtitle, description, cover_image_url, status, visibility,
      slug, share_token, published_at, created_at,
      author:profiles!books_author_id_fkey(id, display_name, email)
    `)
    .eq('id', bookId)
    .single();
  if (error) throw error;

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, title, content, content_text, order_index, word_count, status')
    .eq('book_id', bookId)
    .order('order_index');

  return {
    ...book,
    author_name: book.author?.display_name || '',
    author_email: book.author?.email || '',
    chapters: chapters || [],
  };
}

async function uploadToBackups(bookId, bookTitle, buffer, fileName, mimeType, userId) {
  const token = await getFileFlowToken(userId);
  if (!token) return null;
  const folders = await ensureBookFolders(bookId, bookTitle, token);
  const client = new FileFlowClient(token);
  const fileRecord = await client.uploadBuffer(buffer, fileName, mimeType, folders.backups_folder_id);
  const { url } = await client.getDownloadUrl(fileRecord.id);
  return { fileflow_file_id: fileRecord.id, download_url: url };
}

// GET /api/books/:bookId/export/json
router.get('/:bookId/export/json', authenticate, requireRole(['owner', 'author', 'editor']), async (req, res) => {
  try {
    const snapshot = await buildSnapshot(req.params.bookId);
    const { data: book } = await supabase
      .from('books')
      .select('title, subtitle, description, cover_image_url')
      .eq('id', req.params.bookId)
      .single();

    const exportData = {
      bookflow_export: true,
      version: '1.0',
      exported_at: new Date().toISOString(),
      book: { ...book, id: req.params.bookId },
      ...snapshot,
    };

    const title = (book?.title || 'book').replace(/[^a-z0-9]/gi, '_');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${title}.bookflow.json"`);
    res.json(exportData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:bookId/publisher-metadata
router.get('/:bookId/publisher-metadata', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  try {
    const book = await fetchBookFull(req.params.bookId);
    const totalWords = book.chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0);
    res.json({
      title: book.title,
      subtitle: book.subtitle || '',
      description: book.description || '',
      author_name: book.author_name,
      author_email: book.author_email,
      language: 'en',
      word_count: totalWords,
      chapter_count: book.chapters.length,
      genres: [],
      isbn_placeholder: '',
      cover_image_url: book.cover_image_url || '',
      published_at: book.published_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/export/pdf
router.post('/:bookId/export/pdf', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  let puppeteer;
  try { puppeteer = (await import('puppeteer')).default; }
  catch { return res.status(501).json({ error: 'PDF export requires puppeteer. Run: npm install puppeteer' }); }

  let browser;
  try {
    const book = await fetchBookFull(req.params.bookId);
    const html = buildBookHtml(book, book.chapters);

    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '2.5cm', right: '2.5cm' },
      printBackground: true,
    });
    await browser.close();
    browser = null;

    const fileName = `${(book.title || 'book').replace(/[^a-z0-9]/gi, '_')}.pdf`;
    const result = await uploadToBackups(req.params.bookId, book.title, Buffer.from(pdfBuffer), fileName, 'application/pdf', req.user.id);

    if (result) return res.json(result);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/export/epub
router.post('/:bookId/export/epub', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  let Epub;
  try { Epub = (await import('epub-gen')).default; }
  catch { return res.status(501).json({ error: 'EPUB export requires epub-gen. Run: npm install epub-gen' }); }

  const tmpFile = path.join(os.tmpdir(), `bookflow_${req.params.bookId}_${Date.now()}.epub`);
  try {
    const book = await fetchBookFull(req.params.bookId);

    await new Epub({
      title: book.title || 'Untitled',
      author: book.author_name || 'Unknown',
      publisher: 'BookFlow',
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

    const fileName = `${(book.title || 'book').replace(/[^a-z0-9]/gi, '_')}.epub`;
    const result = await uploadToBackups(req.params.bookId, book.title, epubBuffer, fileName, 'application/epub+zip', req.user.id);

    if (result) return res.json(result);

    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(epubBuffer);
  } catch (err) {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/export/docx
router.post('/:bookId/export/docx', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  let docxLib;
  try { docxLib = await import('docx'); }
  catch { return res.status(501).json({ error: 'DOCX export requires docx. Run: npm install docx' }); }

  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = docxLib;

  try {
    const book = await fetchBookFull(req.params.bookId);

    function tiptapNodeToDocx(node) {
      if (!node) return [];
      if (node.type === 'doc') return (node.content || []).flatMap(tiptapNodeToDocx);
      if (node.type === 'paragraph') {
        const runs = (node.content || []).map(n => {
          if (n.type !== 'text') return null;
          const bold = n.marks?.some(m => m.type === 'bold');
          const italics = n.marks?.some(m => m.type === 'italic');
          return new TextRun({ text: n.text || '', bold, italics });
        }).filter(Boolean);
        return [new Paragraph({ children: runs.length ? runs : [new TextRun('')] })];
      }
      if (node.type === 'heading') {
        const levelMap = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };
        const text = (node.content || []).map(n => n.text || '').join('');
        return [new Paragraph({ text, heading: levelMap[node.attrs?.level] || HeadingLevel.HEADING_1 })];
      }
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        return (node.content || []).flatMap(li => {
          const text = (li.content || []).flatMap(p => (p.content || []).map(n => n.text || '')).join('');
          return [new Paragraph({ text: `- ${text}` })];
        });
      }
      if (node.type === 'blockquote') {
        const text = (node.content || []).flatMap(p => (p.content || []).map(n => n.text || '')).join('');
        return [new Paragraph({ text })];
      }
      if (node.content) return (node.content || []).flatMap(tiptapNodeToDocx);
      return [];
    }

    const children = [];
    children.push(new Paragraph({ text: book.title || 'Untitled', heading: HeadingLevel.TITLE }));
    if (book.subtitle) children.push(new Paragraph({ text: book.subtitle }));
    if (book.author_name) children.push(new Paragraph({ text: `By ${book.author_name}` }));

    for (const ch of book.chapters) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(new Paragraph({ text: ch.title || 'Chapter', heading: HeadingLevel.HEADING_1 }));
      children.push(...tiptapNodeToDocx(ch.content));
    }

    const doc = new Document({ sections: [{ children }] });
    const docxBuffer = await Packer.toBuffer(doc);

    const fileName = `${(book.title || 'book').replace(/[^a-z0-9]/gi, '_')}.docx`;
    const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const result = await uploadToBackups(req.params.bookId, book.title, docxBuffer, fileName, mimeType, req.user.id);

    if (result) return res.json(result);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(docxBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/export/submission-package
router.post('/:bookId/export/submission-package', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  let archiver;
  try { archiver = (await import('archiver')).default; }
  catch { return res.status(501).json({ error: 'Submission package requires archiver. Run: npm install archiver' }); }

  const tmpDir = path.join(os.tmpdir(), `bookflow_pkg_${req.params.bookId}_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const book = await fetchBookFull(req.params.bookId);
    const safeName = (book.title || 'book').replace(/[^a-z0-9]/gi, '_');
    const totalWords = book.chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0);

    const metadata = {
      title: book.title, subtitle: book.subtitle, description: book.description,
      author_name: book.author_name, author_email: book.author_email,
      language: 'en', word_count: totalWords, chapter_count: book.chapters.length,
      genres: req.body.genres || [], isbn: req.body.isbn || '',
      cover_image_url: book.cover_image_url || '',
      exported_at: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(tmpDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    const snapshot = await buildSnapshot(req.params.bookId);
    fs.writeFileSync(
      path.join(tmpDir, `${safeName}.bookflow.json`),
      JSON.stringify({ book: { id: book.id, title: book.title, subtitle: book.subtitle }, ...snapshot }, null, 2)
    );

    try {
      const Epub = (await import('epub-gen')).default;
      const epubPath = path.join(tmpDir, `${safeName}.epub`);
      await new Epub({
        title: book.title, author: book.author_name,
        cover: book.cover_image_url || undefined, output: epubPath,
        content: book.chapters.map(ch => ({ title: ch.title, data: `<h1>${ch.title}</h1>${tiptapToHtml(ch.content)}` })),
      }).promise;
    } catch { /* epub-gen not installed, skip */ }

    try {
      const puppeteer = (await import('puppeteer')).default;
      const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(buildBookHtml(book, book.chapters), { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '2cm', bottom: '2cm', left: '2.5cm', right: '2.5cm' } });
      await browser.close();
      fs.writeFileSync(path.join(tmpDir, `${safeName}.pdf`), Buffer.from(pdfBuffer));
    } catch { /* puppeteer not installed, skip */ }

    const zipPath = path.join(os.tmpdir(), `${safeName}_submission.zip`);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(tmpDir, false);
      archive.finalize();
    });

    const zipBuffer = fs.readFileSync(zipPath);
    fs.unlinkSync(zipPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const zipName = `${safeName}_submission.zip`;
    const result = await uploadToBackups(req.params.bookId, book.title, zipBuffer, zipName, 'application/zip', req.user.id);

    if (result) return res.json(result);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.send(zipBuffer);
  } catch (err) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    res.status(500).json({ error: err.message });
  }
});

export default router;
