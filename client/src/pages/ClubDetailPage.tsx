import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Users, BookOpen, MessageSquare, Settings, Plus, Trash2,
  Crown, Shield, UserMinus, ChevronRight, Loader2, Send,
  Globe, Lock, Star, ArrowLeft,
  X, Check, Mail, Search, Copy, CheckCircle, UserPlus, MessageCircle,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ClubChatPanel from '../components/chat/ClubChatPanel';
import { useChatUnread } from '../hooks/useChatUnread';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  role: 'owner' | 'admin' | 'member';
  user_id?: string;
  invited_email?: string;
  invite_token?: string;
  invite_accepted_at?: string;
  is_join_request?: boolean;
  join_request_message?: string;
  joined_at: string;
  profile?: { id: string; display_name: string; avatar_url?: string; email?: string };
}

interface ClubBook {
  id: string;
  book_id: string;
  is_current: boolean;
  added_at: string;
  book?: { id: string; title: string; cover_image_url?: string; author?: { display_name: string } };
}

interface Discussion {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  parent_id?: string;
  book_id?: string;
  author?: { id: string; display_name: string; avatar_url?: string };
  replies?: Discussion[];
}

interface ClubSettings {
  show_member_reading_progress: boolean;
  show_member_answers: boolean;
  show_member_highlights: boolean;
  show_member_media: boolean;
  enable_progress_tracking?: boolean;
  allow_join_requests?: boolean;
}

interface ClubProgressEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  items_completed: number;
  items_total: number;
  chapters_completed: number;
  chapters_total: number;
  chapters_breakdown: { chapter_id: string; completed: number; total: number }[];
  last_active: string | null;
}

