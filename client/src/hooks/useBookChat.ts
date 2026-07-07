import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import type { BookChatMessage } from '../types'

interface UseBookChatOptions {
  bookId: string
  onNewMessage?: (msg: BookChatMessage) => void
}

export function useBookChat({ bookId, onNewMessage }: UseBookChatOptions) {
  const [messages, setMessages] = useState<BookChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const onNewMessageRef = useRef(onNewMessage)
  onNewMessageRef.current = onNewMessage

  // Initial load
  useEffect(() => {
    if (!bookId) return
    setLoading(true)
    setError(null)
    api.getBookChatMessages(bookId, { limit: 50 })
      .then(({ messages: msgs, hasMore: more }) => {
        setMessages(msgs || [])
        setHasMore(more)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [bookId])

  // Supabase Realtime subscription
  useEffect(() => {
    if (!bookId) return

    const channel = supabase
      .channel(`book-chat-${bookId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'bookflow',
          table: 'book_chat_messages',
          filter: `book_id=eq.${bookId}`,
        },
        async (payload) => {
          const newMsg = payload.new as BookChatMessage
          // Enrich with sender profile if it's a user message
          if (newMsg.sender_id) {
            const { data: profile } = await supabase
              .schema('bookflow')
              .from('profiles')
              .select('id, display_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .maybeSingle()
            if (profile) newMsg.sender = profile as any
          }
          setMessages(prev =>
            prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]
          )
          onNewMessageRef.current?.(newMsg)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'bookflow',
          table: 'book_chat_messages',
          filter: `book_id=eq.${bookId}`,
        },
        (payload) => {
          const updated = payload.new as BookChatMessage
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [bookId])

  const loadMore = useCallback(async () => {
    if (!messages.length || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const oldest = messages[0]
      const { messages: older, hasMore: more } = await api.getBookChatMessages(bookId, {
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
  }, [bookId, messages, loadingMore, hasMore])

  const sendTextMessage = useCallback(async (body: string, replyToId?: string) => {
    const msg = await api.sendBookChatMessage(bookId, body, replyToId)
    if (msg) {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
    }
  }, [bookId])

  const markRead = useCallback(async (lastMessageId: string) => {
    try {
      await api.markBookChatRead(bookId, lastMessageId)
    } catch (_) {}
  }, [bookId])

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    sendTextMessage,
    markRead,
  }
}
