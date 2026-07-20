import express from 'express';
import supabase from '../config/supabase.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/book-landing/:slug — public book landing page data
// No auth required for public books; private books return 401 so client can redirect to login
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    // Look up by slug OR by book ID (UUID) so QR codes pointing to /book-landing/:id also work
    let query = supabase
      .from('books')
      .select(`
        id, title, subtitle, description, cover_image_url,
        status, visibility, published_at, slug, share_token,
        author:profiles(id, display_name, avatar_url),
        settings:book_settings(
          enable_progress_tracking, show_ratings,
          allow_reader_highlights, enable_chapter_qr_codes
        ),
        chapters(id, title, slug, order_index, status, word_count, estimated_read_time_minutes)
      `);

    // UUID pattern check
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.slug);
    if (isUuid) {
      query = query.eq('id', req.params.slug);
    } else {
      query = query.eq('slug', req.params.slug);
    }

    const { data: book, error } = await query.single();

    if (error || !book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const isOwner = req.user && book.author?.id === req.user.id;

    // Non-published books: only the author can access via landing route
    if (book.status !== 'published' && !isOwner) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Private book — only return if user is authenticated (author or collaborator)
    if (book.visibility !== 'public' && !isOwner) {
      if (!req.user) {
        return res.status(401).json({ error: 'Login required', book_id: book.id });
      }
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Sort chapters — owner sees all, public sees only published
    const chapters = (book.chapters || [])
      .filter(c => isOwner || c.status === 'published')
      .sort((a, b) => a.order_index - b.order_index);

    // Check if book is in any clubs (club_required indicator)
    const { data: clubBooks } = await supabase
      .from('club_books')
      .select('club_id')
      .eq('book_id', book.id)
      .limit(1);
    const in_club = (clubBooks || []).length > 0;

    res.json({
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      description: book.description,
      cover_image_url: book.cover_image_url,
      visibility: book.visibility,
      published_at: book.published_at,
      slug: book.slug,
      in_club,
      author: book.author,
      settings: book.settings,
      chapters,
    });
  } catch (err) {
    console.error('Book landing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/book-landing/:bookId/slug — update book slug (auth required, owner only)
router.patch('/:bookId/slug', optionalAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Login required' });
  const { slug: rawSlug } = req.body;
  if (!rawSlug) return res.status(400).json({ error: 'slug is required' });

  try {
    const { data: book, error: bookErr } = await supabase
      .from('books')
      .select('id, author_id')
      .eq('id', req.params.bookId)
      .single();
    if (bookErr || !book) return res.status(404).json({ error: 'Book not found' });
    if (book.author_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const base = rawSlug.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80);
    if (!base) return res.status(400).json({ error: 'Invalid slug' });

    // Check uniqueness
    let slug = base;
    let attempt = 0;
    while (true) {
      const { data: existing } = await supabase.from('books').select('id').eq('slug', slug).neq('id', req.params.bookId).maybeSingle();
      if (!existing) break;
      attempt++;
      slug = `${base}-${attempt}`;
    }

    const { data, error } = await supabase
      .from('books')
      .update({ slug })
      .eq('id', req.params.bookId)
      .select('id, slug')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Patch book slug error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
