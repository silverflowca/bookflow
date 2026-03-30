/**
 * chat-status.js
 * Handles automatic system chat messages:
 *  - Chapter completion updates (triggered by reading progress route)
 *  - Weekly reading summary (cron, configurable per club)
 *  - FileFlow folder provisioning for chat audio
 */

import cron from 'node-cron'
import { supabase } from '../config/supabase.js'
import { FileFlowClient, getFileFlowToken } from './fileflow.js'

// Track active cron tasks per club { clubId: Task }
const activeCrons = new Map()

// ─── FileFlow folder provisioning ────────────────────────────────────────────

export async function ensureClubChatFolder(supabase, clubId, clubName, userId) {
  // Check if already provisioned
  const { data: club } = await supabase
    .schema('bookflow').from('book_clubs')
    .select('chat_audio_fileflow_folder_id')
    .eq('id', clubId).maybeSingle()

  if (club?.chat_audio_fileflow_folder_id) {
    return club.chat_audio_fileflow_folder_id
  }

  try {
    const token = await getFileFlowToken(supabase, userId)
    if (!token) return null

    const ff = new FileFlowClient(process.env.FILEFLOW_URL, token)

    // Ensure parent bookflow folder exists, then club folder, then chat-audio
    // We reuse ensureBookFolders pattern — create: bookflow / {clubName} / chat-audio
    const safeName = clubName.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 60)

    // Create club folder under root
    let parentId = null
    try {
      const rootFolders = await ff.listFolders(null)
      const bookflowFolder = rootFolders?.find(f => f.name === 'bookflow')
      if (bookflowFolder) {
        parentId = bookflowFolder.id
      } else {
        const bf = await ff.createFolder('bookflow', null)
        parentId = bf?.id
      }
    } catch (_) {}

    // Club sub-folder
    let clubFolderId = null
    try {
      if (parentId) {
        const clubFolderName = `${safeName} (club-${clubId.slice(0, 8)})`
        const clubFolderResult = await ff.createFolder(clubFolderName, parentId)
        clubFolderId = clubFolderResult?.id
      }
    } catch (_) {}

    // chat-audio sub-folder
    let chatAudioFolderId = null
    try {
      const parent = clubFolderId || parentId
      if (parent) {
        const chatFolder = await ff.createFolder('chat-audio', parent)
        chatAudioFolderId = chatFolder?.id
      }
    } catch (_) {}

    if (chatAudioFolderId) {
      await supabase.schema('bookflow').from('book_clubs')
        .update({ chat_audio_fileflow_folder_id: chatAudioFolderId })
        .eq('id', clubId)
    }

    return chatAudioFolderId
  } catch (err) {
    console.error('[chat-status] ensureClubChatFolder error:', err.message)
    return null
  }
}

// ─── System message helpers ───────────────────────────────────────────────────

async function insertSystemMessage(supabase, clubId, body, statusPayload, bookId = null) {
  const { data, error } = await supabase
    .schema('bookflow').from('club_chat_messages')
    .insert({
      club_id: clubId,
      book_id: bookId,
      sender_id: null,
      message_type: 'system_status',
      body,
      status_payload: statusPayload,
    })
    .select('id').single()

  if (error) console.error('[chat-status] insertSystemMessage error:', error.message)
  return data?.id
}

async function notifyAllMembers(supabase, clubId, msgId, title, body) {
  const { data: members } = await supabase
    .schema('bookflow').from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .not('invite_accepted_at', 'is', null)

  if (!members?.length) return

  const rows = members.map(m => ({
    user_id: m.user_id,
    type: 'status_update',
    title,
    body,
    club_id: clubId,
    chat_message_id: msgId,
  }))
  await supabase.schema('bookflow').from('user_notifications').insert(rows)
}

// ─── Chapter completion trigger ───────────────────────────────────────────────
/**
 * Called from books.js progress route when chapter changes or book completed.
 * @param {string} userId
 * @param {string} bookId
 * @param {string|null} newChapterId
 * @param {number} percentComplete
 * @param {boolean} justCompleted - true if percent just reached 100
 */
