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
      if (!req.user?.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Allow collaborators
      const { data: collab } = await supabase
        .schema('bookflow')
        .from('book_collaborators')
        .select('id')
        .eq('book_id', chapter.book_id)
        .eq('user_id', req.user.id)
        .not('invite_accepted_at', 'is', null)
        .maybeSingle();

      if (!collab) {
        // Allow club members whose club has this book
        const { data: clubBooks } = await supabase
          .schema('bookflow')
          .from('club_books')
          .select('club_id')
          .eq('book_id', chapter.book_id);

        const clubIds = (clubBooks || []).map(cb => cb.club_id);
        let isClubMember = false;

        if (clubIds.length > 0) {
          const { data: clubMember } = await supabase
            .schema('bookflow')
            .from('club_members')
            .select('id')
            .eq('user_id', req.user.id)
            .in('club_id', clubIds)
            .not('invite_accepted_at', 'is', null)
            .maybeSingle();
          isClubMember = !!clubMember;
        }

        if (!isClubMember) {
          return res.status(403).json({ error: 'Not authorized' });
        }
      }
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
    position_in_chapter,
    display_mode,
    response_visibility,
  } = req.body;
  // display_mode and position_in_chapter are synonymous — client forms use display_mode
  // 'sidebar' is a client-only display hint, not a DB position — normalize it to 'inline'
  const rawPosition = display_mode || position_in_chapter || 'inline';
  const resolvedPosition = rawPosition === 'sidebar' ? 'inline' : rawPosition;

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
        position_in_chapter: resolvedPosition,
        response_visibility: response_visibility || 'private',
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
  const { content_data, visibility, anchor_text, position_in_chapter, display_mode, start_offset, end_offset, response_visibility, order_index } = req.body;

  try {
    // Check ownership
    const { data: existing, error: existingError } = await supabase
      .from('inline_content')
      .select('created_by, book_id, book:books!inline_content_book_id_fkey(author_id)')
      .eq('id', req.params.id)
      .single();

    if (existingError) throw existingError;

    // Allow update if user is creator, book owner, or accepted collaborator
    const isOwner = existing.book?.author_id === req.user.id;
    const isCreator = existing.created_by === req.user.id;
    let isCollaborator = false;
    if (!isOwner && !isCreator) {
      const { data: collab } = await supabase
        .schema('bookflow')
        .from('book_collaborators')
        .select('id')
        .eq('book_id', existing.book_id)
        .eq('user_id', req.user.id)
        .not('invite_accepted_at', 'is', null)
        .maybeSingle();
      isCollaborator = !!collab;
    }

    if (!isCreator && !isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (content_data !== undefined) updateData.content_data = content_data;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (anchor_text !== undefined) updateData.anchor_text = anchor_text;
    const rawPos = display_mode ?? position_in_chapter;
    if (rawPos !== undefined) updateData.position_in_chapter = rawPos === 'sidebar' ? 'inline' : rawPos;
    if (start_offset !== undefined) updateData.start_offset = start_offset;
    if (end_offset !== undefined) updateData.end_offset = end_offset;
    if (response_visibility !== undefined) updateData.response_visibility = response_visibility;
    if (order_index !== undefined) updateData.order_index = order_index;

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

// Reorder inline content — set a single item's order_index
router.patch('/inline-content/:id/order', authenticate, async (req, res) => {
  const { order_index } = req.body;
  if (order_index === undefined || order_index === null) {
    return res.status(400).json({ error: 'order_index is required' });
  }
  try {
    const { data: existing, error: existingError } = await supabase
      .from('inline_content')
      .select('created_by, book_id, book:books!inline_content_book_id_fkey(author_id)')
      .eq('id', req.params.id)
      .single();
    if (existingError) throw existingError;
    const isOwner = existing.book?.author_id === req.user.id;
    const isCreator = existing.created_by === req.user.id;
    let isCollaborator = false;
    if (!isOwner && !isCreator) {
      const { data: collab } = await supabase
        .schema('bookflow')
        .from('book_collaborators')
        .select('id')
        .eq('book_id', existing.book_id)
        .eq('user_id', req.user.id)
        .not('invite_accepted_at', 'is', null)
        .maybeSingle();
      isCollaborator = !!collab;
    }
    if (!isCreator && !isOwner && !isCollaborator) return res.status(403).json({ error: 'Not authorized' });

    const { error } = await supabase
      .from('inline_content')
      .update({ order_index })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('Reorder inline content error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete inline content
router.delete('/inline-content/:id', authenticate, async (req, res) => {
  try {
    // Check ownership or book author/collaborator
    const { data: existing, error: existingError } = await supabase
      .from('inline_content')
      .select('created_by, book_id, book:books!inline_content_book_id_fkey(author_id)')
      .eq('id', req.params.id)
      .single();

    if (existingError) throw existingError;

    const isOwner = existing.book?.author_id === req.user.id;
    const isCreator = existing.created_by === req.user.id;
    let isCollaborator = false;
    if (!isOwner && !isCreator) {
      const { data: collab } = await supabase
        .schema('bookflow')
        .from('book_collaborators')
        .select('id')
        .eq('book_id', existing.book_id)
        .eq('user_id', req.user.id)
        .not('invite_accepted_at', 'is', null)
        .maybeSingle();
      isCollaborator = !!collab;
    }

    if (!isCreator && !isOwner && !isCollaborator) {
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

async function getMediaResponseContent(contentId) {
  const { data, error } = await supabase
    .from('inline_content')
    .select('id, content_type, content_data, book_id, chapter_id, book:books!inline_content_book_id_fkey(author_id, visibility)')
    .eq('id', contentId)
    .single();
  if (error) throw error;
  if (data.content_type !== 'media_response') {
    const err = new Error('Not a media response prompt');
    err.status = 400;
    throw err;
  }
  return data;
}

async function attachMediaResponseProfiles(rows) {
  const responses = rows || [];
  const userIds = [...new Set(responses.map(row => row.user_id).filter(Boolean))];
  if (userIds.length === 0) return responses;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
  return responses.map(row => ({ ...row, user: profileMap.get(row.user_id) || null }));
}

// List audio/video/text responses for an inline media response prompt
router.get('/inline-content/:id/media-responses', authenticate, async (req, res) => {
  try {
    await getMediaResponseContent(req.params.id);

    const { data, error } = await supabase
      .schema('bookflow')
      .from('media_responses')
      .select('*')
      .eq('inline_content_id', req.params.id)
      .neq('status', 'deleted')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(await attachMediaResponseProfiles(data));
  } catch (err) {
    console.error('List media responses error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Add a reader/author audio, video, or text response
router.post('/inline-content/:id/media-responses', authenticate, async (req, res) => {
  const { response_type, body, media_url, duration_seconds, parent_id } = req.body;

  try {
    const content = await getMediaResponseContent(req.params.id);
    const data = content.content_data || {};
    const allowed = {
      text: data.allow_text !== false,
      audio: data.allow_audio !== false,
      video: data.allow_video !== false,
    };

    if (!['text', 'audio', 'video'].includes(response_type) || !allowed[response_type]) {
      return res.status(400).json({ error: 'This response type is not allowed' });
    }
    if (response_type === 'text' && !String(body || '').trim()) {
      return res.status(400).json({ error: 'Text response is required' });
    }
    if ((response_type === 'audio' || response_type === 'video') && !media_url) {
      return res.status(400).json({ error: 'Media URL is required' });
    }

    const maxPerUser = Math.max(1, Number(data.max_responses_per_user || 1));
    if (!parent_id) {
      const { count, error: countError } = await supabase
        .schema('bookflow')
        .from('media_responses')
        .select('id', { count: 'exact', head: true })
        .eq('inline_content_id', req.params.id)
        .eq('user_id', req.user.id)
        .is('parent_id', null)
        .eq('status', 'active');

      if (countError) throw countError;
      if ((count || 0) >= maxPerUser) {
        return res.status(409).json({ error: `Maximum of ${maxPerUser} response${maxPerUser === 1 ? '' : 's'} reached` });
      }
    }

    const { data: inserted, error } = await supabase
      .schema('bookflow')
      .from('media_responses')
      .insert({
        inline_content_id: req.params.id,
        book_id: content.book_id,
        chapter_id: content.chapter_id,
        user_id: req.user.id,
        parent_id: parent_id || null,
        response_type,
        body: response_type === 'text' ? String(body || '').trim() : (body || null),
        media_url: media_url || null,
        duration_seconds: duration_seconds || null,
      })
      .select()
      .single();

    if (error) throw error;
    const [withProfile] = await attachMediaResponseProfiles([inserted]);
    res.status(201).json(withProfile);
  } catch (err) {
    console.error('Create media response error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Soft-delete own response so readers can re-record
router.delete('/media-responses/:responseId', authenticate, async (req, res) => {
  try {
    const { data: existing, error: existingError } = await supabase
      .schema('bookflow')
      .from('media_responses')
      .select('id, user_id, book_id, book:books!media_responses_book_id_fkey(author_id)')
      .eq('id', req.params.responseId)
      .single();

    if (existingError) throw existingError;
    const isOwner = existing.user_id === req.user.id;
    const isBookAuthor = existing.book?.author_id === req.user.id;
    if (!isOwner && !isBookAuthor) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .schema('bookflow')
      .from('media_responses')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', req.params.responseId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete media response error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Flag/report a bad response and surface it in admin feedback
router.post('/media-responses/:responseId/flag', authenticate, async (req, res) => {
  const { reason } = req.body;

  try {
    const { data: existing, error: existingError } = await supabase
      .schema('bookflow')
      .from('media_responses')
      .select('*')
      .eq('id', req.params.responseId)
      .single();

    if (existingError) throw existingError;

    const { error } = await supabase
      .schema('bookflow')
      .from('media_responses')
      .update({
        status: 'flagged',
        flagged_by: req.user.id,
        flag_reason: reason || null,
        flagged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.responseId);

    if (error) throw error;

    try {
      await supabase.from('feedback').insert({
        user_id: req.user.id,
        type: 'bug',
        title: 'Flagged reader media response',
        description: [
          `Reason: ${reason || 'No reason provided'}`,
          `Response ID: ${existing.id}`,
          `Inline content ID: ${existing.inline_content_id}`,
          `Book ID: ${existing.book_id}`,
          `Chapter ID: ${existing.chapter_id}`,
          `Response type: ${existing.response_type}`,
          existing.media_url ? `Media URL: ${existing.media_url}` : null,
          existing.body ? `Text: ${existing.body}` : null,
        ].filter(Boolean).join('\n'),
      });
    } catch (feedbackError) {
      console.warn('Unable to create feedback record for flagged media response:', feedbackError.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Flag media response error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Vote in poll
router.post('/polls/:id/vote', authenticate, async (req, res) => {
  const { selected_option, visibility } = req.body;

  try {
    // Verify this is a poll
    const { data: content, error: contentError } = await supabase
      .schema('bookflow')
      .from('inline_content')
      .select('content_type, content_data')
      .eq('id', req.params.id)
      .single();

    if (contentError) {
      console.error('[vote] inline_content lookup failed:', contentError.message, contentError.code);
      throw contentError;
    }

    if (content.content_type !== 'poll') {
      return res.status(400).json({ error: 'Not a poll' });
    }

    // Check if option is valid
    const pollOptions = content.content_data.options || [];
    if (!pollOptions.find(o => o.id === selected_option || o.text === selected_option)) {
      console.error('[vote] invalid option:', selected_option, 'available:', pollOptions.map(o => o.id));
      return res.status(400).json({ error: 'Invalid option' });
    }

    const { data, error } = await supabase
      .schema('bookflow')
      .from('poll_responses')
      .upsert({
        inline_content_id: req.params.id,
        user_id: req.user.id,
        selected_option,
        ...(visibility && ['private', 'shared', 'public'].includes(visibility) ? { visibility } : {}),
      }, { onConflict: 'inline_content_id,user_id' })
      .select()
      .single();

    if (error) {
      console.error('[vote] upsert failed:', error.message, error.code, error.details);
      throw error;
    }

    // Get poll results
    const { data: results } = await supabase
      .schema('bookflow')
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
      .schema('bookflow')
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
        .schema('bookflow')
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
  const { answer_text, selected_options, visibility } = req.body;

  try {
    // Verify this is a question
    const { data: content, error: contentError } = await supabase
      .schema('bookflow')
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
      .schema('bookflow')
      .from('question_answers')
      .upsert({
        inline_content_id: req.params.id,
        user_id: req.user.id,
        answer_text,
        selected_options,
        is_correct,
        ...(visibility && ['private', 'shared', 'public'].includes(visibility) ? { visibility } : {}),
        updated_at: new Date().toISOString(),
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

// Get current user's answer for a single question
router.get('/questions/:id/my-answer', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('question_answers')
      .select('answer_text, selected_options, is_correct')
      .eq('inline_content_id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's answers for a book
router.get('/books/:bookId/my-answers', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .schema('bookflow')
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

// ─── E-Signature Routes ────────────────────────────────────────────────────────

// POST /inline-content/:id/signatures — submit a signature
router.post('/inline-content/:id/signatures', authenticate, async (req, res) => {
  try {
    const { signer_name, signature_type, signature_data, visibility } = req.body;
    if (!['drawn', 'typed', 'checkbox'].includes(signature_type)) {
      return res.status(400).json({ error: 'Invalid signature_type' });
    }

    // Verify the inline_content exists and is a signature type
    const { data: ic, error: icErr } = await supabase
      .schema('bookflow')
      .from('inline_content')
      .select('id, book_id, content_type')
      .eq('id', req.params.id)
      .single();
    if (icErr || !ic) return res.status(404).json({ error: 'Content not found' });
    if (ic.content_type !== 'signature') return res.status(400).json({ error: 'Not a signature block' });

    const { error: upsertError } = await supabase
      .schema('bookflow')
      .from('signature_responses')
      .upsert({
        inline_content_id: req.params.id,
        user_id: req.user.id,
        book_id: ic.book_id,
        signer_name: signer_name || null,
        signature_type,
        signature_data: signature_data || null,
        visibility: visibility || 'private',
        agreed_at: new Date().toISOString(),
      }, { onConflict: 'inline_content_id,user_id' });

    if (upsertError) throw upsertError;

    // Re-fetch the row (plain — no FK join to auth.users)
    const { data, error } = await supabase
      .schema('bookflow')
      .from('signature_responses')
      .select('*')
      .eq('inline_content_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;

    // Attach profile manually
    const { data: profile } = await supabase
      .schema('bookflow')
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', req.user.id)
      .maybeSingle();

    res.json({ ...data, user: profile || null });
  } catch (err) {
    console.error('Submit signature error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /inline-content/:id/signatures/mine — get current user's signature
router.get('/inline-content/:id/signatures/mine', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('signature_responses')
      .select('*')
      .eq('inline_content_id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json(null);

    const { data: profile } = await supabase
      .schema('bookflow')
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', req.user.id)
      .maybeSingle();

    res.json({ ...data, user: profile || null });
  } catch (err) {
    console.error('Get my signature error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /inline-content/:id/signatures/all — get all signatures (author only)
router.get('/inline-content/:id/signatures/all', authenticate, async (req, res) => {
  try {
    // Verify author
    const { data: ic } = await supabase
      .schema('bookflow')
      .from('inline_content')
      .select('book_id, book:books(author_id)')
      .eq('id', req.params.id)
      .single();

    if (!ic || ic.book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Author access required' });
    }

    const { data, error } = await supabase
      .schema('bookflow')
      .from('signature_responses')
      .select('*')
      .eq('inline_content_id', req.params.id)
      .order('agreed_at', { ascending: false });

    if (error) throw error;

    // Attach profiles
    const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
    let profileMap = {};
    if (userIds.length) {
      const { data: profiles } = await supabase
        .schema('bookflow')
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });
    }
    const responses = data.map(r => ({ ...r, user: profileMap[r.user_id] || null }));
    res.json({ responses, total: responses.length });
  } catch (err) {
    console.error('Get all signatures error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /inline-content/:id/signatures/mine — retract signature
router.delete('/inline-content/:id/signatures/mine', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .schema('bookflow')
      .from('signature_responses')
      .delete()
      .eq('inline_content_id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete signature error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
