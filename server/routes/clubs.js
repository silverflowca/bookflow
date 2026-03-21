import express from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ── Helper: check club membership/role ────────────────────────────────────────
async function getClubRole(clubId, userId) {
  const { data: club } = await supabase
    .from('book_clubs')
    .select('id, created_by')
    .eq('id', clubId)
    .single();
  if (!club) return null;
  if (club.created_by === userId) return 'owner';

  const { data: member } = await supabase
    .from('club_members')
    .select('role, invite_accepted_at')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .single();
  if (!member || !member.invite_accepted_at) return null;
  return member.role;
}

// ── Helper: send notification ──────────────────────────────────────────────────
async function notify(userId, type, title, body, extra = {}) {
  try {
    await supabase.from('user_notifications').insert({
      user_id: userId, type, title, body, ...extra,
    });
  } catch (_) {}
}

// ── GET /api/clubs  — list clubs for current user ─────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    // Step 1: get club IDs where user is an accepted member
    const { data: myMemberships } = await supabase
      .from('club_members')
      .select('club_id, role')
      .eq('user_id', req.user.id)
      .not('invite_accepted_at', 'is', null);

    const memberClubIds = (myMemberships || []).map(m => m.club_id);
    const memberRoleMap = Object.fromEntries((myMemberships || []).map(m => [m.club_id, m.role]));

    // Step 2: fetch clubs created by user OR where user is a member
    let query = supabase
      .from('book_clubs')
      .select(`
        id, name, description, cover_image_url, visibility, max_members, created_at, created_by,
        creator:profiles!book_clubs_created_by_fkey(id, display_name, avatar_url),
        settings:club_settings(*)
      `)
      .order('created_at', { ascending: false });

    if (memberClubIds.length > 0) {
      query = query.or(`created_by.eq.${req.user.id},id.in.(${memberClubIds.join(',')})`);
    } else {
      query = query.eq('created_by', req.user.id);
    }

    const { data: myClubs, error } = await query;
    if (error) throw error;

    // Step 3: enrich with member count and current book
    const enriched = await Promise.all((myClubs || []).map(async (club) => {
      const { count: memberCount } = await supabase
        .from('club_members')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .not('invite_accepted_at', 'is', null);

      const { data: clubBooks } = await supabase
        .from('club_books')
        .select('id, book_id, is_current, book:books(id, title, cover_image_url, author:profiles!books_author_id_fkey(id,display_name))')
        .eq('club_id', club.id)
        .order('added_at', { ascending: false });

      const myRole = club.created_by === req.user.id ? 'owner' : (memberRoleMap[club.id] || 'member');

      return { ...club, member_count: memberCount || 0, books: clubBooks || [], my_role: myRole };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/clubs/public — discover public clubs ─────────────────────────────
router.get('/public', authenticate, async (req, res) => {
  const { search } = req.query;
  try {
    let query = supabase
      .from('book_clubs')
      .select(`
        id, name, description, cover_image_url, max_members, created_at,
        creator:profiles!book_clubs_created_by_fkey(id, display_name, avatar_url)
      `)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(50);

    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    const enriched = await Promise.all((data || []).map(async (club) => {
      const { count } = await supabase
        .from('club_members')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .not('invite_accepted_at', 'is', null);
      return { ...club, member_count: count || 0 };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/clubs — create a club ───────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  const { name, description, visibility = 'private', max_members = 50 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Club name is required' });

  try {
    const { data: club, error } = await supabase
      .from('book_clubs')
      .insert({ name: name.trim(), description, visibility, max_members, created_by: req.user.id })
      .select()
      .single();
    if (error) throw error;

    // Add creator as owner member
    await supabase.from('club_members').insert({
      club_id: club.id,
      user_id: req.user.id,
      role: 'owner',
      invite_accepted_at: new Date().toISOString(),
    });

    // Default settings
    await supabase.from('club_settings').insert({ club_id: club.id });

    res.status(201).json(club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/clubs/:clubId — get club detail ──────────────────────────────────
router.get('/:clubId', authenticate, async (req, res) => {
  try {
    const role = await getClubRole(req.params.clubId, req.user.id);

    const { data: club, error } = await supabase
      .from('book_clubs')
      .select(`
        id, name, description, cover_image_url, visibility, max_members, created_at,
        creator:profiles!book_clubs_created_by_fkey(id, display_name, avatar_url),
        settings:club_settings(*)
      `)
      .eq('id', req.params.clubId)
      .single();

    if (error || !club) return res.status(404).json({ error: 'Club not found' });
    if (club.visibility === 'private' && !role) {
      return res.status(403).json({ error: 'You are not a member of this club' });
    }

    // Members (accepted)
    const { data: members } = await supabase
      .from('club_members')
      .select(`
        id, role, joined_at, invite_accepted_at,
        user:profiles(id, display_name, avatar_url, email)
      `)
      .eq('club_id', req.params.clubId)
      .not('invite_accepted_at', 'is', null)
      .order('joined_at', { ascending: true });

    // Pending invites (only visible to admins)
    let pendingInvites = [];
    if (role === 'owner' || role === 'admin') {
      const { data: pending } = await supabase
        .from('club_members')
        .select('id, invited_email, invited_by, joined_at, invite_token')
        .eq('club_id', req.params.clubId)
        .is('invite_accepted_at', null);
      pendingInvites = pending || [];
    }

    // Books in club
    const { data: clubBooks } = await supabase
      .from('club_books')
      .select(`
        id, is_current, added_at,
        book:books(
          id, title, subtitle, cover_image_url, status,
          author:profiles!books_author_id_fkey(id, display_name)
        ),
        added_by_user:profiles!club_books_added_by_fkey(id, display_name)
      `)
      .eq('club_id', req.params.clubId)
      .order('added_at', { ascending: false });

    res.json({ ...club, my_role: role, members: members || [], pending_invites: pendingInvites, books: clubBooks || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/clubs/:clubId — update club ──────────────────────────────────────
router.put('/:clubId', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  if (!role || !['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only owners/admins can edit the club' });
  }

  const { name, description, visibility, max_members, cover_image_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('book_clubs')
      .update({ name, description, visibility, max_members, cover_image_url, updated_at: new Date().toISOString() })
      .eq('id', req.params.clubId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/clubs/:clubId/settings — update club settings ───────────────────
router.put('/:clubId/settings', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  if (!role || !['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only owners/admins can change settings' });
  }

  const { show_member_reading_progress, show_member_answers, show_member_highlights, show_member_media } = req.body;
  try {
    const { data, error } = await supabase
      .from('club_settings')
      .upsert({
        club_id: req.params.clubId,
        show_member_reading_progress,
        show_member_answers,
        show_member_highlights,
        show_member_media,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'club_id' })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/clubs/:clubId — delete club (owner only) ─────────────────────
router.delete('/:clubId', authenticate, async (req, res) => {
  try {
    const { data: club } = await supabase.from('book_clubs').select('created_by').eq('id', req.params.clubId).single();
    if (!club) return res.status(404).json({ error: 'Club not found' });
    if (club.created_by !== req.user.id) return res.status(403).json({ error: 'Only the owner can delete a club' });

    const { error } = await supabase.from('book_clubs').delete().eq('id', req.params.clubId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/clubs/:clubId/invite — invite a member ─────────────────────────
router.post('/:clubId/invite', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  if (!role || !['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only owners/admins can invite members' });
  }

  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  try {
    // Check if user exists by email
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    // Check existing membership
    if (targetProfile) {
      const { data: existing } = await supabase
        .from('club_members')
        .select('id, invite_accepted_at')
        .eq('club_id', req.params.clubId)
        .eq('user_id', targetProfile.id)
        .maybeSingle();
      if (existing?.invite_accepted_at) {
        return res.status(409).json({ error: 'User is already a member' });
      }
      if (existing) {
        return res.status(409).json({ error: 'User already has a pending invite' });
      }
    }

    const { data: club } = await supabase.from('book_clubs').select('name').eq('id', req.params.clubId).single();
    const inviteToken = crypto.randomBytes(24).toString('hex');

    const memberRecord = {
      club_id: req.params.clubId,
      user_id: targetProfile?.id || null,
      invited_by: req.user.id,
      invited_email: email.trim().toLowerCase(),
      invite_token: inviteToken,
      role: 'member',
    };

    const { data: member, error } = await supabase
      .from('club_members')
      .insert(memberRecord)
      .select()
      .single();
    if (error) throw error;

    // Send in-app notification if user exists
    if (targetProfile) {
      await notify(targetProfile.id, 'club_invite',
        `You've been invited to join "${club.name}"`,
        `You've been invited to join the book club "${club.name}". Accept the invite to get started!`,
        { invite_token: inviteToken }
      );
    }

    res.status(201).json({ ...member, invite_token: inviteToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/clubs/:clubId/members/:memberId/resend-invite ──────────────────
router.post('/:clubId/members/:memberId/resend-invite', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  if (!role || !['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only owners/admins can resend invites' });
  }

  try {
    const { data: member, error } = await supabase
      .from('club_members')
      .select('id, invited_email, user_id, invite_accepted_at')
      .eq('id', req.params.memberId)
      .eq('club_id', req.params.clubId)
      .single();

    if (error || !member) return res.status(404).json({ error: 'Invite not found' });
    if (member.invite_accepted_at) return res.status(409).json({ error: 'Invite already accepted' });

    // Generate a fresh token
    const newToken = crypto.randomBytes(24).toString('hex');
    const { error: updateErr } = await supabase
      .from('club_members')
      .update({ invite_token: newToken })
      .eq('id', member.id);
    if (updateErr) throw updateErr;

    // Resend in-app notification if user is registered
    if (member.user_id) {
      const { data: club } = await supabase.from('book_clubs').select('name').eq('id', req.params.clubId).single();
      await notify(member.user_id, 'club_invite',
        `You've been re-invited to join "${club?.name}"`,
        `You have a new invite link to join the book club "${club?.name}".`,
        { invite_token: newToken }
      );
    }

    res.json({ invite_token: newToken, invited_email: member.invited_email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/clubs/accept/:token — accept a club invite ─────────────────────
router.post('/accept/:token', authenticate, async (req, res) => {
  try {
    const { data: member, error } = await supabase
      .from('club_members')
      .select('*, club:book_clubs(id, name)')
      .eq('invite_token', req.params.token)
      .is('invite_accepted_at', null)
      .single();

    if (error || !member) return res.status(404).json({ error: 'Invalid or expired invite token' });

    // Check if user is already an accepted member of this club
    const { data: existing } = await supabase
      .from('club_members')
      .select('id, invite_accepted_at')
      .eq('club_id', member.club_id)
      .eq('user_id', req.user.id)
      .not('invite_accepted_at', 'is', null)
      .maybeSingle();

    if (existing) {
      // Already a member — delete the dangling invite row and return success
      await supabase.from('club_members').delete().eq('id', member.id);
      return res.json({ success: true, club: member.club, already_member: true });
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('club_members')
      .update({
        invite_accepted_at: now,
        user_id: req.user.id,
        invite_token: null,
      })
      .eq('id', member.id);

    if (updateErr) throw updateErr;

    res.json({ success: true, club: member.club });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/clubs/:clubId/members/:memberId — remove/leave ────────────────
router.delete('/:clubId/members/:memberId', authenticate, async (req, res) => {
  try {
    const { data: member } = await supabase
      .from('club_members')
      .select('user_id, role')
      .eq('id', req.params.memberId)
      .eq('club_id', req.params.clubId)
      .single();

    if (!member) return res.status(404).json({ error: 'Member not found' });

    const myRole = await getClubRole(req.params.clubId, req.user.id);
    const isSelf = member.user_id === req.user.id;
    const canRemove = isSelf || ['owner', 'admin'].includes(myRole);
    if (!canRemove) return res.status(403).json({ error: 'Not authorized to remove this member' });
    if (member.role === 'owner' && !isSelf) return res.status(403).json({ error: 'Cannot remove the club owner' });

    const { error } = await supabase.from('club_members').delete().eq('id', req.params.memberId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/clubs/:clubId/members/:memberId — update member role ─────────────
router.put('/:clubId/members/:memberId', authenticate, async (req, res) => {
  const myRole = await getClubRole(req.params.clubId, req.user.id);
  if (myRole !== 'owner') return res.status(403).json({ error: 'Only the owner can change member roles' });

  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const { data, error } = await supabase
      .from('club_members')
      .update({ role })
      .eq('id', req.params.memberId)
      .eq('club_id', req.params.clubId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/clubs/:clubId/books — add book to club ─────────────────────────
router.post('/:clubId/books', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  if (!role || !['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only owners/admins can add books' });
  }

  const { book_id, set_current = false } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id is required' });

  try {
    if (set_current) {
      // Clear other current flags
      await supabase.from('club_books').update({ is_current: false }).eq('club_id', req.params.clubId);
    }

    const { data, error } = await supabase
      .from('club_books')
      .upsert({ club_id: req.params.clubId, book_id, added_by: req.user.id, is_current: set_current }, { onConflict: 'club_id,book_id' })
      .select(`
        id, is_current, added_at,
        book:books(id, title, cover_image_url, author:profiles!books_author_id_fkey(id,display_name))
      `)
      .single();
    if (error) throw error;

    // Notify all members about new book
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', req.params.clubId)
      .not('invite_accepted_at', 'is', null)
      .neq('user_id', req.user.id);

    const { data: club } = await supabase.from('book_clubs').select('name').eq('id', req.params.clubId).single();
    const { data: book } = await supabase.from('books').select('title').eq('id', book_id).single();

    for (const m of (members || [])) {
      await notify(m.user_id, 'club_book_added',
        `New book in "${club?.name}"`,
        `"${book?.title}" has been added to the reading list.`
      );
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/clubs/:clubId/books/:clubBookId — set as current ─────────────────
router.put('/:clubId/books/:clubBookId', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  if (!role || !['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only owners/admins can change the current book' });
  }

  try {
    await supabase.from('club_books').update({ is_current: false }).eq('club_id', req.params.clubId);
    const { data, error } = await supabase
      .from('club_books')
      .update({ is_current: true })
      .eq('id', req.params.clubBookId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/clubs/:clubId/books/:clubBookId ────────────────────────────────
router.delete('/:clubId/books/:clubBookId', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  if (!role || !['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only owners/admins can remove books' });
  }
  try {
    const { error } = await supabase.from('club_books').delete().eq('id', req.params.clubBookId).eq('club_id', req.params.clubId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/clubs/:clubId/discussions — list discussions ─────────────────────
router.get('/:clubId/discussions', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  if (!role) return res.status(403).json({ error: 'Not a member of this club' });

  const { book_id, chapter_id, parent_id } = req.query;
  try {
    let query = supabase
      .from('club_discussions')
      .select(`
        id, body, created_at, updated_at, book_id, chapter_id, parent_id,
        author:profiles!club_discussions_author_id_fkey(id, display_name, avatar_url)
      `)
      .eq('club_id', req.params.clubId)
      .order('created_at', { ascending: true });

    if (book_id) query = query.eq('book_id', book_id);
    if (chapter_id) query = query.eq('chapter_id', chapter_id);
    if (parent_id === 'null' || parent_id === '') query = query.is('parent_id', null);
    else if (parent_id) query = query.eq('parent_id', parent_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/clubs/:clubId/discussions — post a message ─────────────────────
router.post('/:clubId/discussions', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  if (!role) return res.status(403).json({ error: 'Not a member of this club' });

  const { body, book_id, chapter_id, parent_id } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Message body is required' });

  try {
    const { data, error } = await supabase
      .from('club_discussions')
      .insert({
        club_id: req.params.clubId,
        author_id: req.user.id,
        body: body.trim(),
        book_id: book_id || null,
        chapter_id: chapter_id || null,
        parent_id: parent_id || null,
      })
      .select(`
        id, body, created_at, book_id, chapter_id, parent_id,
        author:profiles!club_discussions_author_id_fkey(id, display_name, avatar_url)
      `)
      .single();
    if (error) throw error;

    // Notify members about new top-level discussion
    if (!parent_id) {
      const { data: members } = await supabase
        .from('club_members')
        .select('user_id')
        .eq('club_id', req.params.clubId)
        .not('invite_accepted_at', 'is', null)
        .neq('user_id', req.user.id);

      const { data: club } = await supabase.from('book_clubs').select('name').eq('id', req.params.clubId).single();
      const { data: poster } = await supabase.from('profiles').select('display_name').eq('id', req.user.id).single();

      for (const m of (members || [])) {
        await notify(m.user_id, 'club_discussion',
          `New discussion in "${club?.name}"`,
          `${poster?.display_name} posted: "${body.slice(0, 80)}${body.length > 80 ? '…' : ''}"`
        );
      }
    } else {
      // Notify parent author of reply
      const { data: parent } = await supabase.from('club_discussions').select('author_id').eq('id', parent_id).single();
      if (parent && parent.author_id !== req.user.id) {
        const { data: club } = await supabase.from('book_clubs').select('name').eq('id', req.params.clubId).single();
        const { data: poster } = await supabase.from('profiles').select('display_name').eq('id', req.user.id).single();
        await notify(parent.author_id, 'club_discussion_reply',
          `Reply in "${club?.name}"`,
          `${poster?.display_name} replied: "${body.slice(0, 80)}${body.length > 80 ? '…' : ''}"`
        );
      }
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/clubs/:clubId/discussions/:id — edit message ─────────────────────
router.put('/:clubId/discussions/:id', authenticate, async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });
  try {
    const { data, error } = await supabase
      .from('club_discussions')
      .update({ body: body.trim(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('author_id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(403).json({ error: 'Not your message' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/clubs/:clubId/discussions/:id ──────────────────────────────────
router.delete('/:clubId/discussions/:id', authenticate, async (req, res) => {
  const role = await getClubRole(req.params.clubId, req.user.id);
  try {
    const { data: msg } = await supabase.from('club_discussions').select('author_id').eq('id', req.params.id).single();
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const canDelete = msg.author_id === req.user.id || ['owner', 'admin'].includes(role);
    if (!canDelete) return res.status(403).json({ error: 'Not authorized' });

    const { error } = await supabase.from('club_discussions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/clubs/:clubId/members/:memberId/progress — reading progress ───────
// Returns member reading progress for all club books (with privacy check)
router.get('/:clubId/members/:memberUserId/progress', authenticate, async (req, res) => {
  const myRole = await getClubRole(req.params.clubId, req.user.id);
  if (!myRole) return res.status(403).json({ error: 'Not a member of this club' });

  try {
    const { data: settings } = await supabase
      .from('club_settings')
      .select('show_member_reading_progress')
      .eq('club_id', req.params.clubId)
      .single();

    if (!settings?.show_member_reading_progress && req.params.memberUserId !== req.user.id) {
      return res.status(403).json({ error: 'Reading progress is private for this club' });
    }

    const { data: clubBooks } = await supabase
      .from('club_books')
      .select('book_id')
      .eq('club_id', req.params.clubId);

    const bookIds = (clubBooks || []).map(cb => cb.book_id);
    if (!bookIds.length) return res.json([]);

    const { data, error } = await supabase
      .from('reading_progress')
      .select(`
        book_id, percent_complete, last_read_at, completed_at,
        current_chapter:chapters(id, title, order_index)
      `)
      .eq('user_id', req.params.memberUserId)
      .in('book_id', bookIds);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/clubs/:clubId/members/:memberUserId/answers — Q&A answers ─────────
router.get('/:clubId/members/:memberUserId/answers', authenticate, async (req, res) => {
  const myRole = await getClubRole(req.params.clubId, req.user.id);
  if (!myRole) return res.status(403).json({ error: 'Not a member of this club' });

  try {
    const { data: settings } = await supabase
      .from('club_settings')
      .select('show_member_answers')
      .eq('club_id', req.params.clubId)
      .single();

    if (!settings?.show_member_answers && req.params.memberUserId !== req.user.id) {
      return res.status(403).json({ error: 'Member answers are private for this club' });
    }

    const { data, error } = await supabase
      .from('question_answers')
      .select(`
        id, answer_text, selected_options, is_correct, created_at,
        question:inline_content(id, content_data, chapter_id)
      `)
      .eq('user_id', req.params.memberUserId);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
