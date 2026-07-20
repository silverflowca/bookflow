import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { getClubRole } from './clubs.js';
import { createNotification } from '../services/notifications.js';

const router = express.Router({ mergeParams: true });

// ── Trackable types (mirrors progress.js) ────────────────────────────────────
const TRACKABLE_TYPES = ['textbox', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'poll', 'question', 'audio', 'video'];

function extractMediaKeys(content, chapterId, counter = { n: 0 }) {
  const keys = [];
  if (!content || !Array.isArray(content)) return keys;
  for (const node of content) {
    if (node.type === 'audio' || node.type === 'video') {
      keys.push({ key: `media:${chapterId}-${counter.n}`, type: node.type });
      counter.n++;
    }
    if (node.content) keys.push(...extractMediaKeys(node.content, chapterId, counter));
  }
  return keys;
}

// ── Notification helper ───────────────────────────────────────────────────────
async function notify(userId, type, title, body, extra = {}) {
  try {
    await createNotification(supabase, { userId, type, title, body, ...extra });
  } catch (_) {}
}

// ── Auth guard helper ─────────────────────────────────────────────────────────
async function requireClassAccess(req, res, minRole = 'member') {
  const { clubId } = req.params;
  const role = await getClubRole(clubId, req.user.id);
  if (!role) {
    res.status(403).json({ error: 'Not a member of this class' });
    return null;
  }
  if (minRole === 'teacher' && role !== 'owner' && role !== 'admin') {
    res.status(403).json({ error: 'Teacher access required' });
    return null;
  }
  return role;
}

// ── Load all teacher/admin user IDs for a club ────────────────────────────────
async function getTeacherIds(clubId) {
  const { data: club } = await supabase
    .schema('bookflow')
    .from('book_clubs')
    .select('created_by')
    .eq('id', clubId)
    .single();

  const { data: admins } = await supabase
    .schema('bookflow')
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('role', 'admin')
    .not('invite_accepted_at', 'is', null);

  const ids = (admins || []).map(a => a.user_id);
  if (club?.created_by) ids.push(club.created_by);
  return [...new Set(ids)];
}