function SegmentedBar({ breakdown }: { breakdown: { completed: number; total: number }[] }) {
  if (!breakdown?.length) return null;
  const grandTotal = breakdown.reduce((s, b) => s + (b.total || 1), 0);
  return (
    <div className="flex gap-px w-full h-2 rounded-full overflow-hidden">
      {breakdown.map((seg, i) => {
        const widthPct = ((seg.total || 1) / grandTotal) * 100;
        const fillPct = seg.total > 0 ? Math.min(100, (seg.completed / seg.total) * 100) : 0;
        const done = seg.total > 0 && seg.completed >= seg.total;
        const started = fillPct > 0 && !done;
        return (
          <div key={i} style={{ width: `${widthPct}%` }} className="relative h-full bg-surface-hover rounded-sm overflow-hidden flex-shrink-0">
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-300 ${done ? 'bg-green-500' : started ? 'bg-amber-400' : ''}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

interface Club {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  visibility: 'public' | 'private';
  max_members: number;
  created_at: string;
  created_by?: string;
  my_role?: 'owner' | 'admin' | 'member' | null;
  member_count?: number;
  creator?: { id: string; display_name: string };
  members?: Member[];
  pending_invites?: Member[];
  books?: ClubBook[];
  settings?: ClubSettings;
}

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

function RoleIcon({ role }: { role: string }) {
  if (role === 'owner') return <span title="Owner"><Crown className="h-3.5 w-3.5 text-yellow-500" /></span>;
  if (role === 'admin') return <span title="Admin"><Shield className="h-3.5 w-3.5 text-blue-500" /></span>;
  return null;
}

function Avatar({ profile, size = 'sm' }: { profile?: { display_name: string; avatar_url?: string }; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs';
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={profile.display_name} className={`${cls} rounded-full object-cover`} />;
  }
  return (
    <div className={`${cls} rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold`}>
      {(profile?.display_name?.[0] ?? '?').toUpperCase()}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InviteModal({ clubId, onClose, onMemberAdded }: { clubId: string; onClose: () => void; onMemberAdded?: (m: Member) => void }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentInvites, setSentInvites] = useState<{ email: string; token: string; link: string }[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError('');
    try {
      const result = await api.inviteToClub(clubId, email.trim());
      const token = result.invite_token;
      const link = token ? `${window.location.origin}/clubs/accept/${token}` : '';
      setSentInvites(prev => [{ email: email.trim(), token: token ?? '', link }, ...prev]);
      if (onMemberAdded && result) onMemberAdded(result);
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  }

  async function copyLink(link: string, token: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback: show the link inline
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-section rounded-xl w-full max-w-md p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-theme">Invite Members</h3>
          <button onClick={onClose} className="text-muted hover:text-theme"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleInvite} className="space-y-3 mb-4">
          <label className="block text-xs text-muted mb-1">Invite by email address</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="member@example.com"
              className="flex-1 px-3 py-2 theme-input rounded-lg text-sm"
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="flex items-center gap-1 px-3 py-2 text-sm theme-button-primary rounded-lg disabled:opacity-50 flex-shrink-0"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Invite
            </button>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </form>

        {sentInvites.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Invites Sent</p>
            <div className="space-y-2">
              {sentInvites.map(inv => (
                <div key={inv.token} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-theme truncate">{inv.email}</p>
                      <p className="text-xs text-muted mt-0.5">Pending acceptance</p>
                    </div>
                    {inv.link && (
                      <button
                        onClick={() => copyLink(inv.link, inv.token)}
                        className="flex items-center gap-1 text-xs px-2 py-1 theme-button-secondary rounded flex-shrink-0"
                        title="Copy invite link"
                      >
                        {copied === inv.token
                          ? <><Check className="h-3 w-3 text-green-400" /> Copied</>
                          : <><Copy className="h-3 w-3" /> Copy Link</>
                        }
                      </button>
                    )}
                  </div>
                  {inv.link && (
                    <p className="text-xs text-muted mt-1 font-mono truncate opacity-60">{inv.link}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4 pt-3 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm theme-button-secondary rounded-lg">Done</button>
        </div>
      </div>
    </div>
  );
}

function AddBookModal({ clubId, existingBookIds, onClose, onAdded }: { clubId: string; existingBookIds: Set<string>; onClose: () => void; onAdded: (cb: ClubBook) => void }) {
  const [search, setSearch] = useState('');
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [setCurrent, setSetCurrent] = useState(false);
  const [error, setError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial results on mount
  useEffect(() => {
    doSearch('');
  }, []);

  function doSearch(q: string) {
    setLoading(true);
    setError('');
    api.searchBooks(q)
      .then(setBooks)
      .catch(() => setError('Failed to load books'))
      .finally(() => setLoading(false));
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 300);
  }

  async function handleAdd(bookId: string) {
    setAdding(bookId);
    setError('');
    try {
      const cb = await api.addBookToClub(clubId, bookId, setCurrent);
      onAdded(cb);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add book');
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-section rounded-xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="font-semibold text-theme">Add Book to Club</h3>
          <button onClick={onClose} className="text-muted hover:text-theme"><X className="h-5 w-5" /></button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search books by title…"
              className="w-full pl-9 pr-3 py-2 theme-input rounded-lg text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Set current toggle */}
        <label className="flex items-center gap-2 px-5 pb-3 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={setCurrent}
            onChange={e => setSetCurrent(e.target.checked)}
            className="rounded"
          />
          Set as current book being read
        </label>

        {error && <p className="px-5 pb-2 text-xs text-red-500">{error}</p>}

        {/* Results */}
        <div className="overflow-y-auto flex-1 px-3 pb-3 space-y-1 min-h-[200px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{search ? 'No books found.' : 'No books available.'}</p>
            </div>
          ) : (
            books.map((book: any) => {
              const alreadyAdded = existingBookIds.has(book.id);
              return (
                <div
                  key={book.id}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${alreadyAdded ? 'opacity-40' : 'hover:bg-white/5'}`}
                >
                  {book.cover_image_url
                    ? <img src={book.cover_image_url} alt={book.title} className="h-12 w-9 object-cover rounded flex-shrink-0" />
                    : <div className="h-12 w-9 bg-indigo-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-4 w-4 text-indigo-400" />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-theme font-medium truncate">{book.title}</p>
                    {book.author?.display_name && (
                      <p className="text-xs text-muted truncate">{book.author.display_name}</p>
                    )}
                  </div>
                  {alreadyAdded ? (
                    <span className="flex items-center gap-1 text-xs text-muted px-3 py-1">
                      <Check className="h-3.5 w-3.5" /> Added
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAdd(book.id)}
                      disabled={adding === book.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs theme-button-primary rounded-lg disabled:opacity-50 flex-shrink-0"
                    >
                      {adding === book.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Add
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function DiscussionThread({
  discussion,
  clubId,
  currentUserId,
  myRole,
  onReply,
  onDeleted,
}: {
  discussion: Discussion;
  clubId: string;
  currentUserId: string;
  myRole: string | null;
  onReply: (parentId: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(discussion.body);
  const [saving, setSaving] = useState(false);

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await api.updateClubDiscussion(clubId, discussion.id, editBody);
      setEditing(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this message?')) return;
    try {
      await api.deleteClubDiscussion(clubId, discussion.id);
      onDeleted(discussion.id);
    } catch (err: any) {
      alert(err.message);
    }
  }

  const canEdit = discussion.author?.id === currentUserId;
  const canDelete = canEdit || myRole === 'owner' || myRole === 'admin';

  return (
    <div className="flex gap-3">
      <Avatar profile={discussion.author} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-theme">{discussion.author?.display_name ?? 'Unknown'}</span>
          <span className="text-xs text-muted">{timeAgo(discussion.created_at)}</span>
          {discussion.created_at !== discussion.updated_at && <span className="text-xs text-muted italic">(edited)</span>}
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              className="w-full px-3 py-2 theme-input rounded-lg text-sm resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={saving} className="text-xs theme-button-primary px-3 py-1 rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="text-xs theme-button-secondary px-3 py-1 rounded-lg">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-theme whitespace-pre-wrap break-words">{discussion.body}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <button onClick={() => onReply(discussion.id)} className="text-xs text-muted hover:text-theme">Reply</button>
              {canEdit && <button onClick={() => setEditing(true)} className="text-xs text-muted hover:text-theme">Edit</button>}
              {canDelete && <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-400">Delete</button>}
            </div>
          </>
        )}
        {/* Replies */}
        {discussion.replies && discussion.replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 border-white/10 pl-3">
            {discussion.replies.map(r => (
              <DiscussionThread
                key={r.id}
                discussion={r}
                clubId={clubId}
                currentUserId={currentUserId}
                myRole={myRole}
                onReply={onReply}
                onDeleted={onDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pending Invite Row ────────────────────────────────────────────────────────

function PendingInviteRow({
  member,
  clubId,
  isAdmin,
  onTokenRefreshed,
  onApproved,
}: {
  member: Member;
  clubId: string;
  isAdmin: boolean;
  onTokenRefreshed: (memberId: string, newToken: string) => void;
  onApproved: (memberId: string) => void;
}) {
  const [token, setToken] = useState(member.invite_token ?? '');
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const link = token ? `${window.location.origin}/clubs/accept/${token}` : '';
  const hasAccount = !!member.user_id;

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleResend() {
    setResending(true);
    try {
      const result = await api.resendClubInvite(clubId, member.id);
      setToken(result.invite_token);
      onTokenRefreshed(member.id, result.invite_token);
      setResent(true);
      setTimeout(() => setResent(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to resend invite');
    } finally {
      setResending(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setShowConfirm(false);
    try {
      await api.approveClubInvite(clubId, member.id);
      onApproved(member.id);
    } catch (err: any) {
      alert(err.message || 'Failed to approve invite');
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="theme-modal rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-theme mb-2">Approve invite?</h3>
            <p className="text-sm text-muted mb-4">
              This will immediately add <span className="font-medium text-theme">{member.invited_email ?? 'this user'}</span> as a club member without requiring them to click the invite link.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-3 py-2 theme-button-secondary rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Yes, Approve
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full bg-gray-500/30 flex items-center justify-center flex-shrink-0">
          <Mail className="h-3.5 w-3.5 text-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-theme">{member.invited_email ?? 'Unknown'}</span>
          {hasAccount && (
            <span className="ml-2 text-xs text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-full">has account</span>
          )}
        </div>
        {isAdmin && hasAccount && (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={approving}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            title="Approve — add member without requiring them to click the link"
          >
            {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve
          </button>
        )}
        <button
          onClick={handleResend}
          disabled={resending}
          className="flex items-center gap-1 px-2 py-1 text-xs theme-button-secondary rounded-lg disabled:opacity-50"
          title="Generate a new invite link and re-notify"
        >
          {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : resent ? <Check className="h-3 w-3 text-green-500" /> : <Send className="h-3 w-3" />}
          {resent ? 'Sent' : 'Re-invite'}
        </button>
      </div>
      {link && (
        <div className="flex items-center gap-2 ml-10">
          <input
            readOnly
            value={link}
            className="flex-1 text-xs px-2 py-1.5 theme-input rounded-lg truncate text-muted"
            onClick={e => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1.5 text-xs theme-button-secondary rounded-lg flex-shrink-0"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Join Request Row ──────────────────────────────────────────────────────────

function JoinRequestRow({
  member,
  clubId,
  onApproved,
  onDeclined,
}: {
  member: Member;
  clubId: string;
  onApproved: (memberId: string) => void;
  onDeclined: (memberId: string) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declining, setDeclining] = useState(false);

  const name = member.profile?.display_name ?? member.profile?.email ?? 'Unknown';

  async function handleApprove() {
    setApproving(true);
    setShowApproveConfirm(false);
    try {
      await api.approveClubInvite(clubId, member.id);
      onApproved(member.id);
    } catch (err: any) {
      alert(err.message || 'Failed to approve');
    } finally {
      setApproving(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    try {
      await api.declineClubRequest(clubId, member.id);
      setShowDeclineModal(false);
      onDeclined(member.id);
    } catch (err: any) {
      alert(err.message || 'Failed to decline');
    } finally {
      setDeclining(false);
    }
  }

  return (
    <>
      {/* Approve confirm */}
      {showApproveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="theme-modal rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-theme mb-2">Approve join request?</h3>
            <p className="text-sm text-muted mb-4">
              <span className="font-medium text-theme">{name}</span> will be added as a club member immediately.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowApproveConfirm(false)} className="flex-1 px-3 py-2 theme-button-secondary rounded-lg text-sm">Cancel</button>
              <button onClick={handleApprove} disabled={approving} className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {approving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline modal — graceful */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="theme-modal rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-theme">Decline request</h3>
              <button onClick={() => setShowDeclineModal(false)} className="text-muted hover:text-theme"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-muted mb-4">
              A kind message will be sent to <span className="font-medium text-theme">{name}</span> letting them know their request wasn't accepted at this time.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-muted italic mb-4">
              "Thank you for your interest in our book club! Unfortunately, we're unable to add new members at this time. We appreciate your enthusiasm for reading and hope you'll find a great fit in another club."
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeclineModal(false)} className="flex-1 px-3 py-2 theme-button-secondary rounded-lg text-sm">Cancel</button>
              <button
                onClick={handleDecline}
                disabled={declining}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {declining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Send & Decline
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar profile={member.profile} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-theme">{name}</span>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <UserPlus className="h-2.5 w-2.5" /> Join Request
            </span>
          </div>
          {member.join_request_message && (
            <div className="mt-1.5 flex items-start gap-1 text-xs text-muted">
              <MessageCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2 italic">"{member.join_request_message}"</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowApproveConfirm(true)}
            disabled={approving}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve
          </button>
          <button
            onClick={() => setShowDeclineModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs theme-button-secondary rounded-lg text-red-400 hover:bg-red-500/10"
          >
            <X className="h-3 w-3" />
            Decline
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PanelTab = 'overview' | 'members' | 'books' | 'discussions' | 'chat' | 'settings' | 'progress';

export default function ClubDetailPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PanelTab>('overview');
  const { counts: chatUnread, clearClub: clearChatUnread } = useChatUnread();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [discLoading, setDiscLoading] = useState(false);
  const [postBody, setPostBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showAddBook, setShowAddBook] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<ClubSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [visibilityDraft, setVisibilityDraft] = useState<'private' | 'public' | null>(null);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [progressData, setProgressData] = useState<ClubProgressEntry[] | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressClubId, setProgressClubId] = useState<string | null>(null);
  const postRef = useRef<HTMLTextAreaElement>(null);

  const myRole = club?.my_role ?? null;
  const currentUserId = user?.id ?? '';
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  useEffect(() => {
    if (clubId) loadClub();
  }, [clubId]);

  useEffect(() => {
    if (tab === 'discussions' && clubId) loadDiscussions();
    if (tab === 'progress' && clubId && !progressData) loadProgress();
  }, [tab]);

  async function loadProgress() {
    if (!clubId) return;
    setProgressLoading(true);
    try {
      const result = await api.getClubProgress(clubId);
      setProgressData(result.members ?? []);
      setProgressClubId(clubId);
    } catch { setProgressData([]); }
    finally { setProgressLoading(false); }
  }

  async function loadClub() {
    try {
      const data = await api.getClub(clubId!);
      setClub(data);
    } catch (err) {
      console.error('Failed to load club:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDiscussions() {
    setDiscLoading(true);
    try {
      const raw: Discussion[] = await api.getClubDiscussions(clubId!);
      // Build threaded tree
      const map = new Map<string, Discussion>();
      const roots: Discussion[] = [];
      raw.forEach(d => { d.replies = []; map.set(d.id, d); });
      raw.forEach(d => {
        if (d.parent_id && map.has(d.parent_id)) {
          map.get(d.parent_id)!.replies!.push(d);
        } else if (!d.parent_id) {
          roots.push(d);
        }
      });
      setDiscussions(roots);
    } catch (err) {
      console.error('Failed to load discussions:', err);
    } finally {
      setDiscLoading(false);
    }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postBody.trim()) return;
    setPosting(true);
    try {
      const msg = await api.postClubDiscussion(clubId!, {
        body: postBody.trim(),
        parent_id: replyingTo ?? undefined,
      });
      if (replyingTo) {
        // Append reply to tree
        setDiscussions(prev => prev.map(d => addReply(d, replyingTo, msg)));
      } else {
        setDiscussions(prev => [msg, ...prev]);
      }
      setPostBody('');
      setReplyingTo(null);
    } catch (err: any) {
      alert(err.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  function addReply(d: Discussion, parentId: string, reply: Discussion): Discussion {
    if (d.id === parentId) return { ...d, replies: [...(d.replies ?? []), reply] };
    return { ...d, replies: d.replies?.map(r => addReply(r, parentId, reply)) };
  }

  function handleDiscussionDeleted(id: string) {
    function removeById(list: Discussion[]): Discussion[] {
      return list.filter(d => d.id !== id).map(d => ({ ...d, replies: removeById(d.replies ?? []) }));
    }
    setDiscussions(prev => removeById(prev));
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this member from the club?')) return;
    try {
      await api.removeClubMember(clubId!, memberId);
      setClub(prev => prev ? { ...prev, members: prev.members?.filter(m => m.id !== memberId) } : prev);
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handleRequestDeclined(memberId: string) {
    setClub(prev => prev ? { ...prev, members: prev.members?.filter(m => m.id !== memberId) } : prev);
  }

  async function handleSetCurrentBook(clubBookId: string) {
    try {
      await api.setCurrentClubBook(clubId!, clubBookId);
      setClub(prev => prev ? {
        ...prev,
        books: prev.books?.map(b => ({ ...b, is_current: b.id === clubBookId }))
      } : prev);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRemoveBook(clubBookId: string) {
    if (!confirm('Remove this book from the club?')) return;
    try {
      await api.removeBookFromClub(clubId!, clubBookId);
      setClub(prev => prev ? { ...prev, books: prev.books?.filter(b => b.id !== clubBookId) } : prev);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSaveSettings() {
    if (!settingsDraft) return;
    setSavingSettings(true);
    try {
      await api.updateClubSettings(clubId!, settingsDraft);
      setClub(prev => prev ? { ...prev, settings: settingsDraft } : prev);
      setEditingSettings(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveVisibility() {
    if (!visibilityDraft) return;
    setSavingVisibility(true);
    try {
      await api.updateClub(clubId!, { visibility: visibilityDraft });
      setClub(prev => prev ? { ...prev, visibility: visibilityDraft } : prev);
      setVisibilityDraft(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingVisibility(false);
    }
  }

  async function handleDeleteClub() {
    if (!confirm('Permanently delete this club? This cannot be undone.')) return;
    try {
      await api.deleteClub(clubId!);
      navigate('/clubs');
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="text-center py-16 text-muted">
        <p>Club not found.</p>
        <Link to="/clubs" className="text-indigo-400 text-sm mt-2 inline-block">← Back to Clubs</Link>
      </div>
    );
  }

  // Server already filters to accepted-only in the members array; pending_invites is a separate field
  const acceptedMembers = club.members ?? [];
  const memberCount = club.member_count ?? acceptedMembers.length;
  const allPending = club.pending_invites ?? [];
  const joinRequests = allPending.filter(m => m.is_join_request);
  const pendingInvites = allPending.filter(m => !m.is_join_request);
  const currentBook = club.books?.find(b => b.is_current);

  const tabs: { key: PanelTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'members', label: `Members (${memberCount})${isAdmin && allPending.length > 0 ? ` · ${allPending.length} pending` : ''}`, icon: <Users className="h-4 w-4" /> },
    { key: 'books', label: `Books (${club.books?.length ?? 0})`, icon: <BookOpen className="h-4 w-4" /> },
    { key: 'discussions', label: 'Discussions', icon: <MessageSquare className="h-4 w-4" /> },
    {
      key: 'chat' as PanelTab,
      label: chatUnread[clubId!] > 0 ? `Chat (${chatUnread[clubId!]})` : 'Chat',
      icon: <MessageSquare className="h-4 w-4" />,
    },
    ...(club.settings?.enable_progress_tracking ? [{ key: 'progress' as PanelTab, label: 'Progress', icon: <CheckCircle className="h-4 w-4" /> }] : []),
    ...(isAdmin ? [{ key: 'settings' as PanelTab, label: 'Settings', icon: <Settings className="h-4 w-4" /> }] : []),
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link to="/clubs" className="flex items-center gap-1 text-sm text-muted hover:text-theme mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Clubs
      </Link>

      {/* Club Header */}
      <div className="theme-section rounded-xl overflow-hidden mb-6">
        {club.cover_image_url && (
          <img src={club.cover_image_url} alt={club.name} className="w-full h-40 object-cover" />
        )}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-theme">{club.name}</h1>
                {club.visibility === 'public'
                  ? <span title="Public"><Globe className="h-5 w-5 text-muted" /></span>
                  : <span title="Private"><Lock className="h-5 w-5 text-muted" /></span>
                }
              </div>
              {club.description && <p className="text-muted mt-1">{club.description}</p>}
              <p className="text-xs text-muted mt-2">
                Created by {club.creator?.display_name ?? 'Unknown'} · {memberCount} / {club.max_members} members
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium self-start flex-shrink-0"
              >
                <Plus className="h-4 w-4" /> Invite Member
              </button>
            )}
          </div>
          {currentBook && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <Star className="h-4 w-4 text-yellow-500" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted">Currently reading</p>
                <p className="text-sm font-medium text-theme truncate">{currentBook.book?.title}</p>
              </div>
              <Link
                to={`/clubs/${clubId}/read/${currentBook.book?.id}`}
                className="flex items-center gap-1 text-xs theme-button-primary px-3 py-1.5 rounded-lg"
              >
                Read Together <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'theme-button-primary' : 'text-muted hover:text-theme hover:bg-white/5'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Recent Members */}
          <div className="theme-section rounded-xl p-4">
            <h3 className="font-semibold text-theme text-sm mb-3">Members</h3>
            <div className="space-y-2">
              {acceptedMembers.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <Avatar profile={m.profile} size="sm" />
                  <span className="text-sm text-theme flex-1 truncate">{m.profile?.display_name ?? m.invited_email ?? 'Unknown'}</span>
                  <RoleIcon role={m.role} />
                </div>
              ))}
            </div>
            <button onClick={() => setTab('members')} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">
              View all →
            </button>
          </div>

          {/* Books */}
          <div className="theme-section rounded-xl p-4">
            <h3 className="font-semibold text-theme text-sm mb-3">Reading List</h3>
            {(club.books?.length ?? 0) === 0 ? (
              <p className="text-muted text-sm">No books added yet.</p>
            ) : (
              <div className="space-y-2">
                {club.books?.slice(0, 4).map(cb => (
                  <div key={cb.id} className="flex items-center gap-2">
                    {cb.book?.cover_image_url
                      ? <img src={cb.book.cover_image_url} alt={cb.book.title} className="h-8 w-6 object-cover rounded" />
                      : <div className="h-8 w-6 bg-indigo-500/20 rounded" />
                    }
                    <span className="text-sm text-theme flex-1 truncate">{cb.book?.title}</span>
                    {cb.is_current && <Star className="h-3.5 w-3.5 text-yellow-500" />}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setTab('books')} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">
              Manage books →
            </button>
          </div>
        </div>
      )}

      {/* ── Members ── */}
      {tab === 'members' && (
        <div className="space-y-4">
          <div className="theme-section rounded-xl p-4">
            <h3 className="font-semibold text-theme text-sm mb-4">Active Members ({memberCount})</h3>
            <div className="space-y-3">
              {acceptedMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar profile={m.profile} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-theme">{m.profile?.display_name ?? 'Unknown'}</span>
                      <RoleIcon role={m.role} />
                    </div>
                    <span className="text-xs text-muted capitalize">{m.role}</span>
                  </div>
                  {club.settings?.show_member_reading_progress && m.user_id && (
                    <Link
                      to={`/clubs/${clubId}/read/${currentBook?.book?.id ?? ''}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Progress
                    </Link>
                  )}
                  {isAdmin && m.user_id !== currentUserId && (
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10"
                      title="Remove member"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {allPending.length > 0 && (
            <div className="theme-section rounded-xl p-4">
              <h3 className="font-semibold text-theme text-sm mb-4">
                Pending New Members &amp; Invites ({allPending.length})
              </h3>

              {joinRequests.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted uppercase tracking-wide mb-3">Join Requests</p>
                  <div className="space-y-4">
                    {joinRequests.map(m => (
                      <JoinRequestRow
                        key={m.id}
                        member={m}
                        clubId={club.id}
                        onApproved={(memberId) => {
                          setClub(prev => {
                            if (!prev) return prev;
                            const approved = prev.pending_invites?.find(mm => mm.id === memberId);
                            return {
                              ...prev,
                              pending_invites: prev.pending_invites?.filter(mm => mm.id !== memberId),
                              members: approved ? [...(prev.members ?? []), { ...approved, invite_accepted_at: new Date().toISOString() }] : prev.members,
                              member_count: (prev.member_count ?? 0) + 1,
                            };
                          });
                        }}
                        onDeclined={handleRequestDeclined}
                      />
                    ))}
                  </div>
                </div>
              )}

              {pendingInvites.length > 0 && (
                <div>
                  {joinRequests.length > 0 && <div className="border-t border-white/10 mb-3" />}
                  <p className="text-xs text-muted uppercase tracking-wide mb-3">Email Invites</p>
                  <div className="space-y-3">
                    {pendingInvites.map(m => (
                      <PendingInviteRow
                        key={m.id}
                        member={m}
                        clubId={club.id}
                        isAdmin={isAdmin}
                        onTokenRefreshed={(memberId, newToken) => {
                          setClub(prev => prev ? {
                            ...prev,
                            pending_invites: prev.pending_invites?.map(mm =>
                              mm.id === memberId ? { ...mm, invite_token: newToken } : mm
                            )
                          } : prev);
                        }}
                        onApproved={(memberId) => {
                          setClub(prev => {
                            if (!prev) return prev;
                            const approved = prev.pending_invites?.find(mm => mm.id === memberId);
                            return {
                              ...prev,
                              pending_invites: prev.pending_invites?.filter(mm => mm.id !== memberId),
                              members: approved ? [...(prev.members ?? []), { ...approved, invite_accepted_at: new Date().toISOString() }] : prev.members,
                              member_count: (prev.member_count ?? 0) + 1,
                            };
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 theme-button-secondary px-4 py-2 rounded-lg text-sm"
            >
              <Plus className="h-4 w-4" /> Invite Someone
            </button>
          )}
        </div>
      )}

      {/* ── Books ── */}
      {tab === 'books' && (
        <div className="space-y-3">
          {isAdmin && (
            <button
              onClick={() => setShowAddBook(true)}
              className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg text-sm"
            >
              <Plus className="h-4 w-4" /> Add Book
            </button>
          )}
          {(club.books?.length ?? 0) === 0 ? (
            <div className="text-center py-10 theme-section rounded-xl text-muted">
              <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No books added yet.</p>
            </div>
          ) : (
            <div className="theme-section rounded-xl divide-y divide-white/10">
              {club.books?.map(cb => (
                <div key={cb.id} className="flex items-center gap-4 p-4">
                  {cb.book?.cover_image_url
                    ? <img src={cb.book.cover_image_url} alt={cb.book.title} className="h-14 w-10 object-cover rounded shadow" />
                    : <div className="h-14 w-10 bg-indigo-500/20 rounded flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-indigo-400" />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-theme text-sm truncate">{cb.book?.title}</p>
                    {cb.book?.author && <p className="text-xs text-muted">{cb.book.author.display_name}</p>}
                    {cb.is_current && (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-500 mt-1">
                        <Star className="h-3 w-3" /> Currently reading
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/clubs/${clubId}/read/${cb.book?.id}`}
                      className="text-xs theme-button-secondary px-3 py-1.5 rounded-lg"
                    >
                      Read Together
                    </Link>
                    {isAdmin && !cb.is_current && (
                      <button
                        onClick={() => handleSetCurrentBook(cb.id)}
                        className="text-xs text-muted hover:text-yellow-400 px-2 py-1.5 rounded-lg hover:bg-yellow-500/10"
                        title="Set as current"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleRemoveBook(cb.id)}
                        className="text-xs text-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Discussions ── */}
      {tab === 'discussions' && (
        <div className="space-y-4">
          {/* Post form */}
          <div className="theme-section rounded-xl p-4">
            <form onSubmit={handlePost} className="space-y-2">
              <textarea
                ref={postRef}
                value={postBody}
                onChange={e => setPostBody(e.target.value)}
                placeholder={replyingTo ? 'Write a reply…' : 'Start a discussion…'}
                className="w-full px-3 py-2 theme-input rounded-lg text-sm resize-none"
                rows={2}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(e as any); } }}
              />
              <div className="flex items-center justify-between">
                {replyingTo ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <span>Replying to a message</span>
                    <button type="button" onClick={() => setReplyingTo(null)} className="text-red-400 hover:text-red-300">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : <span />}
                <button
                  type="submit"
                  disabled={posting || !postBody.trim()}
                  className="flex items-center gap-1.5 theme-button-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {replyingTo ? 'Reply' : 'Post'}
                </button>
              </div>
            </form>
          </div>

          {discLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
          ) : discussions.length === 0 ? (
            <div className="text-center py-10 text-muted">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No discussions yet. Start one!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {discussions.map(d => (
                <div key={d.id} className="theme-section rounded-xl p-4">
                  <DiscussionThread
                    discussion={d}
                    clubId={clubId!}
                    currentUserId={currentUserId}
                    myRole={myRole}
                    onReply={id => { setReplyingTo(id); postRef.current?.focus(); }}
                    onDeleted={handleDiscussionDeleted}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Chat ── */}
      {tab === 'chat' && clubId && (
        <div className="theme-section rounded-xl overflow-hidden" style={{ height: '600px' }} onClick={() => clearChatUnread(clubId)}>
          <ClubChatPanel
            clubId={clubId}
            clubName={club.name}
            bookId={currentBook?.book_id}
            chatAudioFolderId={(club as any).chat_audio_fileflow_folder_id}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* ── Progress ── */}
      {tab === 'progress' && (
        <div className="theme-section rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h2 className="font-semibold text-theme">Member Progress</h2>
            </div>
            <button onClick={loadProgress} className="text-xs text-muted hover:text-theme underline">Refresh</button>
          </div>

          {progressLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}

          {!progressLoading && progressData && progressData.length === 0 && (
            <p className="text-sm text-muted text-center py-8">No progress data yet.</p>
          )}

          {!progressLoading && progressData && progressData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted border-b border-theme">
                    <th className="pb-2 pr-4 font-medium">Member</th>
                    <th className="pb-2 pr-4 font-medium">Progress</th>
                    <th className="pb-2 pr-4 font-medium text-center">Chapters</th>
                    <th className="pb-2 font-medium text-right">Last active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme/30">
                  {progressData.map(entry => {
                    const chapterPct = entry.chapters_total > 0 ? Math.round((entry.chapters_completed / entry.chapters_total) * 100) : 0;
                    return (
                      <tr key={entry.user_id} className="py-2">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {entry.avatar_url
                              ? <img src={entry.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" />
                              : <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">{entry.display_name[0]?.toUpperCase()}</div>
                            }
                            <span className="font-medium text-theme">{entry.display_name}</span>
                            {entry.role === 'owner' && <Crown className="h-3 w-3 text-amber-500" />}
                            {entry.role === 'admin' && <Shield className="h-3 w-3 text-blue-500" />}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1">
                              <SegmentedBar breakdown={entry.chapters_breakdown ?? []} />
                            </div>
                            <span className="text-muted text-xs shrink-0">{chapterPct}%</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <Link
                            to={`/clubs/${progressClubId}/members/${entry.user_id}/progress`}
                            className="text-sm font-medium text-theme hover:text-accent transition-colors"
                            title="View submissions"
                          >
                            {entry.chapters_completed}/{entry.chapters_total}
                          </Link>
                        </td>
                        <td className="py-3 text-right text-muted text-xs">
                          {entry.last_active ? timeAgo(entry.last_active) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && isAdmin && (
        <div className="space-y-6">

          {/* Club Visibility */}
          <div className="theme-section rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-theme">Club Visibility</h3>
                <p className="text-xs text-muted mt-0.5">Control who can discover and see this club</p>
              </div>
              {visibilityDraft !== null ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveVisibility}
                    disabled={savingVisibility}
                    className="flex items-center gap-1 text-sm theme-button-primary px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {savingVisibility ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save
                  </button>
                  <button onClick={() => setVisibilityDraft(null)} className="text-sm theme-button-secondary px-3 py-1.5 rounded-lg">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setVisibilityDraft(club.visibility)}
                  className="text-sm theme-button-secondary px-3 py-1.5 rounded-lg"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'private' as const, icon: <Lock className="h-5 w-5" />, label: 'Members only', desc: 'Only invited members can see this club' },
                { value: 'public' as const, icon: <Globe className="h-5 w-5" />, label: 'Public', desc: 'Discoverable by any logged-in user' },
              ] as const).map(opt => {
                const current = visibilityDraft !== null ? visibilityDraft : club.visibility;
                const isSelected = current === opt.value;
                const isEditing = visibilityDraft !== null;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!isEditing}
                    onClick={() => isEditing && setVisibilityDraft(opt.value)}
                    className={`flex flex-col items-start gap-1.5 p-4 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'border-[3px] border-accent bg-accent/20 text-theme shadow-[0_0_0_1px_var(--color-accent)]'
                        : 'border-2 border-[var(--color-border)] text-muted bg-transparent'
                    } ${isEditing ? 'cursor-pointer hover:border-accent/60 hover:bg-accent/10' : 'cursor-default'}`}
                  >
                    <span className={isSelected ? 'text-accent' : 'text-muted'}>{opt.icon}</span>
                    <span className={`text-sm font-bold ${isSelected ? 'text-theme' : 'text-muted'}`}>{opt.label}</span>
                    <span className={`text-xs leading-snug ${isSelected ? 'text-theme/80' : 'text-muted/70'}`}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Member Visibility toggles */}
          <div className="theme-section rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-theme">Member Visibility</h3>
              {editingSettings ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="flex items-center gap-1 text-sm theme-button-primary px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save
                  </button>
                  <button onClick={() => { setEditingSettings(false); setSettingsDraft(null); }} className="text-sm theme-button-secondary px-3 py-1.5 rounded-lg">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingSettings(true); setSettingsDraft(club.settings ?? { show_member_reading_progress: true, show_member_answers: false, show_member_highlights: true, show_member_media: true, enable_progress_tracking: false, allow_join_requests: false }); }}
                  className="text-sm theme-button-secondary px-3 py-1.5 rounded-lg"
                >
                  Edit
                </button>
              )}
            </div>

            {([
              { key: 'allow_join_requests' as const, label: 'Allow Join Requests', desc: 'Let anyone browsing the Discover tab request to join this club — you approve or decline each request', publicOnly: true },
              { key: 'enable_progress_tracking' as const, label: 'Enable Progress Tracking', desc: 'Track member completion of forms, audio, and video in chapters — shows a Progress tab' },
              { key: 'show_member_reading_progress' as const, label: 'Show Reading Progress Dashboard', desc: 'Allow all members to see each other\'s progress (admins always see it)' },
              { key: 'show_member_answers' as const, label: 'Q&A Answers', desc: 'Reveal other members\' answers to in-book questions' },
              { key: 'show_member_highlights' as const, label: 'Highlights', desc: 'Members can see each other\'s highlights' },
              { key: 'show_member_media' as const, label: 'Audio / Video', desc: 'Show inline media content from other members' },
            ] as { key: keyof ClubSettings; label: string; desc: string; publicOnly?: boolean }[]).filter(({ publicOnly }) => !publicOnly || club.visibility === 'public').map(({ key, label, desc }) => {
              const current = editingSettings ? (settingsDraft?.[key] ?? false) : (club.settings?.[key] ?? false);
              return (
                <div key={key} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-theme">{label}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                  <button
                    disabled={!editingSettings}
                    onClick={() => editingSettings && setSettingsDraft(prev => prev ? { ...prev, [key]: !prev[key] } : prev)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${current ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'} ${editingSettings ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${current ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Danger zone */}
          {myRole === 'owner' && (
            <div className="theme-section rounded-xl p-5 border border-red-500/20">
              <h3 className="font-semibold text-red-400 mb-2">Danger Zone</h3>
              <p className="text-sm text-muted mb-4">Permanently delete this club and all its data.</p>
              <button
                onClick={handleDeleteClub}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 border border-red-500/30"
              >
                <Trash2 className="h-4 w-4" /> Delete Club
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showInvite && (
        <InviteModal
          clubId={clubId!}
          onClose={() => setShowInvite(false)}
          onMemberAdded={m => setClub(prev => prev ? { ...prev, members: [...(prev.members ?? []), m] } : prev)}
        />
      )}
      {showAddBook && (
        <AddBookModal
          clubId={clubId!}
          existingBookIds={new Set(club?.books?.map(b => b.book_id) ?? [])}
          onClose={() => setShowAddBook(false)}
          onAdded={cb => setClub(prev => prev ? { ...prev, books: [...(prev.books ?? []), cb] } : prev)}
        />
      )}
    </div>
  );
}
