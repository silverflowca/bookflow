/**
 * Feedback routes
 *
 * GET  /api/feedback/config           — get feedback config (admin)
 * PATCH /api/feedback/config          — update feedback config (admin)
 * POST /api/feedback/screenshots      — upload screenshot image
 * POST /api/feedback/audio            — upload audio recording
 * POST /api/feedback                  — submit feedback record
 * GET  /api/feedback                  — list all feedback (admin)
 * GET  /api/feedback/:id              — get detail (owner or admin)
 * PATCH /api/feedback/:id/status      — update status (admin)
 * POST /api/feedback/:id/comments     — add discussion reply (admin)
 */

import express from 'express';
import multer from 'multer';
import supabase from '../config/supabase.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:55321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SCREENSHOT_BUCKET = 'bookflow-feedback-screenshots';
const AUDIO_BUCKET = 'bookflow-feedback-audio';

// Multer for screenshots (10 MB, images only)
const uploadScreenshot = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Multer for audio (50 MB, audio only)
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Only audio files are allowed'));
  },
});

// ── Helper: upload buffer to Supabase Storage ─────────────────────────────────
async function uploadToStorage(bucket, storagePath, buffer, mimeType) {
  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: buffer,
    }
  );
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.message || `Storage upload failed (${uploadRes.status})`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;
}

// ── Helper: notify user of a feedback reply ───────────────────────────────────
async function notifyFeedbackReply(userId, feedbackTitle, commentBody) {
  try {
    await supabase.from('user_notifications').insert({
      user_id: userId,
      type: 'feedback_reply',
      title: `Admin replied to your feedback: "${feedbackTitle}"`,
      body: commentBody.slice(0, 300),
    });
  } catch (err) {
    console.warn('[feedback] Failed to send notification:', err.message);
  }
}

