import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Submit or update own rating for a book
router.post('/books/:bookId/rating', authenticate, async (req, res) => {
  const { rating } = req.body;
  const { bookId } = req.params;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be 1–5' });
  }

  try {
    // Verify book exists and user has access
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, visibility, author_id, collaborators:book_collaborators(user_id, invite_accepted_at)')
      .eq('id', bookId)
      .single();

    if (bookError) throw bookError;

    const isBookTeam = book.author_id === req.user.id
      || (book.collaborators || []).some(
          c => c.user_id === req.user.id && c.invite_accepted_at !== null
        );

    // Authors and collaborators cannot rate their own book
    if (isBookTeam) {
      return res.status(403).json({ error: 'Authors cannot rate their own book' });
    }

    if (book.visibility !== 'public') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data, error } = await supabase
      .from('book_ratings')
      .upsert({
        book_id: bookId,
        user_id: req.user.id,
        rating: parseInt(rating),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'book_id,user_id' })
      .select()
      .single();

    if (error) throw error;

    // Return updated aggregate too
    const agg = await getAggregate(bookId);
    res.json({ rating: data, aggregate: agg });
  } catch (err) {
    console.error('Submit rating error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete own rating
router.delete('/books/:bookId/rating', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('book_ratings')
      .delete()
      .eq('book_id', req.params.bookId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    const agg = await getAggregate(req.params.bookId);
    res.json({ aggregate: agg });
  } catch (err) {
    console.error('Delete rating error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get aggregate ratings for a book + current user's rating
router.get('/books/:bookId/ratings', optionalAuth, async (req, res) => {
  try {
    const agg = await getAggregate(req.params.bookId);

    let userRating = null;
    if (req.user) {
      const { data } = await supabase
        .from('book_ratings')
        .select('rating')
        .eq('book_id', req.params.bookId)
        .eq('user_id', req.user.id)
        .maybeSingle();
      userRating = data?.rating ?? null;
    }

    res.json({ ...agg, user_rating: userRating });
  } catch (err) {
    console.error('Get ratings error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function getAggregate(bookId) {
  const { data } = await supabase
    .from('book_ratings')
    .select('rating')
    .eq('book_id', bookId);

  const ratings = data || [];
  const count = ratings.length;
  const average = count > 0
    ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : 0;

  // Distribution 1–5
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratings.forEach(r => { distribution[r.rating] = (distribution[r.rating] || 0) + 1; });

  return { average, count, distribution };
}

export default router;
