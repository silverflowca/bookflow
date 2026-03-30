import React, { useState, useCallback, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useClubChat } from '../../hooks/useClubChat'
import type { ChatMessage } from '../../hooks/useClubChat'
import ChatMessageList from './ChatMessageList'
import ChatInput from './ChatInput'
import ChatSettingsModal from './ChatSettingsModal'
import NotificationPrefsPopover from './NotificationPrefsPopover'

interface Props {
  clubId: string
  clubName: string
  bookId?: string | null
  chatAudioFolderId?: string | null
  chatEnabled?: boolean
  allowAudio?: boolean
  allowSnippet?: boolean
  isAdmin?: boolean
  onClose?: () => void
  // called when a new message arrives (for toast, etc)
  onNewMessage?: (msg: ChatMessage) => void
  // snippet sharing from reader
  onRequestSnippet?: () => void
}

export default function ClubChatPanel({
  clubId, clubName, bookId, chatAudioFolderId,
  chatEnabled = true, allowAudio = true, allowSnippet = true,
  isAdmin = false, onClose, onNewMessage, onRequestSnippet,
}: Props) {
  const { user } = useAuth()
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifPrefs, setShowNotifPrefs] = useState(false)
  const bellBtnRef = useRef<HTMLButtonElement>(null)

  const { messages, loading, loadingMore, hasMore, error, loadMore,
    sendTextMessage, sendAudioMessage, editMessage, deleteMessage, markRead
  } = useClubChat({ clubId, onNewMessage })

  // Mark read when panel is visible and messages arrive
  const handleMarkRead = useCallback(() => {
    if (messages.length > 0) {
      markRead(messages[messages.length - 1].id)
    }
  }, [messages, markRead])

  // Call markRead when panel is focused or messages change
  React.useEffect(() => {
    handleMarkRead()
  }, [messages.length]) // eslint-disable-line

  const handleSendText = useCallback(async (body: string, replyToId?: string) => {
    await sendTextMessage(body, replyToId)
    setReplyTo(null)
  }, [sendTextMessage])

  const handleSendAudio = useCallback(async (data: { audio_fileflow_file_id: string; audio_mime_type: string; audio_duration_seconds: number }) => {
    await sendAudioMessage(data)
  }, [sendAudioMessage])

  if (!user) return null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', backgroundColor: '#fff',
      fontFamily: 'inherit',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.875rem 1rem', borderBottom: '1px solid #f1f5f9',
        backgroundColor: '#fff', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{clubName}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Group Chat</div>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', position: 'relative' }}>
          {/* Notification prefs */}
          <button
            ref={bellBtnRef}
            onClick={() => setShowNotifPrefs(v => !v)}
            title="Notification preferences"
            style={iconBtn}
          >
            🔔
          </button>
          {showNotifPrefs && (
            <NotificationPrefsPopover
              clubId={clubId}
              onClose={() => setShowNotifPrefs(false)}
              anchorRef={bellBtnRef as React.RefObject<HTMLElement>}
            />
          )}
          {/* Settings (admin only) */}
          {isAdmin && (
            <button onClick={() => setShowSettings(true)} title="Chat settings" style={iconBtn}>
              ⚙️
            </button>
          )}
          {onClose && (
            <button onClick={onClose} title="Close" style={iconBtn}>✕</button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '0.5rem 1rem', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: '0.8125rem' }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9375rem' }}>
          Loading messages…
        </div>
      ) : (
        <ChatMessageList
          messages={messages}
          currentUserId={user.id}
          clubId={clubId}
          bookId={bookId}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          onEdit={editMessage}
          onDelete={deleteMessage}
          onReply={setReplyTo}
          isAdmin={isAdmin}
        />
      )}

      {/* Input */}
      <ChatInput
        clubId={clubId}
        chatAudioFolderId={chatAudioFolderId}
        allowAudio={allowAudio && chatEnabled}
        allowSnippet={allowSnippet && chatEnabled}
        disabled={!chatEnabled}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSendText={handleSendText}
        onSendAudio={handleSendAudio}
        onShareSnippet={onRequestSnippet}
      />

      {/* Settings modal */}
      {showSettings && (
        <ChatSettingsModal clubId={clubId} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '0.375rem', borderRadius: '6px', color: '#94a3b8',
  fontSize: '1rem', lineHeight: 1,
}
