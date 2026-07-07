import { useEffect, useState, useRef } from 'react';
import { MessageSquarePlus, ChevronRight, Clock, CheckCircle2, AlertCircle, Circle, Send, Image, Mic, X, Loader2 } from 'lucide-react';
import api from '../lib/api';
import type { Feedback, FeedbackStatus, FeedbackType, FeedbackComment } from '../types';
import { useFeedbackContext } from '../contexts/FeedbackContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const STATUS_META: Record<FeedbackStatus, { label: string; icon: React.ReactNode; className: string }> = {
  open:        { label: 'Open',        icon: <Circle className="h-3.5 w-3.5" />,        className: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400' },
  in_progress: { label: 'In Progress', icon: <Clock className="h-3.5 w-3.5" />,         className: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-400' },
  resolved:    { label: 'Resolved',    icon: <CheckCircle2 className="h-3.5 w-3.5" />,  className: 'text-green-600 bg-green-50 dark:bg-green-950/40 dark:text-green-400' },
  closed:      { label: 'Closed',      icon: <AlertCircle className="h-3.5 w-3.5" />,   className: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' },
};

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature: 'Feature Request',
  question: 'Question',
  comment: 'Comment',
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.open;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.className}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function FeedbackDetail({ item, onClose, onNewComment }: {
  item: Feedback;
  onClose: () => void;
  onNewComment: (comment: FeedbackComment) => void;
}) {
  const [detail, setDetail] = useState<Feedback>(item);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [viewImg, setViewImg] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api.getFeedbackDetail(item.id)
      .then(d => setDetail(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item.id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail.comments?.length]);

  async function sendComment() {
    if (!comment.trim()) return;
    setSending(true);
    setError('');
    try {
      const newComment = await api.addFeedbackComment(detail.id, comment.trim());
      setDetail(d => ({ ...d, comments: [...(d.comments || []), newComment] }));
      onNewComment(newComment);
      setComment('');
    } catch {
      setError('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border-2 border-strong">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-theme gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs text-muted font-medium uppercase tracking-wide">{TYPE_LABELS[detail.type]}</span>
              <StatusBadge status={detail.status} />
            </div>
            <h2 className="text-base font-semibold text-theme leading-snug">{detail.title}</h2>
            <p className="text-xs text-muted mt-0.5">Submitted {timeAgo(detail.created_at ?? '')}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-theme p-1 rounded-lg transition-colors flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
          ) : (
            <>
              {/* Description */}
              {detail.description && (
                <div>
                  <p className="text-xs text-muted uppercase font-medium tracking-wide mb-1">Description</p>
                  <p className="text-sm text-theme whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}

              {/* Audio */}
              {detail.audio?.storage_path && (
                <div>
                  <p className="text-xs text-muted uppercase font-medium tracking-wide mb-1 flex items-center gap-1">
                    <Mic className="h-3.5 w-3.5" /> Audio Recording
                  </p>
                  <audio
                    controls
                    src={detail.audio.storage_path}
                    className="w-full h-9"
                    ref={el => { audioRefs.current['main'] = el; }}
                  />
                </div>
              )}

              {/* Screenshots */}
              {detail.screenshots && detail.screenshots.length > 0 && (
                <div>
                  <p className="text-xs text-muted uppercase font-medium tracking-wide mb-2 flex items-center gap-1">
                    <Image className="h-3.5 w-3.5" /> Screenshots ({detail.screenshots.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {detail.screenshots.map(ss => (
                      <div key={ss.id} className="rounded-lg overflow-hidden border border-theme bg-surface-hover">
                        <button onClick={() => setViewImg(ss.storage_path ?? null)} className="w-full">
                          <img src={ss.storage_path} alt={ss.note || 'Screenshot'} className="w-full object-cover max-h-32 hover:opacity-90 transition-opacity" />
                        </button>
                        {ss.note && <p className="text-xs text-muted px-2 py-1 truncate">{ss.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discussion */}
              <div>
                <p className="text-xs text-muted uppercase font-medium tracking-wide mb-3">Discussion</p>
                {(!detail.comments || detail.comments.length === 0) ? (
                  <p className="text-sm text-muted italic">No replies yet.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="h-7 w-7 rounded-full bg-surface-hover border border-theme overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {c.author?.avatar_url
                            ? <img src={c.author.avatar_url} alt="" className="h-full w-full object-cover" />
                            : <span className="text-xs font-bold text-accent">{(c.author?.display_name || 'A')[0].toUpperCase()}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-theme">{c.author?.display_name || 'Admin'}</span>
                            <span className="text-[11px] text-muted">{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-theme mt-0.5 whitespace-pre-wrap">{c.body}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Reply box */}
        <div className="border-t border-theme p-4">
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="flex gap-2">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendComment(); }}
              placeholder="Add a comment or update… (Ctrl+Enter to send)"
              rows={2}
              className="flex-1 theme-input text-sm resize-none rounded-lg px-3 py-2"
            />
            <button
              onClick={sendComment}
              disabled={sending || !comment.trim()}
              className="theme-button-primary px-3 py-2 rounded-lg self-end disabled:opacity-50 flex items-center gap-1 text-sm"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {viewImg && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewImg(null)}
        >
          <img src={viewImg} alt="Screenshot" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyFeedbackPage() {
  const { openFeedback } = useFeedbackContext();
  const [items, setItems] = useState<Feedback[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | ''>('');
  const [filterType, setFilterType] = useState<FeedbackType | ''>('');
  const [selected, setSelected] = useState<Feedback | null>(null);
  const limit = 15;

  useEffect(() => {
    setLoading(true);
    api.getMyFeedback({
      page,
      limit,
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(filterType ? { type: filterType } : {}),
    })
      .then(r => { setItems(r.data); setCount(r.count); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, filterStatus, filterType]);

  function handleFilterChange() {
    setPage(1);
  }

  const totalPages = Math.ceil(count / limit);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme">My Feedback</h1>
          <p className="text-sm text-muted mt-1">Track your submitted feedback and replies from the team.</p>
        </div>
        <button
          onClick={openFeedback}
          className="theme-button-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Feedback
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value as FeedbackStatus | ''); handleFilterChange(); }}
          className="theme-input text-sm rounded-lg px-3 py-1.5"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value as FeedbackType | ''); handleFilterChange(); }}
          className="theme-input text-sm rounded-lg px-3 py-1.5"
        >
          <option value="">All types</option>
          <option value="bug">Bug</option>
          <option value="feature">Feature Request</option>
          <option value="question">Question</option>
          <option value="comment">Comment</option>
        </select>
        {count > 0 && <span className="text-sm text-muted self-center ml-auto">{count} item{count !== 1 ? 's' : ''}</span>}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-accent" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No feedback yet</p>
          <p className="text-sm mt-1">Submit your first piece of feedback using the button above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const hasUnread = (item.comments?.length ?? 0) > 0;
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="w-full text-left bg-surface border border-theme rounded-xl px-4 py-3.5 hover:bg-surface-hover transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs text-muted">{TYPE_LABELS[item.type]}</span>
                      <StatusBadge status={item.status} />
                      {hasUnread && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent text-white">
                          {item.comments!.length} repl{item.comments!.length === 1 ? 'y' : 'ies'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-theme truncate">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted mt-0.5 line-clamp-1">{item.description}</p>
                    )}
                    <p className="text-[11px] text-muted mt-1">Updated {timeAgo(item.updated_at ?? item.created_at ?? '')}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted flex-shrink-0 mt-1 group-hover:text-accent transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-theme hover:bg-surface-hover disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-theme hover:bg-surface-hover disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <FeedbackDetail
          item={selected}
          onClose={() => setSelected(null)}
          onNewComment={() => {
            // Refresh list counts
            api.getMyFeedback({ page, limit, ...(filterStatus ? { status: filterStatus } : {}), ...(filterType ? { type: filterType } : {}) })
              .then(r => { setItems(r.data); setCount(r.count); })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
