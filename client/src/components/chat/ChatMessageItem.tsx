import React, { useState } from 'react'
import type { ChatMessage } from '../../hooks/useClubChat'
import ChatSnippetCard from './ChatSnippetCard'
import ChatSystemMessage from './ChatSystemMessage'

interface Props {
  message: ChatMessage
  currentUserId: string
  clubId: string
  bookId?: string | null
  onEdit: (msgId: string, body: string) => void
  onDelete: (msgId: string) => void
  onReply: (msg: ChatMessage) => void
  isAdmin?: boolean
}

export default function ChatMessageItem({ message, currentUserId, bookId, onEdit, onDelete, onReply, isAdmin }: Props) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(message.body || '')
  const [showActions, setShowActions] = useState(false)

  if (message.message_type === 'system_status') {
    return <ChatSystemMessage message={message} />
  }

  if (message.deleted_at) {
    return (
      <div style={{ padding: '0.25rem 1rem', color: '#94a3b8', fontSize: '0.8125rem', fontStyle: 'italic' }}>
        This message was deleted.
      </div>
    )
  }

  const isMine = message.sender_id === currentUserId
  const canDelete = isMine || isAdmin
  const avatarLetter = message.sender?.display_name?.[0]?.toUpperCase() || '?'

  const handleEditSave = () => {
    if (editBody.trim()) {
      onEdit(message.id, editBody.trim())
    }
    setEditing(false)
  }

  return (
    <div
      style={{ display: 'flex', gap: '0.625rem', padding: '0.375rem 1rem', position: 'relative' }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', marginTop: '2px' }}>
        {message.sender?.avatar_url ? (
          <img src={message.sender.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8125rem', fontWeight: 600 }}>
            {avatarLetter}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
            {message.sender?.display_name || 'Member'}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {new Date(message.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.edited_at && (
            <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontStyle: 'italic' }}>(edited)</span>
          )}
        </div>

        {/* Reply-to preview */}
        {message.reply_to && (
          <div style={{ borderLeft: '2px solid #cbd5e1', paddingLeft: '0.5rem', marginBottom: '0.375rem', color: '#64748b', fontSize: '0.8125rem' }}>
            <span style={{ fontWeight: 500 }}>{message.reply_to.sender?.display_name || 'Member'}: </span>
            {(message.reply_to.body || '').slice(0, 80)}
          </div>
        )}

        {/* Snippet card */}
        {message.message_type === 'chapter_snippet' && (
          <ChatSnippetCard message={message} bookId={bookId} />
        )}

        {/* Audio */}
        {message.message_type === 'audio' && message.audio_fileflow_url && (
          <div style={{ marginBottom: message.body ? '0.375rem' : 0 }}>
            <audio
              controls
              src={message.audio_fileflow_url}
              style={{ maxWidth: '280px', height: '36px' }}
            />
            {message.audio_duration_seconds && (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                {Math.floor(message.audio_duration_seconds / 60)}:{String(message.audio_duration_seconds % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        )}

        {/* Text body */}
        {editing ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditing(false) }}
              style={{ flex: 1, padding: '0.375rem 0.5rem', border: '1px solid #6366f1', borderRadius: '6px', fontSize: '0.875rem' }}
              autoFocus
            />
            <button onClick={handleEditSave} style={{ padding: '0.375rem 0.625rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ padding: '0.375rem 0.625rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}>Cancel</button>
          </div>
        ) : message.body ? (
          <div style={{ fontSize: '0.9375rem', color: '#1e293b', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {message.body}
          </div>
        ) : null}
      </div>

      {/* Hover actions */}
      {showActions && !editing && (
        <div style={{
          position: 'absolute', right: '1rem', top: '0.25rem',
          display: 'flex', gap: '0.25rem',
          backgroundColor: '#fff', border: '1px solid #e2e8f0',
          borderRadius: '8px', padding: '0.25rem 0.375rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <ActionBtn title="Reply" onClick={() => onReply(message)}>↩</ActionBtn>
          {isMine && message.message_type === 'text' && (
            <ActionBtn title="Edit" onClick={() => { setEditing(true); setEditBody(message.body || '') }}>✏️</ActionBtn>
          )}
          {canDelete && (
            <ActionBtn title="Delete" onClick={() => onDelete(message.id)} danger>🗑</ActionBtn>
          )}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0.125rem 0.25rem', borderRadius: '4px',
        fontSize: '0.875rem', color: danger ? '#ef4444' : '#64748b',
      }}
    >
      {children}
    </button>
  )
}
