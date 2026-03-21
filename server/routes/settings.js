import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

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
      });
    }

    res.json({
      fileflow_url: data.fileflow_url,
      fileflow_access_key: data.fileflow_access_key || '',
      deepgram_api_key: data.deepgram_api_key || '',
    });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update app settings
router.put('/', authenticate, async (req, res) => {
  const { fileflow_url, fileflow_access_key, deepgram_api_key } = req.body;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({
        user_id: req.user.id,
        fileflow_url,
        fileflow_access_key,
        deepgram_api_key: deepgram_api_key || '',
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
    });
  } catch (err) {
    console.error('Update settings error:', err);
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
