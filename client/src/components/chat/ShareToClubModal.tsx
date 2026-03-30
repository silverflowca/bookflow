import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

interface Props {
  bookId?: string
  chapterId: string
  chapterTitle?: string
  snippetText: string
  offsetStart?: number
  offsetEnd?: number
  commentId?: string
  onClose: () => void
  onSent?: () => void
}

interface ClubOption {
  id: string
  name: string
}

export default function ShareToClubModal({
  chapterId, chapterTitle, snippetText, offsetStart, offsetEnd, commentId, onClose, onSent
}: Props) {
  const [clubs, setClubs] = useState<ClubOption[]>([])
  const [selectedClub, setSelectedClub] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getMyClubs().then((data: any[]) => {
      setClubs(data.map((c: any) => ({ id: c.id, name: c.name })))
      if (data.length === 1) setSelectedClub(data[0].id)
    }).catch(() => {})
  }, [])

  const handleSend = async () => {
    if (!selectedClub) return
    setSending(true)
    setError(null)
    try {
      await api.sendClubChatMessage(selectedClub, {
        message_type: 'chapter_snippet',
        body: note.trim() || undefined,
        snippet_chapter_id: chapterId,
        snippet_comment_id: commentId || undefined,
        snippet_text: snippetText,
        snippet_offset_start: offsetStart,
        snippet_offset_end: offsetEnd,
      })
      onSent?.()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#1e293b' }}>Share to Club Chat</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.25rem' }}>✕</button>
        </div>

        {/* Snippet preview */}
        <div style={{ border: '1px solid #e2e8f0', borderLeft: '3px solid #6366f1', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#f8fafc' }}>
          {chapterTitle && <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, marginBottom: '0.375rem' }}>📄 {chapterTitle}</div>}
          <div style={{ fontSize: '0.875rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.5, maxHeight: '80px', overflow: 'hidden' }}>"{snippetText}"</div>
        </div>

        {/* Club select */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.375rem' }}>Share to</label>
          {clubs.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>You're not a member of any clubs.</div>
          ) : (
            <select
              value={selectedClub}
              onChange={e => setSelectedClub(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', outline: 'none' }}
            >
              {clubs.length > 1 && <option value="">Select a club…</option>}
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {/* Optional note */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.375rem' }}>Add a note (optional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What do you think about this?"
            rows={2}
            style={{ width: '100%', resize: 'none', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
          <button
            onClick={handleSend}
            disabled={!selectedClub || sending}
            style={{ padding: '0.5rem 1.25rem', backgroundColor: selectedClub ? '#6366f1' : '#e2e8f0', color: selectedClub ? '#fff' : '#94a3b8', border: 'none', borderRadius: '8px', cursor: selectedClub ? 'pointer' : 'default', fontSize: '0.875rem', fontWeight: 600 }}
          >
            {sending ? 'Sending…' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
