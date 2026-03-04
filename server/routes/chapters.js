import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get chapters for a book
router.get('/books/:bookId/chapters', optionalAuth, async (req, res) => {
  try {
    // First check book access
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('author_id, visibility')
      .eq('id', req.params.bookId)
      .single();

    if (bookError) throw bookError;

    if (book.visibility !== 'public' && book.author_id !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: chapters, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', req.params.bookId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    res.json(chapters);
  } catch (err) {
    console.error('Get chapters error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single chapter with content
router.get('/chapters/:id', optionalAuth, async (req, res) => {
  try {
    const { data: chapter, error } = await supabase
      .from('chapters')
      .select(`
        *,
        book:books(id, title, author_id, visibility)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Check access
    if (chapter.book.visibility !== 'public' && chapter.book.author_id !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(chapter);
  } catch (err) {
    console.error('Get chapter error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create chapter
router.post('/books/:bookId/chapters', authenticate, async (req, res) => {
  const { title, content, content_text, order_index, status } = req.body;

  try {
    // Check author
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', req.params.bookId)
      .single();

    if (bookError) throw bookError;

    if (book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get next order_index if not provided
    let chapterOrder = order_index;
    if (chapterOrder === undefined) {
      const { data: lastChapter } = await supabase
        .from('chapters')
        .select('order_index')
        .eq('book_id', req.params.bookId)
        .order('order_index', { ascending: false })
        .limit(1)
        .single();

      chapterOrder = (lastChapter?.order_index ?? -1) + 1;
    }

    const { data: chapter, error } = await supabase
      .from('chapters')
      .insert({
        book_id: req.params.bookId,
        title,
        content,
        content_text,
        order_index: chapterOrder,
        status: status || 'draft'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(chapter);
  } catch (err) {
    console.error('Create chapter error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update chapter
router.put('/chapters/:id', authenticate, async (req, res) => {
  const { title, content, content_text, order_index, status } = req.body;

  try {
    // Check author
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('book_id, book:books(author_id)')
      .eq('id', req.params.id)
      .single();

    if (chapterError) throw chapterError;

    if (chapter.book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: updated, error } = await supabase
      .from('chapters')
      .update({
        title,
        content,
        content_text,
        order_index,
        status
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(updated);
  } catch (err) {
    console.error('Update chapter error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reorder chapters
router.put('/books/:bookId/chapters/reorder', authenticate, async (req, res) => {
  const { chapter_ids } = req.body; // Array of chapter IDs in new order

  try {
    // Check author
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', req.params.bookId)
      .single();

    if (bookError) throw bookError;

    if (book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update each chapter's order_index
    const updates = chapter_ids.map((id, index) =>
      supabase
        .from('chapters')
        .update({ order_index: index })
        .eq('id', id)
        .eq('book_id', req.params.bookId)
    );

    await Promise.all(updates);

    // Get updated chapters
    const { data: chapters, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', req.params.bookId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    res.json(chapters);
  } catch (err) {
    console.error('Reorder chapters error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete chapter
router.delete('/chapters/:id', authenticate, async (req, res) => {
  try {
    // Check author
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('book_id, book:books(author_id)')
      .eq('id', req.params.id)
      .single();

    if (chapterError) throw chapterError;

    if (chapter.book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete chapter error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
