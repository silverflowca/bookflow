import type { ChatMessage } from '../../hooks/useClubChat'

interface Props {
  message: ChatMessage
  bookId?: string | null
}

export default function ChatSnippetCard({ message, bookId }: Props) {
  const chapterId = message.snippet_chapter_id
  const chapterTitle = message.snippet_chapter?.title
  const chapterIdx = message.snippet_chapter?.order_index ?? 0
  const chapterLabel = chapterTitle
    ? `Chapter ${chapterIdx + 1}: "${chapterTitle}"`
    : chapterId ? `Chapter ${chapterIdx + 1}` : 'Chapter'

  const targetBookId = bookId || message.book_id
  const jumpUrl = targetBookId && chapterId
    ? `/book/${targetBookId}/chapter/${chapterId}?offset=${message.snippet_offset_start ?? 0}&highlight=${message.snippet_offset_end ?? 0}`
    : null

  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderLeft: '3px solid #6366f1',
      borderRadius: '8px',
      padding: '0.625rem 0.75rem',
      backgroundColor: '#f8fafc',
      marginBottom: message.body ? '0.375rem' : 0,
      maxWidth: '360px',
    }}>
      <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <span>📄</span>
        <span>{chapterLabel}</span>
      </div>
      {message.snippet_comment_id && (
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>From a comment</div>
      )}
      <div style={{
        fontSize: '0.875rem',
        color: '#334155',
        fontStyle: 'italic',
        lineHeight: 1.5,
        display: '-webkit-box',
        WebkitLineClamp: 4,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        "{message.snippet_text}"
      </div>
      {jumpUrl && (
        <a
          href={jumpUrl}
          style={{
            display: 'inline-block',
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            color: '#6366f1',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Jump to Chapter →
        </a>
      )}
    </div>
  )
}
