import React, { useState, useEffect } from 'react'
import { api } from '../../lib/api'

// Preset schedule options for the admin UI
const SCHEDULE_PRESETS = [
  { label: 'Every Monday at 9:00 AM', cron: '0 9 * * 1' },
  { label: 'Every Monday at 6:00 AM', cron: '0 6 * * 1' },
  { label: 'Every Wednesday at 9:00 AM', cron: '0 9 * * 3' },
  { label: 'Every Friday at 9:00 AM', cron: '0 9 * * 5' },
  { label: 'Every Sunday at 9:00 AM', cron: '0 9 * * 0' },
  { label: 'Every day at 9:00 AM', cron: '0 9 * * *' },
  { label: 'Custom…', cron: 'custom' },
]

interface ChatSettings {
  chat_enabled: boolean
  allow_audio_messages: boolean
  allow_snippet_sharing: boolean
  weekly_status_updates: boolean
  chapter_completion_updates: boolean
  show_answers_in_completion: boolean
  weekly_cron_schedule: string
  weekly_cron_label: string
  default_notification_mode: 'all' | 'mentions' | 'none'
}

interface Props {
  clubId: string
  onClose: () => void
}

export default function ChatSettingsModal({ clubId, onClose }: Props) {
  const [settings, setSettings] = useState<ChatSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [customCron, setCustomCron] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('0 9 * * 1')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getClubChatSettings(clubId).then(data => {
      setSettings(data)
      const preset = SCHEDULE_PRESETS.find(p => p.cron === data.weekly_cron_schedule && p.cron !== 'custom')
      if (preset) {
        setSelectedPreset(data.weekly_cron_schedule)
      } else {
        setSelectedPreset('custom')
        setCustomCron(data.weekly_cron_schedule || '0 9 * * 1')
      }
    }).catch(() => {})
  }, [clubId])

  const update = (key: keyof ChatSettings, value: any) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const handlePresetChange = (cron: string) => {
    setSelectedPreset(cron)
    if (cron !== 'custom') {
      const preset = SCHEDULE_PRESETS.find(p => p.cron === cron)!
      update('weekly_cron_schedule', cron)
      update('weekly_cron_label', preset.label)
    }
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const finalCron = selectedPreset === 'custom' ? customCron : selectedPreset
      const finalLabel = selectedPreset === 'custom'
        ? `Custom: ${customCron}`
        : SCHEDULE_PRESETS.find(p => p.cron === selectedPreset)?.label || selectedPreset
      await api.updateClubChatSettings(clubId, {
        ...settings,
        weekly_cron_schedule: finalCron,
        weekly_cron_label: finalLabel,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <ModalShell onClose={onClose}>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </ModalShell>
    )
  }

  return (
    <ModalShell onClose={onClose}>
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', maxHeight: '80vh' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#1e293b' }}>Chat Settings</h2>

        <Section title="General">
          <Toggle label="Enable chat" checked={settings.chat_enabled} onChange={v => update('chat_enabled', v)} />
          <Toggle label="Allow audio messages" checked={settings.allow_audio_messages} onChange={v => update('allow_audio_messages', v)} />
          <Toggle label="Allow chapter snippet sharing" checked={settings.allow_snippet_sharing} onChange={v => update('allow_snippet_sharing', v)} />
        </Section>

        <Section title="Default Notifications">
          <div>
            <label style={labelStyle}>Member notification default</label>
            <select
              value={settings.default_notification_mode}
              onChange={e => update('default_notification_mode', e.target.value)}
              style={selectStyle}
            >
              <option value="all">All messages</option>
              <option value="mentions">Mentions only</option>
              <option value="none">None</option>
            </select>
            <p style={hintStyle}>Members can override this in their own preferences.</p>
          </div>
        </Section>

        <Section title="Reading Status Updates">
          <Toggle
            label="Post chapter completion updates"
            description="Automatically post when a member finishes a chapter"
            checked={settings.chapter_completion_updates}
            onChange={v => update('chapter_completion_updates', v)}
          />
          <Toggle
            label="Include member answers in completion posts"
            description="Shows their answers to chapter questions (respects club answer visibility setting)"
            checked={settings.show_answers_in_completion}
            onChange={v => update('show_answers_in_completion', v)}
            disabled={!settings.chapter_completion_updates}
          />
          <Toggle
            label="Post weekly reading summaries"
            description="Automatically post a progress summary for all members"
            checked={settings.weekly_status_updates}
            onChange={v => update('weekly_status_updates', v)}
          />
        </Section>

        {settings.weekly_status_updates && (
          <Section title="Weekly Summary Schedule">
            <div>
              <label style={labelStyle}>Schedule</label>
              <select
                value={selectedPreset}
                onChange={e => handlePresetChange(e.target.value)}
                style={selectStyle}
              >
                {SCHEDULE_PRESETS.map(p => (
                  <option key={p.cron} value={p.cron}>{p.label}</option>
                ))}
              </select>
            </div>
            {selectedPreset === 'custom' && (
              <div>
                <label style={labelStyle}>Custom cron expression</label>
                <input
                  value={customCron}
                  onChange={e => setCustomCron(e.target.value)}
                  placeholder="0 9 * * 1"
                  style={{ ...selectStyle, fontFamily: 'monospace' }}
                />
                <p style={hintStyle}>
                  Uses standard cron syntax. Times are in UTC.<br />
                  Examples: <code>0 9 * * 1</code> = Mon 9am · <code>0 9 * * 1,5</code> = Mon &amp; Fri 9am
                </p>
              </div>
            )}
          </Section>
        )}

        {error && <div style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={primaryBtn}>
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.25rem' }}>✕</button>
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: '0.625rem' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{children}</div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange, disabled }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: '40px', height: '22px', borderRadius: '11px', flexShrink: 0,
          backgroundColor: checked ? '#6366f1' : '#e2e8f0',
          position: 'relative', transition: 'background 0.2s', marginTop: '1px',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: '2px', left: checked ? '20px' : '2px',
          width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <div>
        <div style={{ fontSize: '0.9375rem', color: '#1e293b', fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.125rem' }}>{description}</div>}
      </div>
    </label>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', color: '#334155', fontWeight: 500, marginBottom: '0.375rem' }
const hintStyle: React.CSSProperties = { fontSize: '0.8125rem', color: '#94a3b8', margin: '0.375rem 0 0' }
const selectStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', outline: 'none', backgroundColor: '#fff' }
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1.25rem', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600 }
const secondaryBtn: React.CSSProperties = { padding: '0.5rem 1.25rem', backgroundColor: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9375rem' }
