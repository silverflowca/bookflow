/**
 * Saved Books routes — authenticated users only.
 *
 * GET    /api/saved-books          — list all saved books for current user
 * GET    /api/saved-books/count    — count of saved books (for badge)
 * POST   /api/saved-books/:bookId  — save a book
 * DELETE /api/saved-books/:bookId  — unsave a book
 */

import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

/** List all saved books with book details */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('saved_books')
      .select(`
        id, saved_at,
        book:books!saved_books_book_id_fkey(
          id, title, subtitle, cover_image_url, status, visibility,
          author:profiles!books_author_id_fkey(id, display_name)
        )
      `)
      .eq('user_id', req.user.id)
      .order('saved_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Get saved books error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** Count of saved books */
router.get('/count', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('saved_books')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ count: count ?? 0 });
  } catch (err) {
    res.json({ count: 0 });
  }
});

/** Save a book */
router.post('/:bookId', async (req, res) => {
  const { bookId } = req.params;
  try {
    const { data, error } = await supabase
      .from('saved_books')
      .upsert({ user_id: req.user.id, book_id: bookId }, { onConflict: 'user_id,book_id' })
      .select('id, saved_at')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Save book error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** Unsave a book */
router.delete('/:bookId', async (req, res) => {
  const { bookId } = req.params;
  try {
    const { error } = await supabase
      .from('saved_books')
      .delete()
      .eq('user_id', req.user.id)
      .eq('book_id', bookId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('Unsave book error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
