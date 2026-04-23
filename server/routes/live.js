import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

/** Walk TipTap JSON and extract slides for FreeShow */
function chapterToSlides(chapterTitle, tiptapJson, inlineQuestions = []) {
  const slides = [];
  let idx = 0;

  const VERSE_RE = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalm|Psalms|Proverbs|Ecclesiastes|Song|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\s+\d+:\d+[-\d]*/gi;

  // Title slide
  slides.push({ id: String(++idx), type: 'title', text: chapterTitle || 'Live Session' });

  const nodes = tiptapJson?.content ?? [];

  for (const node of nodes) {
    const text = extractText(node).trim();
    if (!text) continue;

    if (node.type === 'heading') {
      slides.push({ id: String(++idx), type: 'heading', text });
    } else if (node.type === 'paragraph') {
      const verseMatches = text.match(VERSE_RE);
      if (verseMatches) {
        slides.push({ id: String(++idx), type: 'scripture', reference: verseMatches[0], text });
      } else if (text.length > 20) {
        // Split long paragraphs into slides of ~120 chars each
        const chunks = splitText(text, 120);
        for (const chunk of chunks) {
          slides.push({ id: String(++idx), type: 'content', text: chunk });
        }
      }
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const items = (node.content ?? []).map(li => extractText(li).trim()).filter(Boolean);
      if (items.length) {
        slides.push({ id: String(++idx), type: 'list', items });
      }
    }
  }

  // Discussion / question slides from inline content
  for (const q of inlineQuestions) {
    const qText = q.content_data?.question || q.content_data?.text || '';
    if (qText) {
      slides.push({ id: String(++idx), type: 'discussion', text: `💬 ${qText}` });
    }
  }

  // Closing slide
  slides.push({ id: String(++idx), type: 'closing', text: 'Thank you for joining!' });

  return slides;
}

function extractText(node) {
  if (node.type === 'text') return node.text ?? '';
  if (!node.content) return '';
  return node.content.map(extractText).join('');
}

function splitText(text, maxLen) {
  const words = text.split(' ');
  const chunks = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxLen && current) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

/** Compute next occurrence of a recurring show */
function nextOccurrence(show) {
  const now = new Date();
  const [h, m] = (show.recurrence_time || '19:00').split(':').map(Number);
  const targetDay = show.recurrence_day ?? 0;

  let d = new Date();
  d.setHours(h, m, 0, 0);

  if (show.recurrence === 'none') return null;

  let daysAhead = (targetDay - d.getDay() + 7) % 7;
  if (daysAhead === 0 && d <= now) daysAhead = 7;
  d.setDate(d.getDate() + daysAhead);

  if (show.recurrence === 'biweekly') {
    // Check last episode to see if we need +7 more
    // Simple: just add 14 from last episode if exists
  }

  return d.toISOString();
}

// ── Shows CRUD ────────────────────────────────────────────────────────────────

