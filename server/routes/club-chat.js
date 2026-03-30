import express from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { getClubRole } from './clubs.js'
import { ensureClubChatFolder, postCompletionUpdate } from '../services/chat-status.js'
import { FileFlowClient, getFileFlowToken } from '../services/fileflow.js'

const router = express.Router({ mergeParams: true })

// ─── helpers ────────────────────────────────────────────────────────────────

async function requireClubMember(supabase, clubId, userId) {
  const { data, error } = await supabase
    .schema('bookflow')
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .not('invite_accepted_at', 'is', null)
    .maybeSingle()
  if (error || !data) return null
  return data.role
}

async function refreshAudioUrl(supabase, message, userId) {
  if (message.message_type !== 'audio' || !message.audio_fileflow_file_id) return message
  // Refresh if older than 45 min
  const refreshedAt = message.audio_url_refreshed_at
    ? new Date(message.audio_url_refreshed_at)
    : null
  const stale = !refreshedAt || Date.now() - refreshedAt.getTime() > 45 * 60 * 1000
  if (!stale) return message
  try {
    const token = await getFileFlowToken(supabase, userId)
    const ff = new FileFlowClient(process.env.FILEFLOW_URL, token)
    const urlData = await ff.getDownloadUrl(message.audio_fileflow_file_id)
    const freshUrl = urlData?.url || urlData?.download_url
    if (freshUrl) {
      await supabase.schema('bookflow').from('club_chat_messages').update({
        audio_fileflow_url: freshUrl,
        audio_url_refreshed_at: new Date().toISOString()
      }).eq('id', message.id)
      return { ...message, audio_fileflow_url: freshUrl }
    }
  } catch (_) {}
  return message
}

async function notifyMembers(supabase, clubId, excludeUserId, type, title, body, extras = {}) {
  const { data: members } = await supabase
    .schema('bookflow')
    .from('club_members')
    .select('user_id, club_chat_member_prefs(notification_mode)')
    .eq('club_id', clubId)
    .not('invite_accepted_at', 'is', null)
    .neq('user_id', excludeUserId)

  if (!members?.length) return

  // Load club default
  const { data: settings } = await supabase
    .schema('bookflow')
    .from('club_chat_settings')
    .select('default_notification_mode')
    .eq('club_id', clubId)
    .maybeSingle()
  const clubDefault = settings?.default_notification_mode || 'all'

  const rows = members
    .filter(m => {
      const mode = m.club_chat_member_prefs?.notification_mode || 'inherit'
      const effective = mode === 'inherit' ? clubDefault : mode
      if (effective === 'none') return false
      if (effective === 'mentions' && type !== 'chat_mention') return false
      return true
    })
    .map(m => ({
      user_id: m.user_id,
      type,
      title,
      body,
      club_id: clubId,
      ...extras
    }))

  if (rows.length > 0) {
    await supabase.schema('bookflow').from('user_notifications').insert(rows)
  }
}

