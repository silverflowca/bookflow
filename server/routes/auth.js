import express from 'express';
import { supabase, supabasePublic } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const CLIENT_URL = () => process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:5178';

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

// Forgot password — sends reset email via Supabase Auth
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  try {
    const { error } = await supabasePublic.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${CLIENT_URL()}/reset-password`,
    });

    if (error) throw error;

    // Always return success to prevent email enumeration
    res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    // Still return success to prevent enumeration
    res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
  }
});

// Reset password — called after user clicks the email link (Supabase token exchange)
router.post('/reset-password', async (req, res) => {
  const { access_token, new_password } = req.body;
  if (!access_token || !new_password) {
    return res.status(400).json({ error: 'access_token and new_password are required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Set the session from the recovery token so we can update the password
    const { data: sessionData, error: sessionErr } = await supabasePublic.auth.setSession({
      access_token,
      refresh_token: req.body.refresh_token || '',
    });
    if (sessionErr) throw sessionErr;

    const { error } = await supabasePublic.auth.updateUser({ password: new_password });
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(400).json({ error: err.message || 'Failed to reset password. The link may have expired.' });
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
