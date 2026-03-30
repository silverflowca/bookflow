import type { ChatMessage } from '../../hooks/useClubChat'

interface Props {
  message: ChatMessage
}

export default function ChatSystemMessage({ message }: Props) {
  const payload = message.status_payload || {}

  const icon = payload.event === 'completion' ? '✅'
    : payload.event === 'weekly_summary' ? '📖'
    : '📖'

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      padding: '0.5rem 1rem',
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '12px',
        padding: '0.75rem 1rem',
        fontSize: '0.875rem',
        color: '#0c4a6e',
      }}>
        {payload.event === 'weekly_summary' ? (
          <WeeklySummary payload={payload} />
        ) : payload.event === 'completion' ? (
          <CompletionMessage payload={payload} />
        ) : (
          <div style={{ whiteSpace: 'pre-line' }}>{icon} {message.body}</div>
        )}
        <div style={{ fontSize: '0.75rem', color: '#7dd3fc', marginTop: '0.5rem', textAlign: 'right' }}>
          {new Date(message.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

function WeeklySummary({ payload }: { payload: any }) {
  const members: any[] = payload.members || []
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
        📖 Weekly Reading Update{payload.book_title ? ` — ${payload.book_title}` : ''}
      </div>
      {members.map((m, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderTop: i > 0 ? '1px solid #e0f2fe' : undefined }}>
          <span style={{ fontWeight: 500 }}>{m.member_name}</span>
          <span style={{ color: m.completed ? '#16a34a' : '#0369a1' }}>
            {m.chapter_label}
            {!m.completed && m.percent > 0 && <span style={{ marginLeft: '0.5rem', color: '#7dd3fc' }}>({m.percent}%)</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

function CompletionMessage({ payload }: { payload: any }) {
  const answers: any[] = payload.answers || []
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: answers.length ? '0.5rem' : 0 }}>
        ✅ {payload.member_name} just finished reading the book!
      </div>
      {answers.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#0369a1', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Chapter Answers
          </div>
          {answers.map((a, i) => (
            <div key={i} style={{ marginBottom: '0.375rem', paddingLeft: '0.75rem', borderLeft: '2px solid #bae6fd' }}>
              <div style={{ color: '#0369a1', fontStyle: 'italic', fontSize: '0.8125rem' }}>{a.question}</div>
              <div style={{ fontWeight: 500 }}>{a.answer}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
