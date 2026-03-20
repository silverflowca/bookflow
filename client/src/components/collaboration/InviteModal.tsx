import { useState } from 'react';
import { X, UserPlus, Mail, User, Loader2, Copy, Check } from 'lucide-react';
import api from '../../lib/api';
import type { BookCollaborator, CollaboratorRole } from '../../types';

interface InviteModalProps {
  bookId: string;
  bookTitle: string;
  onClose: () => void;
  onInvited: (collab: BookCollaborator & { invite_token?: string }) => void;
}

export default function InviteModal({ bookId, bookTitle, onClose, onInvited }: InviteModalProps) {
  const [tab, setTab] = useState<'email' | 'user'>('email');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<CollaboratorRole, 'owner'>>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleInvite() {
    setError('');
    if (!email.trim()) {
      setError('Please enter an email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.inviteCollaborator(bookId, {
        email: email.trim(),
        role,
      });

      onInvited(result);

      if (result.invite_token) {
        setInviteToken(result.invite_token);
      } else {
        onClose();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errMsg.includes('already') ? 'This person is already a collaborator.' : errMsg);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!inviteToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Show success with invite link
  if (inviteToken) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="theme-modal rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-theme">Invite sent!</h3>
            <button onClick={onClose} className="text-muted hover:text-theme"><X className="h-5 w-5" /></button>
          </div>

          <p className="text-muted text-sm mb-4">
            No account was found for <strong>{email}</strong>. Share this link so they can accept the invite:
          </p>

          <div className="flex gap-2">
            <div className="flex-1 bg-surface border border-theme rounded-lg px-3 py-2 text-sm text-muted truncate">
              {`${window.location.origin}/invite/${inviteToken}`}
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <button onClick={onClose} className="w-full mt-4 text-sm text-muted hover:text-theme transition-colors">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="theme-modal rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-theme">Invite collaborator</h3>
            <p className="text-sm text-muted">{bookTitle}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-theme">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-surface rounded-lg p-1 mb-5">
          <button
            onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'email' ? 'bg-surface-hover text-theme' : 'text-muted hover:text-theme'
            }`}
          >
            <Mail className="h-4 w-4" />
            By Email
          </button>
          <button
            onClick={() => setTab('user')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'user' ? 'bg-surface-hover text-theme' : 'text-muted hover:text-theme'
            }`}
          >
            <User className="h-4 w-4" />
            Existing User
          </button>
        </div>

        {/* Email field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-theme mb-1.5">
            {tab === 'email' ? 'Email address' : 'Email or username'}
          </label>
          <input
            type="email"
            placeholder={tab === 'email' ? 'colleague@example.com' : 'their email address'}
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            className="w-full border border-theme rounded-lg px-3 py-2 bg-surface text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
          />
        </div>

        {/* Role selector */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-theme mb-1.5">Role</label>
          <div className="grid grid-cols-3 gap-2">
            {(['author', 'editor', 'reviewer'] as Exclude<CollaboratorRole, 'owner'>[]).map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors capitalize ${
                  role === r
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-theme text-muted hover:border-accent/50 hover:text-theme'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            {role === 'author' && 'Can edit chapters and content.'}
            {role === 'editor' && 'Can edit content and leave comments.'}
            {role === 'reviewer' && 'Can review and comment, cannot edit.'}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-theme py-2 rounded-lg text-sm font-medium text-muted hover:text-theme transition-colors">
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 theme-button-primary py-2 rounded-lg text-sm font-medium"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {loading ? 'Inviting...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