// ── GET /config — get feedback config singleton (admin only) ──────────────────
router.get('/config', authenticate, requireSuperAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('feedback_config')
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[feedback] GET /config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /config — update feedback config singleton (admin only) ─────────────
router.patch('/config', authenticate, requireSuperAdmin, async (req, res) => {
  const { enabled, config } = req.body;
  try {
    // Fetch the singleton row id
    const { data: existing, error: fetchErr } = await supabase
      .from('feedback_config')
      .select('id')
      .single();
    if (fetchErr) throw fetchErr;

    const updates = { updated_at: new Date().toISOString(), updated_by: req.user.id };
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (config !== undefined) updates.config = config;

    const { data, error } = await supabase
      .from('feedback_config')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[feedback] PATCH /config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /screenshots — upload a screenshot image ─────────────────────────────
router.post('/screenshots', authenticate, uploadScreenshot.single('screenshot'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No screenshot file provided' });
  try {
    const ext = req.file.originalname.split('.').pop() || 'png';
    const storagePath = `screenshots/${req.user.id}/${Date.now()}.${ext}`;
    const publicUrl = await uploadToStorage(
      SCREENSHOT_BUCKET,
      storagePath,
      req.file.buffer,
      req.file.mimetype
    );
    res.json({ storage_path: publicUrl });
  } catch (err) {
    console.error('[feedback] POST /screenshots error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /audio — upload an audio recording ───────────────────────────────────
router.post('/audio', authenticate, uploadAudio.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
  try {
    const ext = req.file.mimetype.includes('mp4') ? 'm4a' : 'webm';
    const storagePath = `audio/${req.user.id}/${Date.now()}.${ext}`;
    const publicUrl = await uploadToStorage(
      AUDIO_BUCKET,
      storagePath,
      req.file.buffer,
      req.file.mimetype
    );
    const durationSeconds = parseFloat(req.body.duration_seconds) || null;
    res.json({ storage_path: publicUrl, duration_seconds: durationSeconds });
  } catch (err) {
    console.error('[feedback] POST /audio error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST / — submit feedback ──────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  const { type, title, description, page_url, user_agent, screenshots = [], audio = null } = req.body;

  if (!type || !title) {
    return res.status(400).json({ error: 'type and title are required' });
  }

  try {
    // Check if feedback is enabled
    const { data: cfg } = await supabase
      .from('feedback_config')
      .select('enabled, config')
      .single();

    if (cfg && !cfg.enabled) {
      return res.status(403).json({ error: 'Feedback is currently disabled' });
    }

    // Check if this specific user is disabled
    if (cfg?.config?.disabled_user_ids?.includes(req.user.id)) {
      return res.status(403).json({ error: 'Feedback is not available for your account' });
    }

    // Insert main feedback record
    const { data: feedback, error: fbErr } = await supabase
      .from('feedback')
      .insert({
        user_id: req.user.id,
        type,
        title: title.slice(0, 500),
        description: description || null,
        page_url: page_url || null,
        user_agent: user_agent || null,
      })
      .select()
      .single();
    if (fbErr) throw fbErr;

    // Insert screenshots
    if (screenshots.length > 0) {
      const screenshotRows = screenshots.map((s, i) => ({
        feedback_id: feedback.id,
        storage_path: s.storage_path,
        annotation_data: s.annotation_data || [],
        order_index: s.order_index ?? i,
        note: s.note || null,
        screenshot_audio_path: s.screenshot_audio_path || null,
      }));
      const { error: ssErr } = await supabase
        .from('feedback_screenshots')
        .insert(screenshotRows);
      if (ssErr) console.warn('[feedback] Screenshot insert warning:', ssErr.message);
    }

    // Insert audio
    if (audio?.storage_path) {
      const { error: audErr } = await supabase
        .from('feedback_audio')
        .insert({
          feedback_id: feedback.id,
          storage_path: audio.storage_path,
          duration_seconds: audio.duration_seconds || null,
        });
      if (audErr) console.warn('[feedback] Audio insert warning:', audErr.message);
    }

    res.status(201).json({ ...feedback, screenshots, audio });
  } catch (err) {
    console.error('[feedback] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /mine — list current user's own feedback submissions ─────────────────
router.get('/mine', authenticate, async (req, res) => {
  const { status, type, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * pageSize;

  try {
    let query = supabase
      .from('feedback')
      .select(`
        id, type, title, description, status, page_url, created_at, updated_at,
        screenshots:feedback_screenshots(id, storage_path, order_index, note),
        audio:feedback_audio(id, storage_path, duration_seconds),
        comments:feedback_comments(id, body, created_at, author:profiles!feedback_comments_author_id_fkey(id, display_name, avatar_url))
      `, { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;
    if (error) throw error;

    const normalized = (data ?? []).map(item => ({
      ...item,
      audio: Array.isArray(item.audio) ? (item.audio[0] ?? null) : item.audio,
    }));

    res.json({ data: normalized, count, page: pageNum, limit: pageSize });
  } catch (err) {
    console.error('[feedback] GET /mine error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET / — list all feedback (admin only) ────────────────────────────────────
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  const { status, type, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * pageSize;

  try {
    let query = supabase
      .from('feedback')
      .select(`
        *,
        user:profiles!feedback_user_id_fkey(id, display_name, email, avatar_url),
        screenshots:feedback_screenshots(id, storage_path, annotation_data, order_index, note, screenshot_audio_path),
        audio:feedback_audio(id, storage_path, duration_seconds)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;
    if (error) throw error;

    // PostgREST returns one-to-one FK joins as arrays — normalize audio to object|null
    const normalized = (data ?? []).map(item => ({
      ...item,
      audio: Array.isArray(item.audio) ? (item.audio[0] ?? null) : item.audio,
    }));

    res.json({ data: normalized, count, page: pageNum, limit: pageSize });
  } catch (err) {
    console.error('[feedback] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /:id — get feedback detail (owner or admin) ───────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: feedback, error } = await supabase
      .from('feedback')
      .select(`
        *,
        user:profiles!feedback_user_id_fkey(id, display_name, email, avatar_url),
        screenshots:feedback_screenshots(id, storage_path, annotation_data, order_index, note, screenshot_audio_path),
        audio:feedback_audio(id, storage_path, duration_seconds),
        comments:feedback_comments(
          id, body, created_at,
          author:profiles!feedback_comments_author_id_fkey(id, display_name, email, avatar_url)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !feedback) return res.status(404).json({ error: 'Feedback not found' });

    // Authorization: must be owner or super_admin
    const isOwner = feedback.user_id === req.user.id;
    const isAdmin = req.user.system_role === 'super_admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Normalize audio from array to object|null
    feedback.audio = Array.isArray(feedback.audio) ? (feedback.audio[0] ?? null) : feedback.audio;

    // Sort screenshots and comments
    if (feedback.screenshots) {
      feedback.screenshots.sort((a, b) => a.order_index - b.order_index);
    }
    if (feedback.comments) {
      feedback.comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    res.json(feedback);
  } catch (err) {
    console.error('[feedback] GET /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /:id — update title/description (owner or admin) ───────────────────
router.patch('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  try {
    const { data: feedback, error: fbErr } = await supabase
      .from('feedback')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (fbErr || !feedback) return res.status(404).json({ error: 'Feedback not found' });

    const isOwner = feedback.user_id === req.user.id;
    const isAdmin = req.user.system_role === 'super_admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Access denied' });

    const { data, error } = await supabase
      .from('feedback')
      .update({ title: title.trim().slice(0, 500), description: description?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[feedback] PATCH /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /:id/status — update status (admin only) ───────────────────────────
router.patch('/:id/status', authenticate, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }
  try {
    const { data, error } = await supabase
      .from('feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[feedback] PATCH /:id/status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/comments — add discussion reply (owner or admin) ────────────────
router.post('/:id/comments', authenticate, async (req, res) => {
  const { id } = req.params;
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });

  try {
    // Fetch feedback to get owner + title for authorization + notification
    const { data: feedback, error: fbErr } = await supabase
      .from('feedback')
      .select('id, user_id, title')
      .eq('id', id)
      .single();
    if (fbErr || !feedback) return res.status(404).json({ error: 'Feedback not found' });

    // Authorization: must be owner or super_admin
    const isOwner = feedback.user_id === req.user.id;
    const isAdmin = req.user.system_role === 'super_admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Insert comment
    const { data: comment, error: cmtErr } = await supabase
      .from('feedback_comments')
      .insert({ feedback_id: id, author_id: req.user.id, body: body.trim() })
      .select(`
        *,
        author:profiles!feedback_comments_author_id_fkey(id, display_name, email, avatar_url)
      `)
      .single();
    if (cmtErr) throw cmtErr;

    // Update feedback updated_at
    await supabase
      .from('feedback')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    // Notify: if owner replied → notify admins; if admin replied → notify owner
    if (isOwner) {
      // Notify all super_admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('system_role', 'super_admin');
      const adminIds = (admins || []).map(a => a.id).filter(aid => aid !== req.user.id);
      if (adminIds.length > 0) {
        await supabase.from('user_notifications').insert(
          adminIds.map(adminId => ({
            user_id: adminId,
            type: 'feedback_reply',
            title: `User replied to feedback: "${feedback.title}"`,
            body: body.trim().slice(0, 300),
          }))
        );
      }
    } else if (isAdmin && feedback.user_id !== req.user.id) {
      await notifyFeedbackReply(feedback.user_id, feedback.title, body.trim());
    }

    res.status(201).json(comment);
  } catch (err) {
    console.error('[feedback] POST /:id/comments error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
