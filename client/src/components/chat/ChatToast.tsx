import { useEffect } from 'react'
import type { ChatMessage } from '../../hooks/useClubChat'

interface ToastItem {
  id: string
  message: ChatMessage
  clubId: string
  clubName: string
}

interface Props {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
  onView: (clubId: string) => void
}

export default function ChatToast({ toasts, onDismiss, onView }: Props) {
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      zIndex: 1000, maxWidth: '320px',
    }}>
      {toasts.slice(-3).map(toast => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} onView={onView} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onDismiss, onView }: { toast: ToastItem; onDismiss: (id: string) => void; onView: (clubId: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 5000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  const msg = toast.message
  const senderName = msg.sender?.display_name || 'A member'
  const preview = msg.message_type === 'audio'
    ? '🎙 Voice message'
    : msg.message_type === 'chapter_snippet'
      ? '📄 Shared a chapter snippet'
      : msg.message_type === 'system_status'
        ? msg.body?.slice(0, 60) || 'Status update'
        : (msg.body || '').slice(0, 80)

  const avatarLetter = (msg.sender?.display_name || '?')[0].toUpperCase()

  return (
    <div style={{
      backgroundColor: '#fff', border: '1px solid #e2e8f0',
      borderRadius: '12px', padding: '0.75rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
      animation: 'slideIn 0.2s ease',
    }}>
      {/* Avatar */}
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '0.9375rem', flexShrink: 0 }}>
        {msg.sender?.avatar_url ? <img src={msg.sender.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : avatarLetter}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.125rem' }}>{toast.clubName}</div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{senderName}</div>
        <div style={{ fontSize: '0.8125rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
        <button
          onClick={() => onView(toast.clubId)}
          style={{ padding: '0.25rem 0.625rem', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
        >
          View
        </button>
        <button
          onClick={() => onDismiss(toast.id)}
          style={{ padding: '0.25rem 0.625rem', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
