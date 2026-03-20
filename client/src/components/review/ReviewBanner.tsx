import { useState } from 'react';
import { Star, Check, X, Loader2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import api from '../../lib/api';
import type { ReviewRequest } from '../../types';

interface ReviewBannerProps {
  bookId: string;
  reviewStatus: 'none' | 'pending' | 'approved' | 'rejected';
  userRole: 'owner' | 'author' | 'editor' | 'reviewer';
  latestReview?: ReviewRequest | null;
  onStatusChange?: (status: string) => void;
}

export default function ReviewBanner({ bookId, reviewStatus, userRole, latestReview, onStatusChange }: ReviewBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [reviewerNote, setReviewerNote] = useState('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  if (reviewStatus === 'none' && !['owner', 'author'].includes(userRole)) return null;

  async function handleSubmit() {
    setLoading(true);
    try {
      await api.submitForReview(bookId, message);
      onStatusChange?.('pending');
      setShowSubmitForm(false);
      setMessage('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to submit for review');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(status: 'approved' | 'rejected') {
    if (!latestReview) return;
    setLoading(true);
    try {
      await api.reviewDecision(bookId, latestReview.id, { status, reviewer_note: reviewerNote });
      onStatusChange?.(status);
      setReviewerNote('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update review');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!latestReview) return;
    if (!confirm('Cancel this review request?')) return;
    setLoading(true);
    try {
      await api.cancelReview(bookId, latestReview.id);
      onStatusChange?.('none');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to cancel review');
    } finally {
      setLoading(false);
    }
  }

  const STATUS_CONFIG = {
    none: { bg: 'bg-surface border-theme', icon: <Star className="h-4 w-4 text-muted" />, label: 'Not submitted' },
    pending: { bg: 'bg-yellow-50 border-yellow-200', icon: <Star className="h-4 w-4 text-yellow-500" />, label: 'Review pending' },
    approved: { bg: 'bg-green-50 border-green-200', icon: <Check className="h-4 w-4 text-green-500" />, label: 'Approved' },
    rejected: { bg: 'bg-red-50 border-red-200', icon: <X className="h-4 w-4 text-red-500" />, label: 'Changes requested' },
  };

  const config = STATUS_CONFIG[reviewStatus];

  return (
    <div className={`border rounded-lg overflow-hidden ${config.bg}`}>
      {/* Banner row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {config.icon}
        <span className="text-sm font-medium text-theme flex-1">{config.label}</span>

        {latestReview?.reviewer_note && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted hover:text-theme flex items-center gap-1 transition-colors"
          >
            Note
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}

        {/* Owner/Author: submit button */}
        {reviewStatus === 'none' && ['owner', 'author'].includes(userRole) && (
          <button
            onClick={() => setShowSubmitForm(!showSubmitForm)}
            className="text-xs theme-button-primary px-3 py-1.5 rounded-md font-medium flex items-center gap-1"
          >
            <Send className="h-3 w-3" />
            Submit for review
          </button>
        )}

        {/* Pending: cancel (submitter) or approve/reject (reviewer) */}
        {reviewStatus === 'pending' && (
          <>
            {['owner', 'author'].includes(userRole) && latestReview?.submitted_by && (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="text-xs text-muted hover:text-red-500 px-3 py-1.5 rounded-md border border-theme transition-colors"
              >
                Cancel
              </button>
            )}
            {['owner', 'reviewer'].includes(userRole) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs theme-button-primary px-3 py-1.5 rounded-md font-medium"
              >
                Review
              </button>
            )}
          </>
        )}
      </div>

      {/* Expanded: reviewer note or review form */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-current/10 space-y-3">
          {/* Show existing reviewer note */}
          {latestReview?.reviewer_note && (
            <p className="text-sm text-muted italic">"{latestReview.reviewer_note}"</p>
          )}

          {/* Reviewer action form */}
          {reviewStatus === 'pending' && ['owner', 'reviewer'].includes(userRole) && (
            <div className="space-y-2">
              <textarea
                placeholder="Optional note for the author..."
                value={reviewerNote}
                onChange={e => setReviewerNote(e.target.value)}
                className="w-full text-sm border border-theme rounded-lg px-3 py-2 bg-surface text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecision('approved')}
                  disabled={loading}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Approve
                </button>
                <button
                  onClick={() => handleDecision('rejected')}
                  disabled={loading}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Request changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit form */}
      {showSubmitForm && (
        <div className="px-4 pb-4 pt-1 border-t border-current/10 space-y-2">
          <textarea
            placeholder="Message to reviewers (optional)..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full text-sm border border-theme rounded-lg px-3 py-2 bg-surface text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-1.5 theme-button-primary px-4 py-1.5 rounded-lg text-sm font-medium"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit
            </button>
            <button onClick={() => setShowSubmitForm(false)} className="text-sm text-muted hover:text-theme transition-colors px-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
