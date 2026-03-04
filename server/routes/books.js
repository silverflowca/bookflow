import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate, optionalAuth, requireAuthor } from '../middleware/auth.js';

const router = express.Router();

// Get all books (public + own)
router.get('/', optionalAuth, async (req, res) => {
  const { status, visibility, author_id, limit = 50, offset = 0 } = req.query;

  try {
    let query = supabase
      .from('books')
      .select(`
        *,
        author:profiles!books_author_id_fkey(id, display_name, avatar_url),
        chapters:chapters(count)
      `, { count: 'exact' });

    // Filter by visibility
    if (req.user) {
      query = query.or(`visibility.eq.public,author_id.eq.${req.user.id}`);
    } else {
      query = query.eq('visibility', 'public');
    }

    if (status) query = query.eq('status', status);
    if (visibility) query = query.eq('visibility', visibility);
    if (author_id) query = query.eq('author_id', author_id);

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ data, count });
  } catch (err) {
    console.error('Get books error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get my books (author)
router.get('/my', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('books')
      .select(`
        *,
        chapters:chapters(count),
        settings:book_settings(*)
      `)
      .eq('author_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get my books error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single book
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { data: book, error } = await supabase
      .from('books')
      .select(`
        *,
        author:profiles!books_author_id_fkey(id, display_name, avatar_url, bio),
        chapters:chapters(id, title, order_index, status, word_count, estimated_read_time_minutes),
        settings:book_settings(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Check visibility
    if (book.visibility !== 'public' && book.author_id !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized to view this book' });
    }

    // Sort chapters by order
    book.chapters = book.chapters.sort((a, b) => a.order_index - b.order_index);

    res.json(book);
  } catch (err) {
    console.error('Get book error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create book
router.post('/', authenticate, async (req, res) => {
  const { title, subtitle, description, cover_image_url, visibility } = req.body;

  try {
    // Update user as author if not already
    await supabase
      .from('profiles')
      .update({ is_author: true })
      .eq('id', req.user.id);

    const { data: book, error } = await supabase
      .from('books')
      .insert({
        title,
        subtitle,
        description,
        cover_image_url,
        visibility: visibility || 'private',
        author_id: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(book);
  } catch (err) {
    console.error('Create book error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update book
router.put('/:id', authenticate, requireAuthor, async (req, res) => {
  const { title, subtitle, description, cover_image_url, status, visibility } = req.body;

  try {
    const updateData = {
      title,
      subtitle,
      description,
      cover_image_url,
      status,
      visibility
    };

    // Set published_at when publishing
    if (status === 'published') {
      const { data: current } = await supabase
        .from('books')
        .select('published_at')
        .eq('id', req.params.id)
        .single();

      if (!current?.published_at) {
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data: book, error } = await supabase
      .from('books')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(book);
  } catch (err) {
    console.error('Update book error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update book settings
router.put('/:id/settings', authenticate, requireAuthor, async (req, res) => {
  const {
    allow_reader_highlights,
    allow_reader_notes,
    allow_reader_questions,
    allow_reader_polls,
    show_author_highlights,
    show_author_notes
  } = req.body;

  try {
    const { data: settings, error } = await supabase
      .from('book_settings')
      .update({
        allow_reader_highlights,
        allow_reader_notes,
        allow_reader_questions,
        allow_reader_polls,
        show_author_highlights,
        show_author_notes
      })
      .eq('book_id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(settings);
  } catch (err) {
    console.error('Update book settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete book
router.delete('/:id', authenticate, requireAuthor, async (req, res) => {
  try {
    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete book error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get reading progress
router.get('/:id/progress', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('*')
      .eq('book_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json(data || null);
  } catch (err) {
    console.error('Get progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update reading progress
router.put('/:id/progress', authenticate, async (req, res) => {
  const { current_chapter_id, scroll_position, percent_complete } = req.body;

  try {
    const progressData = {
      user_id: req.user.id,
      book_id: req.params.id,
      current_chapter_id,
      scroll_position,
      percent_complete,
      last_read_at: new Date().toISOString()
    };

    // Set completed_at if 100%
    if (percent_complete >= 100) {
      progressData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('reading_progress')
      .upsert(progressData, { onConflict: 'user_id,book_id' })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Update progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