// ─── GET /api/clubs/:clubId/chat/messages ────────────────────────────────────
router.get('/messages', authenticate, async (req, res) => {

  const { clubId } = req.params
  const { before, limit = 50 } = req.query

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  // Check chat enabled
  const { data: settings } = await supabase
    .schema('bookflow')
    .from('club_chat_settings')
    .select('chat_enabled')
    .eq('club_id', clubId)
    .maybeSingle()
  if (settings && !settings.chat_enabled) {
    return res.json({ messages: [], hasMore: false })
  }

  let query = supabase
    .schema('bookflow')
    .from('club_chat_messages')
    .select(`
      *,
      sender:profiles!sender_id(id, display_name, avatar_url),
      reply_to:club_chat_messages!reply_to_id(id, body, message_type, sender_id,
        sender:profiles!sender_id(id, display_name, avatar_url)),
      snippet_chapter:chapters!snippet_chapter_id(id, title, order_index),
      snippet_comment:book_comments!snippet_comment_id(id, body)
    `)
    .eq('club_id', clubId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Number(limit) + 1)

  if (before) {
    // cursor: get messages older than this message's created_at
    const { data: cursor } = await supabase
      .schema('bookflow')
      .from('club_chat_messages')
      .select('created_at')
      .eq('id', before)
      .maybeSingle()
    if (cursor) {
      query = query.lt('created_at', cursor.created_at)
    }
  }

  const { data: messages, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const hasMore = messages.length > Number(limit)
  const page = hasMore ? messages.slice(0, Number(limit)) : messages

  // Batch refresh stale audio URLs
  const refreshed = await Promise.all(
    page.map(m => refreshAudioUrl(supabase, m, req.user.id))
  )

  // Return oldest-first for the client
  res.json({ messages: refreshed.reverse(), hasMore })
})

// ─── POST /api/clubs/:clubId/chat/messages ───────────────────────────────────
router.post('/messages', authenticate, async (req, res) => {

  const { clubId } = req.params
  const {
    message_type = 'text',
    body,
    book_id,
    reply_to_id,
    // audio
    audio_fileflow_file_id,
    audio_mime_type,
    audio_duration_seconds,
    // snippet
    snippet_chapter_id,
    snippet_comment_id,
    snippet_text,
    snippet_offset_start,
    snippet_offset_end,
  } = req.body

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  const { data: settings } = await supabase
    .schema('bookflow')
    .from('club_chat_settings')
    .select('chat_enabled, allow_audio_messages, allow_snippet_sharing')
    .eq('club_id', clubId)
    .maybeSingle()

  if (settings && !settings.chat_enabled) {
    return res.status(403).json({ error: 'Chat is disabled for this club' })
  }
  if (message_type === 'audio' && settings && !settings.allow_audio_messages) {
    return res.status(403).json({ error: 'Audio messages are disabled for this club' })
  }
  if (message_type === 'chapter_snippet' && settings && !settings.allow_snippet_sharing) {
    return res.status(403).json({ error: 'Snippet sharing is disabled for this club' })
  }

  // For audio: fetch the download URL from FileFlow so we store it
  let audioUrl = null
  if (message_type === 'audio' && audio_fileflow_file_id) {
    try {
      const token = await getFileFlowToken(supabase, req.user.id)
      const ff = new FileFlowClient(process.env.FILEFLOW_URL, token)
      const urlData = await ff.getDownloadUrl(audio_fileflow_file_id)
      audioUrl = urlData?.url || urlData?.download_url || null
    } catch (_) {}
  }

  const insertData = {
    club_id: clubId,
    book_id: book_id || null,
    sender_id: req.user.id,
    message_type,
    body: body || null,
    reply_to_id: reply_to_id || null,
    ...(message_type === 'audio' ? {
      audio_fileflow_file_id,
      audio_fileflow_url: audioUrl,
      audio_url_refreshed_at: new Date().toISOString(),
      audio_mime_type: audio_mime_type || null,
      audio_duration_seconds: audio_duration_seconds || null,
    } : {}),
    ...(message_type === 'chapter_snippet' ? {
      snippet_chapter_id: snippet_chapter_id || null,
      snippet_comment_id: snippet_comment_id || null,
      snippet_text: snippet_text || null,
      snippet_offset_start: snippet_offset_start ?? null,
      snippet_offset_end: snippet_offset_end ?? null,
    } : {}),
  }

  const { data: message, error } = await supabase
    .schema('bookflow')
    .from('club_chat_messages')
    .insert(insertData)
    .select(`
      *,
      sender:profiles!sender_id(id, display_name, avatar_url),
      snippet_chapter:chapters!snippet_chapter_id(id, title, order_index)
    `)
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Notify members
  const { data: senderProfile } = await supabase
    .schema('bookflow').from('profiles')
    .select('display_name').eq('id', req.user.id).maybeSingle()
  const senderName = senderProfile?.display_name || 'A member'

  // Check for @mentions in body
  const mentionRegex = /@([a-zA-Z0-9_]+)/g
  const mentions = body ? [...body.matchAll(mentionRegex)].map(m => m[1]) : []

  if (mentions.length > 0) {
    const { data: mentionedProfiles } = await supabase
      .schema('bookflow').from('profiles')
      .select('id, display_name').in('display_name', mentions)
    for (const mp of mentionedProfiles || []) {
      if (mp.id !== req.user.id) {
        await supabase.schema('bookflow').from('user_notifications').insert({
          user_id: mp.id,
          type: 'chat_mention',
          title: `${senderName} mentioned you`,
          body: body?.slice(0, 120),
          club_id: clubId,
          chat_message_id: message.id,
        })
      }
    }
  }

  const typeLabel = message_type === 'audio'
    ? `${senderName} sent a voice message`
    : message_type === 'chapter_snippet'
      ? `${senderName} shared a chapter snippet`
      : `${senderName}: ${(body || '').slice(0, 80)}`

  await notifyMembers(
    supabase, clubId, req.user.id,
    'chat_message',
    `New message in your reading club`,
    typeLabel,
    { chat_message_id: message.id }
  )

  res.json(message)
})

// ─── PUT /api/clubs/:clubId/chat/messages/:msgId ─────────────────────────────
router.put('/messages/:msgId', authenticate, async (req, res) => {

  const { clubId, msgId } = req.params
  const { body } = req.body

  if (!body?.trim()) return res.status(400).json({ error: 'Body required' })

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  const { data: existing } = await supabase
    .schema('bookflow').from('club_chat_messages')
    .select('sender_id, message_type').eq('id', msgId).maybeSingle()

  if (!existing) return res.status(404).json({ error: 'Message not found' })
  if (existing.sender_id !== req.user.id) return res.status(403).json({ error: 'Not your message' })
  if (existing.message_type !== 'text') return res.status(400).json({ error: 'Only text messages can be edited' })

  const { data, error } = await supabase
    .schema('bookflow').from('club_chat_messages')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', msgId)
    .select('*')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ─── DELETE /api/clubs/:clubId/chat/messages/:msgId ──────────────────────────
router.delete('/messages/:msgId', authenticate, async (req, res) => {

  const { clubId, msgId } = req.params

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  const { data: existing } = await supabase
    .schema('bookflow').from('club_chat_messages')
    .select('sender_id').eq('id', msgId).maybeSingle()

  if (!existing) return res.status(404).json({ error: 'Message not found' })
  const isAdmin = role === 'owner' || role === 'admin'
  if (existing.sender_id !== req.user.id && !isAdmin) {
    return res.status(403).json({ error: 'Not your message' })
  }

  const { error } = await supabase
    .schema('bookflow').from('club_chat_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', msgId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// ─── GET /api/clubs/:clubId/chat/settings ────────────────────────────────────
router.get('/settings', authenticate, async (req, res) => {

  const { clubId } = req.params

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  const { data, error } = await supabase
    .schema('bookflow').from('club_chat_settings')
    .select('*').eq('club_id', clubId).maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || {})
})

// ─── PUT /api/clubs/:clubId/chat/settings ────────────────────────────────────
router.put('/settings', authenticate, async (req, res) => {

  const { clubId } = req.params

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role || !['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Only admins can change chat settings' })
  }

  const allowed = [
    'chat_enabled',
    'allow_audio_messages',
    'allow_snippet_sharing',
    'weekly_status_updates',
    'chapter_completion_updates',
    'show_answers_in_completion',
    'weekly_cron_schedule',
    'weekly_cron_label',
    'default_notification_mode',
  ]
  const updates = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .schema('bookflow').from('club_chat_settings')
    .upsert({ club_id: clubId, ...updates }, { onConflict: 'club_id' })
    .select('*')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // If cron schedule changed, reschedule
  if (updates.weekly_cron_schedule) {
    const { rescheduleClubCron } = await import('../services/chat-status.js')
    rescheduleClubCron(clubId, updates.weekly_cron_schedule)
  }

  res.json(data)
})

// ─── GET /api/clubs/:clubId/chat/prefs ───────────────────────────────────────
router.get('/prefs', authenticate, async (req, res) => {

  const { clubId } = req.params

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  const { data } = await supabase
    .schema('bookflow').from('club_chat_member_prefs')
    .select('notification_mode')
    .eq('club_id', clubId).eq('user_id', req.user.id)
    .maybeSingle()

  res.json({ notification_mode: data?.notification_mode || 'inherit' })
})

// ─── PUT /api/clubs/:clubId/chat/prefs ───────────────────────────────────────
router.put('/prefs', authenticate, async (req, res) => {

  const { clubId } = req.params
  const { notification_mode } = req.body

  const valid = ['inherit', 'all', 'mentions', 'none']
  if (!valid.includes(notification_mode)) {
    return res.status(400).json({ error: 'Invalid notification_mode' })
  }

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  const { data, error } = await supabase
    .schema('bookflow').from('club_chat_member_prefs')
    .upsert({ club_id: clubId, user_id: req.user.id, notification_mode }, { onConflict: 'club_id,user_id' })
    .select('*').single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ─── POST /api/clubs/:clubId/chat/read ───────────────────────────────────────
router.post('/read', authenticate, async (req, res) => {

  const { clubId } = req.params
  const { last_message_id } = req.body

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  const { error } = await supabase
    .schema('bookflow').from('club_chat_read_receipts')
    .upsert({
      club_id: clubId,
      user_id: req.user.id,
      last_read_message_id: last_message_id || null,
      last_read_at: new Date().toISOString()
    }, { onConflict: 'club_id,user_id' })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// ─── GET /api/clubs/:clubId/chat/unread-count ────────────────────────────────
router.get('/unread-count', authenticate, async (req, res) => {

  const { clubId } = req.params

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  // Get last read receipt
  const { data: receipt } = await supabase
    .schema('bookflow').from('club_chat_read_receipts')
    .select('last_read_at')
    .eq('club_id', clubId).eq('user_id', req.user.id)
    .maybeSingle()

  let countQuery = supabase
    .schema('bookflow').from('club_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .is('deleted_at', null)
    .neq('sender_id', req.user.id)

  if (receipt?.last_read_at) {
    countQuery = countQuery.gt('created_at', receipt.last_read_at)
  }

  const { count, error } = await countQuery
  if (error) return res.status(500).json({ error: error.message })
  res.json({ count: count || 0 })
})

// ─── GET /api/clubs/chat/unread-all ─────────────────────────────────────────
// Returns unread counts for ALL clubs the user is in (for sidebar badges)
router.get('/unread-all', authenticate, async (req, res) => {


  const { data: memberships } = await supabase
    .schema('bookflow').from('club_members')
    .select('club_id')
    .eq('user_id', req.user.id)
    .not('invite_accepted_at', 'is', null)

  if (!memberships?.length) return res.json({})

  const { data: receipts } = await supabase
    .schema('bookflow').from('club_chat_read_receipts')
    .select('club_id, last_read_at')
    .eq('user_id', req.user.id)
    .in('club_id', memberships.map(m => m.club_id))

  const receiptMap = Object.fromEntries((receipts || []).map(r => [r.club_id, r.last_read_at]))

  const counts = {}
  await Promise.all(
    memberships.map(async ({ club_id }) => {
      let q = supabase
        .schema('bookflow').from('club_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club_id)
        .is('deleted_at', null)
        .neq('sender_id', req.user.id)
      if (receiptMap[club_id]) {
        q = q.gt('created_at', receiptMap[club_id])
      }
      const { count } = await q
      counts[club_id] = count || 0
    })
  )

  res.json(counts)
})

// ─── POST /api/clubs/:clubId/chat/ensure-folder ──────────────────────────────
// Called client-side before first audio message to ensure the FileFlow folder exists
router.post('/ensure-folder', authenticate, async (req, res) => {

  const { clubId } = req.params

  const role = await requireClubMember(supabase, clubId, req.user.id)
  if (!role) return res.status(403).json({ error: 'Not a club member' })

  const { data: club } = await supabase
    .schema('bookflow').from('book_clubs')
    .select('id, name, chat_audio_fileflow_folder_id')
    .eq('id', clubId).maybeSingle()

  if (!club) return res.status(404).json({ error: 'Club not found' })

  if (club.chat_audio_fileflow_folder_id) {
    return res.json({ folder_id: club.chat_audio_fileflow_folder_id })
  }

  const folderId = await ensureClubChatFolder(supabase, clubId, club.name, req.user.id)
  res.json({ folder_id: folderId })
})

export default router
