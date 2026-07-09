import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { createHash, randomBytes } from 'crypto';

const router = express.Router();

// Get app settings for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;

    // Return defaults if no settings exist
    if (!data) {
      return res.json({
        fileflow_url: process.env.FILEFLOW_URL || 'http://localhost:8680',
        fileflow_access_key: '',
        deepgram_api_key: '',
        restream_client_id: '',
        restream_client_secret: '',
        home_tagline: '',
        feature_demo_book_id: null,
        resend_api_key: '',
        email_from: '',
      });
    }

    res.json({
      fileflow_url: data.fileflow_url,
      fileflow_access_key: data.fileflow_access_key || '',
      deepgram_api_key: data.deepgram_api_key || '',
      restream_client_id: data.restream_client_id || '',
      restream_client_secret: data.restream_client_secret || '',
      home_tagline: data.home_tagline || '',
      feature_demo_book_id: data.feature_demo_book_id || null,
      resend_api_key: data.resend_api_key || '',
      email_from: data.email_from || '',
    });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update app settings
router.put('/', authenticate, async (req, res) => {
  const { fileflow_url, fileflow_access_key, deepgram_api_key, restream_client_id, restream_client_secret, home_tagline, feature_demo_book_id, resend_api_key, email_from } = req.body;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({
        user_id: req.user.id,
        fileflow_url,
        fileflow_access_key,
        deepgram_api_key: deepgram_api_key || '',
        restream_client_id: restream_client_id || '',
        restream_client_secret: restream_client_secret || '',
        home_tagline: home_tagline || '',
        feature_demo_book_id: feature_demo_book_id || null,
        resend_api_key: resend_api_key || '',
        email_from: email_from || '',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      fileflow_url: data.fileflow_url,
      fileflow_access_key: data.fileflow_access_key || '',
      deepgram_api_key: data.deepgram_api_key || '',
      restream_client_id: data.restream_client_id || '',
      restream_client_secret: data.restream_client_secret || '',
      home_tagline: data.home_tagline || '',
      feature_demo_book_id: data.feature_demo_book_id || null,
      resend_api_key: data.resend_api_key || '',
      email_from: data.email_from || '',
    });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Public home page settings — no auth required, returns display-only fields
router.get('/public', async (req, res) => {
  try {
    // Find the first super_admin's settings to use as the site-wide config
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('system_role', 'super_admin')
      .limit(1)
      .maybeSingle();

    if (!admin) return res.json({ home_tagline: '', feature_demo_book_id: null });

    const { data } = await supabase
      .from('app_settings')
      .select('home_tagline, feature_demo_book_id')
      .eq('user_id', admin.id)
      .maybeSingle();

    res.json({
      home_tagline: data?.home_tagline || '',
      feature_demo_book_id: data?.feature_demo_book_id || null,
    });
  } catch (err) {
    res.json({ home_tagline: '', feature_demo_book_id: null });
  }
});

// ── API Key Management ────────────────────────────────────────────────────────

// List API keys for current user (never returns raw key)
router.get('/api-keys', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, last_used_at, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate a new API key — returns raw key ONCE
router.post('/api-keys', authenticate, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Key name is required' });
  try {
    const rawKey = 'bfk_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const { data, error } = await supabase
      .from('api_keys')
      .insert({ user_id: req.user.id, key_hash: keyHash, name: name.trim() })
      .select('id, name, created_at')
      .single();
    if (error) throw error;
    res.status(201).json({ ...data, key: rawKey });
  } catch (err) {
    console.error('Create API key error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Revoke an API key
router.delete('/api-keys/:id', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete API key error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Test FileFlow connection
router.post('/test-fileflow', authenticate, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${url}/api/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: `Server returned ${response.status}` });
    }
  } catch (err) {
    console.error('FileFlow connection test failed:', err);
    res.json({
      success: false,
      error: err.name === 'AbortError' ? 'Connection timeout' : err.message,
    });
  }
});

export default router;