export async function postCompletionUpdate(userId, bookId, newChapterId, percentComplete, justCompleted) {
  try {
    // Find clubs where this book is current
    const { data: clubBooks } = await supabase
      .schema('bookflow').from('club_books')
      .select('club_id')
      .eq('book_id', bookId)
      .eq('is_current', true)

    if (!clubBooks?.length) return

    // Get user profile
    const { data: profile } = await supabase
      .schema('bookflow').from('profiles')
      .select('display_name').eq('id', userId).maybeSingle()
    const name = profile?.display_name || 'A member'

    // Get chapter info
    let chapterTitle = null
    if (newChapterId) {
      const { data: ch } = await supabase
        .schema('bookflow').from('chapters')
        .select('title, order_index').eq('id', newChapterId).maybeSingle()
      chapterTitle = ch?.title
        ? `Chapter ${ch.order_index + 1}: "${ch.title}"`
        : `Chapter ${(ch?.order_index ?? 0) + 1}`
    }

    for (const { club_id } of clubBooks) {
      // Check membership and settings
      const [memberCheck, settings] = await Promise.all([
        supabase.schema('bookflow').from('club_members')
          .select('role').eq('club_id', club_id).eq('user_id', userId)
          .not('invite_accepted_at', 'is', null).maybeSingle(),
        supabase.schema('bookflow').from('club_chat_settings')
          .select('chat_enabled, chapter_completion_updates, show_answers_in_completion')
          .eq('club_id', club_id).maybeSingle()
      ])

      if (!memberCheck.data) continue
      if (!settings.data?.chat_enabled) continue
      if (!settings.data?.chapter_completion_updates) continue

      if (justCompleted) {
        // Book completed — fetch answers if settings allow
        let answers = []
        if (settings.data?.show_answers_in_completion) {
          const { data: clubSettings } = await supabase
            .schema('bookflow').from('club_settings')
            .select('show_member_answers').eq('club_id', club_id).maybeSingle()

          if (clubSettings?.show_member_answers) {
            // Fetch answered questions for this book
            const { data: qAnswers } = await supabase
              .schema('bookflow')
              .from('question_answers')
              .select(`
                answer_text, selected_options,
                inline_content:inline_content_id(content_data, chapter_id,
                  chapter:chapters!chapter_id(title, order_index))
              `)
              .eq('user_id', userId)
              .order('created_at', { ascending: true })

            answers = (qAnswers || [])
              .filter(a => {
                // Only include answers for chapters in this book
                return true // server-side filter would need book_id on inline_content — skip for now
              })
              .slice(0, 5) // cap at 5 for readability
              .map(a => ({
                question: a.inline_content?.content_data?.question || 'Question',
                answer: a.answer_text || (a.selected_options || []).join(', '),
                chapter: a.inline_content?.chapter?.title,
              }))
          }
        }

        const body = `✅ ${name} just finished reading the book!`
        const msgId = await insertSystemMessage(supabase, club_id, body, {
          event: 'completion',
          member_id: userId,
          member_name: name,
          book_id: bookId,
          answers,
        }, bookId)
        if (msgId) {
          await notifyAllMembers(supabase, club_id, msgId, `${name} finished the book!`, body)
        }
      } else if (newChapterId && chapterTitle) {
        const body = `📖 ${name} moved to ${chapterTitle} (${percentComplete}% complete)`
        const msgId = await insertSystemMessage(supabase, club_id, body, {
          event: 'progress',
          member_id: userId,
          member_name: name,
          book_id: bookId,
          chapter_id: newChapterId,
          chapter_title: chapterTitle,
          percent: percentComplete,
        }, bookId)
        if (msgId) {
          await notifyAllMembers(supabase, club_id, msgId, `${name} is reading`, body)
        }
      }
    }
  } catch (err) {
    console.error('[chat-status] postCompletionUpdate error:', err.message)
  }
}

// ─── Weekly summary ───────────────────────────────────────────────────────────

