import { useEffect, useMemo, useState } from 'react';
import { X, UserPlus, Mail, User, Loader2, Copy, Check, Search } from 'lucide-react';
import api from '../../lib/api';
import type { BookCollaborator, CollaboratorRole, ShareableUser } from '../../types';

interface InviteModalProps {
  bookId: string;
  bookTitle: string;
  onClose: () => void;
  onInvited: (collab: BookCollaborator & { invite_token?: string }) => void;
}

type InviteTab = 'email' | 'user';
type SuccessState =
  | { mode: 'added'; label: string }
  | { mode: 'email'; label: string }
  | { mode: 'manual'; label: string; url: string };

function AvatarFallback({ label }: { label: string }) {
  const initials = useMemo(
    () =>
      label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || '')
        .join('') || 'U',
    [label]
  );

  return (
    <div className="h-10 w-10 shrink-0 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold">
      {initials}
    </div>
  );
}

export default function InviteModal({ bookId, bookTitle, onClose, onInvited }: InviteModalProps) {
  const [tab, setTab] = useState<InviteTab>('email');
  const [email, setEmail] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ShareableUser | null>(null);
  const [userResults, setUserResults] = useState<ShareableUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [role, setRole] = useState<Exclude<CollaboratorRole, 'owner'>>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tab !== 'user') {
      return;
    }

    if (userQuery.trim().length < 2) {
      setUserResults([]);
      setSearchingUsers(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const results = await api.searchShareableUsers(bookId, userQuery.trim());
        if (!cancelled) {
          setUserResults(results);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const errMsg = err instanceof Error ? err.message : 'Unable to search users';
          setError(errMsg);
        }
      } finally {
        if (!cancelled) {
          setSearchingUsers(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bookId, tab, userQuery]);

  async function handleInvite() {
    setError('');
    setCopied(false);

    if (tab === 'email') {
      if (!email.trim()) {
        setError('Please enter an email address.');
        return;
      }
    } else if (!selectedUser) {
      setError('Choose a user to share this book with.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.inviteCollaborator(bookId, {
        email: tab === 'email' ? email.trim() : undefined,
        userId: tab === 'user' ? selectedUser?.id : undefined,
        role,
      });

      onInvited(result);

      if (tab === 'user') {
        setSuccess({ mode: 'added', label: result.added_name || selectedUser?.display_name || selectedUser?.email || 'User' });
        return;
      }

      if (result.manual && result.invite_url) {
        setSuccess({ mode: 'manual', label: email.trim(), url: result.invite_url });
        return;
      }

      if (result.email_sent) {
        setSuccess({ mode: 'email', label: email.trim() });
        return;
      }

      if (result.invite_url) {
        setSuccess({ mode: 'manual', label: email.trim(), url: result.invite_url });
        return;
      }

      setSuccess({ mode: 'added', label: result.added_name || email.trim() });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errMsg.includes('already') ? 'This person already has access to this book.' : errMsg);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="theme-modal rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-theme">
              {success.mode === 'manual' ? 'Invite ready' : success.mode === 'email' ? 'Invite sent' : 'Book shared'}
            </h3>
            <button onClick={onClose} className="text-muted hover:text-theme"><X className="h-5 w-5" /></button>
          </div>

          {success.mode === 'added' && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl mb-4">
              <Check className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                <strong>{success.label}</strong> now has access to <strong>{bookTitle}</strong> as <strong>{role}</strong>.
              </p>
            </div>
          )}

          {success.mode === 'email' && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl mb-4">
              <Check className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                We emailed <strong>{success.label}</strong> an invite to collaborate on <strong>{bookTitle}</strong>.
              </p>
            </div>
          )}

          {success.mode === 'manual' && (
            <>
              <p className="text-muted text-sm mb-4">
                SMTP is not configured, so we generated a share link for <strong>{success.label}</strong> instead.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 bg-surface border border-theme rounded-lg px-3 py-2 text-sm text-muted truncate">
                  {success.url}
                </div>
                <button
                  onClick={() => copyLink(success.url)}
                  className="flex items-center gap-1 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}

          <button onClick={onClose} className="w-full mt-4 theme-button-primary py-2 rounded-lg text-sm font-medium">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="theme-modal rounded-2xl max-w-xl w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-theme">Share book</h3>
            <p className="text-sm text-muted">{bookTitle}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-theme">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 bg-surface rounded-lg p-1 mb-5">
          <button
            onClick={() => { setTab('email'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'email' ? 'bg-surface-hover text-theme' : 'text-muted hover:text-theme'
            }`}
          >
            <Mail className="h-4 w-4" />
            Invite by Email
          </button>
          <button
            onClick={() => { setTab('user'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'user' ? 'bg-surface-hover text-theme' : 'text-muted hover:text-theme'
            }`}
          >
            <User className="h-4 w-4" />
            Existing User
          </button>
        </div>

        {tab === 'email' ? (
          <div className="mb-4">
            <label className="block text-sm font-medium text-theme mb-1.5">Email address</label>
            <input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              className="w-full border border-theme rounded-lg px-3 py-2 bg-surface text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
            <p className="text-xs text-muted mt-2">
              If they already have a BookFlow account, we’ll connect the share automatically. Otherwise, we’ll email them an invite link.
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-medium text-theme mb-1.5">Find by name or email</label>
            <div className="relative">
              <Search className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Start typing a name or email"
                value={userQuery}
                onChange={e => {
                  setUserQuery(e.target.value);
                  setSelectedUser(null);
                  setError('');
                }}
                className="w-full border border-theme rounded-lg pl-9 pr-3 py-2 bg-surface text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="mt-3 border border-theme rounded-xl bg-surface max-h-64 overflow-y-auto">
              {searchingUsers && (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching users…
                </div>
              )}

              {!searchingUsers && userQuery.trim().length < 2 && (
                <div className="px-3 py-3 text-sm text-muted">
                  Type at least 2 characters to search BookFlow users.
                </div>
              )}

              {!searchingUsers && userQuery.trim().length >= 2 && userResults.length === 0 && (
                <div className="px-3 py-3 text-sm text-muted">
                  No matching users found. Try their email instead.
                </div>
              )}

              {!searchingUsers && userResults.map(user => {
                const isSelected = selectedUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => { setSelectedUser(user); setError(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left border-b last:border-b-0 border-theme transition-colors ${
                      isSelected ? 'bg-accent/10' : 'hover:bg-surface-hover'
                    }`}
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.display_name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <AvatarFallback label={user.display_name || user.email} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-theme truncate">{user.display_name}</div>
                      <div className="text-xs text-muted truncate">{user.email}</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-accent shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

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
            {loading ? 'Sharing…' : 'Share Book'}
          </button>
        </div>
      </div>
    </div>
  );
}
