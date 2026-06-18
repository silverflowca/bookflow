import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Globe, Lock, Search, BookOpen, Loader2, UserPlus, Check, X } from 'lucide-react';
import api from '../lib/api';

interface Club {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  visibility: 'public' | 'private';
  max_members: number;
  created_at: string;
  member_count?: number;
  allow_join_requests?: boolean;
  creator?: { id: string; display_name: string; avatar_url?: string };
  members?: { id: string; role: string; user_id: string; invite_accepted_at?: string }[];
  books?: { id: string; is_current: boolean; book?: { id: string; title: string; cover_image_url?: string } }[];
}

function ClubCard({ club, onOpen }: { club: Club; onOpen: (id: string) => void }) {
  const memberCount = club.member_count ?? club.members?.filter(m => m.invite_accepted_at).length ?? 0;
  const currentBook = club.books?.find(b => b.is_current)?.book;

  return (
    <div
      className="theme-section rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onOpen(club.id)}
    >
      {club.cover_image_url ? (
        <img src={club.cover_image_url} alt={club.name} className="w-full h-28 object-cover" />
      ) : (
        <div className="w-full h-28 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Users className="h-10 w-10 text-white opacity-60" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-theme text-sm leading-tight">{club.name}</h3>
          {club.visibility === 'public' ? (
            <span title="Public"><Globe className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" /></span>
          ) : (
            <span title="Private"><Lock className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" /></span>
          )}
        </div>
        {club.description && (
          <p className="text-muted text-xs mt-1 line-clamp-2">{club.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {memberCount} / {club.max_members}
          </span>
          {currentBook && (
            <span className="flex items-center gap-1 truncate">
              <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{currentBook.title}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateClubModalProps {
  onClose: () => void;
  onCreate: (club: Club) => void;
}

function CreateClubModal({ onClose, onCreate }: CreateClubModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [maxMembers, setMaxMembers] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const club = await api.createClub({ name: name.trim(), description: description.trim() || undefined, visibility, max_members: maxMembers });
      onCreate(club);
    } catch (err: any) {
      setError(err.message || 'Failed to create club');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-section rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">Create Book Club</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">Club Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 theme-input rounded-lg text-sm"
              placeholder="e.g. Sci-Fi Saturday Club"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 theme-input rounded-lg text-sm resize-none"
              rows={3}
              placeholder="What is this club about?"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Visibility</label>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value as 'private' | 'public')}
              className="w-full px-3 py-2 theme-input rounded-lg text-sm"
            >
              <option value="private">Private — invite only</option>
              <option value="public">Public — anyone can discover</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Max Members</label>
            <input
              type="number"
              value={maxMembers}
              onChange={e => setMaxMembers(Number(e.target.value))}
              min={2}
              max={500}
              className="w-full px-3 py-2 theme-input rounded-lg text-sm"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm theme-button-secondary rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm theme-button-primary rounded-lg disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Club
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestJoinModal({ club, onClose, onRequested }: { club: Club; onClose: () => void; onRequested: () => void }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await api.requestToJoinClub(club.id, message.trim() || undefined);
      setDone(true);
      setTimeout(() => { onRequested(); onClose(); }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-section rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-theme">Request to Join</h3>
          <button onClick={onClose} className="text-muted hover:text-theme"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted mb-4">{club.name}</p>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-4 text-green-400">
            <Check className="h-8 w-8" />
            <p className="text-sm font-medium">Request sent!</p>
            <p className="text-xs text-muted text-center">The club admin will review your request and get back to you.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1">Message (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Introduce yourself or tell us why you'd like to join…"
                className="w-full px-3 py-2 theme-input rounded-lg text-sm resize-none"
                rows={3}
              />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm theme-button-secondary rounded-lg">Cancel</button>
              <button
                type="submit"
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 text-sm theme-button-primary rounded-lg disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Send Request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ClubsPage() {
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [publicClubs, setPublicClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [joinRequestClub, setJoinRequestClub] = useState<Club | null>(null);
  const [requestedClubIds, setRequestedClubIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadClubs();
  }, []);

  async function loadClubs() {
    try {
      const [mine, pub] = await Promise.all([
        api.getMyClubs().catch(() => []),
        api.getPublicClubs().catch(() => []),
      ]);
      setMyClubs(mine);
      setPublicClubs(pub);
    } catch (err) {
      console.error('Failed to load clubs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    try {
      const results = await api.getPublicClubs(search);
      setPublicClubs(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }

  function handleCreated(club: Club) {
    setMyClubs(prev => [club, ...prev]);
    setShowCreate(false);
    navigate(`/clubs/${club.id}`);
  }

  const myClubIds = new Set(myClubs.map(c => c.id));
  const displayedPublic = publicClubs;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-theme theme-title">Book Clubs & Study Groups</h1>
          <p className="text-muted mt-1">Read together, discuss together</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg font-medium self-start sm:self-auto"
        >
          <Plus className="h-5 w-5" />
          New Club
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 theme-section p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('mine')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'mine' ? 'theme-button-primary' : 'text-muted hover:text-theme'}`}
        >
          My Clubs {myClubs.length > 0 && <span className="ml-1 opacity-60">({myClubs.length})</span>}
        </button>
        <button
          onClick={() => setTab('discover')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'discover' ? 'theme-button-primary' : 'text-muted hover:text-theme'}`}
        >
          Discover
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strong" />
        </div>
      ) : tab === 'mine' ? (
        myClubs.length === 0 ? (
          <div className="text-center py-16 theme-section border-dashed rounded-xl">
            <Users className="h-12 w-12 text-muted mx-auto mb-4" />
            <h3 className="font-semibold text-theme mb-2">No clubs yet</h3>
            <p className="text-muted text-sm mb-4">Create a club or get invited to one to start reading together.</p>
            <button onClick={() => setShowCreate(true)} className="theme-button-primary px-4 py-2 rounded-lg text-sm font-medium">
              Create Your First Club
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {myClubs.map(club => (
              <ClubCard key={club.id} club={club} onOpen={id => navigate(`/clubs/${id}`)} />
            ))}
          </div>
        )
      ) : (
        <div>
          {/* Search */}
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search public clubs..."
                className="w-full pl-9 pr-3 py-2 theme-input rounded-lg text-sm"
              />
            </div>
            <button onClick={handleSearch} className="theme-button-secondary px-4 py-2 rounded-lg text-sm">
              Search
            </button>
          </div>

          {displayedPublic.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No public clubs found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedPublic.map(club => {
                const isMember = myClubIds.has(club.id);
                const canRequest = club.allow_join_requests !== false;
                const requested = requestedClubIds.has(club.id);
                return (
                  <div key={club.id} className="flex flex-col">
                    <ClubCard club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                    {isMember ? (
                      <button
                        onClick={() => navigate(`/clubs/${club.id}`)}
                        className="mt-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs theme-button-primary rounded-lg"
                      >
                        <Check className="h-3.5 w-3.5" /> Member — Open
                      </button>
                    ) : (
                      <button
                        onClick={() => canRequest && !requested && setJoinRequestClub(club)}
                        disabled={requested || !canRequest}
                        title={!canRequest ? 'This club is not accepting join requests' : undefined}
                        className="mt-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs theme-button-secondary rounded-lg disabled:opacity-50"
                      >
                        {requested
                          ? <><Check className="h-3.5 w-3.5 text-green-400" /> Request Sent</>
                          : !canRequest
                            ? <><Lock className="h-3.5 w-3.5" /> Requests Closed</>
                            : <><UserPlus className="h-3.5 w-3.5" /> Request to Join</>
                        }
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateClubModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />
      )}
      {joinRequestClub && (
        <RequestJoinModal
          club={joinRequestClub}
          onClose={() => setJoinRequestClub(null)}
          onRequested={() => setRequestedClubIds(prev => new Set([...prev, joinRequestClub.id]))}
        />
      )}
    </div>
  );
}
