import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, History, RotateCcw, Eye, Plus, Loader2, Tag } from 'lucide-react';
import api from '../lib/api';
import type { Book, BookVersion } from '../types';

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

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual save',
  submit_review: 'Submitted for review',
  publish: 'Published',
  auto: 'Auto (pre-restore)',
};

const TRIGGER_COLORS: Record<string, string> = {
  manual: 'bg-blue-100 text-blue-700',
  submit_review: 'bg-yellow-100 text-yellow-700',
  publish: 'bg-green-100 text-green-700',
  auto: 'bg-gray-100 text-gray-600',
};

export default function BookVersionsPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [versions, setVersions] = useState<BookVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<BookVersion | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [showNewSnapshot, setShowNewSnapshot] = useState(false);

  useEffect(() => {
    if (bookId) loadData();
  }, [bookId]);

  async function loadData() {
    try {
      const [bookData, versionsData] = await Promise.all([
        api.getBook(bookId!),
        api.getVersions(bookId!),
      ]);
      setBook(bookData);
      setVersions(versionsData);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSnapshot() {
    setCreating(true);
    try {
      const newVersion = await api.createVersion(bookId!, labelInput || undefined);
      setVersions(prev => [newVersion, ...prev]);
      setShowNewSnapshot(false);
      setLabelInput('');
    } catch (err) {
      console.error('Failed to create snapshot:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore(versionId: string) {
    if (!confirm('Restore to this version? The current state will be saved as a new version before restoring.')) return;
    setRestoringId(versionId);
    try {
      const result = await api.restoreVersion(bookId!, versionId);
      alert(`Restored ${result.restoredChapters} chapter(s). A backup of the current state was saved.`);
      await loadData();
    } catch (err) {
      console.error('Failed to restore version:', err);
      alert('Failed to restore version.');
    } finally {
      setRestoringId(null);
    }
  }

  async function handlePreview(versionId: string) {
    try {
      const version = await api.getVersion(bookId!, versionId);
      setPreviewVersion(version);
    } catch (err) {
      console.error('Failed to load version:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link
        to={`/edit/book/${bookId}/settings`}
        className="inline-flex items-center gap-1 text-muted hover:text-theme mb-6 transition-colors text-sm"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-accent" />
            <h1 className="text-2xl font-bold text-theme">Version History</h1>
          </div>
          {book && <p className="text-muted mt-1 ml-9">{book.title}</p>}
        </div>
        <button
          onClick={() => setShowNewSnapshot(!showNewSnapshot)}
          className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg font-medium"
        >
          <Plus className="h-4 w-4" />
          Save Snapshot
        </button>
      </div>

      {/* New snapshot form */}
      {showNewSnapshot && (
        <div className="theme-section rounded-xl p-4 mb-6 flex gap-3 items-center">
          <Tag className="h-4 w-4 text-muted flex-shrink-0" />
          <input
            type="text"
            placeholder="Snapshot label (optional)"
            value={labelInput}
            onChange={e => setLabelInput(e.target.value)}
            className="flex-1 bg-transparent text-theme placeholder-muted text-sm outline-none"
            onKeyDown={e => e.key === 'Enter' && handleCreateSnapshot()}
          />
          <button
            onClick={handleCreateSnapshot}
            disabled={creating}
            className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {creating ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setShowNewSnapshot(false)}
            className="text-muted hover:text-theme text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Versions list */}
      {versions.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No versions yet. Versions are created when you save snapshots, submit for review, or publish.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version, idx) => (
            <div key={version.id} className="theme-section rounded-xl p-4 flex items-center gap-4">
              {/* Version number */}
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                <span className="text-sm font-bold text-accent">v{version.version_number}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-theme">
                    {version.label || `Version ${version.version_number}`}
                  </p>
                  {idx === 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Latest
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIGGER_COLORS[version.trigger] || ''}`}>
                    {TRIGGER_LABELS[version.trigger] || version.trigger}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                  <span>{timeAgo(version.created_at)}</span>
                  {version.created_by_user?.display_name && (
                    <span>by {version.created_by_user.display_name}</span>
                  )}
                  {version.snapshot?.chapters && (
                    <span>{version.snapshot.chapters.length} chapter(s)</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePreview(version.id)}
                  className="flex items-center gap-1 text-xs text-muted hover:text-theme transition-colors px-3 py-1.5 rounded-lg border border-theme"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
                {idx !== 0 && (
                  <button
                    onClick={() => handleRestore(version.id)}
                    disabled={!!restoringId}
                    className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors px-3 py-1.5 rounded-lg border border-theme"
                  >
                    {restoringId === version.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RotateCcw className="h-3.5 w-3.5" />
                    }
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewVersion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewVersion(null)}>
          <div className="theme-modal rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b-2 border-theme">
              <div>
                <h3 className="text-lg font-semibold text-theme">
                  {previewVersion.label || `Version ${previewVersion.version_number}`}
                </h3>
                <p className="text-sm text-muted">{new Date(previewVersion.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setPreviewVersion(null)} className="text-muted hover:text-theme">✕</button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {(previewVersion.snapshot?.chapters || []).map((ch: { id: string; title: string; order_index: number; word_count?: number; content_text?: string }) => (
                <div key={ch.id} className="theme-section rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-theme">
                      {ch.order_index + 1}. {ch.title}
                    </h4>
                    {ch.word_count != null && (
                      <span className="text-xs text-muted">{ch.word_count} words</span>
                    )}
                  </div>
                  {ch.content_text && (
                    <p className="text-sm text-muted line-clamp-3">{ch.content_text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
