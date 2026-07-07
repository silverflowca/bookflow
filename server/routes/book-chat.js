/**
 * book-chat.js
 * Book-level chat — any reader of a book can participate.
 * Endpoints mounted at /api/book-chat/:bookId
 */

import express from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router({ mergeParams: true })

// ─── Access guard ─────────────────────────────────────────────────────────────

/**
 * Verify the requesting user can access this book's chat.
 * Returns the book row (with settings) or null if access denied.
 */
async function getBookIfAccessible(bookId, userId) {
  const { data: book } = await supabase
    .schema('bookflow').from('books')
    .select('id, title, cover_image_url, visibility, author_id, settings:book_settings(enable_book_chat)')
    .eq('id', bookId)
    .maybeSingle()

  if (!book) return null

  // Public books are always accessible
  if (book.visibility === 'public') return book

  if (!userId) return null

  // Author always has access
  if (book.author_id === userId) return book

  // Collaborators have access
  const { data: collab } = await supabase
    .schema('bookflow').from('book_collaborators')
    .select('id')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .not('invite_accepted_at', 'is', null)
    .maybeSingle()
  if (collab) return book

  // Any user who has opened the book (reading_progress exists)
  const { data: prog } = await supabase
    .schema('bookflow').from('reading_progress')
    .select('book_id')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .maybeSingle()

  return prog ? book : null
}

// ─── GET /api/book-chat/:bookId/messages ─────────────────────────────────────

router.get('/messages', async (req, res) => {
  try {
    const { bookId } = req.params
    const userId = req.user?.id ?? null
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)
    const before = req.query.before // message id cursor

    const book = await getBookIfAccessible(bookId, userId)
    if (!book) return res.status(403).json({ error: 'Access denied' })
    if (!book.settings?.enable_book_chat) return res.status(403).json({ error: 'Book chat is not enabled' })

    let query = supabase
      .schema('bookflow').from('book_chat_messages')
      .select(`
        id, book_id, sender_id, message_type, body, status_payload,
        reply_to_id, deleted_at, created_at,
        sender:profiles!sender_id(id, display_name, avatar_url)
      `)
      .eq('book_id', bookId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (before) {
      // Get the created_at of the cursor message to paginate
      const { data: cursor } = await supabase
        .schema('bookflow').from('book_chat_messages')
        .select('created_at').eq('id', before).maybeSingle()
      if (cursor) {
        query = query.lt('created_at', cursor.created_at)
      }
    }

    const { data: messages, error } = await query
    if (error) throw error

    const hasMore = messages.length > limit
    const trimmed = hasMore ? messages.slice(0, limit) : messages

    res.json({ messages: trimmed.reverse(), hasMore })
  } catch (err) {
    console.error('[book-chat] GET /messages error:', err.message)
    res.status(500).json({ error: 'Failed to load messages' })
  }
})

// ─── POST /api/book-chat/:bookId/messages ────────────────────────────────────

router.post('/messages', authenticate, async (req, res) => {
  try {
    const { bookId } = req.params
    const { body, reply_to_id } = req.body

    if (!body?.trim()) return res.status(400).json({ error: 'Message body is required' })

    const book = await getBookIfAccessible(bookId, req.user.id)
    if (!book) return res.status(403).json({ error: 'Access denied' })
    if (!book.settings?.enable_book_chat) return res.status(403).json({ error: 'Book chat is not enabled' })

    const { data: message, error } = await supabase
      .schema('bookflow').from('book_chat_messages')
      .insert({
        book_id: bookId,
        sender_id: req.user.id,
        message_type: 'text',
        body: body.trim(),
        reply_to_id: reply_to_id || null,
      })
      .select(`
        id, book_id, sender_id, message_type, body, status_payload,
        reply_to_id, deleted_at, created_at,
        sender:profiles!sender_id(id, display_name, avatar_url)
      `)
      .single()

    if (error) throw error
    res.status(201).json(message)
  } catch (err) {
    console.error('[book-chat] POST /messages error:', err.message)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// ─── POST /api/book-chat/:bookId/read ────────────────────────────────────────

router.post('/read', authenticate, async (req, res) => {
  try {
    const { bookId } = req.params
    const { last_message_id } = req.body

    if (!last_message_id) return res.status(400).json({ error: 'last_message_id is required' })

    const { error } = await supabase
      .schema('bookflow').from('book_chat_read_receipts')
      .upsert({
        book_id: bookId,
        user_id: req.user.id,
        last_read_message_id: last_message_id,
        last_read_at: new Date().toISOString(),
      }, { onConflict: 'book_id,user_id' })

    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    console.error('[book-chat] POST /read error:', err.message)
    res.status(500).json({ error: 'Failed to mark read' })
  }
})

// ─── GET /api/book-chat/:bookId/unread-count ─────────────────────────────────

router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const { bookId } = req.params

    // Get last read timestamp
    const { data: receipt } = await supabase
      .schema('bookflow').from('book_chat_read_receipts')
      .select('last_read_at')
      .eq('book_id', bookId)
      .eq('user_id', req.user.id)
      .maybeSingle()

    const since = receipt?.last_read_at || new Date(0).toISOString()

    const { count, error } = await supabase
      .schema('bookflow').from('book_chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', bookId)
      .is('deleted_at', null)
      .neq('sender_id', req.user.id)
      .gt('created_at', since)

    if (error) throw error
    res.json({ count: count ?? 0 })
  } catch (err) {
    console.error('[book-chat] GET /unread-count error:', err.message)
    res.status(500).json({ error: 'Failed to get unread count' })
  }
})