// ═══════════════════════════════════════════════════════════════════════════════
// ROSTER
// GET /api/clubs/:clubId/class/roster
// Teacher only — members + completion% + submission counts
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:clubId/class/roster', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  try {
    // Load all accepted, non-removed members with profile
    const { data: members, error: mErr } = await supabase
      .schema('bookflow')
      .from('club_members')
      .select('user_id, role, invite_accepted_at, invited_email, profile:profiles!club_members_user_id_fkey(display_name, avatar_url, email)')
      .eq('club_id', clubId)
      .not('invite_accepted_at', 'is', null);
    if (mErr) throw mErr;

    // Load current club book (fall back to most recently added if none marked current)
    let { data: clubBook } = await supabase
      .schema('bookflow')
      .from('club_books')
      .select('book_id')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

    if (!clubBook) {
      const { data: fallback } = await supabase
        .schema('bookflow')
        .from('club_books')
        .select('book_id')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      clubBook = fallback;
    }

    if (!clubBook) return res.json({ members: [], chapters: [] });

    // Load chapters
    const { data: chapters } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id, title, order_index, content')
      .eq('book_id', clubBook.book_id)
      .eq('status', 'published')
      .order('order_index', { ascending: true });

    const chapterIds = (chapters || []).map(c => c.id);

    // Load inline content
    const { data: allInline } = await supabase
      .schema('bookflow')
      .from('inline_content')
      .select('id, chapter_id, content_type')
      .in('chapter_id', chapterIds)
      .in('content_type', TRACKABLE_TYPES);

    // Compute totals per chapter
    const totalByChapter = {};
    for (const ch of (chapters || [])) {
      const formCount = (allInline || []).filter(ic => ic.chapter_id === ch.id).length;
      const mediaCount = extractMediaKeys(ch.content?.content || [], ch.id).length;
      totalByChapter[ch.id] = formCount + mediaCount;
    }
    const grandTotal = Object.values(totalByChapter).reduce((a, b) => a + b, 0);

    // Load completions
    const memberIds = (members || []).map(m => m.user_id);
    const { data: allCompletions } = await supabase
      .schema('bookflow')
      .from('chapter_item_completions')
      .select('user_id, chapter_id, item_key, completed_at')
      .in('chapter_id', chapterIds)
      .in('user_id', memberIds);

    // Load submission counts per student
    const { data: allSubmissions } = await supabase
      .schema('bookflow')
      .from('class_submissions')
      .select('student_id, status')
      .eq('club_id', clubId)
      .in('status', ['submitted', 'graded']);

    // Aggregate
    const result = (members || []).map(member => {
      const userCompletions = (allCompletions || []).filter(c => c.user_id === member.user_id);
      const userSubs = (allSubmissions || []).filter(s => s.student_id === member.user_id);

      const chapters_breakdown = (chapters || []).map(ch => ({
        chapter_id: ch.id,
        completed: userCompletions.filter(c => c.chapter_id === ch.id).length,
        total: totalByChapter[ch.id] || 0,
      }));

      const lastActive = userCompletions.length
        ? userCompletions.reduce((latest, c) =>
            c.completed_at > latest ? c.completed_at : latest,
            userCompletions[0].completed_at)
        : null;

      const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
      const completedCount = userCompletions.length;

      return {
        user_id: member.user_id,
        display_name: profile?.display_name || 'Member',
        avatar_url: profile?.avatar_url || null,
        email: profile?.email || member.invited_email || null,
        role: member.role,
        enrolled_at: member.invite_accepted_at,
        items_completed: completedCount,
        items_total: grandTotal,
        completion_pct: grandTotal > 0 ? Math.round((completedCount / grandTotal) * 100) : 0,
        chapters_breakdown,
        submissions_submitted: userSubs.filter(s => s.status === 'submitted').length,
        submissions_graded: userSubs.filter(s => s.status === 'graded').length,
        last_active: lastActive,
      };
    });

    res.json({
      members: result,
      chapters: (chapters || []).map(c => ({ id: c.id, title: c.title })),
    });
  } catch (err) {
    console.error('Class roster error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT ROSTER
// GET /api/clubs/:clubId/class/roster/export
// Teacher only — returns CSV of all members with email + progress detail
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:clubId/class/roster/export', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  try {
    // Club info
    const { data: club } = await supabase
      .schema('bookflow')
      .from('book_clubs')
      .select('name, club_type')
      .eq('id', clubId)
      .single();

    // Members with email
    const { data: members, error: mErr } = await supabase
      .schema('bookflow')
      .from('club_members')
      .select('user_id, role, invite_accepted_at, invited_email, profile:profiles!club_members_user_id_fkey(display_name, avatar_url, email)')
      .eq('club_id', clubId)
      .not('invite_accepted_at', 'is', null);
    if (mErr) throw mErr;

    // Current book
    let { data: clubBook } = await supabase
      .schema('bookflow')
      .from('club_books')
      .select('book_id, book:books(id, title)')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

    if (!clubBook) {
      const { data: fallback } = await supabase
        .schema('bookflow')
        .from('club_books')
        .select('book_id, book:books(id, title)')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      clubBook = fallback;
    }

    const bookTitle = clubBook ? (Array.isArray(clubBook.book) ? clubBook.book[0]?.title : clubBook.book?.title) || '' : '';

    let grandTotal = 0;
    let chaptersMap = [];

    if (clubBook) {
      const { data: chapters } = await supabase
        .schema('bookflow')
        .from('chapters')
        .select('id, title, order_index, content')
        .eq('book_id', clubBook.book_id)
        .eq('status', 'published')
        .order('order_index', { ascending: true });

      const chapterIds = (chapters || []).map(c => c.id);
      const { data: allInline } = await supabase
        .schema('bookflow')
        .from('inline_content')
        .select('id, chapter_id, content_type')
        .in('chapter_id', chapterIds.length ? chapterIds : ['none'])
        .in('content_type', TRACKABLE_TYPES);

      const totalByChapter = {};
      for (const ch of (chapters || [])) {
        const formCount = (allInline || []).filter(ic => ic.chapter_id === ch.id).length;
        const mediaCount = extractMediaKeys(ch.content?.content || [], ch.id).length;
        totalByChapter[ch.id] = formCount + mediaCount;
      }
      grandTotal = Object.values(totalByChapter).reduce((a, b) => a + b, 0);

      const memberIds = (members || []).map(m => m.user_id);
      const { data: allCompletions } = await supabase
        .schema('bookflow')
        .from('chapter_item_completions')
        .select('user_id, chapter_id, item_key, completed_at')
        .in('chapter_id', chapterIds.length ? chapterIds : ['none'])
        .in('user_id', memberIds.length ? memberIds : ['none']);

      const { data: allSubmissions } = await supabase
        .schema('bookflow')
        .from('class_submissions')
        .select('student_id, status')
        .eq('club_id', clubId)
        .in('status', ['submitted', 'graded']);

      chaptersMap = (members || []).map(member => {
        const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
        const userCompletions = (allCompletions || []).filter(c => c.user_id === member.user_id);
        const userSubs = (allSubmissions || []).filter(s => s.student_id === member.user_id);
        const completedCount = userCompletions.length;
        const completionPct = grandTotal > 0 ? Math.round((completedCount / grandTotal) * 100) : 0;
        const completedChapters = (chapters || []).filter(ch => {
          const total = totalByChapter[ch.id] || 0;
          const done = userCompletions.filter(c => c.chapter_id === ch.id).length;
          return total > 0 && done >= total;
        }).length;
        const lastActive = userCompletions.length
          ? userCompletions.reduce((l, c) => c.completed_at > l ? c.completed_at : l, userCompletions[0].completed_at)
          : null;

        return {
          display_name: profile?.display_name || 'Member',
          email: profile?.email || member.invited_email || '',
          role: member.role,
          enrolled_at: member.invite_accepted_at,
          completion_pct: completionPct,
          items_completed: completedCount,
          items_total: grandTotal,
          chapters_completed: completedChapters,
          chapters_total: (chapters || []).length,
          submissions_submitted: userSubs.filter(s => s.status === 'submitted').length,
          submissions_graded: userSubs.filter(s => s.status === 'graded').length,
          last_active: lastActive,
        };
      });
    } else {
      chaptersMap = (members || []).map(member => {
        const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
        return {
          display_name: profile?.display_name || 'Member',
          email: profile?.email || member.invited_email || '',
          role: member.role,
          enrolled_at: member.invite_accepted_at,
          completion_pct: 0, items_completed: 0, items_total: 0,
          chapters_completed: 0, chapters_total: 0,
          submissions_submitted: 0, submissions_graded: 0, last_active: null,
        };
      });
    }

    // Build CSV
    const clubType = club?.club_type || 'club';
    const groupLabel = clubType === 'online_class' ? 'Class' : clubType === 'study_group' ? 'Study Group' : 'Book Club';
    const clubName = club?.name || clubId;

    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Name', 'Email', 'Role', groupLabel, 'Book', 'Progress %', 'Items Completed', 'Items Total', 'Chapters Completed', 'Chapters Total', 'Submitted', 'Graded', 'Enrolled At', 'Last Active'];
    const rows = chaptersMap.map(m => [
      escape(m.display_name),
      escape(m.email),
      escape(m.role),
      escape(clubName),
      escape(bookTitle),
      escape(m.completion_pct),
      escape(m.items_completed),
      escape(m.items_total),
      escape(m.chapters_completed),
      escape(m.chapters_total),
      escape(m.submissions_submitted),
      escape(m.submissions_graded),
      escape(m.enrolled_at ? new Date(m.enrolled_at).toLocaleDateString() : ''),
      escape(m.last_active ? new Date(m.last_active).toLocaleDateString() : ''),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const filename = `${clubName.replace(/[^a-z0-9]/gi, '_')}_roster.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Class roster export error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// MY PROGRESS (student self-view)
// GET /api/clubs/:clubId/class/my-progress
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:clubId/class/my-progress', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;

  const userId = req.user.id;

  try {
    // Current book (fall back to most recently added if none marked current)
    let { data: clubBook } = await supabase
      .schema('bookflow')
      .from('club_books')
      .select('book_id, book:books(id, title, cover_image_url)')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

    if (!clubBook) {
      const { data: fallback } = await supabase
        .schema('bookflow')
        .from('club_books')
        .select('book_id, book:books(id, title, cover_image_url)')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      clubBook = fallback;
    }

    if (!clubBook) return res.json({ chapters: [], book: null, completion_pct: 0, items_completed: 0, items_total: 0, submissions: [] });

    const book = Array.isArray(clubBook.book) ? clubBook.book[0] : clubBook.book;

    // Chapters
    const { data: chapters } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id, title, order_index, content')
      .eq('book_id', clubBook.book_id)
      .eq('status', 'published')
      .order('order_index', { ascending: true });

    const chapterIds = (chapters || []).map(c => c.id);

    // Inline trackable content totals per chapter
    const { data: allInline } = await supabase
      .schema('bookflow')
      .from('inline_content')
      .select('id, chapter_id, content_type')
      .in('chapter_id', chapterIds)
      .in('content_type', TRACKABLE_TYPES);

    const totalByChapter = {};
    for (const ch of (chapters || [])) {
      const formCount = (allInline || []).filter(ic => ic.chapter_id === ch.id).length;
      const mediaCount = extractMediaKeys(ch.content?.content || [], ch.id).length;
      totalByChapter[ch.id] = formCount + mediaCount;
    }
    const grandTotal = Object.values(totalByChapter).reduce((a, b) => a + b, 0);

    // My completions
    const { data: completions } = await supabase
      .schema('bookflow')
      .from('chapter_item_completions')
      .select('chapter_id, item_key, completed_at')
      .eq('user_id', userId)
      .in('chapter_id', chapterIds);

    const chapters_breakdown = (chapters || []).map(ch => ({
      chapter_id: ch.id,
      title: ch.title,
      completed: (completions || []).filter(c => c.chapter_id === ch.id).length,
      total: totalByChapter[ch.id] || 0,
    }));

    const completedCount = (completions || []).length;

    // My submissions with prompts and feedback
    const { data: submissions } = await supabase
      .schema('bookflow')
      .from('class_submissions')
      .select(`
        id, title, status, submitted_at, created_at,
        prompt:class_submission_prompts(id, title, prompt_type, due_date),
        feedback:class_submission_feedback(grade, feedback_text)
      `)
      .eq('club_id', clubId)
      .eq('student_id', userId)
      .order('created_at', { ascending: false });

    const norm = v => Array.isArray(v) ? v[0] ?? null : v;
    const normalizedSubs = (submissions || []).map(s => ({
      ...s,
      prompt: norm(s.prompt),
      feedback: norm(s.feedback),
    }));

    res.json({
      book,
      chapters: chapters_breakdown,
      items_completed: completedCount,
      items_total: grandTotal,
      completion_pct: grandTotal > 0 ? Math.round((completedCount / grandTotal) * 100) : 0,
      submissions: normalizedSubs,
    });
  } catch (err) {
    console.error('My progress error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/clubs/:clubId/class/sessions
 * Members: only published sessions. Teachers: all sessions.
 */
router.get('/:clubId/class/sessions', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res);
  if (!role) return;

  const isTeacher = role === 'owner' || role === 'admin';

  try {
    let query = supabase
      .schema('bookflow')
      .from('class_sessions')
      .select('*')
      .eq('club_id', clubId)
      .order('session_date', { ascending: true });

    if (!isTeacher) query = query.eq('is_published', true);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/clubs/:clubId/class/sessions
 * Teacher only — create session
 */
router.post('/:clubId/class/sessions', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  const { title, description, session_date, duration_minutes, meeting_url, notes, is_published } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!session_date) return res.status(400).json({ error: 'session_date is required' });

  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_sessions')
      .insert({
        club_id: clubId,
        title,
        description: description || null,
        session_date,
        duration_minutes: duration_minutes || 60,
        meeting_url: meeting_url || null,
        notes: notes || null,
        is_published: is_published || false,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/clubs/:clubId/class/sessions/:id
 * Teacher only — update session
 */
router.put('/:clubId/class/sessions/:id', authenticate, async (req, res) => {
  const { clubId, id } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  const allowed = ['title', 'description', 'session_date', 'duration_minutes', 'meeting_url', 'notes', 'is_published'];
  const updates = {};
  for (const k of allowed) {
    if (k in req.body) updates[k] = req.body[k];
  }
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_sessions')
      .update(updates)
      .eq('id', id)
      .eq('club_id', clubId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Session not found' });
    res.json(data);
  } catch (err) {
    console.error('Update session error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/clubs/:clubId/class/sessions/:id
 * Teacher only — delete session
 */
router.delete('/:clubId/class/sessions/:id', authenticate, async (req, res) => {
  const { clubId, id } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  try {
    const { error } = await supabase
      .schema('bookflow')
      .from('class_sessions')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS (Writing Assignments)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/clubs/:clubId/class/prompts
 * All members — list prompts ordered by sort_order
 */
router.get('/:clubId/class/prompts', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res);
  if (!role) return;

  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submission_prompts')
      .select('*')
      .eq('club_id', clubId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Get prompts error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/clubs/:clubId/class/prompts
 * Teacher only — create prompt
 */
router.post('/:clubId/class/prompts', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  const { title, body, prompt_type, chapter_id, session_id, is_required, due_date, sort_order } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const VALID_TYPES = ['journal', 'essay', 'assignment', 'scribe'];
  const pType = VALID_TYPES.includes(prompt_type) ? prompt_type : 'journal';

  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submission_prompts')
      .insert({
        club_id: clubId,
        chapter_id: chapter_id || null,
        session_id: session_id || null,
        title,
        body: body || null,
        prompt_type: pType,
        is_required: is_required || false,
        due_date: due_date || null,
        sort_order: sort_order || 0,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create prompt error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/clubs/:clubId/class/prompts/:id
 * Teacher only — update prompt
 */
router.put('/:clubId/class/prompts/:id', authenticate, async (req, res) => {
  const { clubId, id } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  const allowed = ['title', 'body', 'prompt_type', 'chapter_id', 'session_id', 'is_required', 'due_date', 'sort_order'];
  const updates = {};
  for (const k of allowed) {
    if (k in req.body) updates[k] = req.body[k];
  }
  if (updates.prompt_type) {
    const VALID_TYPES = ['journal', 'essay', 'assignment', 'scribe'];
    if (!VALID_TYPES.includes(updates.prompt_type)) delete updates.prompt_type;
  }
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submission_prompts')
      .update(updates)
      .eq('id', id)
      .eq('club_id', clubId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Prompt not found' });
    res.json(data);
  } catch (err) {
    console.error('Update prompt error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/clubs/:clubId/class/prompts/:id
 * Teacher only — delete prompt
 */
router.delete('/:clubId/class/prompts/:id', authenticate, async (req, res) => {
  const { clubId, id } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  try {
    const { error } = await supabase
      .schema('bookflow')
      .from('class_submission_prompts')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete prompt error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// SUBMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/clubs/:clubId/class/submissions
 * Teacher: all submissions with feedback. Student: own submissions with feedback.
 * Query params: ?prompt_id=&student_id= (teacher filter), ?status=
 */
router.get('/:clubId/class/submissions', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res);
  if (!role) return;

  const isTeacher = role === 'owner' || role === 'admin';
  const { prompt_id, student_id, status } = req.query;

  try {
    let query = supabase
      .schema('bookflow')
      .from('class_submissions')
      .select(`
        *,
        student:profiles!class_submissions_student_id_fkey(id, display_name, avatar_url),
        prompt:class_submission_prompts(id, title, prompt_type),
        feedback:class_submission_feedback(id, grade, feedback_text, created_at, created_by)
      `)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (!isTeacher) {
      query = query.eq('student_id', req.user.id);
    } else if (student_id) {
      query = query.eq('student_id', student_id);
    }

    if (prompt_id) query = query.eq('prompt_id', prompt_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Get submissions error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/clubs/:clubId/class/submissions/:subId
 * Member — single submission with feedback (students see own; teachers see all)
 */
router.get('/:clubId/class/submissions/:subId', authenticate, async (req, res) => {
  const { clubId, subId } = req.params;
  const role = await requireClassAccess(req, res);
  if (!role) return;

  const isTeacher = role === 'owner' || role === 'admin';

  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submissions')
      .select(`
        *,
        student:profiles!class_submissions_student_id_fkey(id, display_name, avatar_url),
        prompt:class_submission_prompts(id, title, body, prompt_type),
        feedback:class_submission_feedback(id, grade, feedback_text, created_at, created_by)
      `)
      .eq('id', subId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Submission not found' });

    const profile = Array.isArray(data.student) ? data.student[0] : data.student;
    if (!isTeacher && profile?.id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(data);
  } catch (err) {
    console.error('Get submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/clubs/:clubId/class/submissions
 * Student — create draft or submit directly
 */
router.post('/:clubId/class/submissions', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res);
  if (!role) return;

  const { title, body, prompt_id, chapter_id, status } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });

  const VALID_STATUSES = ['draft', 'submitted'];
  const subStatus = VALID_STATUSES.includes(status) ? status : 'draft';

  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submissions')
      .insert({
        club_id: clubId,
        student_id: req.user.id,
        prompt_id: prompt_id || null,
        chapter_id: chapter_id || null,
        title: title || null,
        body,
        status: subStatus,
        submitted_at: subStatus === 'submitted' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Notify teachers when student submits
    if (subStatus === 'submitted') {
      const teacherIds = await getTeacherIds(clubId);
      const { data: profile } = await supabase
        .schema('bookflow')
        .from('profiles')
        .select('display_name')
        .eq('id', req.user.id)
        .single();
      const name = profile?.display_name || 'A student';

      for (const tid of teacherIds) {
        if (tid !== req.user.id) {
          await notify(tid, 'class_assignment_submitted',
            'Assignment Submitted',
            `${name} submitted an assignment`,
            { club_id: clubId, submission_id: data.id });
        }
      }
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Create submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/clubs/:clubId/class/submissions/:subId
 * Student — edit own draft. Can also submit (status: 'submitted').
 */
router.put('/:clubId/class/submissions/:subId', authenticate, async (req, res) => {
  const { clubId, subId } = req.params;
  const role = await requireClassAccess(req, res);
  if (!role) return;

  try {
    // Verify ownership and current status
    const { data: existing, error: findErr } = await supabase
      .schema('bookflow')
      .from('class_submissions')
      .select('id, student_id, status')
      .eq('id', subId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: 'Submission not found' });
    if (existing.student_id !== req.user.id) return res.status(403).json({ error: 'Not your submission' });
    if (existing.status === 'graded') return res.status(400).json({ error: 'Cannot edit a graded submission' });

    const allowed = ['title', 'body', 'status'];
    const updates = {};
    for (const k of allowed) {
      if (k in req.body) updates[k] = req.body[k];
    }
    // Only allow draft→submitted, not backwards
    if (updates.status && !['draft', 'submitted'].includes(updates.status)) delete updates.status;
    if (updates.status === 'submitted' && existing.status !== 'submitted') {
      updates.submitted_at = new Date().toISOString();
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submissions')
      .update(updates)
      .eq('id', subId)
      .eq('club_id', clubId)
      .select()
      .single();

    if (error) throw error;

    // Notify teachers if newly submitted
    if (updates.status === 'submitted' && existing.status !== 'submitted') {
      const teacherIds = await getTeacherIds(clubId);
      const { data: profile } = await supabase
        .schema('bookflow')
        .from('profiles')
        .select('display_name')
        .eq('id', req.user.id)
        .single();
      const name = profile?.display_name || 'A student';

      for (const tid of teacherIds) {
        if (tid !== req.user.id) {
          await notify(tid, 'class_assignment_submitted',
            'Assignment Submitted',
            `${name} submitted an assignment`,
            { club_id: clubId, submission_id: subId });
        }
      }
    }

    res.json(data);
  } catch (err) {
    console.error('Update submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/clubs/:clubId/class/submissions/:subId/feedback
 * Teacher only — upsert grade + comment, mark submission as graded, notify student
 */
router.post('/:clubId/class/submissions/:subId/feedback', authenticate, async (req, res) => {
  const { clubId, subId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  const { grade, feedback_text } = req.body;

  // Validate grade if provided
  if (grade !== undefined && grade !== null) {
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 0 || g > 100) {
      return res.status(400).json({ error: 'grade must be an integer 0–100' });
    }
  }

  try {
    // Verify submission belongs to this club
    const { data: sub, error: subErr } = await supabase
      .schema('bookflow')
      .from('class_submissions')
      .select('id, student_id, status')
      .eq('id', subId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (subErr) throw subErr;
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    // Upsert feedback
    const { data: feedback, error: fbErr } = await supabase
      .schema('bookflow')
      .from('class_submission_feedback')
      .upsert({
        submission_id: subId,
        club_id: clubId,
        created_by: req.user.id,
        grade: grade !== undefined ? grade : null,
        feedback_text: feedback_text || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'submission_id' })
      .select()
      .single();

    if (fbErr) throw fbErr;

    // Mark submission as graded
    await supabase
      .schema('bookflow')
      .from('class_submissions')
      .update({ status: 'graded', updated_at: new Date().toISOString() })
      .eq('id', subId);

    // Notify student
    await notify(
      sub.student_id,
      'class_feedback_posted',
      'Feedback on Your Assignment',
      grade !== undefined && grade !== null
        ? `Your assignment has been graded: ${grade}/100`
        : 'Your assignment has received feedback',
      { club_id: clubId, submission_id: subId }
    );

    res.json(feedback);
  } catch (err) {
    console.error('Submission feedback error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// INLINE Q&A ANSWERS (form_responses)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/clubs/:clubId/class/answers
 * Teacher only — all form_responses from class members for current book's chapters
 * Query: ?student_id= filter
 */
router.get('/:clubId/class/answers', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  const { student_id } = req.query;

  try {
    // Get current book
    const { data: clubBook } = await supabase
      .schema('bookflow')
      .from('club_books')
      .select('book_id')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

    if (!clubBook) return res.json([]);

    // Get chapter IDs for current book
    const { data: chapters } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id, title, order_index')
      .eq('book_id', clubBook.book_id)
      .eq('status', 'published')
      .order('order_index', { ascending: true });

    const chapterIds = (chapters || []).map(c => c.id);
    if (chapterIds.length === 0) return res.json([]);

    // Get inline_content (questions/polls) for these chapters
    const { data: inlineContent } = await supabase
      .schema('bookflow')
      .from('inline_content')
      .select('id, chapter_id, content_type, content')
      .in('chapter_id', chapterIds)
      .in('content_type', ['question', 'poll', 'radio', 'select', 'multiselect', 'checkbox', 'textbox', 'textarea']);

    const inlineIds = (inlineContent || []).map(ic => ic.id);
    if (inlineIds.length === 0) return res.json([]);

    // Get member IDs
    const { data: members } = await supabase
      .schema('bookflow')
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId)
      .not('invite_accepted_at', 'is', null);

    const memberIds = (members || []).map(m => m.user_id);

    // Query form_responses
    let query = supabase
      .schema('bookflow')
      .from('form_responses')
      .select(`
        *,
        student:profiles!form_responses_user_id_fkey(id, display_name, avatar_url),
        feedback:class_answer_feedback(id, grade, feedback_text, created_at, created_by)
      `)
      .in('inline_content_id', inlineIds)
      .in('user_id', memberIds)
      .order('created_at', { ascending: false });

    if (student_id) query = query.eq('user_id', student_id);

    const { data: responses, error } = await query;
    if (error) throw error;

    // Attach chapter info and inline content info to each response
    const inlineMap = Object.fromEntries((inlineContent || []).map(ic => [ic.id, ic]));
    const chapterMap = Object.fromEntries((chapters || []).map(c => [c.id, c]));

    const enriched = (responses || []).map(r => {
      const ic = inlineMap[r.inline_content_id];
      const ch = ic ? chapterMap[ic.chapter_id] : null;
      return {
        ...r,
        inline_content: ic ? { id: ic.id, content_type: ic.content_type, content: ic.content } : null,
        chapter: ch ? { id: ch.id, title: ch.title, order_index: ch.order_index } : null,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Get class answers error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/clubs/:clubId/class/answers/:responseId/feedback
 * Teacher only — upsert grade + comment on a form_response, notify student
 */
router.post('/:clubId/class/answers/:responseId/feedback', authenticate, async (req, res) => {
  const { clubId, responseId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  const { grade, feedback_text, student_id } = req.body;

  if (grade !== undefined && grade !== null) {
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 0 || g > 100) {
      return res.status(400).json({ error: 'grade must be an integer 0–100' });
    }
  }

  if (!student_id) return res.status(400).json({ error: 'student_id is required' });

  try {
    const { data: feedback, error: fbErr } = await supabase
      .schema('bookflow')
      .from('class_answer_feedback')
      .upsert({
        club_id: clubId,
        response_id: responseId,
        student_id,
        created_by: req.user.id,
        grade: grade !== undefined ? grade : null,
        feedback_text: feedback_text || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'club_id,response_id' })
      .select()
      .single();

    if (fbErr) throw fbErr;

    // Notify student
    await notify(
      student_id,
      'class_feedback_posted',
      'Feedback on Your Answer',
      grade !== undefined && grade !== null
        ? `Your answer has been graded: ${grade}/100`
        : 'Your answer has received feedback',
      { club_id: clubId, response_id: responseId }
    );

    res.json(feedback);
  } catch (err) {
    console.error('Answer feedback error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT DETAIL (teacher drills into one student)
// GET /api/clubs/:clubId/class/students/:studentId
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:clubId/class/students/:studentId', authenticate, async (req, res) => {
  const { clubId, studentId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  try {
    // Profile
    const { data: profile } = await supabase
      .schema('bookflow')
      .from('profiles')
      .select('id, display_name, avatar_url, email')
      .eq('id', studentId)
      .maybeSingle();

    // Current book
    const { data: clubBook } = await supabase
      .schema('bookflow')
      .from('club_books')
      .select('book_id, book:books(id, title, cover_image_url)')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

    if (!clubBook) return res.json({ profile, book: null, chapters: [], submissions: [], answers: [] });
    const book = Array.isArray(clubBook.book) ? clubBook.book[0] : clubBook.book;

    // Chapters
    const { data: chapters } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id, title, order_index, content')
      .eq('book_id', clubBook.book_id)
      .eq('status', 'published')
      .order('order_index', { ascending: true });

    const chapterIds = (chapters || []).map(c => c.id);

    // Inline content totals
    const { data: allInline } = await supabase
      .schema('bookflow')
      .from('inline_content')
      .select('id, chapter_id, content_type, label')
      .in('chapter_id', chapterIds)
      .in('content_type', TRACKABLE_TYPES);

    const totalByChapter = {};
    for (const ch of (chapters || [])) {
      const formCount = (allInline || []).filter(ic => ic.chapter_id === ch.id).length;
      const mediaCount = extractMediaKeys(ch.content?.content || [], ch.id).length;
      totalByChapter[ch.id] = formCount + mediaCount;
    }
    const grandTotal = Object.values(totalByChapter).reduce((a, b) => a + b, 0);

    // Student completions
    const { data: completions } = await supabase
      .schema('bookflow')
      .from('chapter_item_completions')
      .select('chapter_id, item_key, completed_at')
      .eq('user_id', studentId)
      .in('chapter_id', chapterIds);

    const chapters_breakdown = (chapters || []).map(ch => ({
      chapter_id: ch.id,
      title: ch.title,
      completed: (completions || []).filter(c => c.chapter_id === ch.id).length,
      total: totalByChapter[ch.id] || 0,
    }));

    // Q&A answers with inline_content label + response comments
    const { data: answers } = await supabase
      .schema('bookflow')
      .from('form_responses')
      .select(`
        id, chapter_id, content_id, response_data, created_at,
        comments:class_response_comments(id, author_id, body, created_at, author:profiles!class_response_comments_author_id_fkey(id, display_name, avatar_url))
      `)
      .eq('user_id', studentId)
      .in('chapter_id', chapterIds)
      .order('created_at', { ascending: true });

    const norm = v => Array.isArray(v) ? v[0] ?? null : v;

    const enrichedAnswers = (answers || []).map(a => {
      const ic = (allInline || []).find(i => i.id === a.content_id);
      const comments = (a.comments || []).map(c => ({ ...c, author: norm(c.author) }));
      return { ...a, question_label: ic?.label || null, chapter_title: (chapters || []).find(c => c.id === a.chapter_id)?.title || null, comments };
    });

    // Submissions with feedback
    const { data: submissions } = await supabase
      .schema('bookflow')
      .from('class_submissions')
      .select(`
        id, title, status, submitted_at, created_at, body,
        prompt:class_submission_prompts(id, title, prompt_type),
        feedback:class_submission_feedback(grade, feedback_text, created_at)
      `)
      .eq('club_id', clubId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    const normalizedSubs = (submissions || []).map(s => ({
      ...s,
      prompt: norm(s.prompt),
      feedback: norm(s.feedback),
    }));

    const completedCount = (completions || []).length;

    res.json({
      profile,
      book,
      items_completed: completedCount,
      items_total: grandTotal,
      completion_pct: grandTotal > 0 ? Math.round((completedCount / grandTotal) * 100) : 0,
      chapters: chapters_breakdown,
      answers: enrichedAnswers,
      submissions: normalizedSubs,
    });
  } catch (err) {
    console.error('Student detail error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE COMMENTS (teacher ↔ student dialogue on Q&A answers)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/clubs/:clubId/class/responses/:responseId/comments
router.get('/:clubId/class/responses/:responseId/comments', authenticate, async (req, res) => {
  const { clubId, responseId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;

  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_response_comments')
      .select('id, author_id, body, created_at, author:profiles!class_response_comments_author_id_fkey(id, display_name, avatar_url)')
      .eq('club_id', clubId)
      .eq('response_id', responseId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const norm = v => Array.isArray(v) ? v[0] ?? null : v;
    res.json((data || []).map(c => ({ ...c, author: norm(c.author) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clubs/:clubId/class/responses/:responseId/comments
router.post('/:clubId/class/responses/:responseId/comments', authenticate, async (req, res) => {
  const { clubId, responseId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;

  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });

  try {
    // Find response owner to notify
    const { data: response } = await supabase
      .schema('bookflow')
      .from('form_responses')
      .select('user_id')
      .eq('id', responseId)
      .maybeSingle();

    const { data: comment, error } = await supabase
      .schema('bookflow')
      .from('class_response_comments')
      .insert({ club_id: clubId, response_id: responseId, author_id: req.user.id, body: body.trim() })
      .select('id, author_id, body, created_at, author:profiles!class_response_comments_author_id_fkey(id, display_name, avatar_url)')
      .single();
    if (error) throw error;

    const norm = v => Array.isArray(v) ? v[0] ?? null : v;
    const result = { ...comment, author: norm(comment.author) };

    // Notify the other party
    if (response?.user_id && response.user_id !== req.user.id) {
      await notify(response.user_id, 'class_response_comment',
        'New comment on your answer',
        `Your teacher left a comment on one of your answers.`,
        { club_id: clubId, response_id: responseId }
      );
    } else if (response?.user_id && response.user_id === req.user.id) {
      // Student replied — notify teachers
      const teacherIds = await getTeacherIds(clubId);
      for (const tid of teacherIds) {
        await notify(tid, 'class_response_comment',
          'Student replied to answer comment',
          `A student replied to a comment on their answer.`,
          { club_id: clubId, response_id: responseId }
        );
      }
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// 1:1 DIRECT MESSAGES (private teacher ↔ student sessions)
// ═══════════════════════════════════════════════════════════════════════════════

function dmPair(a, b) {
  // Stable ordering: lower UUID first
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

// GET /api/clubs/:clubId/class/dm/:otherUserId
router.get('/:clubId/class/dm/:otherUserId', authenticate, async (req, res) => {
  const { clubId, otherUserId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;

  const { user_a, user_b } = dmPair(req.user.id, otherUserId);
  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_direct_messages')
      .select('id, author_id, body, read_at, created_at, author:profiles!class_direct_messages_author_id_fkey(id, display_name, avatar_url)')
      .eq('club_id', clubId)
      .eq('user_a', user_a)
      .eq('user_b', user_b)
      .order('created_at', { ascending: true });
    if (error) throw error;

    // Mark unread messages as read
    await supabase.schema('bookflow')
      .from('class_direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('club_id', clubId)
      .eq('user_a', user_a)
      .eq('user_b', user_b)
      .neq('author_id', req.user.id)
      .is('read_at', null);

    const norm = v => Array.isArray(v) ? v[0] ?? null : v;
    res.json((data || []).map(m => ({ ...m, author: norm(m.author) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clubs/:clubId/class/dm/:otherUserId
router.post('/:clubId/class/dm/:otherUserId', authenticate, async (req, res) => {
  const { clubId, otherUserId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;

  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });

  const { user_a, user_b } = dmPair(req.user.id, otherUserId);
  try {
    const { data: msg, error } = await supabase
      .schema('bookflow')
      .from('class_direct_messages')
      .insert({ club_id: clubId, user_a, user_b, author_id: req.user.id, body: body.trim() })
      .select('id, author_id, body, read_at, created_at, author:profiles!class_direct_messages_author_id_fkey(id, display_name, avatar_url)')
      .single();
    if (error) throw error;

    const norm = v => Array.isArray(v) ? v[0] ?? null : v;
    const result = { ...msg, author: norm(msg.author) };

    // Notify recipient
    await notify(otherUserId, 'class_dm',
      'New private message',
      `You have a new message in your class.`,
      { club_id: clubId }
    );

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUBMISSION COMMENTS  (threaded dialogue on assignments, linked to chapter/book)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/clubs/:clubId/class/submissions/:subId/comments
router.get('/:clubId/class/submissions/:subId/comments', authenticate, async (req, res) => {
  const { clubId, subId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;
  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submission_comments')
      .select('id, author_id, body, chapter_id, response_id, created_at, updated_at, author:profiles!class_submission_comments_author_id_fkey(id, display_name, avatar_url)')
      .eq('club_id', clubId)
      .eq('submission_id', subId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clubs/:clubId/class/submissions/:subId/comments
router.post('/:clubId/class/submissions/:subId/comments', authenticate, async (req, res) => {
  const { clubId, subId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;
  const { body, chapter_id, response_id } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });

  try {
    // Verify submission belongs to this club
    const { data: sub, error: subErr } = await supabase
      .schema('bookflow')
      .from('class_submissions')
      .select('id, student_id')
      .eq('id', subId)
      .eq('club_id', clubId)
      .maybeSingle();
    if (subErr || !sub) return res.status(404).json({ error: 'Submission not found' });

    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submission_comments')
      .insert({ club_id: clubId, submission_id: subId, author_id: req.user.id, body: body.trim(), chapter_id: chapter_id || null, response_id: response_id || null })
      .select('id, author_id, body, chapter_id, response_id, created_at, updated_at, author:profiles!class_submission_comments_author_id_fkey(id, display_name, avatar_url)')
      .single();
    if (error) throw error;

    const isTeacher = role === 'owner' || role === 'admin';
    if (isTeacher) {
      // Notify student
      await notify(sub.student_id, 'class_response_comment', 'New comment on your submission', `Your teacher commented on your submission.`, { club_id: clubId });
    } else {
      // Notify all teachers
      const teacherIds = await getTeacherIds(clubId);
      for (const tid of teacherIds) {
        if (tid !== req.user.id) {
          await notify(tid, 'class_response_comment', 'Student replied on submission', `A student replied on their submission.`, { club_id: clubId });
        }
      }
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clubs/:clubId/class/submissions/:subId/comments/:commentId
router.delete('/:clubId/class/submissions/:subId/comments/:commentId', authenticate, async (req, res) => {
  const { clubId, commentId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;
  try {
    const { error } = await supabase
      .schema('bookflow')
      .from('class_submission_comments')
      .delete()
      .eq('id', commentId)
      .eq('club_id', clubId)
      .eq('author_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Student note / teacher follow-up on feedback ─────────────────────────────

// PATCH /api/clubs/:clubId/class/submissions/:subId/feedback/student-note
// Student replies to feedback they received
router.patch('/:clubId/class/submissions/:subId/feedback/student-note', authenticate, async (req, res) => {
  const { clubId, subId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;
  if (role === 'owner' || role === 'admin') return res.status(403).json({ error: 'Students only' });

  const { student_note } = req.body;
  if (typeof student_note !== 'string') return res.status(400).json({ error: 'student_note required' });

  try {
    const { data: sub } = await supabase.schema('bookflow').from('class_submissions').select('student_id').eq('id', subId).eq('club_id', clubId).maybeSingle();
    if (!sub || sub.student_id !== req.user.id) return res.status(403).json({ error: 'Not your submission' });

    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submission_feedback')
      .update({ student_note: student_note.trim() || null, student_noted_at: new Date().toISOString() })
      .eq('submission_id', subId)
      .eq('club_id', clubId)
      .select()
      .single();
    if (error) throw error;

    // Notify teachers
    const teacherIds = await getTeacherIds(clubId);
    for (const tid of teacherIds) {
      await notify(tid, 'class_response_comment', 'Student replied to feedback', `A student left a note on your feedback.`, { club_id: clubId });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clubs/:clubId/class/submissions/:subId/feedback/follow-up
// Teacher adds a follow-up note after student replied
router.patch('/:clubId/class/submissions/:subId/feedback/follow-up', authenticate, async (req, res) => {
  const { clubId, subId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;

  const { teacher_follow_up } = req.body;
  if (typeof teacher_follow_up !== 'string') return res.status(400).json({ error: 'teacher_follow_up required' });

  try {
    const { data, error } = await supabase
      .schema('bookflow')
      .from('class_submission_feedback')
      .update({ teacher_follow_up: teacher_follow_up.trim() || null, follow_up_at: new Date().toISOString() })
      .eq('submission_id', subId)
      .eq('club_id', clubId)
      .select()
      .single();
    if (error) throw error;

    // Notify student
    const { data: sub } = await supabase.schema('bookflow').from('class_submissions').select('student_id').eq('id', subId).single();
    if (sub?.student_id) {
      await notify(sub.student_id, 'class_feedback_posted', 'Teacher follow-up on your submission', `Your teacher added a follow-up note on your submission.`, { club_id: clubId });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS REPORT  — rich snapshot for PDF/print
// GET /api/clubs/:clubId/class/progress-report/:studentId  (teacher)
// GET /api/clubs/:clubId/class/my-progress-report          (student)
// ═══════════════════════════════════════════════════════════════════════════════

async function buildProgressReport(clubId, studentId) {
  // Club info
  const { data: club } = await supabase.schema('bookflow').from('book_clubs')
    .select('id, name, description, cover_image_url').eq('id', clubId).single();

  // Student profile
  const { data: profile } = await supabase.schema('bookflow').from('profiles')
    .select('id, display_name, avatar_url, email').eq('id', studentId).single();

  // Enrolled date
  const { data: membership } = await supabase.schema('bookflow').from('club_members')
    .select('invite_accepted_at, role').eq('club_id', clubId).eq('user_id', studentId).maybeSingle();

  // All books in this class
  const { data: clubBooks } = await supabase.schema('bookflow').from('club_books')
    .select('book_id, is_current, book:books!club_books_book_id_fkey(id, title, cover_image_url)')
    .eq('club_id', clubId).order('created_at', { ascending: true });

  const bookReports = [];
  for (const cb of (clubBooks || [])) {
    const book = Array.isArray(cb.book) ? cb.book[0] : cb.book;
    if (!book) continue;

    const { data: chapters } = await supabase.schema('bookflow').from('chapters')
      .select('id, title, order_index, content')
      .eq('book_id', book.id).eq('status', 'published').order('order_index', { ascending: true });

    const chapterIds = (chapters || []).map(c => c.id);

    const { data: allInline } = await supabase.schema('bookflow').from('inline_content')
      .select('id, chapter_id, content_type, label')
      .in('chapter_id', chapterIds).in('content_type', TRACKABLE_TYPES);

    const { data: completions } = await supabase.schema('bookflow').from('chapter_item_completions')
      .select('chapter_id, item_key, completed_at')
      .in('chapter_id', chapterIds).eq('user_id', studentId);

    const { data: responses } = await supabase.schema('bookflow').from('form_responses')
      .select('id, inline_content_id, response_data, created_at')
      .in('inline_content_id', (allInline || []).map(ic => ic.id)).eq('user_id', studentId);

    const chapterRows = (chapters || []).map(ch => {
      const inline = (allInline || []).filter(ic => ic.chapter_id === ch.id);
      const mediaCount = extractMediaKeys(ch.content?.content || [], ch.id).length;
      const total = inline.length + mediaCount;
      const completed = (completions || []).filter(c => c.chapter_id === ch.id).length;
      const chResponses = (responses || []).filter(r => inline.some(ic => ic.id === r.inline_content_id));
      return { chapter_id: ch.id, title: ch.title, order_index: ch.order_index, completed, total, responses: chResponses };
    });

    const totalCompleted = chapterRows.reduce((a, c) => a + c.completed, 0);
    const totalItems = chapterRows.reduce((a, c) => a + c.total, 0);
    bookReports.push({ book, is_current: cb.is_current, chapters: chapterRows, items_completed: totalCompleted, items_total: totalItems, completion_pct: totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0 });
  }

  // Submissions + feedback
  const { data: submissions } = await supabase.schema('bookflow').from('class_submissions')
    .select('id, title, body, status, submitted_at, created_at, prompt:class_submission_prompts(title, prompt_type, chapter_id), feedback:class_submission_feedback(grade, feedback_text, student_note, teacher_follow_up, created_at)')
    .eq('club_id', clubId).eq('student_id', studentId).order('created_at', { ascending: true });

  // Q&A feedback (graded answers)
  const { data: answerFeedback } = await supabase.schema('bookflow').from('class_answer_feedback')
    .select('id, response_id, grade, feedback_text, created_at')
    .eq('club_id', clubId).eq('student_id', studentId);

  // Compute grade average
  const grades = (submissions || []).map(s => s.feedback?.grade).filter(g => g != null);
  const answerGrades = (answerFeedback || []).map(a => a.grade).filter(g => g != null);
  const allGrades = [...grades, ...answerGrades];
  const avgGrade = allGrades.length > 0 ? Math.round(allGrades.reduce((a, b) => a + b, 0) / allGrades.length) : null;

  return {
    generated_at: new Date().toISOString(),
    club,
    profile,
    enrollment: membership ? { enrolled_at: membership.invite_accepted_at, role: membership.role } : null,
    books: bookReports,
    submissions: submissions || [],
    answer_feedback: answerFeedback || [],
    summary: {
      avg_grade: avgGrade,
      submissions_submitted: (submissions || []).filter(s => s.status !== 'draft').length,
      submissions_graded: (submissions || []).filter(s => s.status === 'graded').length,
      total_prompts_assigned: (submissions || []).length,
    },
  };
}

// Teacher: view any student's report
router.get('/:clubId/class/progress-report/:studentId', authenticate, async (req, res) => {
  const { clubId, studentId } = req.params;
  const role = await requireClassAccess(req, res, 'teacher');
  if (!role) return;
  try {
    res.json(await buildProgressReport(clubId, studentId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student: view own report
router.get('/:clubId/class/my-progress-report', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;
  try {
    res.json(await buildProgressReport(clubId, req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clubs/:clubId/class/dm — list all DM conversations for current user
router.get('/:clubId/class/dm', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;

  try {
    // Get all messages where user is a participant, grouped by other party
    const { data: msgs } = await supabase
      .schema('bookflow')
      .from('class_direct_messages')
      .select('id, user_a, user_b, author_id, body, read_at, created_at')
      .eq('club_id', clubId)
      .or(`user_a.eq.${req.user.id},user_b.eq.${req.user.id}`)
      .order('created_at', { ascending: false });

    // Group by conversation partner
    const convMap = {};
    for (const m of (msgs || [])) {
      const otherId = m.user_a === req.user.id ? m.user_b : m.user_a;
      if (!convMap[otherId]) {
        convMap[otherId] = { other_user_id: otherId, last_message: m.body, last_at: m.created_at, unread_count: 0 };
      }
      if (!m.read_at && m.author_id !== req.user.id) convMap[otherId].unread_count++;
    }

    const otherIds = Object.keys(convMap);
    if (!otherIds.length) return res.json([]);

    const { data: profiles } = await supabase
      .schema('bookflow')
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', otherIds);

    const result = otherIds.map(id => ({
      ...convMap[id],
      profile: (profiles || []).find(p => p.id === id) || null,
    })).sort((a, b) => b.last_at.localeCompare(a.last_at));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;