async function postWeeklySummaryForClub(supabase, clubId) {
  try {
    const { data: settings } = await supabase
      .schema('bookflow').from('club_chat_settings')
      .select('weekly_status_updates, chat_enabled')
      .eq('club_id', clubId).maybeSingle()

    if (!settings?.chat_enabled || !settings?.weekly_status_updates) return

    // Get current book
    const { data: clubBook } = await supabase
      .schema('bookflow').from('club_books')
      .select('book_id, book:books!book_id(title)')
      .eq('club_id', clubId).eq('is_current', true).maybeSingle()

    if (!clubBook) return
    const bookTitle = clubBook.book?.title || 'the current book'

    // Get all accepted members
    const { data: members } = await supabase
      .schema('bookflow').from('club_members')
      .select('user_id, profile:profiles!user_id(display_name)')
      .eq('club_id', clubId)
      .not('invite_accepted_at', 'is', null)

    if (!members?.length) return

    // Get reading progress for each member
    const memberProgress = await Promise.all(
      members.map(async m => {
        const { data: prog } = await supabase
          .schema('bookflow').from('reading_progress')
          .select('percent_complete, current_chapter_id, completed_at, last_read_at')
          .eq('user_id', m.user_id).eq('book_id', clubBook.book_id).maybeSingle()

        let chapterLabel = 'Not started'
        if (prog?.completed_at) {
          chapterLabel = 'Completed ✓'
        } else if (prog?.current_chapter_id) {
          const { data: ch } = await supabase
            .schema('bookflow').from('chapters')
            .select('title, order_index').eq('id', prog.current_chapter_id).maybeSingle()
          chapterLabel = ch?.title
            ? `Chapter ${ch.order_index + 1}: "${ch.title}"`
            : `Chapter ${(ch?.order_index ?? 0) + 1}`
        }

        return {
          member_id: m.user_id,
          member_name: m.profile?.display_name || 'Member',
          chapter_label: chapterLabel,
          percent: prog?.percent_complete || 0,
          completed: !!prog?.completed_at,
          last_read_at: prog?.last_read_at,
        }
      })
    )

    const lines = memberProgress
      .map(p => `• ${p.member_name} — ${p.chapter_label}${p.completed ? '' : ` (${p.percent}%)`}`)
      .join('\n')
    const body = `📖 Weekly Reading Update — ${bookTitle}\n\n${lines}`

    const msgId = await insertSystemMessage(supabase, clubId, body, {
      event: 'weekly_summary',
      book_id: clubBook.book_id,
      book_title: bookTitle,
      members: memberProgress,
    }, clubBook.book_id)

    if (msgId) {
      await notifyAllMembers(
        supabase, clubId, msgId,
        `Weekly reading update for ${bookTitle}`,
        body.slice(0, 100)
      )
    }

    console.log(`[chat-status] Posted weekly summary for club ${clubId}`)
  } catch (err) {
    console.error(`[chat-status] Weekly summary error for club ${clubId}:`, err.message)
  }
}

// Run weekly summary across all clubs that use the global default schedule
async function runGlobalWeeklySummary() {
  try {
    // Get clubs using default cron (0 9 * * 1) or clubs that haven't opted out
    const { data: allSettings } = await supabase
      .schema('bookflow').from('club_chat_settings')
      .select('club_id, weekly_cron_schedule')
      .eq('weekly_status_updates', true)
      .eq('chat_enabled', true)

    if (!allSettings?.length) return
    for (const s of allSettings) {
      // Only run for clubs on the default schedule (custom schedules have their own cron)
      if (s.weekly_cron_schedule === '0 9 * * 1') {
        await postWeeklySummaryForClub(supabase, s.club_id)
      }
    }
  } catch (err) {
    console.error('[chat-status] runGlobalWeeklySummary error:', err.message)
  }
}

// ─── Cron management ─────────────────────────────────────────────────────────

export function rescheduleClubCron(clubId, cronExpression) {
  // Stop existing cron for this club if any
  if (activeCrons.has(clubId)) {
    activeCrons.get(clubId).stop()
    activeCrons.delete(clubId)
  }

  if (!cronExpression || cronExpression === '0 9 * * 1') {
    // Uses global default — no individual cron needed
    return
  }

  if (!cron.validate(cronExpression)) {
    console.warn(`[chat-status] Invalid cron expression for club ${clubId}: ${cronExpression}`)
    return
  }

  const task = cron.schedule(cronExpression, async () => {
    await postWeeklySummaryForClub(supabase, clubId)
  })
  activeCrons.set(clubId, task)
  console.log(`[chat-status] Scheduled custom cron for club ${clubId}: ${cronExpression}`)
}

export async function startStatusCron() {
  // Global default: every Monday at 9am
  cron.schedule('0 9 * * 1', runGlobalWeeklySummary)
  console.log('[chat-status] Global weekly summary cron started (Mon 9am)')

  // Load and schedule any clubs with custom cron expressions
  try {
    const { data: customSchedules } = await supabase
      .schema('bookflow').from('club_chat_settings')
      .select('club_id, weekly_cron_schedule')
      .neq('weekly_cron_schedule', '0 9 * * 1')
      .eq('weekly_status_updates', true)

    for (const s of customSchedules || []) {
      rescheduleClubCron(s.club_id, s.weekly_cron_schedule)
    }
    console.log(`[chat-status] Loaded ${customSchedules?.length || 0} custom club schedules`)
  } catch (err) {
    console.error('[chat-status] Failed to load custom schedules:', err.message)
  }
}
