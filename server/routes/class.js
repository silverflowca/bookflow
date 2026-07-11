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
    // Load all accepted members with profile
    const { data: members, error: mErr } = await supabase
      .schema('bookflow')
      .from('club_members')
      .select('user_id, role, invite_accepted_at, profile:profiles!club_members_user_id_fkey(display_name, avatar_url)')
      .eq('club_id', clubId)
      .not('invite_accepted_at', 'is', null);
    if (mErr) throw mErr;

    // Load current club book
    const { data: clubBook } = await supabase
      .schema('bookflow')
      .from('club_books')
      .select('book_id')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

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
// MY PROGRESS (student self-view)
// GET /api/clubs/:clubId/class/my-progress
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:clubId/class/my-progress', authenticate, async (req, res) => {
  const { clubId } = req.params;
  const role = await requireClassAccess(req, res, 'member');
  if (!role) return;

  const userId = req.user.id;

  try {
    // Current book
    const { data: clubBook } = await supabase
      .schema('bookflow')
      .from('club_books')
      .select('book_id, book:books(id, title, cover_image_url)')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

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

  const { title, body, prompt_type, chapter_id, is_required, due_date, sort_order } = req.body;
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

  const allowed = ['title', 'body', 'prompt_type', 'chapter_id', 'is_required', 'due_date', 'sort_order'];
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


export default router;
