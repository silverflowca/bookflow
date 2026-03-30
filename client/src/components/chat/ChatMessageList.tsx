import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../hooks/useClubChat'
import ChatMessageItem from './ChatMessageItem'

interface Props {
  messages: ChatMessage[]
  currentUserId: string
  clubId: string
  bookId?: string | null
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onEdit: (msgId: string, body: string) => void
  onDelete: (msgId: string) => void
  onReply: (msg: ChatMessage) => void
  isAdmin?: boolean
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function ChatMessageList({
  messages, currentUserId, clubId, bookId,
  hasMore, loadingMore, onLoadMore,
  onEdit, onDelete, onReply, isAdmin,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(0)

  // Auto-scroll to bottom on new messages (only if near bottom)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    const newMessages = messages.length > prevLengthRef.current
    prevLengthRef.current = messages.length
    if (newMessages && wasAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // Group messages by date
  type Group = { dateLabel: string; messages: ChatMessage[] }
  const groups: Group[] = []
  for (const msg of messages) {
    const label = formatDateLabel(msg.created_at)
    if (!groups.length || groups[groups.length - 1].dateLabel !== label) {
      groups.push({ dateLabel: label, messages: [msg] })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflowY: 'auto', paddingTop: '0.5rem', paddingBottom: '0.25rem' }}
    >
      {/* Load more */}
      {hasMore && (
        <div style={{ textAlign: 'center', padding: '0.5rem' }}>
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: '0.8125rem' }}
          >
            {loadingMore ? 'Loading…' : '↑ Load older messages'}
          </button>
        </div>
      )}

      {messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.9375rem' }}>
          No messages yet. Be the first to say something! 👋
        </div>
      )}

      {groups.map(group => (
        <div key={group.dateLabel}>
          {/* Date separator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem 0.375rem' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#f1f5f9' }} />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>{group.dateLabel}</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#f1f5f9' }} />
          </div>

          {group.messages.map(msg => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              clubId={clubId}
              bookId={bookId}
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={onReply}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  )
}
