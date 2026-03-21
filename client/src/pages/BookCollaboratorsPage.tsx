import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Users, UserPlus, Trash2, RefreshCw, Loader2, Copy, Check, Crown } from 'lucide-react';
import api from '../lib/api';
import type { Book, BookCollaborator, CollaboratorRole } from '../types';
import InviteModal from '../components/collaboration/InviteModal';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  author: 'Author',
  editor: 'Editor',
  reviewer: 'Reviewer',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  author: 'bg-blue-100 text-blue-800',
  editor: 'bg-green-100 text-green-800',
  reviewer: 'bg-yellow-100 text-yellow-800',
};

export default function BookCollaboratorsPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [collaborators, setCollaborators] = useState<BookCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (bookId) loadData();
  }, [bookId]);

  async function loadData() {
    try {
      const bookData = await api.getBook(bookId!);
      setBook(bookData);
    } catch (err) {
      console.error('Failed to load book:', err);
    }

    try {
      const collabData = await api.getCollaborators(bookId!);
      setCollaborators(collabData);
    } catch (err) {
      console.error('Failed to load collaborators:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeRole(collabId: string, newRole: Exclude<CollaboratorRole, 'owner'>) {
    try {
      const updated = await api.updateCollaboratorRole(bookId!, collabId, newRole);
      setCollaborators(prev => prev.map(c => c.id === collabId ? { ...c, ...updated } : c));
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  }

  async function handleRemove(collabId: string) {
    if (!confirm('Remove this collaborator from the book?')) return;
    try {
      await api.removeCollaborator(bookId!, collabId);
      setCollaborators(prev => prev.filter(c => c.id !== collabId));
    } catch (err) {
      console.error('Failed to remove collaborator:', err);
    }
  }

  async function copyInviteLink(token: string, id: string) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleInvited(collab: BookCollaborator & { invite_token?: string }) {
    setCollaborators(prev => [...prev, collab]);
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
            <Users className="h-6 w-6 text-accent" />
            <h1 className="text-2xl font-bold text-theme">Collaborators</h1>
          </div>
          {book && (
            <p className="text-muted mt-1 ml-9">{book.title}</p>
          )}
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg font-medium"
        >
          <UserPlus className="h-4 w-4" />
          Invite
        </button>
      </div>

      {/* Permission info */}
      <div className="theme-section rounded-xl p-4 mb-6 text-sm text-muted">
        <strong className="text-theme">Permission levels:</strong>{' '}
        <span className="font-medium text-blue-600">Author</span> — can edit chapters;{' '}
        <span className="font-medium text-green-600">Editor</span> — can edit chapters + add comments;{' '}
        <span className="font-medium text-yellow-600">Reviewer</span> — can review + comment, cannot edit.
      </div>

      {/* Collaborators list */}
      <div className="space-y-3">
        {/* Owner row */}
        {book && (
          <div className="theme-section rounded-xl p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Crown className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-theme">
                {book.author?.display_name || 'Book Owner'}
              </p>
              <p className="text-xs text-muted">Owner of this book</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS.owner}`}>
              Owner
            </span>
          </div>
        )}

        {collaborators.length === 0 && (
          <div className="text-center py-8 text-muted">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No collaborators yet. Invite someone to get started.</p>
          </div>
        )}

        {collaborators.map(collab => (
          <div key={collab.id} className="theme-section rounded-xl p-4 flex items-center gap-4">
            {/* Avatar */}
            <div className="h-10 w-10 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0 text-sm font-semibold text-muted">
              {collab.user?.display_name?.[0]?.toUpperCase() || collab.invited_email?.[0]?.toUpperCase() || '?'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-theme truncate">
                {collab.user?.display_name || collab.invited_email || 'Unknown'}
              </p>
              <p className="text-xs text-muted">
                {collab.invite_accepted_at
                  ? `Active since ${new Date(collab.invite_accepted_at).toLocaleDateString()}`
                  : 'Invite pending'}
              </p>
            </div>

            {/* Pending invite copy link */}
            {!collab.invite_accepted_at && collab.invite_token && (
              <button
                onClick={() => copyInviteLink(collab.invite_token!, collab.id)}
                className="text-xs text-muted hover:text-accent flex items-center gap-1 transition-colors"
                title="Copy invite link"
              >
                {copiedId === collab.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copiedId === collab.id ? 'Copied' : 'Copy link'}
              </button>
            )}

            {/* Role selector */}
            {collab.invite_accepted_at ? (
              <select
                value={collab.role}
                onChange={e => handleChangeRole(collab.id, e.target.value as Exclude<CollaboratorRole, 'owner'>)}
                className="text-sm border border-theme rounded-lg px-2 py-1 bg-surface text-theme focus:ring-2 focus:ring-accent"
              >
                <option value="author">Author</option>
                <option value="editor">Editor</option>
                <option value="reviewer">Reviewer</option>
              </select>
            ) : (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[collab.role] || ''}`}>
                {ROLE_LABELS[collab.role] || collab.role}
              </span>
            )}

            {/* Remove button */}
            <button
              onClick={() => handleRemove(collab.id)}
              className="text-muted hover:text-red-500 transition-colors p-1"
              title="Remove collaborator"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Refresh */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={loadData}
          className="flex items-center gap-2 text-sm text-muted hover:text-theme transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          bookId={bookId!}
          bookTitle={book?.title || ''}
          onClose={() => setShowInviteModal(false)}
          onInvited={handleInvited}
        />
      )}
    </div>
  );
}
