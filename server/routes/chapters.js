import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Helper: check if user is owner or accepted collaborator of a book
async function canEditBook(bookId, userId) {
  const { data: book, error } = await supabase
    .from('books')
    .select('author_id, collaborators:book_collaborators(user_id, invite_accepted_at)')
    .eq('id', bookId)
    .single();
  if (error) throw error;
  if (book.author_id === userId) return true;
  return (book.collaborators || []).some(
    c => c.user_id === userId && c.invite_accepted_at !== null
  );
}

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
      .neq('status', 'archived')
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
    if (!await canEditBook(req.params.bookId, req.user.id)) {
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
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('book_id')
      .eq('id', req.params.id)
      .single();

    if (chapterError) throw chapterError;

    if (!await canEditBook(chapter.book_id, req.user.id)) {
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
    if (!await canEditBook(req.params.bookId, req.user.id)) {
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

// Archive chapter (soft-delete — sets status to 'archived', never physically deleted)
router.delete('/chapters/:id', authenticate, async (req, res) => {
  try {
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('book_id')
      .eq('id', req.params.id)
      .single();

    if (chapterError) throw chapterError;

    if (!await canEditBook(chapter.book_id, req.user.id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('chapters')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Archive chapter error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Slug helpers (reuse same logic as publish.js) ──────────────────────────
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

async function uniqueChapterSlug(base, bookId, excludeChapterId) {
  let slug = base;
  let attempt = 0;
  while (true) {
    let q = supabase.from('chapters').select('id').eq('book_id', bookId).eq('slug', slug);
    if (excludeChapterId) q = q.neq('id', excludeChapterId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

// PATCH /api/chapters/:id/slug — update chapter slug
router.patch('/chapters/:id/slug', authenticate, async (req, res) => {
  const { slug: rawSlug } = req.body;
  if (!rawSlug) return res.status(400).json({ error: 'slug is required' });

  try {
    const { data: chapter, error: chErr } = await supabase
      .from('chapters')
      .select('book_id')
      .eq('id', req.params.id)
      .single();
    if (chErr) throw chErr;

    if (!await canEditBook(chapter.book_id, req.user.id))
      return res.status(403).json({ error: 'Not authorized' });

    const base = generateSlug(rawSlug);
    if (!base) return res.status(400).json({ error: 'Invalid slug' });
    const slug = await uniqueChapterSlug(base, chapter.book_id, req.params.id);

    const { data, error } = await supabase
      .from('chapters')
      .update({ slug })
      .eq('id', req.params.id)
      .select('id, slug')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Patch chapter slug error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/chapters/:chapterId/generate-slug — auto-generate from title
router.post('/books/:bookId/chapters/:chapterId/generate-slug', authenticate, async (req, res) => {
  try {
    const { data: chapter, error: chErr } = await supabase
      .from('chapters')
      .select('title, book_id')
      .eq('id', req.params.chapterId)
      .eq('book_id', req.params.bookId)
      .single();
    if (chErr) throw chErr;

    if (!await canEditBook(req.params.bookId, req.user.id))
      return res.status(403).json({ error: 'Not authorized' });

    const base = generateSlug(chapter.title || 'chapter');
    const slug = await uniqueChapterSlug(base, req.params.bookId, req.params.chapterId);

    const { data, error } = await supabase
      .from('chapters')
      .update({ slug })
      .eq('id', req.params.chapterId)
      .select('id, slug')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Generate chapter slug error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
