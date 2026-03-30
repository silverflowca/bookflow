import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

export interface ChatSender {
  id: string
  display_name: string
  avatar_url?: string | null
}

export interface ChatMessage {
  id: string
  club_id: string
  book_id?: string | null
  sender_id?: string | null
  sender?: ChatSender | null
  message_type: 'text' | 'audio' | 'chapter_snippet' | 'system_status'
  body?: string | null
  // audio
  audio_fileflow_url?: string | null
  audio_duration_seconds?: number | null
  audio_mime_type?: string | null
  audio_fileflow_file_id?: string | null
  // snippet
  snippet_chapter_id?: string | null
  snippet_chapter?: { id: string; title: string; order_index: number } | null
  snippet_comment_id?: string | null
  snippet_text?: string | null
  snippet_offset_start?: number | null
  snippet_offset_end?: number | null
  // system
  status_payload?: any
  // meta
  reply_to_id?: string | null
  reply_to?: Partial<ChatMessage> | null
  edited_at?: string | null
  deleted_at?: string | null
  created_at: string
}

interface UseClubChatOptions {
  clubId: string
  onNewMessage?: (msg: ChatMessage) => void
}

export function useClubChat({ clubId, onNewMessage }: UseClubChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchMessages = useCallback(async (before?: string) => {
    try {
      const res = await api.getClubChatMessages(clubId, { before, limit: 50 })
      return res
    } catch (err: any) {
      throw err
    }
  }, [clubId])

  // Initial load
  useEffect(() => {
    if (!clubId) return
    setLoading(true)
    setError(null)
    fetchMessages()
      .then(({ messages: msgs, hasMore: more }) => {
        setMessages(msgs)
        setHasMore(more)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [clubId, fetchMessages])

  // Realtime subscription
  useEffect(() => {
    if (!clubId) return

    const channel = supabase
      .channel(`club-chat-${clubId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'bookflow',
          table: 'club_chat_messages',
          filter: `club_id=eq.${clubId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage
          // Enrich with sender profile
          if (newMsg.sender_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .maybeSingle()
            if (profile) newMsg.sender = profile
          }
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          onNewMessage?.(newMsg)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'bookflow',
          table: 'club_chat_messages',
          filter: `club_id=eq.${clubId}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessage
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [clubId, onNewMessage])

  const loadMore = useCallback(async () => {
    if (!messages.length || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const oldest = messages[0]
      const { messages: older, hasMore: more } = await fetchMessages(oldest.id)
      setMessages(prev => [...older, ...prev])
      setHasMore(more)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }, [messages, loadingMore, hasMore, fetchMessages])

  const sendTextMessage = useCallback(async (body: string, replyToId?: string) => {
    const msg = await api.sendClubChatMessage(clubId, { message_type: 'text', body, reply_to_id: replyToId })
    if (msg) setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
  }, [clubId])

  const sendSnippetMessage = useCallback(async (snippet: {
    snippet_chapter_id: string
    snippet_comment_id?: string
    snippet_text: string
    snippet_offset_start?: number
    snippet_offset_end?: number
    body?: string
  }) => {
    const msg = await api.sendClubChatMessage(clubId, { message_type: 'chapter_snippet', ...snippet })
    if (msg) setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
  }, [clubId])

  const sendAudioMessage = useCallback(async (audio: {
    audio_fileflow_file_id: string
    audio_mime_type: string
    audio_duration_seconds?: number
    body?: string
  }) => {
    const msg = await api.sendClubChatMessage(clubId, { message_type: 'audio', ...audio })
    if (msg) setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
  }, [clubId])

  const editMessage = useCallback(async (msgId: string, body: string) => {
    const updated = await api.editClubChatMessage(clubId, msgId, body)
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, ...updated } : m))
  }, [clubId])

  const deleteMessage = useCallback(async (msgId: string) => {
    await api.deleteClubChatMessage(clubId, msgId)
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted_at: new Date().toISOString() } : m))
  }, [clubId])

  const markRead = useCallback(async (lastMessageId: string) => {
    await api.markClubChatRead(clubId, lastMessageId)
  }, [clubId])

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    sendTextMessage,
    sendSnippetMessage,
    sendAudioMessage,
    editMessage,
    deleteMessage,
    markRead,
  }
}
