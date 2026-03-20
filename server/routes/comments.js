import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// Helper: get book_id from chapter
async function getBookIdForChapter(chapterId) {
  const { data } = await supabase
    .from('chapters')
    .select('book_id')
    .eq('id', chapterId)
    .single();
  return data?.book_id;
}

// Helper: check if user is a member of a book
async function isBookMember(bookId, userId) {
  const { data: book } = await supabase
    .from('books')
    .select('author_id')
    .eq('id', bookId)
    .single();
  if (book?.author_id === userId) return true;

  const { data: collab } = await supabase
    .from('book_collaborators')
    .select('id')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .not('invite_accepted_at', 'is', null)
    .single();
  return !!collab;
}

// GET /api/chapters/:chapterId/comments
router.get('/', authenticate, async (req, res) => {
  try {
    const bookId = await getBookIdForChapter(req.params.chapterId);
    if (!bookId) return res.status(404).json({ error: 'Chapter not found' });

    const member = await isBookMember(bookId, req.user.id);
    if (!member) return res.status(403).json({ error: 'Not a collaborator on this book' });

    const { data, error } = await supabase
      .from('book_comments')
      .select(`
        id, body, selection_start, selection_end, anchor_text, status,
        resolved_at, created_at, updated_at, parent_id,
        author:profiles!book_comments_author_id_fkey(id, display_name, avatar_url),
        resolver:profiles!book_comments_resolved_by_fkey(id, display_name)
      `)
      .eq('chapter_id', req.params.chapterId)
      .is('parent_id', null)  // top-level only; replies fetched separately or nested
      .order('created_at');

    if (error) throw error;

    // Attach replies
    const commentIds = data.map(c => c.id);
    let replies = [];
    if (commentIds.length > 0) {
      const { data: replyData } = await supabase
        .from('book_comments')
        .select(`
          id, body, parent_id, created_at, updated_at,
          author:profiles!book_comments_author_id_fkey(id, display_name, avatar_url)
        `)
        .in('parent_id', commentIds)
        .order('created_at');
      replies = replyData || [];
    }

    const withReplies = data.map(c => ({
      ...c,
      replies: replies.filter(r => r.parent_id === c.id),
    }));

    res.json(withReplies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chapters/:chapterId/comments — create comment or reply
router.post('/', authenticate, async (req, res) => {
  const { body, selection_start, selection_end, anchor_text, parent_id } = req.body;

  if (!body?.trim()) return res.status(400).json({ error: 'Comment body required' });

  try {
    const bookId = await getBookIdForChapter(req.params.chapterId);
    if (!bookId) return res.status(404).json({ error: 'Chapter not found' });

    const member = await isBookMember(bookId, req.user.id);
    if (!member) return res.status(403).json({ error: 'Not a collaborator on this book' });

    const { data, error } = await supabase
      .from('book_comments')
      .insert({
        book_id: bookId,
        chapter_id: req.params.chapterId,
        parent_id: parent_id || null,
        author_id: req.user.id,
        body: body.trim(),
        selection_start: selection_start ?? null,
        selection_end: selection_end ?? null,
        anchor_text: anchor_text || null,
      })
      .select(`
        id, body, selection_start, selection_end, anchor_text, status, created_at, parent_id,
        author:profiles!book_comments_author_id_fkey(id, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Notify book owner of new comment (if not self)
    const { data: book } = await supabase
      .from('books')
      .select('author_id, title')
      .eq('id', bookId)
      .single();

    if (book && book.author_id !== req.user.id) {
      await supabase.from('user_notifications').insert({
        user_id: book.author_id,
        type: parent_id ? 'comment_reply' : 'comment',
        title: parent_id ? 'New reply to a comment' : `New comment on "${book.title}"`,
        body: body.substring(0, 120),
        book_id: bookId,
        chapter_id: req.params.chapterId,
        comment_id: data.id,
      });
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/comments/:commentId — edit own comment
router.put('/:commentId', authenticate, async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });

  try {
    const { data, error } = await supabase
      .from('book_comments')
      .update({ body: body.trim() })
      .eq('id', req.params.commentId)
      .eq('author_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(403).json({ error: 'Not your comment' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/comments/:commentId
router.delete('/:commentId', authenticate, async (req, res) => {
  try {
    const { data: comment } = await supabase
      .from('book_comments')
      .select('author_id, book_id')
      .eq('id', req.params.commentId)
      .single();

    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Allow author of comment OR book owner
    const isAuthor = comment.author_id === req.user.id;
    const { data: book } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', comment.book_id)
      .single();
    const isBookOwner = book?.author_id === req.user.id;

    if (!isAuthor && !isBookOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('book_comments')
      .delete()
      .eq('id', req.params.commentId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/comments/:commentId/resolve
router.post('/:commentId/resolve', authenticate, async (req, res) => {
  const { status = 'resolved' } = req.body;

  try {
    const { data: comment } = await supabase
      .from('book_comments')
      .select('book_id')
      .eq('id', req.params.commentId)
      .single();

    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Owner or editor can resolve
    const { data: book } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', comment.book_id)
      .single();
    const isOwner = book?.author_id === req.user.id;

    const { data: collab } = await supabase
      .from('book_collaborators')
      .select('role')
      .eq('book_id', comment.book_id)
      .eq('user_id', req.user.id)
      .not('invite_accepted_at', 'is', null)
      .single();
    const canResolve = isOwner || collab?.role === 'editor' || collab?.role === 'author';

    if (!canResolve) return res.status(403).json({ error: 'Not authorized to resolve comments' });

    const { data, error } = await supabase
      .from('book_comments')
      .update({
        status,
        resolved_by: req.user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', req.params.commentId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
