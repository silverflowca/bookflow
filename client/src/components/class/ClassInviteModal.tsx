import { useState, useEffect, useRef } from 'react';
import { X, Mail, Search, UserPlus, Check, Copy, Link, Shield } from 'lucide-react';
import api from '../../lib/api';

interface SearchUser {
  id: string;
  display_name: string;
  avatar_url?: string;
  email?: string;
}

interface Props {
  clubId: string;
  clubName: string;
  inviteRole?: 'admin' | 'member';
  onClose: () => void;
  onAdded: () => void;
}

type InviteTab = 'email' | 'existing';

export default function ClassInviteModal({ clubId, clubName, inviteRole = 'member', onClose, onAdded }: Props) {
  const isTeacherInvite = inviteRole === 'admin';
  const [tab, setTab] = useState<InviteTab>('email');

  // Email tab
  const [email, setEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Existing user tab
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchClubUsers(clubId, query.trim());
        setResults(data);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, clubId]);

  async function handleEmailInvite() {
    if (!email.trim()) return;
    setEmailSending(true);
    setEmailError('');
    setInviteLink('');
    try {
      const result = await api.inviteClubMember(clubId, { email: email.trim(), role: inviteRole });
      if (result.invite_token) {
        const link = `${window.location.origin}/clubs/accept/${result.invite_token}`;
        setInviteLink(link);
      }
      onAdded();
      setEmail('');
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setEmailSending(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAddUser(user: SearchUser) {
    setAdding(user.id);
    setAddError('');
    try {
      await api.inviteClubMember(clubId, { userId: user.id, role: inviteRole });
      setAddedIds(prev => new Set([...prev, user.id]));
      onAdded();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(null);
    }
  }

  const title = isTeacherInvite ? 'Add Teacher / Facilitator' : 'Add Student';
  const Icon = isTeacherInvite ? Shield : UserPlus;
  const iconColor = isTeacherInvite ? 'text-blue-500' : 'text-violet-500';
  const btnClass = isTeacherInvite ? 'theme-button-secondary' : 'theme-button-primary';
  const placeholder = isTeacherInvite ? 'teacher@example.com' : 'student@example.com';
  const description = isTeacherInvite
    ? `Invite a teacher or facilitator to <span class="text-theme font-medium">${clubName}</span>. They will have full admin access to the class.`
    : `Send an invite link to a student's email address. They'll receive a notification to join <span class="text-theme font-medium">${clubName}</span>.`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-section rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-strong/20">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <h2 className="font-semibold text-theme">{title}</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-theme transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-strong/20">
          <button
            onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === 'email' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-muted hover:text-theme'
            }`}
          >
            <Mail className="h-4 w-4" /> Invite by Email
          </button>
          <button
            onClick={() => setTab('existing')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === 'existing' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-muted hover:text-theme'
            }`}
          >
            <Search className="h-4 w-4" /> Find User
          </button>
        </div>

        {/* Email Tab */}
        {tab === 'email' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted" dangerouslySetInnerHTML={{ __html: description }} />
            <div className="flex gap-2">
              <input
                type="email"
                className="flex-1 theme-input rounded-lg px-3 py-2 text-sm"
                placeholder={placeholder}
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailInvite()}
                autoFocus
              />
              <button
                onClick={handleEmailInvite}
                disabled={emailSending || !email.trim()}
                className={`${btnClass} px-4 py-2 rounded-lg text-sm disabled:opacity-50 whitespace-nowrap`}
              >
                {emailSending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}
            {inviteLink && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Invite sent! Share this link:
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-black/20 rounded px-2 py-1.5 border border-emerald-200 dark:border-emerald-800 min-w-0">
                    <Link className="h-3.5 w-3.5 text-muted flex-shrink-0" />
                    <span className="text-xs text-theme truncate">{inviteLink}</span>
                  </div>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 flex-shrink-0 transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Existing User Tab */}
        {tab === 'existing' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted">
              Search for existing BookFlow users to add directly to <span className="text-theme font-medium">{clubName}</span>
              {isTeacherInvite ? ' as a teacher/facilitator.' : '.'}
            </p>
            <input
              type="text"
              className="w-full theme-input rounded-lg px-3 py-2 text-sm"
              placeholder="Search by name or email..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            <div className="space-y-2 min-h-[120px]">
              {searching && (
                <p className="text-sm text-muted text-center py-4">Searching...</p>
              )}
              {!searching && query.length >= 2 && results.length === 0 && (
                <p className="text-sm text-muted text-center py-4">No users found</p>
              )}
              {!searching && query.length < 2 && (
                <p className="text-xs text-muted text-center py-6">Type at least 2 characters to search</p>
              )}
              {results.map(user => {
                const isAdded = addedIds.has(user.id);
                const isAdding = adding === user.id;
                return (
                  <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-strong/10 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                      {user.avatar_url
                        ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        : user.display_name.charAt(0)
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme truncate">{user.display_name}</p>
                      {user.email && <p className="text-xs text-muted truncate">{user.email}</p>}
                    </div>
                    <button
                      onClick={() => !isAdded && handleAddUser(user)}
                      disabled={isAdding || isAdded}
                      className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        isAdded
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : `${btnClass} disabled:opacity-50`
                      }`}
                    >
                      {isAdded ? <><Check className="h-3.5 w-3.5" /> Added</> : isAdding ? 'Adding...' : <><UserPlus className="h-3.5 w-3.5" /> Add</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-5 pb-5 flex justify-end">
          <button onClick={onClose} className="theme-button-secondary px-4 py-2 rounded-lg text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
