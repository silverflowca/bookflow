import { useState } from 'react';
import { MoreVertical, Check, Trash2, Reply, Loader2, Share2 } from 'lucide-react';
import api from '../../lib/api';
import type { BookComment } from '../../types';
import ShareToClubModal from '../chat/ShareToClubModal';

interface CommentThreadProps {
  comment: BookComment;
  chapterId: string;
  bookId?: string;
  canResolve: boolean;
  onResolved?: (commentId: string) => void;
  onDeleted?: (commentId: string) => void;
  onReplyAdded?: (reply: BookComment, parentId: string) => void;
  currentUserId?: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CommentThread({
  comment,
  chapterId,
  bookId,
  canResolve,
  onResolved,
  onDeleted,
  onReplyAdded,
  currentUserId,
}: CommentThreadProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const isOwn = comment.author_id === currentUserId || comment.author?.id === currentUserId;
  const isResolved = comment.status === 'resolved';

  async function handleResolve() {
    setResolving(true);
    try {
      await api.resolveComment(comment.id);
      onResolved?.(comment.id);
    } catch (err) {
      console.error('Failed to resolve:', err);
    } finally {
      setResolving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.deleteComment(comment.id);
      onDeleted?.(comment.id);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  async function handleReply() {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const reply = await api.createComment(chapterId, replyText.trim(), { parent_id: comment.id });
      onReplyAdded?.(reply, comment.id);
      setReplyText('');
      setShowReply(false);
    } catch (err) {
      console.error('Failed to reply:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`rounded-xl p-3 ${isResolved ? 'opacity-60' : 'theme-section'}`}>
      {/* Inline selection badge */}
      {comment.anchor_text && (
        <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-xs text-yellow-800 mb-2 truncate italic">
          "{comment.anchor_text}"
        </div>
      )}

      {/* Comment header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-surface-hover flex items-center justify-center text-xs font-semibold text-muted flex-shrink-0">
            {comment.author?.display_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-theme">{comment.author?.display_name || 'Unknown'}</span>
            <span className="text-xs text-muted ml-2">{timeAgo(comment.created_at)}</span>
          </div>
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-muted hover:text-theme p-1 rounded transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 w-40 theme-modal rounded-lg shadow-lg z-20 py-1 text-sm">
              {canResolve && !isResolved && (
                <button
                  onClick={() => { handleResolve(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-muted hover:text-theme hover:bg-surface-hover transition-colors"
                >
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Resolve
                </button>
              )}
              {isOwn && (
                <button
                  onClick={() => { handleDelete(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-muted hover:text-red-500 hover:bg-surface-hover transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
              <button
                onClick={() => { setShowMenu(false); setShowReply(true); }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 text-muted hover:text-theme hover:bg-surface-hover transition-colors"
              >
                <Reply className="h-3.5 w-3.5" />
                Reply
              </button>
              {bookId && (
                <button
                  onClick={() => { setShowMenu(false); setShowShareModal(true); }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-muted hover:text-theme hover:bg-surface-hover transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share to Club Chat
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <p className="text-sm text-theme mt-2 ml-9 leading-relaxed">{comment.body}</p>

      {/* Resolved badge */}
      {isResolved && (
        <div className="flex items-center gap-1 ml-9 mt-1.5">
          <Check className="h-3 w-3 text-green-500" />
          <span className="text-xs text-green-600">Resolved</span>
        </div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-9 mt-3 space-y-2 border-l-2 border-theme pl-3">
          {comment.replies.map(reply => (
            <div key={reply.id} className="flex gap-2">
              <div className="h-6 w-6 rounded-full bg-surface-hover flex items-center justify-center text-xs font-semibold text-muted flex-shrink-0">
                {reply.author?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <span className="text-xs font-medium text-theme">{reply.author?.display_name}</span>
                <span className="text-xs text-muted ml-1.5">{timeAgo(reply.created_at)}</span>
                <p className="text-sm text-theme mt-0.5">{reply.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {showReply && (
        <div className="ml-9 mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Reply..."
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReply()}
            className="flex-1 text-sm border border-theme rounded-lg px-3 py-1.5 bg-surface text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
            autoFocus
          />
          <button
            onClick={handleReply}
            disabled={submitting || !replyText.trim()}
            className="text-xs theme-button-primary px-3 py-1.5 rounded-lg font-medium"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send'}
          </button>
          <button onClick={() => setShowReply(false)} className="text-xs text-muted hover:text-theme">Cancel</button>
        </div>
      )}

      {/* Quick actions row */}
      {!isResolved && (
        <div className="flex items-center gap-3 mt-2 ml-9">
          <button
            onClick={() => setShowReply(!showReply)}
            className="flex items-center gap-1 text-xs text-muted hover:text-theme transition-colors"
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
          {canResolve && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="flex items-center gap-1 text-xs text-muted hover:text-green-600 transition-colors"
            >
              {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Resolve
            </button>
          )}
          {bookId && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1 text-xs text-muted hover:text-theme transition-colors"
            >
              <Share2 className="h-3 w-3" />
              Share to Chat
            </button>
          )}
        </div>
      )}

      {showShareModal && bookId && (
        <ShareToClubModal
          bookId={bookId}
          chapterId={chapterId}
          snippetText={comment.anchor_text || comment.body.slice(0, 200)}
          offsetStart={comment.selection_start}
          offsetEnd={comment.selection_end}
          commentId={comment.id}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
