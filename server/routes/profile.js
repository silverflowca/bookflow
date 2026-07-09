import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// ── GET /api/profile/me — current user's full profile with reading data ────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Profile
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profErr || !profile) return res.status(404).json({ error: 'Profile not found' });

    // Books authored
    const { data: authoredBooks } = await supabase
      .from('books')
      .select('id, title, cover_image_url, status, visibility, created_at, word_count, slug')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    // Currently reading (progress < 100, sorted by last_read_at desc)
    const { data: progressRows } = await supabase
      .from('reading_progress')
      .select(`
        id, percent_complete, last_read_at, started_at, completed_at,
        book:books(id, title, cover_image_url, slug,
          author:profiles!books_author_id_fkey(id, display_name)
        )
      `)
      .eq('user_id', userId)
      .order('last_read_at', { ascending: false })
      .limit(20);

    const currentlyReading = (progressRows || []).filter(
      r => r.percent_complete > 0 && !r.completed_at
    );
    const completedBooks = (progressRows || []).filter(r => r.completed_at);

    // Club memberships
    const { data: clubMembers } = await supabase
      .from('club_members')
      .select(`
        id, role, joined_at,
        club:book_clubs(id, name, cover_image_url, visibility, max_members, club_type)
      `)
      .eq('user_id', userId)
      .not('invite_accepted_at', 'is', null)
      .order('joined_at', { ascending: false });

    // Stats
    const totalRead = completedBooks.length;
    const totalStarted = (progressRows || []).length;
    const avgProgress = totalStarted > 0
      ? Math.round((progressRows || []).reduce((s, r) => s + r.percent_complete, 0) / totalStarted)
      : 0;
    const allClubs = (clubMembers || []).map(cm => ({ ...cm.club, role: cm.role, joined_at: cm.joined_at }));

    res.json({
      profile,
      authored_books: authoredBooks || [],
      currently_reading: currentlyReading,
      completed_books: completedBooks,
      clubs: allClubs,
      stats: {
        total_read: totalRead,
        total_started: totalStarted,
        avg_progress: avgProgress,
        clubs_count: allClubs.filter(c => c.club_type !== 'study_group').length,
        study_groups_count: allClubs.filter(c => c.club_type === 'study_group').length,
        books_authored: (authoredBooks || []).length,
      },
    });
  } catch (err) {
    console.error('GET /profile/me error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/profile/me — update profile + privacy settings ───────────────────
router.put('/me', authenticate, async (req, res) => {
  const {
    display_name, bio, avatar_url, is_author,
    website_url, location,
    profile_public, show_reading_progress, show_clubs, show_books_authored,
    share_my_progress, enable_insert_panel, notification_prefs,
  } = req.body;

  try {
    const update = {};
    if (display_name !== undefined)        update.display_name = display_name;
    if (bio !== undefined)                 update.bio = bio;
    if (avatar_url !== undefined)          update.avatar_url = avatar_url;
    if (is_author !== undefined)           update.is_author = is_author;
    if (website_url !== undefined)         update.website_url = website_url;
    if (location !== undefined)            update.location = location;
    if (profile_public !== undefined)      update.profile_public = profile_public;
    if (show_reading_progress !== undefined) update.show_reading_progress = show_reading_progress;
    if (show_clubs !== undefined)          update.show_clubs = show_clubs;
    if (show_books_authored !== undefined) update.show_books_authored = show_books_authored;
    if (share_my_progress !== undefined)   update.share_my_progress = share_my_progress;
    if (enable_insert_panel !== undefined) update.enable_insert_panel = enable_insert_panel;
    if (notification_prefs !== undefined)  update.notification_prefs = notification_prefs;

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(profile);
  } catch (err) {
    console.error('PUT /profile/me error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/profile/:userId — public profile view ───────────────────────────
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user?.id ?? null;
    const isOwnProfile = viewerId === userId;

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio, is_author, created_at, website_url, location, profile_public, show_reading_progress, show_clubs, show_books_authored')
      .eq('id', userId)
      .single();

    if (profErr || !profile) return res.status(404).json({ error: 'User not found' });

    // Private profile — only the owner sees full data
    if (!profile.profile_public && !isOwnProfile) {
      return res.json({
        profile: {
          id: profile.id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          is_author: profile.is_author,
          created_at: profile.created_at,
          profile_public: false,
        },
        authored_books: [],
        currently_reading: [],
        completed_books: [],
        clubs: [],
        stats: null,
        is_private: true,
      });
    }

    // Authored books (always visible if is_author, or owner)
    let authoredBooks = [];
    if (isOwnProfile || profile.show_books_authored) {
      const { data } = await supabase
        .from('books')
        .select('id, title, cover_image_url, status, visibility, created_at, slug')
        .eq('author_id', userId)
        .eq('visibility', isOwnProfile ? undefined : 'public')  // public only for others
        .order('created_at', { ascending: false });
      // filter undefined eq
      const { data: publicBooks } = await supabase
        .from('books')
        .select('id, title, cover_image_url, status, created_at, slug')
        .eq('author_id', userId)
        .in('visibility', isOwnProfile ? ['public', 'private', 'unlisted'] : ['public'])
        .order('created_at', { ascending: false });
      authoredBooks = publicBooks || [];
    }

    // Reading progress (respect privacy)
    let currentlyReading = [];
    let completedBooks = [];
    if (isOwnProfile || profile.show_reading_progress) {
      const { data: progressRows } = await supabase
        .from('reading_progress')
        .select(`
          id, percent_complete, last_read_at, started_at, completed_at,
          book:books(id, title, cover_image_url, slug,
            author:profiles!books_author_id_fkey(id, display_name)
          )
        `)
        .eq('user_id', userId)
        .order('last_read_at', { ascending: false })
        .limit(20);

      currentlyReading = (progressRows || []).filter(r => r.percent_complete > 0 && !r.completed_at);
      completedBooks = (progressRows || []).filter(r => r.completed_at);
    }

    // Clubs (respect privacy)
    let clubs = [];
    if (isOwnProfile || profile.show_clubs) {
      const { data: clubMembers } = await supabase
        .from('club_members')
        .select(`
          id, role, joined_at,
          club:book_clubs(id, name, cover_image_url, visibility, club_type)
        `)
        .eq('user_id', userId)
        .not('invite_accepted_at', 'is', null)
        .order('joined_at', { ascending: false });
      clubs = (clubMembers || [])
        .filter(cm => cm.club && (isOwnProfile || cm.club.visibility === 'public'))
        .map(cm => ({ ...cm.club, role: cm.role, joined_at: cm.joined_at }));
    }

    const totalRead = completedBooks.length;
    const totalStarted = currentlyReading.length + completedBooks.length;

    res.json({
      profile,
      authored_books: authoredBooks,
      currently_reading: currentlyReading,
      completed_books: completedBooks,
      clubs,
      stats: {
        total_read: totalRead,
        total_started: totalStarted,
        clubs_count: clubs.filter(c => c.club_type !== 'study_group').length,
        study_groups_count: clubs.filter(c => c.club_type === 'study_group').length,
        books_authored: authoredBooks.length,
      },
      is_own: isOwnProfile,
    });
  } catch (err) {
    console.error('GET /profile/:userId error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
