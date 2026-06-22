/**
 * Admin routes — protected by requireSuperAdmin.
 *
 * GET  /api/admin/users              — list all users (with system_role)
 * PATCH /api/admin/users/:id/role    — set or clear system_role
 * GET  /api/admin/books              — list all books (any visibility)
 * GET  /api/admin/clubs              — list all clubs
 * GET  /api/admin/stats              — aggregate counts
 */

import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require auth + super_admin
router.use(authenticate, requireSuperAdmin);

// ── Users ─────────────────────────────────────────────────────────────────────

/** List all users with profiles */
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url, bio, is_author, system_role, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** Set or clear system_role for a user */
router.patch('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { system_role } = req.body; // 'super_admin' | null

  // Prevent super_admin from removing their own role (safety)
  if (id === req.user.id && !system_role) {
    return res.status(400).json({ error: 'You cannot remove your own super_admin role' });
  }

  if (system_role !== null && system_role !== 'super_admin') {
    return res.status(400).json({ error: 'Invalid role. Allowed: super_admin or null' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ system_role: system_role || null })
      .eq('id', id)
      .select('id, email, display_name, system_role')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Admin set role error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Books ─────────────────────────────────────────────────────────────────────

/** List all books (regardless of visibility, including archived) */
router.get('/books', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('books')
      .select(`
        id, title, status, visibility, created_at, updated_at,
        author:profiles!books_author_id_fkey(id, display_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Admin list books error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** Reinstate an archived book — sets status back to 'draft' */
router.patch('/books/:bookId/reinstate', async (req, res) => {
  try {
    const { error } = await supabase
      .from('books')
      .update({ status: 'draft' })
      .eq('id', req.params.bookId)
      .eq('status', 'archived'); // safety: only reinstate archived books

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Admin reinstate book error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Clubs ─────────────────────────────────────────────────────────────────────

/** List all clubs */
router.get('/clubs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('book_clubs')
      .select(`
        id, name, description, visibility, created_at,
        creator:profiles!book_clubs_created_by_fkey(id, display_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Admin list clubs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────

/** Aggregate counts for the admin dashboard */
router.get('/stats', async (req, res) => {
  try {
    const [
      { count: userCount },
      { count: bookCount },
      { count: clubCount },
      { count: superAdminCount },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('books').select('id', { count: 'exact', head: true }),
      supabase.from('book_clubs').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('system_role', 'super_admin'),
    ]);

    res.json({
      users: userCount ?? 0,
      books: bookCount ?? 0,
      clubs: clubCount ?? 0,
      super_admins: superAdminCount ?? 0,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
