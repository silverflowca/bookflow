import React, { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'

interface Props {
  clubId: string
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement>
}

type Mode = 'inherit' | 'all' | 'mentions' | 'none'

const OPTIONS: { value: Mode; label: string; description: string }[] = [
  { value: 'inherit', label: 'Club default', description: "Use the club's notification setting" },
  { value: 'all', label: 'All messages', description: 'Toast + badge for every new message' },
  { value: 'mentions', label: 'Mentions only', description: 'Only notify when @mentioned' },
  { value: 'none', label: 'None', description: 'No notifications (badges still update)' },
]

export default function NotificationPrefsPopover({ clubId, onClose, anchorRef }: Props) {
  const [mode, setMode] = useState<Mode>('inherit')
  const [saving, setSaving] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getClubChatPrefs(clubId).then(data => setMode((data.notification_mode || 'inherit') as Mode)).catch(() => {})
  }, [clubId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  const handleSelect = async (value: Mode) => {
    setMode(value)
    setSaving(true)
    try {
      await api.updateClubChatPrefs(clubId, value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute', bottom: '2.5rem', right: 0,
        backgroundColor: '#fff', border: '1px solid #e2e8f0',
        borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        width: '240px', zIndex: 100, padding: '0.375rem 0',
      }}
    >
      <div style={{ padding: '0.5rem 0.875rem 0.375rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
        Notifications
      </div>
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => handleSelect(opt.value)}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
            width: '100%', textAlign: 'left', padding: '0.5rem 0.875rem',
            background: mode === opt.value ? '#f0f9ff' : 'none',
            border: 'none', cursor: 'pointer',
          }}
        >
          <div style={{
            width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
            border: `2px solid ${mode === opt.value ? '#6366f1' : '#cbd5e1'}`,
            backgroundColor: mode === opt.value ? '#6366f1' : 'transparent',
          }} />
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: mode === opt.value ? 600 : 400, color: '#1e293b' }}>{opt.label}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{opt.description}</div>
          </div>
        </button>
      ))}
      {saving && (
        <div style={{ padding: '0.375rem 0.875rem', fontSize: '0.75rem', color: '#6366f1' }}>Saving…</div>
      )}
    </div>
  )
}
