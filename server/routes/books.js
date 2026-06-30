import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate, optionalAuth, requireAuthor } from '../middleware/auth.js';
import { postCompletionUpdate } from '../services/chat-status.js';

const router = express.Router();

function normalizeOne(value) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function getBookResponseContext(bookId, viewerId) {
  const { data: book, error: bookErr } = await supabase
    .schema('bookflow')
    .from('books')
    .select('id, author_id, visibility')
    .eq('id', bookId)
    .single();

  if (bookErr) throw bookErr;

  const viewerIsAuthor = !!viewerId && book.author_id === viewerId;

  const { data: clubBookRows } = await supabase
    .schema('bookflow')
    .from('club_books')
    .select('club_id')
    .eq('book_id', bookId);

  const clubIds = [...new Set((clubBookRows || []).map(row => row.club_id).filter(Boolean))];

  let clubs = [];
  let clubMembers = [];
  if (clubIds.length) {
    const [{ data: clubRows }, { data: memberRows }] = await Promise.all([
      supabase
        .schema('bookflow')
        .from('book_clubs')
        .select('id, name, club_type')
        .in('id', clubIds),
      supabase
        .schema('bookflow')
        .from('club_members')
        .select('club_id, user_id, invite_accepted_at')
        .in('club_id', clubIds)
        .not('invite_accepted_at', 'is', null),
    ]);
    clubs = clubRows || [];
    clubMembers = memberRows || [];
  }

  const { data: shareRows } = await supabase
    .schema('bookflow')
    .from('book_shares')
    .select('user_id, profile:profiles!book_shares_user_id_fkey(id, display_name, avatar_url)')
    .eq('book_id', bookId);

  const sharedUsers = (shareRows || [])
    .map(row => {
      const profile = normalizeOne(row.profile);
      return profile
        ? { id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url ?? null }
        : null;
    })
    .filter(Boolean);

  const clubMetaById = new Map(clubs.map(club => [club.id, club]));
  const clubsByUser = new Map();
  for (const member of clubMembers) {
    const club = clubMetaById.get(member.club_id);
    if (!club) continue;
    const current = clubsByUser.get(member.user_id) || [];
    current.push(club);
    clubsByUser.set(member.user_id, current);
  }

  const sharedUserIds = new Set(sharedUsers.map(user => user.id));
  const viewerClubIds = new Set((clubsByUser.get(viewerId) || []).map(club => club.id));
  const viewerHasDirectShare = !!viewerId && sharedUserIds.has(viewerId);

  const canAccess = viewerIsAuthor
    || book.visibility === 'public'
    || (!!viewerId && (viewerHasDirectShare || viewerClubIds.size > 0));

  return {
    book,
    canAccess,
    viewerId,
    viewerIsAuthor,
    clubsByUser,
    sharedUsers,
    sharedUserIds,
    viewerClubIds,
    viewerHasDirectShare,
  };
}

function canViewerSeeResponse(responseVisibility, respondentId, context) {
  if (context.viewerIsAuthor) return true;
  if (context.viewerId && respondentId === context.viewerId) return true;

  if (responseVisibility === 'private') return false;
  if (responseVisibility === 'public') return context.canAccess;
  if (!context.viewerId) return false;

  const respondentClubs = context.clubsByUser.get(respondentId) || [];
  const sameClub = respondentClubs.some(club => context.viewerClubIds.has(club.id));
  const directShareChannel = context.viewerHasDirectShare && context.sharedUserIds.has(respondentId);

  return sameClub || directShareChannel;
}

function withResponseMeta(response, context) {
  const respondentId = response.user_id;
  const club_contexts = (context.clubsByUser.get(respondentId) || []).map(club => ({
    id: club.id,
    name: club.name,
    club_type: club.club_type,
  }));
  const shared_with_users = context.sharedUserIds.has(respondentId)
    ? context.sharedUsers.filter(user => user.id !== respondentId)
    : [];

  return {
    ...response,
    visibility: response.visibility || 'shared',
    club_contexts,
    shared_with_users,
  };
}