// ─── GET /api/book-chat/:bookId/readers ──────────────────────────────────────

router.get('/readers', authenticate, async (req, res) => {
  try {
    const { bookId } = req.params

    const book = await getBookIfAccessible(bookId, req.user.id)
    if (!book) return res.status(403).json({ error: 'Access denied' })

    // Fetch all users who have reading progress for this book
    // and who have share_my_progress = true
    const { data: progRows, error } = await supabase
      .schema('bookflow').from('reading_progress')
      .select(`
        user_id,
        percent_complete,
        completed_at,
        current_chapter_id,
        profile:profiles!user_id(id, display_name, avatar_url, share_my_progress)
      `)
      .eq('book_id', bookId)

    if (error) throw error

    // Filter to those who share progress, and enrich with chapter title
    const sharedReaders = (progRows || []).filter(r => r.profile?.share_my_progress !== false)

    // Fetch chapter titles for current chapters
    const chapterIds = [...new Set(sharedReaders.map(r => r.current_chapter_id).filter(Boolean))]
    let chapterMap = {}
    if (chapterIds.length) {
      const { data: chapters } = await supabase
        .schema('bookflow').from('chapters')
        .select('id, title, order_index')
        .in('id', chapterIds)
      for (const ch of chapters || []) {
        chapterMap[ch.id] = `${ch.order_index + 1}. ${ch.title}`
      }
    }

    const readers = sharedReaders.map(r => ({
      user_id: r.user_id,
      display_name: r.profile?.display_name || 'Unknown',
      avatar_url: r.profile?.avatar_url || null,
      current_chapter_title: r.current_chapter_id ? (chapterMap[r.current_chapter_id] || null) : null,
      percent_complete: r.percent_complete || 0,
      completed_at: r.completed_at || null,
    }))

    res.json(readers)
  } catch (err) {
    console.error('[book-chat] GET /readers error:', err.message)
    res.status(500).json({ error: 'Failed to load readers' })
  }
})

// ─── GET /api/book-chat/:bookId/stats ────────────────────────────────────────
// Lightweight stats accessible to any reader (not just authors)

router.get('/stats', authenticate, async (req, res) => {
  try {
    const { bookId } = req.params

    const book = await getBookIfAccessible(bookId, req.user.id)
    if (!book) return res.status(403).json({ error: 'Access denied' })

    // Total word count + estimated read time from chapters
    const { data: chapters } = await supabase
      .schema('bookflow').from('chapters')
      .select('word_count, estimated_read_time_minutes')
      .eq('book_id', bookId)
      .eq('status', 'published')

    const totalWords = (chapters || []).reduce((sum, c) => sum + (c.word_count || 0), 0)
    const totalReadMinutes = (chapters || []).reduce((sum, c) => sum + (c.estimated_read_time_minutes || 0), 0)

    // Reader count + avg progress from reading_progress
    const { data: progress } = await supabase
      .schema('bookflow').from('reading_progress')
      .select('percent_complete, user_id')
      .eq('book_id', bookId)

    const totalReaders = (progress || []).length
    const avgProgress = totalReaders > 0
      ? Math.round((progress || []).reduce((sum, p) => sum + (p.percent_complete || 0), 0) / totalReaders)
      : 0

    res.json({ total_words: totalWords, total_read_minutes: totalReadMinutes, total_readers: totalReaders, avg_progress: avgProgress })
  } catch (err) {
    console.error('[book-chat] GET /stats error:', err.message)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})

export default router
