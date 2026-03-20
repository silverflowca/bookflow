import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// GET /api/books/:bookId/versions
router.get('/', authenticate, requireRole(['owner', 'author', 'editor', 'reviewer']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('book_versions')
      .select(`
        id, version_number, label, trigger, created_at,
        created_by_user:profiles!book_versions_created_by_fkey(id, display_name, avatar_url)
      `)
      .eq('book_id', req.params.bookId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/versions — create manual snapshot
router.post('/', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  const { label } = req.body;

  try {
    const snapshot = await buildSnapshot(req.params.bookId);

    const { data, error } = await supabase
      .from('book_versions')
      .insert({
        book_id: req.params.bookId,
        version_number: 0, // auto-set by trigger
        label: label || null,
        snapshot,
        created_by: req.user.id,
        trigger: 'manual',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:bookId/versions/:versionId
router.get('/:versionId', authenticate, requireRole(['owner', 'author', 'editor', 'reviewer']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('book_versions')
      .select(`
        *,
        created_by_user:profiles!book_versions_created_by_fkey(id, display_name, avatar_url)
      `)
      .eq('id', req.params.versionId)
      .eq('book_id', req.params.bookId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Version not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/versions/:versionId/restore — restore to this version
router.post('/:versionId/restore', authenticate, requireRole(['owner']), async (req, res) => {
  try {
    const { data: version, error: vErr } = await supabase
      .from('book_versions')
      .select('snapshot')
      .eq('id', req.params.versionId)
      .eq('book_id', req.params.bookId)
      .single();

    if (vErr || !version) return res.status(404).json({ error: 'Version not found' });

    // Save current state as a new 'auto' version before restoring
    const current = await buildSnapshot(req.params.bookId);
    await supabase.from('book_versions').insert({
      book_id: req.params.bookId,
      version_number: 0,
      label: 'Pre-restore snapshot',
      snapshot: current,
      created_by: req.user.id,
      trigger: 'auto',
    });

    // Restore each chapter from the snapshot
    const chapters = version.snapshot?.chapters || [];
    for (const ch of chapters) {
      await supabase
        .from('chapters')
        .update({ content: ch.content, content_text: ch.content_text, title: ch.title, order_index: ch.order_index })
        .eq('id', ch.id)
        .eq('book_id', req.params.bookId);
    }

    res.json({ success: true, restoredChapters: chapters.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: build a full snapshot of all chapters
export async function buildSnapshot(bookId) {
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, title, content, content_text, order_index, status, word_count')
    .eq('book_id', bookId)
    .order('order_index');

  return { chapters: chapters || [], snapped_at: new Date().toISOString() };
}

export default router;
