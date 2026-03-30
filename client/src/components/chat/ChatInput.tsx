import React, { useState, useRef, useCallback } from 'react'
import type { ChatMessage } from '../../hooks/useClubChat'
import ChatAudioRecorder from './ChatAudioRecorder'

interface Props {
  clubId: string
  chatAudioFolderId?: string | null
  allowAudio?: boolean
  allowSnippet?: boolean
  disabled?: boolean
  replyTo?: ChatMessage | null
  onCancelReply?: () => void
  onSendText: (body: string, replyToId?: string) => Promise<void>
  onSendAudio: (data: { audio_fileflow_file_id: string; audio_mime_type: string; audio_duration_seconds: number }) => Promise<void>
  onShareSnippet?: () => void
}

export default function ChatInput({
  clubId, chatAudioFolderId, allowAudio = true, allowSnippet = true,
  disabled = false, replyTo, onCancelReply,
  onSendText, onSendAudio, onShareSnippet,
}: Props) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [showAudio, setShowAudio] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(async () => {
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await onSendText(text, replyTo?.id)
      setBody('')
      onCancelReply?.()
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [body, sending, replyTo, onSendText, onCancelReply])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAudioSend = useCallback(async (data: { audio_fileflow_file_id: string; audio_mime_type: string; audio_duration_seconds: number }) => {
    await onSendAudio(data)
    setShowAudio(false)
  }, [onSendAudio])

  if (disabled) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', borderTop: '1px solid #f1f5f9' }}>
        Chat is disabled for this club.
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.625rem 0.75rem', backgroundColor: '#fff' }}>
      {/* Reply-to bar */}
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.375rem 0.625rem', backgroundColor: '#f0f9ff', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
          <span style={{ color: '#0369a1' }}>
            Replying to <strong>{replyTo.sender?.display_name || 'member'}</strong>: {(replyTo.body || '').slice(0, 60)}
          </span>
          <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0 0.25rem' }}>✕</button>
        </div>
      )}

      {/* Audio recorder */}
      {showAudio && (
        <div style={{ marginBottom: '0.5rem' }}>
          <ChatAudioRecorder
            clubId={clubId}
            chatAudioFolderId={chatAudioFolderId || null}
            onSend={handleAudioSend}
            onCancel={() => setShowAudio(false)}
          />
        </div>
      )}

      {!showAudio && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          {/* Attach menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAttach(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', color: '#94a3b8', fontSize: '1.1rem', borderRadius: '6px' }}
              title="Attach"
            >
              📎
            </button>
            {showAttach && (
              <div style={{
                position: 'absolute', bottom: '2.5rem', left: 0,
                backgroundColor: '#fff', border: '1px solid #e2e8f0',
                borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                minWidth: '160px', zIndex: 50,
              }}>
                {allowAudio && (
                  <MenuItem onClick={() => { setShowAudio(true); setShowAttach(false) }}>
                    🎙 Record Audio
                  </MenuItem>
                )}
                {allowSnippet && onShareSnippet && (
                  <MenuItem onClick={() => { onShareSnippet(); setShowAttach(false) }}>
                    📄 Share Chapter Snippet
                  </MenuItem>
                )}
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            style={{
              flex: 1, resize: 'none', padding: '0.5rem 0.75rem',
              border: '1px solid #e2e8f0', borderRadius: '8px',
              fontSize: '0.9375rem', lineHeight: 1.5, outline: 'none',
              maxHeight: '120px', overflowY: 'auto',
              fontFamily: 'inherit',
            }}
          />

          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            style={{
              padding: '0.5rem 0.875rem', backgroundColor: body.trim() ? '#6366f1' : '#e2e8f0',
              color: body.trim() ? '#fff' : '#94a3b8',
              border: 'none', borderRadius: '8px', cursor: body.trim() ? 'pointer' : 'default',
              fontSize: '0.875rem', fontWeight: 600, transition: 'background 0.15s',
            }}
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      )}
    </div>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '0.5rem 0.875rem', background: 'none', border: 'none',
        cursor: 'pointer', fontSize: '0.875rem', color: '#334155',
      }}
    >
      {children}
    </button>
  )
}
