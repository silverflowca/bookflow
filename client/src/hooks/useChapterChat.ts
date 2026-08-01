import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import type { ChatMessage } from './useClubChat'

interface UseChapterChatOptions {
  clubId: string
  chapterId: string
  enabled?: boolean
}

export function useChapterChat({ clubId, chapterId, enabled = true }: UseChapterChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Initial load
  useEffect(() => {
    if (!clubId || !chapterId || !enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    api.getClubChatMessages(clubId, { chapter_id: chapterId, limit: 50 })
      .then(({ messages: msgs, hasMore: more }) => {
        setMessages(msgs || [])
        setHasMore(more)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [clubId, chapterId, enabled])

  // Realtime subscription — listen on the full club channel but filter client-side by chapter
  useEffect(() => {
    if (!clubId || !chapterId || !enabled) return

    const channel = supabase
      .channel(`chapter-chat-${clubId}-${chapterId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'bookflow',
          table: 'club_chat_messages',
          filter: `club_id=eq.${clubId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage & { chapter_id?: string }
          // Only care about messages for this chapter
          if (newMsg.chapter_id !== chapterId) return
          // Enrich with sender profile
          if (newMsg.sender_id) {
            const { data: profile } = await supabase
              .schema('bookflow')
              .from('profiles')
              .select('id, display_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .maybeSingle()
            if (profile) (newMsg as any).sender = profile
          }
          setMessages(prev =>
            prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]
          )
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
          const updated = payload.new as ChatMessage & { chapter_id?: string }
          if (updated.chapter_id !== chapterId) return
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [clubId, chapterId, enabled])

  const loadMore = useCallback(async () => {
    if (!messages.length || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const oldest = messages[0]
      const { messages: older, hasMore: more } = await api.getClubChatMessages(clubId, {
        chapter_id: chapterId,
        before: oldest.id,
        limit: 50,
      })
      setMessages(prev => [...(older || []), ...prev])
      setHasMore(more)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }, [clubId, chapterId, messages, loadingMore, hasMore])

  const sendMessage = useCallback(async (body: string) => {
    const msg = await api.sendClubChatMessage(clubId, {
      message_type: 'text',
      body,
      chapter_id: chapterId,
    })
    if (msg) {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
    }
  }, [clubId, chapterId])

  const markRead = useCallback(async (lastMessageId: string) => {
    try {
      await api.markClubChatRead(clubId, lastMessageId)
    } catch (_) {}
  }, [clubId])

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    sendMessage,
    markRead,
  }
}
