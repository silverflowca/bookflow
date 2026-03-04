import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get inline content for a chapter
router.get('/chapters/:chapterId/inline-content', optionalAuth, async (req, res) => {
  const { content_type, author_only } = req.query;

  try {
    // Check chapter access
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('book_id, book:books(author_id, visibility)')
      .eq('id', req.params.chapterId)
      .single();

    if (chapterError) throw chapterError;

    const isAuthor = req.user?.id === chapter.book.author_id;

    if (chapter.book.visibility !== 'public' && !isAuthor) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let query = supabase
      .from('inline_content')
      .select(`
        *,
        creator:profiles!inline_content_created_by_fkey(id, display_name, avatar_url)
      `)
      .eq('chapter_id', req.params.chapterId)
      .order('start_offset', { ascending: true });

    // Filter by content type if specified
    if (content_type) {
      query = query.eq('content_type', content_type);
    }

    // Filter by author content
    if (author_only === 'true') {
      query = query.eq('is_author_content', true);
    }

    // Visibility filtering
    if (req.user) {
      if (isAuthor) {
        // Author sees everything
      } else {
        // Reader sees: their own content + all_readers visibility + author content marked visible
        query = query.or(`created_by.eq.${req.user.id},visibility.eq.all_readers`);
      }
    } else {
      // Unauthenticated: only public author content
      query = query.eq('is_author_content', true).eq('visibility', 'all_readers');
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get inline content error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create inline content
router.post('/chapters/:chapterId/inline-content', authenticate, async (req, res) => {
  const {
    content_type,
    start_offset,
    end_offset,
    anchor_text,
    content_data,
    visibility,
    position_in_chapter
  } = req.body;

  try {
    // Get chapter and book info
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('book_id, book:books(author_id, settings:book_settings(*))')
      .eq('id', req.params.chapterId)
      .single();

    if (chapterError) throw chapterError;

    const isAuthor = req.user.id === chapter.book.author_id;
    const settings = chapter.book.settings;

    // Check permissions for reader-created content
    if (!isAuthor) {
      const typePermissions = {
        highlight: settings?.allow_reader_highlights,
        note: settings?.allow_reader_notes,
        question: settings?.allow_reader_questions,
        poll: settings?.allow_reader_polls,
        audio: settings?.allow_reader_audio,
        video: settings?.allow_reader_video,
        link: settings?.allow_reader_links
      };

      // If permission is explicitly false, deny; if undefined, allow (default permissive)
      if (typePermissions[content_type] === false) {
        return res.status(403).json({
          error: `Readers cannot add ${content_type}s to this book`
        });
      }
    }

    const { data, error } = await supabase
      .from('inline_content')
      .insert({
        book_id: chapter.book_id,
        chapter_id: req.params.chapterId,
        content_type,
        start_offset,
        end_offset,
        anchor_text,
        content_data,
        created_by: req.user.id,
        is_author_content: isAuthor,
        visibility: isAuthor ? (visibility || 'all_readers') : (visibility || 'private'),
        position_in_chapter: position_in_chapter || 'inline'
      })
      .select(`
        *,
        creator:profiles!inline_content_created_by_fkey(id, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('Create inline content error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update inline content
router.put('/inline-content/:id', authenticate, async (req, res) => {
  const { content_data, visibility, anchor_text, position_in_chapter, start_offset, end_offset } = req.body;

  try {
    // Check ownership
    const { data: existing, error: existingError } = await supabase
      .from('inline_content')
      .select('created_by, book:books!inline_content_book_id_fkey(author_id)')
      .eq('id', req.params.id)
      .single();

    if (existingError) throw existingError;

    // Allow update if user is creator or book author
    const isAuthor = existing.book?.author_id === req.user.id;
    const isCreator = existing.created_by === req.user.id;

    if (!isCreator && !isAuthor) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (content_data !== undefined) updateData.content_data = content_data;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (anchor_text !== undefined) updateData.anchor_text = anchor_text;
    if (position_in_chapter !== undefined) updateData.position_in_chapter = position_in_chapter;
    if (start_offset !== undefined) updateData.start_offset = start_offset;
    if (end_offset !== undefined) updateData.end_offset = end_offset;

    const { data, error } = await supabase
      .from('inline_content')
      .update(updateData)
      .eq('id', req.params.id)
      .select(`
        *,
        creator:profiles!inline_content_created_by_fkey(id, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Update inline content error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete inline content
router.delete('/inline-content/:id', authenticate, async (req, res) => {
  try {
    // Check ownership or book author
    const { data: existing, error: existingError } = await supabase
      .from('inline_content')
      .select('created_by, book:books!inline_content_book_id_fkey(author_id)')
      .eq('id', req.params.id)
      .single();

    if (existingError) throw existingError;

    const isAuthor = existing.book?.author_id === req.user.id;
    const isCreator = existing.created_by === req.user.id;

    if (!isCreator && !isAuthor) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('inline_content')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete inline content error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Vote in poll
router.post('/polls/:id/vote', authenticate, async (req, res) => {
  const { selected_option } = req.body;

  try {
    // Verify this is a poll
    const { data: content, error: contentError } = await supabase
      .from('inline_content')
      .select('content_type, content_data')
      .eq('id', req.params.id)
      .single();

    if (contentError) throw contentError;

    if (content.content_type !== 'poll') {
      return res.status(400).json({ error: 'Not a poll' });
    }

    // Check if option is valid
    const options = content.content_data.options || [];
    if (!options.find(o => o.id === selected_option || o.text === selected_option)) {
      return res.status(400).json({ error: 'Invalid option' });
    }

    const { data, error } = await supabase
      .from('poll_responses')
      .upsert({
        inline_content_id: req.params.id,
        user_id: req.user.id,
        selected_option
      }, { onConflict: 'inline_content_id,user_id' })
      .select()
      .single();

    if (error) throw error;

    // Get poll results
    const { data: results } = await supabase
      .from('poll_responses')
      .select('selected_option')
      .eq('inline_content_id', req.params.id);

    const counts = {};
    results?.forEach(r => {
      counts[r.selected_option] = (counts[r.selected_option] || 0) + 1;
    });

    res.json({
      vote: data,
      results: counts,
      total_votes: results?.length || 0
    });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get poll results
router.get('/polls/:id/results', optionalAuth, async (req, res) => {
  try {
    const { data: results } = await supabase
      .from('poll_responses')
      .select('selected_option')
      .eq('inline_content_id', req.params.id);

    const counts = {};
    results?.forEach(r => {
      counts[r.selected_option] = (counts[r.selected_option] || 0) + 1;
    });

    // Get user's vote if authenticated
    let userVote = null;
    if (req.user) {
      const { data: vote } = await supabase
        .from('poll_responses')
        .select('selected_option')
        .eq('inline_content_id', req.params.id)
        .eq('user_id', req.user.id)
        .single();
      userVote = vote?.selected_option;
    }

    res.json({
      results: counts,
      total_votes: results?.length || 0,
      user_vote: userVote
    });
  } catch (err) {
    console.error('Get poll results error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Answer question
router.post('/questions/:id/answer', authenticate, async (req, res) => {
  const { answer_text, selected_options } = req.body;

  try {
    // Verify this is a question
    const { data: content, error: contentError } = await supabase
      .from('inline_content')
      .select('content_type, content_data')
      .eq('id', req.params.id)
      .single();

    if (contentError) throw contentError;

    if (content.content_type !== 'question') {
      return res.status(400).json({ error: 'Not a question' });
    }

    // Check if answer is correct (for quiz questions)
    let is_correct = null;
    if (content.content_data.correct_answer) {
      if (selected_options) {
        is_correct = JSON.stringify(selected_options.sort()) ===
          JSON.stringify(content.content_data.correct_answer.sort());
      } else if (answer_text) {
        is_correct = answer_text.toLowerCase().trim() ===
          content.content_data.correct_answer.toLowerCase().trim();
      }
    }

    const { data, error } = await supabase
      .from('question_answers')
      .upsert({
        inline_content_id: req.params.id,
        user_id: req.user.id,
        answer_text,
        selected_options,
        is_correct
      }, { onConflict: 'inline_content_id,user_id' })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Answer question error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user's answers for a book
router.get('/books/:bookId/my-answers', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('question_answers')
      .select(`
        *,
        inline_content:inline_content_id(id, chapter_id, content_type, content_data, anchor_text)
      `)
      .eq('user_id', req.user.id)
      .eq('inline_content.book_id', req.params.bookId);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get answers error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
