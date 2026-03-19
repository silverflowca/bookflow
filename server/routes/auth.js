import express from 'express';
import { supabase, supabasePublic } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Register new user — uses anon key so Supabase issues a real session
router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body;

  try {
    const { data, error } = await supabasePublic.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    });

    if (error) throw error;

    res.json({
      user: data.user,
      session: data.session
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Login — uses anon key so Supabase issues a real session with access_token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Get or create profile using service role (bypasses RLS)
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          display_name: data.user.user_metadata?.display_name || data.user.email.split('@')[0]
        })
        .select()
        .single();
      profile = newProfile;
    }

    res.json({
      user: data.user,
      session: data.session,
      profile
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(401).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    res.json({
      user: req.user,
      profile
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update profile
router.put('/profile', authenticate, async (req, res) => {
  const { display_name, bio, avatar_url, is_author } = req.body;

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        display_name,
        bio,
        avatar_url,
        is_author
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json(profile);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
