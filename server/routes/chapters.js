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

    // Check access: public books or author always allowed
    if (chapter.book.visibility !== 'public' && chapter.book.author_id !== req.user?.id) {
      if (!req.user?.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Allow collaborators
      const { data: collab } = await supabase
        .schema('bookflow')
        .from('book_collaborators')
        .select('id')
        .eq('book_id', chapter.book.id)
        .eq('user_id', req.user.id)
        .not('invite_accepted_at', 'is', null)
        .maybeSingle();

      if (!collab) {
        // Allow club members whose club has this book
        const { data: clubBooks } = await supabase
          .schema('bookflow')
          .from('club_books')
          .select('club_id')
          .eq('book_id', chapter.book.id);

        const clubIds = (clubBooks || []).map(cb => cb.club_id);

        if (clubIds.length > 0) {
          const { data: clubMember } = await supabase
            .schema('bookflow')
            .from('club_members')
            .select('id')
            .eq('user_id', req.user.id)
            .in('club_id', clubIds)
            .not('invite_accepted_at', 'is', null)
            .maybeSingle();

          if (!clubMember) {
            return res.status(403).json({ error: 'Not authorized' });
          }
        } else {
          return res.status(403).json({ error: 'Not authorized' });
        }
      }
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
  const { title, content, content_text, order_index, status, word_count, estimated_read_time_minutes } = req.body;

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

    // Compute word count server-side if not provided but content_text is
    let finalWordCount = word_count;
    let finalReadTime = estimated_read_time_minutes;
    if (finalWordCount == null && content_text != null) {
      const words = content_text.trim() ? content_text.trim().split(/\s+/).length : 0;
      finalWordCount = words;
      finalReadTime = Math.max(1, Math.round(words / 200));
    }

    const updatePayload = { title, content, content_text, order_index, status };
    if (finalWordCount != null) updatePayload.word_count = finalWordCount;
    if (finalReadTime != null) updatePayload.estimated_read_time_minutes = finalReadTime;

    const { data: updated, error } = await supabase
      .from('chapters')
      .update(updatePayload)
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