async function buildBookResponses(bookId, { chapterId = null, viewerId = null, authorMode = false } = {}) {
  const context = await getBookResponseContext(bookId, viewerId);
  if (!authorMode && !context.canAccess) {
    return { forbidden: true, items: [] };
  }

  let icQuery = supabase
    .schema('bookflow')
    .from('inline_content')
    .select('id, content_type, content_data, anchor_text, position_in_chapter, order_index, chapter_id, created_by, is_author_content, creator:profiles!inline_content_created_by_fkey(id, display_name, avatar_url), chapters(title, order_index)')
    .eq('book_id', bookId)
    .order('order_index', { ascending: true });

  if (chapterId) icQuery = icQuery.eq('chapter_id', chapterId);

  const { data: items, error: icErr } = await icQuery;
  if (icErr) throw icErr;
  if (!items?.length) return { forbidden: false, items: [] };

  const formIds = items.filter(i => ['select', 'multiselect', 'radio', 'checkbox', 'textbox', 'textarea'].includes(i.content_type)).map(i => i.id);
  const pollIds = items.filter(i => i.content_type === 'poll').map(i => i.id);
  const questionIds = items.filter(i => i.content_type === 'question').map(i => i.id);

  const [frsRes, prsRes, qasRes] = await Promise.all([
    formIds.length
      ? supabase
          .schema('bookflow')
          .from('form_responses')
          .select('inline_content_id, id, user_id, response_data, updated_at, visibility, user:profiles!form_responses_user_id_fkey(id, display_name, avatar_url)')
          .in('inline_content_id', formIds)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    pollIds.length
      ? supabase
          .schema('bookflow')
          .from('poll_responses')
          .select('inline_content_id, id, user_id, selected_option, created_at, visibility, user:profiles!poll_responses_user_id_fkey(id, display_name, avatar_url)')
          .in('inline_content_id', pollIds)
      : Promise.resolve({ data: [] }),
    questionIds.length
      ? supabase
          .schema('bookflow')
          .from('question_answers')
          .select('inline_content_id, id, user_id, answer_text, selected_options, is_correct, created_at, visibility, user:profiles!question_answers_user_id_fkey(id, display_name, avatar_url)')
          .in('inline_content_id', questionIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const formResponsesByItem = {};
  for (const row of (frsRes.data || [])) {
    if (!authorMode && !canViewerSeeResponse(row.visibility || 'shared', row.user_id, context)) continue;
    const enriched = withResponseMeta(row, context);
    if (!formResponsesByItem[row.inline_content_id]) formResponsesByItem[row.inline_content_id] = [];
    formResponsesByItem[row.inline_content_id].push(enriched);
  }

  const pollResponsesByItem = {};
  for (const row of (prsRes.data || [])) {
    if (!authorMode && !canViewerSeeResponse(row.visibility || 'shared', row.user_id, context)) continue;
    const enriched = withResponseMeta(row, context);
    if (!pollResponsesByItem[row.inline_content_id]) pollResponsesByItem[row.inline_content_id] = [];
    pollResponsesByItem[row.inline_content_id].push(enriched);
  }

  const questionAnswersByItem = {};
  for (const row of (qasRes.data || [])) {
    if (!authorMode && !canViewerSeeResponse(row.visibility || 'shared', row.user_id, context)) continue;
    const enriched = withResponseMeta(row, context);
    if (!questionAnswersByItem[row.inline_content_id]) questionAnswersByItem[row.inline_content_id] = [];
    questionAnswersByItem[row.inline_content_id].push(enriched);
  }

  const choiceTypes = ['select', 'multiselect', 'radio', 'checkbox'];
  const result = items.map(item => {
    const chap = normalizeOne(item.chapters) || {};
    let responses = [];
    let aggregates = null;
    let total = 0;

    if (item.content_type === 'poll') {
      const prs = pollResponsesByItem[item.id] || [];
      total = prs.length;
      responses = prs;
      const options = item.content_data?.options || [];
      const counts = {};
      options.forEach(option => { counts[option.id] = 0; });
      prs.forEach(response => {
        if (counts[response.selected_option] !== undefined) counts[response.selected_option]++;
      });
      aggregates = {
        counts,
        total,
        options: options.map(option => ({
          id: option.id,
          text: option.text,
          count: counts[option.id] || 0,
          percent: total > 0 ? Math.round(((counts[option.id] || 0) / total) * 100) : 0,
        })),
      };
    } else if (item.content_type === 'question') {
      responses = questionAnswersByItem[item.id] || [];
      total = responses.length;
    } else if (choiceTypes.includes(item.content_type)) {
      const frs = formResponsesByItem[item.id] || [];
      total = frs.length;
      responses = frs;
      const options = item.content_data?.options || [];
      const counts = {};
      options.forEach(option => { counts[option.id] = 0; });
      frs.forEach(response => {
        const value = response.response_data?.value;
        if (!value) return;
        if (Array.isArray(value)) value.forEach(v => { if (counts[v] !== undefined) counts[v]++; });
        else if (counts[value] !== undefined) counts[value]++;
      });
      aggregates = {
        counts,
        total,
        options: options.map(option => ({
          id: option.id,
          text: option.text,
          count: counts[option.id] || 0,
          percent: total > 0 ? Math.round(((counts[option.id] || 0) / total) * 100) : 0,
        })),
      };
    } else {
      responses = formResponsesByItem[item.id] || [];
      total = responses.length;
    }

    return {
      id: item.id,
      content_type: item.content_type,
      content_data: item.content_data,
      anchor_text: item.anchor_text ?? null,
      created_by: item.created_by ?? null,
      is_author_content: item.is_author_content !== false,
      creator: normalizeOne(item.creator),
      position_in_chapter: item.position_in_chapter,
      order_index: item.order_index,
      chapter_id: item.chapter_id,
      chapter_title: chap.title || '',
      chapter_order: chap.order_index ?? 0,
      total,
      responses,
      aggregates,
    };
  });

  result.sort((a, b) => a.chapter_order - b.chapter_order || (a.order_index ?? 0) - (b.order_index ?? 0));
  return { forbidden: false, items: result };
}

// Get all books (public + own)
router.get('/', optionalAuth, async (req, res) => {
  const { status, visibility, author_id, search, limit = 50, offset = 0 } = req.query;

  try {
    let query = supabase
      .from('books')
      .select(`
        *,
        author:profiles!books_author_id_fkey(id, display_name, avatar_url),
        chapters:chapters(count),
        settings:book_settings(show_ratings)
      `, { count: 'exact' });

    // Filter by visibility
    if (req.user) {
      query = query.or(`visibility.eq.public,author_id.eq.${req.user.id}`);
    } else {
      query = query.eq('visibility', 'public');
    }

    // Never show archived books to regular users
    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.neq('status', 'archived');
    }
    if (visibility) query = query.eq('visibility', visibility);
    if (author_id) query = query.eq('author_id', author_id);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const books = data || [];

    // Fetch rating aggregates for all returned books in one query
    let ratingsMap = {};
    if (books.length > 0) {
      const bookIds = books.map(b => b.id);
      const { data: allRatings } = await supabase
        .from('book_ratings')
        .select('book_id, rating')
        .in('book_id', bookIds);

      if (allRatings) {
        const grouped = {};
        for (const r of allRatings) {
          if (!grouped[r.book_id]) grouped[r.book_id] = [];
          grouped[r.book_id].push(r.rating);
        }
        for (const [bookId, ratings] of Object.entries(grouped)) {
          const ratingCount = ratings.length;
          const ratingAverage = ratingCount > 0
            ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratingCount) * 10) / 10
            : 0;
          ratingsMap[bookId] = { rating_average: ratingAverage, rating_count: ratingCount };
        }
      }
    }

    const enriched = books.map(book => ({
      ...book,
      rating_average: ratingsMap[book.id]?.rating_average ?? 0,
      rating_count: ratingsMap[book.id]?.rating_count ?? 0,
    }));

    res.json({ data: enriched, count });
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
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get my books error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Discover all public books with optional search
router.get('/public', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    let query = supabase
      .from('books')
      .select(`
        id, title, subtitle, description, cover_image_url, status, visibility, updated_at, author_id,
        chapters:chapters(count),
        author:profiles!books_author_id_fkey(id, display_name, avatar_url)
      `)
      .eq('visibility', 'public')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(60);

    if (q) {
      query = query.or(`title.ilike.%${q}%,subtitle.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get public books error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get books where user is a collaborator (not owner)
router.get('/collaborating', authenticate, async (req, res) => {
  try {
    const { data: collabs, error } = await supabase
      .from('book_collaborators')
      .select(`
        role, invite_accepted_at,
        book:books(
          id, title, subtitle, cover_image_url, status, visibility,
          review_status, updated_at, author_id,
          author:profiles!books_author_id_fkey(id, display_name, avatar_url)
        )
      `)
      .eq('user_id', req.user.id)
      .not('invite_accepted_at', 'is', null);

    if (error) throw error;

    const books = (collabs || [])
      .filter(c => c.book)
      .map(c => ({ ...c.book, userRole: c.role }));

    res.json(books);
  } catch (err) {
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
        settings:book_settings(*),
        collaborators:book_collaborators(id, user_id, role, invite_accepted_at)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Check visibility
    if (book.visibility !== 'public' && book.author_id !== req.user?.id) {
      if (!req.user?.id) {
        return res.status(403).json({ error: 'Not authorized to view this book' });
      }

      // Allow collaborators
      const { data: collab } = await supabase
        .schema('bookflow')
        .from('book_collaborators')
        .select('id')
        .eq('book_id', req.params.id)
        .eq('user_id', req.user.id)
        .not('invite_accepted_at', 'is', null)
        .maybeSingle();

      if (!collab) {
        // Allow club members whose club has this book
        const { data: clubBooks } = await supabase
          .schema('bookflow')
          .from('club_books')
          .select('club_id')
          .eq('book_id', req.params.id);

        const clubIds = (clubBooks || []).map(cb => cb.club_id);

        if (clubIds.length > 0) {
          const { data: clubMember } = await supabase
            .schema('bookflow')
            .from('club_members')
            .select('id, club_id')
            .eq('user_id', req.user.id)
            .in('club_id', clubIds)
            .not('invite_accepted_at', 'is', null)
            .maybeSingle();

          if (!clubMember) {
            return res.status(403).json({ error: 'Not authorized to view this book' });
          }

          // Check if any of the user's clubs have progress tracking enabled for this book
          const { data: clubSettingsRows } = await supabase
            .schema('bookflow')
            .from('club_settings')
            .select('enable_progress_tracking')
            .in('club_id', clubIds);

          const clubProgressEnabled = (clubSettingsRows || []).some(cs => cs.enable_progress_tracking);
          if (clubProgressEnabled) {
            book.club_progress_tracking_enabled = true;
          }
          book.user_in_shared_club = true;
        } else {
          return res.status(403).json({ error: 'Not authorized to view this book' });
        }
      }
    }

    // For public books, still check if the authenticated user is in a club that has
    // progress tracking enabled for this book — so the reader can record completions.
    if (book.visibility === 'public' && req.user?.id && !book.club_progress_tracking_enabled) {
      const { data: clubBooks } = await supabase
        .schema('bookflow')
        .from('club_books')
        .select('club_id')
        .eq('book_id', req.params.id);

      const clubIds = (clubBooks || []).map(cb => cb.club_id);

      if (clubIds.length > 0) {
        const { data: clubMember } = await supabase
          .schema('bookflow')
          .from('club_members')
          .select('club_id')
          .eq('user_id', req.user.id)
          .in('club_id', clubIds)
          .not('invite_accepted_at', 'is', null)
          .maybeSingle();

        if (clubMember) {
          const { data: clubSettingsRows } = await supabase
            .schema('bookflow')
            .from('club_settings')
            .select('enable_progress_tracking')
            .in('club_id', clubIds);

          const clubProgressEnabled = (clubSettingsRows || []).some(cs => cs.enable_progress_tracking);
          if (clubProgressEnabled) {
            book.club_progress_tracking_enabled = true;
          }
          book.user_in_shared_club = true;
        }
      }
    }

    // Sort chapters by order
    book.chapters = book.chapters.sort((a, b) => a.order_index - b.order_index);

    // Fetch rating aggregate separately
    const { data: ratingRows } = await supabase
      .from('book_ratings')
      .select('rating')
      .eq('book_id', req.params.id);
    const rawRatings = ratingRows || [];
    book.rating_count = rawRatings.length;
    book.rating_average = book.rating_count > 0
      ? Math.round((rawRatings.reduce((s, r) => s + r.rating, 0) / book.rating_count) * 10) / 10
      : 0;

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

// Slug helpers (reused from publish.js logic)
function generateBookSlug(title) {
  return (title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

async function uniqueBookSlug(base, bookId) {
  let slug = base;
  let attempt = 0;
  while (true) {
    const { data } = await supabase.from('books').select('id').eq('slug', slug).neq('id', bookId).maybeSingle();
    if (!data) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

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

    // Auto-generate human-readable slug when making book public (if no slug yet)
    if (visibility === 'public') {
      const { data: current } = await supabase
        .from('books')
        .select('slug, title')
        .eq('id', req.params.id)
        .single();
      if (!current?.slug) {
        const base = generateBookSlug(title || current?.title || 'untitled');
        updateData.slug = await uniqueBookSlug(base, req.params.id);
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
    show_author_notes,
    show_inline_form_preview,
    allow_public_tts,
    enable_progress_tracking,
    show_ratings,
    show_component_panel,
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
        show_author_notes,
        show_inline_form_preview,
        allow_public_tts,
        enable_progress_tracking,
        show_ratings,
        show_component_panel,
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

// Archive book (soft-delete — sets status to 'archived', never actually deleted)
router.delete('/:id', authenticate, requireAuthor, async (req, res) => {
  try {
    const { error } = await supabase
      .from('books')
      .update({ status: 'archived' })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Archive book error:', err);
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
    // Fetch previous progress to detect chapter change / completion
    const { data: prev } = await supabase
      .from('reading_progress')
      .select('current_chapter_id, percent_complete, completed_at')
      .eq('user_id', req.user.id)
      .eq('book_id', req.params.id)
      .maybeSingle();

    const progressData = {
      user_id: req.user.id,
      book_id: req.params.id,
      current_chapter_id,
      scroll_position,
      percent_complete,
      last_read_at: new Date().toISOString()
    };

    // Set completed_at if 100%
    const justCompleted = percent_complete >= 100 && !prev?.completed_at;
    if (percent_complete >= 100) {
      progressData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('reading_progress')
      .upsert(progressData, { onConflict: 'user_id,book_id' })
      .select()
      .single();

    if (error) throw error;

    // Fire chat status update if chapter changed or book completed (non-blocking)
    const chapterChanged = current_chapter_id && current_chapter_id !== prev?.current_chapter_id;
    if (justCompleted || chapterChanged) {
      postCompletionUpdate(
        req.user.id,
        req.params.id,
        current_chapter_id,
        percent_complete,
        justCompleted
      ).catch(err => console.error('chat-status trigger error:', err.message));
    }

    res.json(data);
  } catch (err) {
    console.error('Update progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /books/:id/stats — author dashboard statistics
router.get('/:id/stats', authenticate, requireAuthor, async (req, res) => {
  const bookId = req.params.id;
  try {
    // Fetch all data in parallel
    // Pre-fetch inline content IDs and chapter IDs (needed for sub-queries below)
    const [inlineIdsRes, chapterIdsRes] = await Promise.all([
      supabase.from('inline_content').select('id, content_type, chapter_id').eq('book_id', bookId).eq('is_author_content', true),
      supabase.from('chapters').select('id').eq('book_id', bookId),
    ]);
    const inlineContent = inlineIdsRes.data || [];
    const allInlineIds = inlineContent.map(r => r.id);
    const allChapterIds = (chapterIdsRes.data || []).map(c => c.id);

    const [
      chaptersRes,
      readersRes,
      completedRes,
      formResponsesRes,
      pollResponsesRes,
      questionAnswersRes,
      commentsRes,
      completionsRes,
    ] = await Promise.all([
      // Chapters with word count
      supabase.from('chapters').select('id, title, order_index, status, word_count, estimated_read_time_minutes').eq('book_id', bookId).order('order_index'),
      // Unique readers (reading_progress rows)
      supabase.from('reading_progress').select('user_id, percent_complete, last_read_at, completed_at').eq('book_id', bookId),
      // Completed readers
      supabase.from('reading_progress').select('user_id', { count: 'exact' }).eq('book_id', bookId).not('completed_at', 'is', null),
      // Generic form responses (textbox, select, etc.)
      allInlineIds.length
        ? supabase.from('form_responses').select('id, inline_content_id').in('inline_content_id', allInlineIds)
        : Promise.resolve({ data: [] }),
      // Poll votes
      allInlineIds.length
        ? supabase.from('poll_responses').select('id, inline_content_id').in('inline_content_id', allInlineIds)
        : Promise.resolve({ data: [] }),
      // Question answers
      allInlineIds.length
        ? supabase.from('question_answers').select('id, inline_content_id').in('inline_content_id', allInlineIds)
        : Promise.resolve({ data: [] }),
      // Comments total
      supabase.from('book_comments').select('id, status, created_at').eq('book_id', bookId),
      // Chapter item completions (for progress stats)
      allChapterIds.length
        ? supabase.from('chapter_item_completions').select('user_id, chapter_id, item_type, completed_at').in('chapter_id', allChapterIds)
        : Promise.resolve({ data: [] }),
    ]);

    const chapters = chaptersRes.data || [];
    const readers = readersRes.data || [];
    // Combine all response types into one array for counting
    const formResponses = [
      ...(formResponsesRes.data || []),
      ...(pollResponsesRes.data || []),
      ...(questionAnswersRes.data || []),
    ];
    const comments = commentsRes.data || [];
    const completions = completionsRes.data || [];

    // Total word count
    const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
    const publishedChapters = chapters.filter(c => c.status === 'published');

    // Reader stats
    const totalReaders = readers.length;
    const completedReaders = completedRes.count || 0;
    const avgProgress = readers.length
      ? Math.round(readers.reduce((sum, r) => sum + (r.percent_complete || 0), 0) / readers.length)
      : 0;

    // Active readers (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const activeReaders = readers.filter(r => r.last_read_at > thirtyDaysAgo).length;

    // Content breakdown
    const contentByType = inlineContent.reduce((acc, ic) => {
      acc[ic.content_type] = (acc[ic.content_type] || 0) + 1;
      return acc;
    }, {});

    // Build fast id → chapter_id lookup
    const inlineIdToChapter = {};
    const inlineByChapter = {};
    for (const ic of inlineContent) {
      inlineIdToChapter[ic.id] = ic.chapter_id;
      if (!inlineByChapter[ic.chapter_id]) inlineByChapter[ic.chapter_id] = [];
      inlineByChapter[ic.chapter_id].push(ic.id);
    }
    // Form response counts per chapter (covers form_responses + poll_responses + question_answers + audio/video plays)
    const responsesByChapter = {};
    for (const fr of formResponses) {
      const ch = inlineIdToChapter[fr.inline_content_id];
      if (ch) responsesByChapter[ch] = (responsesByChapter[ch] || 0) + 1;
    }
    // Audio/video completions stored in chapter_item_completions with key "ic:{id}"
    for (const c of completions) {
      if (c.item_type === 'audio' || c.item_type === 'video') {
        if (c.item_key?.startsWith('ic:')) {
          const icId = c.item_key.slice(3);
          const ch = inlineIdToChapter[icId] || c.chapter_id;
          if (ch) responsesByChapter[ch] = (responsesByChapter[ch] || 0) + 1;
        } else {
          // TipTap-embedded media key "media:{chapterId}-{n}" — count against the chapter directly
          responsesByChapter[c.chapter_id] = (responsesByChapter[c.chapter_id] || 0) + 1;
        }
      }
    }

    // Completion stats per chapter
    const completionsByChapter = {};
    const uniqueReadersByChapter = {};
    for (const c of completions) {
      if (!completionsByChapter[c.chapter_id]) completionsByChapter[c.chapter_id] = 0;
      completionsByChapter[c.chapter_id]++;
      if (!uniqueReadersByChapter[c.chapter_id]) uniqueReadersByChapter[c.chapter_id] = new Set();
      uniqueReadersByChapter[c.chapter_id].add(c.user_id);
    }

    // Per-chapter stats
    const chapterStats = chapters.map(ch => ({
      id: ch.id,
      title: ch.title,
      order_index: ch.order_index,
      status: ch.status,
      word_count: ch.word_count || 0,
      read_time: ch.estimated_read_time_minutes || 0,
      components: inlineByChapter[ch.id]?.length || 0,
      form_responses: responsesByChapter[ch.id] || 0,
      completions: completionsByChapter[ch.id] || 0,
      unique_readers: uniqueReadersByChapter[ch.id]?.size || 0,
    }));

    // Recent activity (last 10 completions)
    const recentCompletions = [...completions]
      .sort((a, b) => b.completed_at?.localeCompare(a.completed_at))
      .slice(0, 10);

    // Comments breakdown
    const openComments = comments.filter(c => c.status === 'open').length;
    const resolvedComments = comments.filter(c => c.status === 'resolved').length;

    res.json({
      overview: {
        total_chapters: chapters.length,
        published_chapters: publishedChapters.length,
        total_words: totalWords,
        total_readers: totalReaders,
        active_readers: activeReaders,
        completed_readers: completedReaders,
        avg_progress: avgProgress,
        total_components: inlineContent.length,
        total_form_responses: formResponses.length + completions.filter(c => c.item_type === 'audio' || c.item_type === 'video').length, // form + poll + question + media plays
        total_comments: comments.length,
        open_comments: openComments,
        resolved_comments: resolvedComments,
      },
      content_by_type: contentByType,
      chapter_stats: chapterStats,
      recent_completions: recentCompletions,
    });
  } catch (err) {
    console.error('Book stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /books/:id/responses ──────────────────────────────────────────────────
// Returns all inline content for a book with aggregated responses.
// Author or super_admin only.  Optional ?chapter_id=uuid to scope to one chapter.
router.get('/:id/responses', authenticate, requireAuthor, async (req, res) => {
  const bookId = req.params.id;
  const { chapter_id } = req.query;

  try {
    const result = await buildBookResponses(bookId, {
      chapterId: typeof chapter_id === 'string' ? chapter_id : null,
      viewerId: req.user.id,
      authorMode: true,
    });

    res.json(result.items);
  } catch (err) {
    console.error('Book responses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /books/:id/accessible-responses ───────────────────────────────────────
// Returns response rows the current viewer is allowed to see:
// - author: everything
// - authenticated readers: own + shared + public
// - guests on a public book: public only
router.get('/:id/accessible-responses', optionalAuth, async (req, res) => {
  const bookId = req.params.id;
  const { chapter_id } = req.query;

  try {
    const result = await buildBookResponses(bookId, {
      chapterId: typeof chapter_id === 'string' ? chapter_id : null,
      viewerId: req.user?.id || null,
      authorMode: false,
    });

    if (result.forbidden) {
      return res.status(403).json({ error: 'Not authorized to view these responses' });
    }

    res.json(result.items);
  } catch (err) {
    console.error('Accessible book responses error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
