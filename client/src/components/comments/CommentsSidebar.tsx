import { useEffect, useState, useCallback } from 'react';
import { X, MessageSquare, Plus, Loader2, Filter } from 'lucide-react';
import api from '../../lib/api';
import type { BookComment } from '../../types';
import CommentThread from './CommentThread';

interface CommentsSidebarProps {
  chapterId: string;
  bookId: string;
  canResolve: boolean;
  currentUserId?: string;
  onClose: () => void;
  /** When the editor has a selection, show new comment form pre-filled */
  pendingSelection?: {
    from: number;
    to: number;
    text: string;
  } | null;
  onSelectionUsed?: () => void;
}

type FilterType = 'all' | 'open' | 'resolved';

export default function CommentsSidebar({
  chapterId,
  canResolve,
  currentUserId,
  onClose,
  pendingSelection,
  onSelectionUsed,
}: CommentsSidebarProps) {
  const [comments, setComments] = useState<BookComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('open');
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
  }, [chapterId]);

  // When there's a pending selection, auto-open the new comment form
  useEffect(() => {
    if (pendingSelection) {
      setShowNewForm(true);
    }
  }, [pendingSelection]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getChapterComments(chapterId);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  async function handleSubmit() {
    if (!newBody.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const opts: { selection_start?: number; selection_end?: number; anchor_text?: string } = {};
      if (pendingSelection) {
        opts.selection_start = pendingSelection.from;
        opts.selection_end = pendingSelection.to;
        opts.anchor_text = pendingSelection.text;
      }

      const comment = await api.createComment(chapterId, newBody.trim(), opts);
      setComments(prev => [{ ...comment, replies: [] }, ...prev]);
      setNewBody('');
      setShowNewForm(false);
      onSelectionUsed?.();
    } catch (err: any) {
      console.error('Failed to create comment:', err);
      setSubmitError(err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResolved(commentId: string) {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, status: 'resolved' as const } : c
    ));
  }

  function handleDeleted(commentId: string) {
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  function handleReplyAdded(reply: BookComment, parentId: string) {
    setComments(prev => prev.map(c =>
      c.id === parentId ? { ...c, replies: [...(c.replies || []), reply] } : c
    ));
  }

  const filtered = comments.filter(c => {
    if (filter === 'open') return c.status === 'open';
    if (filter === 'resolved') return c.status === 'resolved';
    return true;
  });

  const openCount = comments.filter(c => c.status === 'open').length;

  return (
    <div className="flex flex-col h-full w-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-theme flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <span className="font-semibold text-theme text-sm">Comments</span>
          {openCount > 0 && (
            <span className="bg-accent/10 text-accent text-xs px-1.5 py-0.5 rounded-full font-medium">
              {openCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="p-1.5 text-muted hover:text-accent rounded-lg hover:bg-surface-hover transition-colors"
            title="New comment"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-theme rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* New comment form */}
      {showNewForm && (
        <div className="p-3 border-b-2 border-theme space-y-2 flex-shrink-0">
          {pendingSelection && (
            <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-xs text-yellow-800 truncate italic">
              "{pendingSelection.text}"
            </div>
          )}
          <textarea
            placeholder="Add a comment..."
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            className="w-full text-sm border border-theme rounded-lg px-3 py-2 bg-theme text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            rows={3}
            autoFocus
          />
          {submitError && (
            <p className="text-xs text-red-600">{submitError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !newBody.trim()}
              className="flex items-center gap-1.5 theme-button-primary px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Post
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewBody(''); setSubmitError(null); onSelectionUsed?.(); }}
              className="text-sm text-muted hover:text-theme transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-1 px-3 py-2 border-b-2 border-theme flex-shrink-0">
        <Filter className="h-3.5 w-3.5 text-muted mr-1" />
        {(['open', 'resolved', 'all'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 rounded text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-accent/10 text-accent' : 'text-muted hover:text-theme'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              {filter === 'open' ? 'No open comments' : filter === 'resolved' ? 'No resolved comments' : 'No comments yet'}
            </p>
            {filter === 'open' && (
              <button
                onClick={() => setShowNewForm(true)}
                className="mt-2 text-xs text-accent hover:underline"
              >
                Add the first comment
              </button>
            )}
          </div>
        ) : (
          filtered.map(comment => (
            <CommentThread
              key={comment.id}
              comment={comment}
              chapterId={chapterId}
              canResolve={canResolve}
              currentUserId={currentUserId}
              onResolved={handleResolved}
              onDeleted={handleDeleted}
              onReplyAdded={handleReplyAdded}
            />
          ))
        )}
      </div>
    </div>
  );
}
