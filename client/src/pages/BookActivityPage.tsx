import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft, Activity, GitBranch, MessageSquare, Layers, FileEdit,
  Loader2, ChevronDown, User
} from 'lucide-react';
import api from '../lib/api';
import type { Book, ActivityEvent, ActivityEventType } from '../types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

const FILTERS: { key: string; label: string; type?: ActivityEventType }[] = [
  { key: 'all', label: 'All' },
  { key: 'version', label: 'Versions', type: 'version' },
  { key: 'comment', label: 'Comments', type: 'comment' },
  { key: 'inline_content', label: 'Content', type: 'inline_content' },
  { key: 'change_log', label: 'Edits', type: 'change_log' },
];

const EVENT_ICONS: Record<ActivityEventType, typeof Activity> = {
  version: GitBranch,
  comment: MessageSquare,
  inline_content: Layers,
  change_log: FileEdit,
};

const EVENT_COLORS: Record<ActivityEventType, string> = {
  version: 'bg-blue-100 text-blue-600',
  comment: 'bg-green-100 text-green-600',
  inline_content: 'bg-purple-100 text-purple-600',
  change_log: 'bg-orange-100 text-orange-600',
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  submit_review: 'Review',
  publish: 'Published',
  auto: 'Auto',
};

const TRIGGER_COLORS: Record<string, string> = {
  manual: 'bg-blue-100 text-blue-700',
  submit_review: 'bg-yellow-100 text-yellow-700',
  publish: 'bg-green-100 text-green-700',
  auto: 'bg-gray-100 text-gray-600',
};

const COMMENT_STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
};

export default function BookActivityPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const PAGE_SIZE = 30;

  useEffect(() => {
    if (bookId) {
      loadBook();
      loadActivity(true);
    }
  }, [bookId, activeFilter]);

  async function loadBook() {
    try {
      const data = await api.getBook(bookId!);
      setBook(data);
    } catch (err) {
      console.error('Failed to load book:', err);
    }
  }

  async function loadActivity(reset = false) {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const offset = reset ? 0 : events.length;
    try {
      const result = await api.getBookActivity(bookId!, {
        type: activeFilter === 'all' ? 'all' : activeFilter,
        limit: PAGE_SIZE,
        offset,
      });
      setEvents(reset ? result.events : prev => [...prev, ...result.events]);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link
        to={`/edit/book/${bookId}/settings`}
        className="inline-flex items-center gap-1 text-muted hover:text-theme mb-6 transition-colors text-sm"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Activity className="h-6 w-6 text-accent mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-theme">Activity</h1>
          {book && <p className="text-muted mt-0.5">{book.title}</p>}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 mb-6 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeFilter === f.key
                ? 'bg-surface-hover text-theme shadow-sm'
                : 'text-muted hover:text-theme'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No activity yet.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-1">
            {events.map(event => {
              const Icon = EVENT_ICONS[event.event_type] || Activity;
              const colorClass = EVENT_COLORS[event.event_type] || 'bg-gray-100 text-gray-600';
              const meta = event.meta as any;

              return (
                <div key={event.id} className="flex gap-4 py-3 pl-0">
                  {/* Icon circle */}
                  <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-theme">{event.description}</p>

                      {/* Version trigger badge */}
                      {event.event_type === 'version' && meta.trigger && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIGGER_COLORS[meta.trigger] || 'bg-gray-100 text-gray-600'}`}>
                          {TRIGGER_LABELS[meta.trigger] || meta.trigger}
                        </span>
                      )}

                      {/* Comment status badge */}
                      {event.event_type === 'comment' && meta.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMMENT_STATUS_COLORS[meta.status] || ''}`}>
                          {meta.status}
                        </span>
                      )}

                      {/* Change type badge */}
                      {event.event_type === 'change_log' && meta.change_type && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHANGE_TYPE_COLORS[meta.change_type] || ''}`}>
                          {meta.change_type}
                        </span>
                      )}

                      {/* Chapter link for inline content */}
                      {event.event_type === 'inline_content' && meta.chapter_id && (
                        <Link
                          to={`/edit/book/${bookId}/chapter/${meta.chapter_id}`}
                          className="text-xs text-accent hover:underline"
                        >
                          {meta.chapter_title || 'View chapter'}
                        </Link>
                      )}

                      {/* Chapter link for comment */}
                      {event.event_type === 'comment' && meta.chapter_id && (
                        <Link
                          to={`/edit/book/${bookId}/chapter/${meta.chapter_id}?comments=1`}
                          className="text-xs text-accent hover:underline"
                        >
                          {meta.chapter_title || 'View chapter'}
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      {event.actor ? (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {event.actor.display_name}
                        </span>
                      ) : null}
                      <span>{timeAgo(event.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => loadActivity(false)}
            disabled={loadingMore}
            className="flex items-center gap-2 px-4 py-2 border border-theme rounded-lg text-sm text-muted hover:text-theme transition-colors"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