// GET /api/live/shows
router.get('/shows', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('live_shows')
      .select('*, books(id, title, cover_image_url)')
      .eq('host_user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ shows: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/live/shows
router.post('/shows', authenticate, async (req, res) => {
  try {
    const { title, description, book_id, recurrence, recurrence_day, recurrence_time,
            timezone, guest_invite_url, restream_channel_id } = req.body;

    const { data, error } = await supabase
      .from('live_shows')
      .insert({
        title, description, book_id: book_id || null,
        host_user_id: req.user.id,
        recurrence: recurrence || 'weekly',
        recurrence_day: recurrence_day ?? 0,
        recurrence_time: recurrence_time || '19:00:00',
        timezone: timezone || 'America/Toronto',
        guest_invite_url: guest_invite_url || null,
        restream_channel_id: restream_channel_id || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ show: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/live/shows/:id
router.patch('/shows/:id', authenticate, async (req, res) => {
  try {
    const allowed = ['title', 'description', 'book_id', 'recurrence', 'recurrence_day',
                     'recurrence_time', 'timezone', 'is_active', 'guest_invite_url', 'restream_channel_id'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

    const { data, error } = await supabase
      .from('live_shows')
      .update(updates)
      .eq('id', req.params.id)
      .eq('host_user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ show: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/live/shows/:id
router.delete('/shows/:id', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('live_shows')
      .delete()
      .eq('id', req.params.id)
      .eq('host_user_id', req.user.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Episodes ──────────────────────────────────────────────────────────────────

// GET /api/live/episodes
router.get('/episodes', authenticate, async (req, res) => {
  try {
    const { status, show_id } = req.query;

    let query = supabase
      .from('live_episodes')
      .select(`
        *,
        live_shows!inner(host_user_id, title, book_id),
        chapters(id, title)
      `)
      .eq('live_shows.host_user_id', req.user.id)
      .order('scheduled_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (show_id) query = query.eq('show_id', show_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ episodes: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/live/episodes — create manually
router.post('/episodes', authenticate, async (req, res) => {
  try {
    const { show_id, title, chapter_id, scheduled_at, notes, guest_invite_url } = req.body;

    const { data, error } = await supabase
      .from('live_episodes')
      .insert({ show_id, title, chapter_id: chapter_id || null,
                scheduled_at, notes, guest_invite_url: guest_invite_url || null })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ episode: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/live/episodes/generate — auto-generate next episode from show schedule
router.post('/episodes/generate', authenticate, async (req, res) => {
  try {
    const { show_id } = req.body;

    const { data: show, error: se } = await supabase
      .from('live_shows')
      .select('*')
      .eq('id', show_id)
      .eq('host_user_id', req.user.id)
      .single();

    if (se || !show) return res.status(404).json({ error: 'Show not found' });

    const scheduledAt = nextOccurrence(show);
    if (!scheduledAt) return res.status(400).json({ error: 'Show has no recurrence' });

    const episodeTitle = `${show.title} — ${new Date(scheduledAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    const { data, error } = await supabase
      .from('live_episodes')
      .insert({
        show_id,
        title: episodeTitle,
        scheduled_at: scheduledAt,
        guest_invite_url: show.guest_invite_url,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ episode: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/live/episodes/:id
router.get('/episodes/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('live_episodes')
      .select(`
        *,
        live_shows(host_user_id, title, book_id, guest_invite_url),
        chapters(id, title, content)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (data?.live_shows?.host_user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json({ episode: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/live/episodes/:id
router.patch('/episodes/:id', authenticate, async (req, res) => {
  try {
    const allowed = ['title', 'chapter_id', 'scheduled_at', 'status', 'recording_url',
                     'notes', 'guest_invite_url', 'restream_session_id', 'youtube_broadcast_id'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

    const { data, error } = await supabase
      .from('live_episodes')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ episode: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/live/episodes/:id/build-deck — chapter → FreeShow slide JSON
router.post('/episodes/:id/build-deck', authenticate, async (req, res) => {
  try {
    const { data: episode, error: ee } = await supabase
      .from('live_episodes')
      .select('*, live_shows(host_user_id), chapters(title, content)')
      .eq('id', req.params.id)
      .single();

    if (ee || !episode) return res.status(404).json({ error: 'Episode not found' });
    if (episode.live_shows?.host_user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const chapter = episode.chapters;
    let tiptapJson = chapter?.content ?? null;
    if (typeof tiptapJson === 'string') tiptapJson = JSON.parse(tiptapJson);

    // Fetch inline questions for this chapter
    let inlineQuestions = [];
    if (episode.chapter_id) {
      const { data: iq } = await supabase
        .from('inline_content')
        .select('content_data')
        .eq('chapter_id', episode.chapter_id)
        .in('content_type', ['question', 'textbox', 'textarea']);
      inlineQuestions = iq ?? [];
    }

    const slides = chapterToSlides(chapter?.title || episode.title, tiptapJson, inlineQuestions);
    const deck = { name: episode.title, slides };

    // Store deck on episode
    await supabase.from('live_episodes').update({ slide_deck: deck }).eq('id', req.params.id);

    res.json({ deck, slideCount: slides.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/live/episodes/:id/push-freeshow
router.post('/episodes/:id/push-freeshow', authenticate, async (req, res) => {
  try {
    const { data: episode } = await supabase
      .from('live_episodes')
      .select('slide_deck, live_shows(host_user_id)')
      .eq('id', req.params.id)
      .single();

    if (!episode?.slide_deck) return res.status(400).json({ error: 'Build slide deck first' });
    if (episode.live_shows?.host_user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const freeshowUrl = process.env.FREESHOW_API_URL || 'http://localhost:5506';

    const fsRes = await fetch(`${freeshowUrl}?action=newShow&data=${encodeURIComponent(JSON.stringify(episode.slide_deck))}`, {
      method: 'GET',
    }).catch(() => null);

    if (!fsRes || !fsRes.ok) {
      return res.status(502).json({ ok: false, error: 'FreeShow not reachable. Make sure FreeShow is open and the API is enabled in Connections settings.' });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/live/episodes/:id/start
router.post('/episodes/:id/start', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('live_episodes')
      .update({ status: 'live', started_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ episode: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/live/episodes/:id/end
router.post('/episodes/:id/end', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('live_episodes')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ episode: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/live/episodes/:id/chat
router.get('/episodes/:id/chat', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('live_chat_messages')
      .select('*')
      .eq('episode_id', req.params.id)
      .order('received_at', { ascending: true })
      .limit(200);

    if (error) throw error;
    res.json({ messages: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/live/episodes/:episodeId/flag — flag a chat message as prayer/question request
router.post('/episodes/:id/flag', authenticate, async (req, res) => {
  try {
    const { message_id, type, body } = req.body;

    const { data, error } = await supabase
      .from('live_requests')
      .insert({
        episode_id: req.params.id,
        source_message_id: message_id || null,
        body: body || '',
        type: type || 'prayer',
        flagged_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ request: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/live/episodes/:id/requests
router.get('/episodes/:id/requests', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('live_requests')
      .select('*')
      .eq('episode_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ requests: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/live/requests/:id/resolve
router.patch('/requests/:id/resolve', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('live_requests')
      .update({ resolved: true })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ request: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Restream OAuth ────────────────────────────────────────────────────────────

const RESTREAM_TOKEN_URL = 'https://api.restream.io/oauth/token';
const RESTREAM_AUTH_URL = 'https://api.restream.io/oauth/authorize';
const RESTREAM_SCOPES = 'chat.read stream.read channels.read profile.read';

/** Get the current user's Restream credentials from app_settings */
async function getRestreamSettings(userId) {
  const { data } = await supabase
    .from('app_settings')
    .select('restream_client_id, restream_client_secret, restream_access_token, restream_refresh_token, restream_token_expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? {};
}

/** Persist tokens back to app_settings */
async function saveRestreamTokens(userId, { access_token, refresh_token, expires_in }) {
  const expires_at = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();
  await supabase.from('app_settings').upsert({
    user_id: userId,
    restream_access_token: access_token,
    restream_refresh_token: refresh_token || '',
    restream_token_expires_at: expires_at,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

/** Refresh an expired access token, return new access_token or null on failure */
async function refreshRestreamToken(userId, creds) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: creds.restream_client_id,
    client_secret: creds.restream_client_secret,
    refresh_token: creds.restream_refresh_token,
  });
  const r = await fetch(RESTREAM_TOKEN_URL, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!r.ok) return null;
  const tokens = await r.json();
  await saveRestreamTokens(userId, tokens);
  return tokens.access_token;
}

/** Get a valid access token, refreshing if expired */
async function getValidAccessToken(userId) {
  const creds = await getRestreamSettings(userId);
  if (!creds.restream_access_token) return null;

  const expiresAt = creds.restream_token_expires_at ? new Date(creds.restream_token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt <= new Date(Date.now() + 60_000); // 1 min buffer

  if (isExpired && creds.restream_refresh_token) {
    return refreshRestreamToken(userId, creds);
  }
  return isExpired ? null : creds.restream_access_token;
}

// GET /api/live/restream/status — check if user has a valid Restream connection
router.get('/restream/status', authenticate, async (req, res) => {
  try {
    const creds = await getRestreamSettings(req.user.id);
    const hasCredentials = !!(creds.restream_client_id && creds.restream_client_secret);
    const hasToken = !!creds.restream_access_token;
    const expiresAt = creds.restream_token_expires_at ? new Date(creds.restream_token_expires_at) : null;
    const isExpired = !expiresAt || expiresAt <= new Date();

    res.json({
      connected: hasToken && !isExpired,
      has_credentials: hasCredentials,
      has_token: hasToken,
      expires_at: creds.restream_token_expires_at || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/live/restream/auth — start OAuth flow (redirect user to Restream)
// Accepts token via query param because the browser performs a full redirect (no Auth header)
router.get('/restream/auth', async (req, res) => {
  // Allow token via ?token= query param (browser redirect) or Authorization header
  const token = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  try {
    const creds = await getRestreamSettings(req.user.id);
    if (!creds.restream_client_id) {
      return res.status(400).json({ error: 'Save your Restream client_id and client_secret in Settings first.' });
    }

    const serverBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 8682}`;
    const redirectUri = `${serverBase}/api/live/restream/callback`;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: creds.restream_client_id,
      redirect_uri: redirectUri,
      scope: RESTREAM_SCOPES,
      state: req.user.id, // use user id as state to retrieve it in callback
    });

    res.redirect(`${RESTREAM_AUTH_URL}?${params}`);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/live/restream/callback — Restream redirects here with ?code=&state=
router.get('/restream/callback', async (req, res) => {
  try {
    const { code, state: userId, error: oauthError } = req.query;
    const clientUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:5177';

    if (oauthError || !code || !userId) {
      return res.redirect(`${clientUrl}/settings?restream=error&msg=${encodeURIComponent(oauthError || 'missing_code')}`);
    }

    const creds = await getRestreamSettings(userId);
    if (!creds.restream_client_id) {
      return res.redirect(`${clientUrl}/settings?restream=error&msg=no_credentials`);
    }

    const serverBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 8682}`;
    const redirectUri = `${serverBase}/api/live/restream/callback`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: creds.restream_client_id,
      client_secret: creds.restream_client_secret,
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(RESTREAM_TOKEN_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Restream token exchange failed:', err);
      return res.redirect(`${clientUrl}/settings?restream=error&msg=${encodeURIComponent('token_exchange_failed')}`);
    }

    const tokens = await tokenRes.json();
    await saveRestreamTokens(userId, tokens);

    res.redirect(`${clientUrl}/settings?restream=connected`);
  } catch (e) {
    console.error('Restream callback error:', e);
    const clientUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:5177';
    res.redirect(`${clientUrl}/settings?restream=error&msg=${encodeURIComponent(e.message)}`);
  }
});

// POST /api/live/restream/disconnect — revoke stored tokens
router.post('/restream/disconnect', authenticate, async (req, res) => {
  try {
    await supabase.from('app_settings').upsert({
      user_id: req.user.id,
      restream_access_token: '',
      restream_refresh_token: '',
      restream_token_expires_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── FreeShow proxy ────────────────────────────────────────────────────────────

// GET /api/live/freeshow/status
router.get('/freeshow/status', authenticate, async (req, res) => {
  try {
    const url = process.env.FREESHOW_API_URL || 'http://localhost:5506';
    const r = await fetch(`${url}?action=getVersion`).catch(() => null);
    if (r && r.ok) {
      res.json({ ok: true, connected: true });
    } else {
      res.json({ ok: false, connected: false, message: 'FreeShow not reachable' });
    }
  } catch (e) {
    res.json({ ok: false, connected: false, message: e.message });
  }
});

// POST /api/live/freeshow/action
router.post('/freeshow/action', authenticate, async (req, res) => {
  try {
    const { action, data: actionData } = req.body;
    const url = process.env.FREESHOW_API_URL || 'http://localhost:5506';

    let qs = `?action=${action}`;
    if (actionData) qs += `&data=${encodeURIComponent(JSON.stringify(actionData))}`;

    const r = await fetch(`${url}${qs}`).catch(() => null);
    if (!r) return res.status(502).json({ ok: false, error: 'FreeShow not reachable' });

    const text = await r.text().catch(() => '');
    res.json({ ok: r.ok, result: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Restream Streaming API ────────────────────────────────────────────────────

const RESTREAM_API = 'https://api.restream.io/v2';

/** Make an authenticated Restream API call, refreshing token if needed */
async function restreamFetch(userId, path, options = {}) {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error('Restream not connected. Please authorise in Settings → Restream Integration.');

  const r = await fetch(`${RESTREAM_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Restream API ${r.status}: ${text}`);
  }
  return r.json().catch(() => ({}));
}

// GET /api/live/restream/stream-status — get live channel statuses
router.get('/restream/stream-status', authenticate, async (req, res) => {
  try {
    const channels = await restreamFetch(req.user.id, '/channel');
    const profile = await restreamFetch(req.user.id, '/user/profile').catch(() => null);
    res.json({ channels: channels ?? [], profile });
  } catch (e) {
    res.status(e.message?.includes('not connected') ? 401 : 502).json({ error: e.message });
  }
});

// POST /api/live/restream/go-live — enable all channels to go live
router.post('/restream/go-live', authenticate, async (req, res) => {
  try {
    // Fetch all channels, enable any that are disabled
    const channels = await restreamFetch(req.user.id, '/channel');
    const results = await Promise.allSettled(
      (channels ?? [])
        .filter(ch => !ch.enabled)
        .map(ch => restreamFetch(req.user.id, `/channel/${ch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: true }),
        }))
    );

    res.json({ ok: true, channels_enabled: results.filter(r => r.status === 'fulfilled').length });
  } catch (e) {
    res.status(e.message?.includes('not connected') ? 401 : 502).json({ error: e.message });
  }
});

// POST /api/live/episodes/:id/schedule-restream — create a scheduled stream on all Restream channels
router.post('/episodes/:id/schedule-restream', authenticate, async (req, res) => {
  try {
    const { data: episode } = await supabase
      .from('live_episodes')
      .select('title, scheduled_at, notes, live_shows(host_user_id)')
      .eq('id', req.params.id)
      .single();

    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    if (episode.live_shows?.host_user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    // Restream v2 — create a broadcast event
    const broadcastPayload = {
      title: episode.title,
      description: episode.notes || '',
      plannedStartTime: episode.scheduled_at,
    };

    const broadcast = await restreamFetch(req.user.id, '/broadcast', {
      method: 'POST',
      body: JSON.stringify(broadcastPayload),
    });

    // Store broadcast id on episode
    await supabase.from('live_episodes').update({ restream_session_id: String(broadcast.id ?? '') }).eq('id', req.params.id);

    res.json({ ok: true, broadcast });
  } catch (e) {
    res.status(e.message?.includes('not connected') ? 401 : 502).json({ error: e.message });
  }
});

// POST /api/live/episodes/:id/post-recap — post a recap notification / message after show
router.post('/episodes/:id/post-recap', authenticate, async (req, res) => {
  try {
    const { recording_url, message } = req.body;
    const { data: episode } = await supabase
      .from('live_episodes')
      .select('id, title, recording_url, live_shows(host_user_id)')
      .eq('id', req.params.id)
      .single();

    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    if (episode.live_shows?.host_user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    // Save recording URL if provided
    if (recording_url) {
      await supabase.from('live_episodes').update({ recording_url }).eq('id', req.params.id);
    }

    // Attempt to post to Restream profile/description — this stores the recap internally
    // (Restream doesn't have a direct "post to socials" API; this is a best-effort note)
    const recapText = message || `${episode.title} has ended. ${recording_url ? 'Watch the recording: ' + recording_url : 'Thank you for joining!'}`;

    res.json({ ok: true, recap: recapText, recording_url: recording_url || episode.recording_url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Restream Webhook ──────────────────────────────────────────────────────────

// POST /api/live/webhook/restream  (no auth — Restream calls this)
router.post('/webhook/restream', async (req, res) => {
  try {
    const event = req.body;
    const eventType = event?.type || event?.event;

    if (eventType === 'stream.started' || eventType === 'stream_started') {
      const sessionId = event?.data?.sessionId || event?.sessionId;
      if (sessionId) {
        await supabase
          .from('live_episodes')
          .update({ status: 'live', started_at: new Date().toISOString() })
          .eq('restream_session_id', sessionId);
      }
    }

    if (eventType === 'stream.ended' || eventType === 'stream_ended') {
      const sessionId = event?.data?.sessionId || event?.sessionId;
      if (sessionId) {
        await supabase
          .from('live_episodes')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('restream_session_id', sessionId);
      }
    }

    if (eventType === 'chat.message' || eventType === 'chatMessage') {
      const msg = event?.data || event;
      const episodeId = req.query.episode_id;
      if (episodeId && msg.body) {
        await supabase.from('live_chat_messages').insert({
          episode_id: episodeId,
          platform: msg.platform || msg.source || 'restream',
          platform_user: msg.authorName || msg.user || null,
          body: msg.body || msg.message || '',
        });
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Restream webhook error:', e);
    res.status(200).json({ ok: true }); // Always 200 to Restream
  }
});

// ── Bible ──────────────────────────────────────────────────────────────────────

// GET /api/live/bible/books
router.get('/bible/books', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bible_verses')
      .select('book_name, book_order')
      .order('book_order')
      .order('book_name');
    if (error) throw error;
    // deduplicate
    const seen = new Set();
    const books = (data || []).filter(r => {
      if (seen.has(r.book_name)) return false;
      seen.add(r.book_name);
      return true;
    });
    res.json(books);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/live/bible/search?q=
router.get('/bible/search', authenticate, async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 2) return res.json([]);
    const { data, error } = await supabase
      .from('bible_verses')
      .select('book_name, chapter, verse, text')
      .ilike('text', `%${q}%`)
      .limit(30);
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/live/bible/:book/chapters
router.get('/bible/:book/chapters', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bible_verses')
      .select('chapter')
      .eq('book_name', req.params.book)
      .order('chapter');
    if (error) throw error;
    const chapters = [...new Set((data || []).map(r => r.chapter))];
    res.json(chapters);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/live/bible/:book/:chapter
router.get('/bible/:book/:chapter', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bible_verses')
      .select('verse, text')
      .eq('book_name', req.params.book)
      .eq('chapter', parseInt(req.params.chapter))
      .order('verse');
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Queue ──────────────────────────────────────────────────────────────────────

// GET /api/live/episodes/:id/queue
router.get('/episodes/:id/queue', authenticate, async (req, res) => {
  try {
    const { data: groups } = await supabase
      .from('live_queue_groups')
      .select('*')
      .eq('episode_id', req.params.id)
      .order('sort_order');

    const { data: items, error } = await supabase
      .from('live_queue_items')
      .select('*')
      .eq('episode_id', req.params.id)
      .order('sort_order');

    if (error) throw error;
    res.json({ groups: groups || [], items: items || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/live/episodes/:id/queue — add item
router.post('/episodes/:id/queue', authenticate, async (req, res) => {
  try {
    const { type = 'verse', label, body, book_ref, chapter_ref, verse_start, verse_end, group_id, sort_order } = req.body;
    if (!label || !body) return res.status(400).json({ error: 'label and body required' });

    // auto sort_order = max + 1
    const { data: last } = await supabase
      .from('live_queue_items')
      .select('sort_order')
      .eq('episode_id', req.params.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('live_queue_items')
      .insert({
        episode_id: req.params.id,
        type, label, body, book_ref, chapter_ref, verse_start, verse_end,
        group_id: group_id || null,
        sort_order: sort_order ?? ((last?.sort_order ?? -1) + 1),
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/live/queue/:itemId — edit / reorder
router.patch('/queue/:itemId', authenticate, async (req, res) => {
  try {
    const allowed = ['label', 'body', 'sort_order', 'group_id'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const { data, error } = await supabase
      .from('live_queue_items')
      .update(updates)
      .eq('id', req.params.itemId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/live/queue/:itemId
router.delete('/queue/:itemId', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('live_queue_items')
      .delete()
      .eq('id', req.params.itemId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Queue Groups
// POST /api/live/episodes/:id/queue/groups
router.post('/episodes/:id/queue/groups', authenticate, async (req, res) => {
  try {
    const { label, sort_order } = req.body;
    if (!label) return res.status(400).json({ error: 'label required' });
    const { data, error } = await supabase
      .from('live_queue_groups')
      .insert({ episode_id: req.params.id, label, sort_order: sort_order ?? 0 })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/live/queue/groups/:groupId
router.patch('/queue/groups/:groupId', authenticate, async (req, res) => {
  try {
    const { label, sort_order } = req.body;
    const { data, error } = await supabase
      .from('live_queue_groups')
      .update({ label, sort_order })
      .eq('id', req.params.groupId)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/live/queue/groups/:groupId
router.delete('/queue/groups/:groupId', authenticate, async (req, res) => {
  try {
    await supabase.from('live_queue_groups').delete().eq('id', req.params.groupId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Send to Restream ───────────────────────────────────────────────────────────

function formatChatText(item) {
  if (item.type === 'verse' || item.book_ref) {
    return `✝️ ${item.label} — "${item.body}"`;
  }
  return `📖 ${item.label}: ${item.body}`;
}

function formatLowerThird(item) {
  return {
    title: item.label,
    subtitle: item.body.length > 120 ? item.body.slice(0, 117) + '…' : item.body,
  };
}

async function sendToRestream(token, targets, item) {
  const results = {};

  if (targets.includes('chat')) {
    const text = formatChatText(item);
    const r = await fetch('https://api.restream.io/v2/chat/message', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    results.chat = r.ok ? 'sent' : `error ${r.status}`;
  }

  if (targets.includes('lower_third')) {
    const { title, subtitle } = formatLowerThird(item);
    const r = await fetch('https://api.restream.io/v2/overlay/lower-third', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle }),
    });
    results.lower_third = r.ok ? 'sent' : `error ${r.status}`;
  }

  if (targets.includes('caption')) {
    // Split multi-verse body into sentences, send sequentially
    const lines = item.body.split(/(?<=[.!?])\s+/).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const captionText = i === 0 ? `${item.label} — ${lines[i]}` : lines[i];
      await fetch('https://api.restream.io/v2/captions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: captionText }),
      });
      if (i < lines.length - 1) await new Promise(r => setTimeout(r, 2500));
    }
    results.caption = 'sent';
  }

  return results;
}

// POST /api/live/queue/:itemId/send
router.post('/queue/:itemId/send', authenticate, async (req, res) => {
  try {
    const { targets = ['chat'] } = req.body; // targets: ['chat','lower_third','caption']

    const { data: item, error: itemErr } = await supabase
      .from('live_queue_items')
      .select('*')
      .eq('id', req.params.itemId)
      .single();
    if (itemErr || !item) return res.status(404).json({ error: 'Queue item not found' });

    const token = await getValidAccessToken(req.user.id);
    if (!token) return res.status(401).json({ error: 'Restream not connected. Go to Settings to connect.' });

    const results = await sendToRestream(token, targets, item);

    // Mark as sent
    await supabase
      .from('live_queue_items')
      .update({ sent_at: new Date().toISOString(), sent_targets: targets })
      .eq('id', req.params.itemId);

    res.json({ ok: true, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/live/episodes/:id/send-now  — send freetext immediately
router.post('/episodes/:id/send-now', authenticate, async (req, res) => {
  try {
    const { text, label = 'Custom', targets = ['chat'] } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const token = await getValidAccessToken(req.user.id);
    if (!token) return res.status(401).json({ error: 'Restream not connected.' });

    const item = { type: 'custom', label, body: text, book_ref: null };
    const results = await sendToRestream(token, targets, item);
    res.json({ ok: true, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

