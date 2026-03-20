import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { buildSnapshot } from './versions.js';

const router = express.Router({ mergeParams: true });

// GET /api/books/:bookId/reviews
router.get('/', authenticate, requireRole(['owner', 'author', 'editor', 'reviewer']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('review_requests')
      .select(`
        id, status, message, submitted_at, reviewed_at, reviewer_note,
        submitter:profiles!review_requests_submitted_by_fkey(id, display_name, avatar_url),
        reviewer:profiles!review_requests_reviewed_by_fkey(id, display_name, avatar_url),
        version:book_versions(id, version_number, label)
      `)
      .eq('book_id', req.params.bookId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/reviews — submit for review
router.post('/', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  const { message } = req.body;
  const bookId = req.params.bookId;

  try {
    // Cannot submit if already pending
    const { data: existing } = await supabase
      .from('review_requests')
      .select('id')
      .eq('book_id', bookId)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return res.status(409).json({ error: 'A review is already pending for this book' });
    }

    // Create a version snapshot
    const snapshot = await buildSnapshot(bookId);
    const { data: version } = await supabase
      .from('book_versions')
      .insert({
        book_id: bookId,
        version_number: 0,
        label: 'Submitted for review',
        snapshot,
        created_by: req.user.id,
        trigger: 'submit_review',
      })
      .select('id')
      .single();

    // Create the review request
    const { data: review, error } = await supabase
      .from('review_requests')
      .insert({
        book_id: bookId,
        version_id: version?.id || null,
        submitted_by: req.user.id,
        message: message || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update book review_status
    await supabase
      .from('books')
      .update({ review_status: 'pending' })
      .eq('id', bookId);

    // Notify all reviewers
    const { data: reviewers } = await supabase
      .from('book_collaborators')
      .select('user_id')
      .eq('book_id', bookId)
      .eq('role', 'reviewer')
      .not('invite_accepted_at', 'is', null)
      .not('user_id', 'is', null);

    const { data: book } = await supabase
      .from('books')
      .select('title, author_id')
      .eq('id', bookId)
      .single();

    // Also notify book owner if submitter is not owner
    const notifyUsers = [
      ...(reviewers || []).map(r => r.user_id),
    ];
    if (book?.author_id !== req.user.id) notifyUsers.push(book?.author_id);

    for (const userId of notifyUsers.filter(Boolean)) {
      await supabase.from('user_notifications').insert({
        user_id: userId,
        type: 'review_submitted',
        title: `Review requested: "${book?.title}"`,
        body: message?.substring(0, 120) || 'A new review has been submitted.',
        book_id: bookId,
        review_request_id: review.id,
      });
    }

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/books/:bookId/reviews/:reviewId — approve or reject
router.put('/:reviewId', authenticate, requireRole(['owner', 'reviewer']), async (req, res) => {
  const { status, reviewer_note } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }

  try {
    const { data: review, error: fetchErr } = await supabase
      .from('review_requests')
      .select('id, submitted_by, book_id, status')
      .eq('id', req.params.reviewId)
      .eq('book_id', req.params.bookId)
      .single();

    if (fetchErr || !review) return res.status(404).json({ error: 'Review not found' });
    if (review.status !== 'pending') return res.status(409).json({ error: 'Review is no longer pending' });

    const { data: updated, error } = await supabase
      .from('review_requests')
      .update({
        status,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        reviewer_note: reviewer_note || null,
      })
      .eq('id', req.params.reviewId)
      .select()
      .single();

    if (error) throw error;

    // Update book review_status
    await supabase
      .from('books')
      .update({ review_status: status })
      .eq('id', req.params.bookId);

    // Notify submitter
    const { data: book } = await supabase
      .from('books')
      .select('title')
      .eq('id', req.params.bookId)
      .single();

    await supabase.from('user_notifications').insert({
      user_id: review.submitted_by,
      type: status === 'approved' ? 'review_approved' : 'review_rejected',
      title: `Review ${status}: "${book?.title}"`,
      body: reviewer_note?.substring(0, 120) || null,
      book_id: req.params.bookId,
      review_request_id: review.id,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/books/:bookId/reviews/:reviewId — cancel (submitter only)
router.delete('/:reviewId', authenticate, async (req, res) => {
  try {
    const { data: review } = await supabase
      .from('review_requests')
      .select('submitted_by, status')
      .eq('id', req.params.reviewId)
      .eq('book_id', req.params.bookId)
      .single();

    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.submitted_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the submitter can cancel a review' });
    }
    if (review.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending reviews can be cancelled' });
    }

    await supabase
      .from('review_requests')
      .update({ status: 'cancelled' })
      .eq('id', req.params.reviewId);

    await supabase
      .from('books')
      .update({ review_status: 'none' })
      .eq('id', req.params.bookId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
