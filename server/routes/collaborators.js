import express from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });
const collaboratorSelect = `
  id, book_id, user_id, role, invited_email, invite_token, invite_accepted_at, created_at,
  user:profiles!book_collaborators_user_id_fkey(id, display_name, email, avatar_url),
  invited_by_user:profiles!book_collaborators_invited_by_fkey(id, display_name)
`;

function buildOrigin() {
  return process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:5177';
}

async function maybeSendCollaboratorInviteEmail({ to, senderName, bookTitle, role, inviteUrl, requiresSignup }) {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost || !to) {
    return { manual: true, email_sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 8px;">${bookTitle}</h2>
      <p style="color:#555;margin:0 0 16px;">
        ${senderName} shared a BookFlow book with you as ${role}.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
        ${requiresSignup ? 'Accept Invite' : 'Open BookFlow'} →
      </a>
      <p style="margin-top:24px;font-size:12px;color:#888;">Or copy this link: ${inviteUrl}</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${senderName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `${senderName} shared "${bookTitle}" with you on BookFlow`,
    html,
  });

  return { manual: false, email_sent: true };
}

// GET /api/books/:bookId/collaborators
router.get('/', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('book_collaborators')
      .select(collaboratorSelect)
      .eq('book_id', req.params.bookId)
      .order('created_at');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:bookId/collaborators/search-users?q=...
router.get('/search-users', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  try {
    const rawQuery = String(req.query.q || '').trim();
    if (rawQuery.length < 2) {
      return res.json([]);
    }

    const sanitizedQuery = rawQuery.replace(/[%_,]/g, ' ').trim();

    const { data: existingCollaborators, error: collabError } = await supabase
      .from('book_collaborators')
      .select('user_id')
      .eq('book_id', req.params.bookId);

    if (collabError) throw collabError;

    const blockedUserIds = new Set([
      req.book.author_id,
      req.user.id,
      ...(existingCollaborators || []).map(row => row.user_id).filter(Boolean),
    ]);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url')
      .or(`display_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`)
      .limit(12);

    if (error) throw error;

    const filtered = (profiles || [])
      .filter(profile => profile?.id && !blockedUserIds.has(profile.id))
      .slice(0, 8);

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books/:bookId/collaborators — invite by email or userId
router.post('/', authenticate, requireRole(['owner', 'author']), async (req, res) => {
  const { email, userId, role } = req.body;

  if (!role || !['author', 'editor', 'reviewer'].includes(role)) {
    return res.status(400).json({ error: 'Valid role required: author, editor, reviewer' });
  }
  if (!email && !userId) {
    return res.status(400).json({ error: 'email or userId required' });
  }

  try {
    const bookId = req.params.bookId;
    const origin = buildOrigin();

    // If inviting by userId, look up their profile
    let resolvedUserId = userId || null;
    let resolvedEmail = email || null;
    let resolvedDisplayName = null;

    if (userId && !email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', userId)
        .single();
      resolvedEmail = profile?.email;
      resolvedDisplayName = profile?.display_name || null;
    }

    // If inviting by email, check if user already exists
    if (email && !userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('email', email)
        .single();
      if (profile) {
        resolvedUserId = profile.id;
        resolvedDisplayName = profile.display_name || null;
      }
    }

    // Prevent inviting the book owner
    if (resolvedUserId === req.book.author_id) {
      return res.status(400).json({ error: 'Cannot invite the book owner as a collaborator' });
    }

    const inviteToken = resolvedUserId
      ? null  // no token needed if user already exists
      : crypto.randomUUID();

    const payload = {
      book_id: bookId,
      user_id: resolvedUserId,
      role,
      invited_by: req.user.id,
      invited_email: resolvedEmail,
      invite_token: inviteToken,
      // If user already exists, auto-accept
      invite_accepted_at: resolvedUserId ? new Date().toISOString() : null,
    };

    const { data: collab, error } = await supabase
      .from('book_collaborators')
      .insert(payload)
      .select(collaboratorSelect)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'User is already a collaborator on this book' });
      }
      throw error;
    }

    // Create notification for the invitee (if they exist)
    if (resolvedUserId) {
      await supabase.from('user_notifications').insert({
        user_id: resolvedUserId,
        type: 'invite',
        title: `You've been invited to collaborate on "${req.book.title || 'a book'}"`,
        body: `Role: ${role}`,
        book_id: bookId,
      });
    }

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', req.user.id)
      .single();

    const senderName = senderProfile?.display_name || senderProfile?.email || 'A BookFlow author';
    const inviteUrl = resolvedUserId
      ? `${origin}/books/${bookId}/collaborators`
      : `${origin}/invite/${inviteToken}`;

    const emailStatus = await maybeSendCollaboratorInviteEmail({
      to: resolvedEmail,
      senderName,
      bookTitle: req.book.title || 'Untitled Book',
      role,
      inviteUrl,
      requiresSignup: !resolvedUserId,
    });

    res.status(201).json({
      ...collab,
      invite_token: inviteToken,
      invite_url: inviteToken ? `${origin}/invite/${inviteToken}` : inviteUrl,
      manual: emailStatus.manual,
      email_sent: emailStatus.email_sent,
      added_name: collab?.user?.display_name || resolvedDisplayName || resolvedEmail,
    });
  } catch (err) {
    console.error('Collaborator invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/books/:bookId/collaborators/:id — change role (owner only)
router.put('/:id', authenticate, requireRole(['owner']), async (req, res) => {
  const { role } = req.body;

  if (!role || !['author', 'editor', 'reviewer'].includes(role)) {
    return res.status(400).json({ error: 'Valid role required' });
  }

  try {
    const { data, error } = await supabase
      .from('book_collaborators')
      .update({ role })
      .eq('id', req.params.id)
      .eq('book_id', req.params.bookId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Collaborator not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/books/:bookId/collaborators/:id — remove collaborator
router.delete('/:id', authenticate, requireRole(['owner']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('book_collaborators')
      .delete()
      .eq('id', req.params.id)
      .eq('book_id', req.params.bookId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:bookId/my-role — mounted at app level
export async function getMyRole(req, res) {
  try {
    const bookId = req.params.bookId;
    const userId = req.user.id;

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.author_id === userId) {
      return res.json({ role: 'owner' });
    }

    const { data: collab } = await supabase
      .from('book_collaborators')
      .select('role')
      .eq('book_id', bookId)
      .eq('user_id', userId)
      .not('invite_accepted_at', 'is', null)
      .maybeSingle();

    if (!collab) {
      return res.status(403).json({ error: 'Not a collaborator on this book' });
    }

    res.json({ role: collab.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/invites/accept/:token — accept an email invite
// This is mounted at the app level, not under /books/:bookId
export async function acceptInvite(req, res) {
  const { token } = req.params;

  try {
    const { data: collab, error } = await supabase
      .from('book_collaborators')
      .select('*, book:books(id, title, author_id)')
      .eq('invite_token', token)
      .single();

    if (error || !collab) {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }

    if (collab.invite_accepted_at) {
      return res.status(409).json({ error: 'Invite already accepted' });
    }

    // Link to authenticated user
    const userId = req.user?.id;
    if (!userId) {
      // Return token info so client can prompt login then re-accept
      return res.json({
        requiresAuth: true,
        book: collab.book,
        role: collab.role,
        token,
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from('book_collaborators')
      .update({
        user_id: userId,
        invite_accepted_at: new Date().toISOString(),
        invite_token: null,
      })
      .eq('id', collab.id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, book: collab.book, role: updated.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export default router;
