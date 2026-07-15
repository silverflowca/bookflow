import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Users, Globe, Lock, Search, BookOpen, Loader2, UserPlus, Check, X, Expand, LayoutGrid, LayoutList, GraduationCap, Video, MessageSquare } from 'lucide-react';
import api from '../lib/api';

function ExpandableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="relative group cursor-zoom-in" onClick={() => setOpen(true)}>
        <img src={src} alt={alt} className="w-full h-auto" />
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-lg p-1.5">
          <Expand className="h-4 w-4 text-white" />
        </div>
      </div>
      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            onClick={() => setOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
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
  club_type: 'club' | 'study_group' | 'online_class';
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

function ClubRow({ club, onOpen }: { club: Club; onOpen: (id: string) => void }) {
  const memberCount = club.member_count ?? club.members?.filter(m => m.invite_accepted_at).length ?? 0;
  const currentBook = club.books?.find(b => b.is_current)?.book;

  return (
    <div
      className="theme-section rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4 p-3"
      onClick={() => onOpen(club.id)}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        {club.cover_image_url
          ? <img src={club.cover_image_url} alt={club.name} className="w-full h-full object-cover" />
          : <Users className="h-5 w-5 text-white opacity-60" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-theme text-sm truncate">{club.name}</h3>
          {club.visibility === 'public'
            ? <Globe className="h-3.5 w-3.5 text-muted flex-shrink-0" />
            : <Lock className="h-3.5 w-3.5 text-muted flex-shrink-0" />
          }
        </div>
        {club.description && (
          <p className="text-muted text-xs truncate">{club.description}</p>
        )}
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {memberCount} / {club.max_members}
        </span>
        {currentBook && (
          <span className="hidden sm:flex items-center gap-1 max-w-[160px] truncate">
            <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{currentBook.title}</span>
          </span>
        )}
      </div>
    </div>
  );
}

interface CreateClubModalProps {
  clubType: 'club' | 'study_group' | 'online_class';
  onClose: () => void;
  onCreate: (club: Club) => void;
}

function CreateClubModal({ clubType, onClose, onCreate }: CreateClubModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [maxMembers, setMaxMembers] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const label = clubType === 'study_group' ? 'Study Group' : clubType === 'online_class' ? 'Online Class' : 'Book Club';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const club = await api.createClub({ name: name.trim(), description: description.trim() || undefined, visibility, max_members: maxMembers, club_type: clubType });
      onCreate(club);
    } catch (err: any) {
      setError(err.message || `Failed to create ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-section rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">Create {label}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">{label} Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 theme-input rounded-lg text-sm"
              placeholder={clubType === 'study_group' ? 'e.g. Sunday Morning Bible Study' : clubType === 'online_class' ? 'e.g. Discerners & Feelers — Session 1' : 'e.g. Sci-Fi Saturday Club'}
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
              placeholder={clubType === 'study_group' ? 'What book or topic will your group study?' : clubType === 'online_class' ? 'Describe your class — topic, level, what students will learn...' : 'What is this club about?'}
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
              Create {label}
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
  const [myStudyGroups, setMyStudyGroups] = useState<Club[]>([]);
  const [publicStudyGroups, setPublicStudyGroups] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [mainTab, setMainTab] = useState<'clubs' | 'bookstudy' | 'onlineclasses'>(
    searchParams.get('tab') === 'bookstudy' ? 'bookstudy' : searchParams.get('tab') === 'onlineclasses' ? 'onlineclasses' : 'clubs'
  );

  // Sync tab when URL search param changes (e.g. clicking nav link while already on /clubs)
  useEffect(() => {
    const t = searchParams.get('tab');
    setMainTab(t === 'bookstudy' ? 'bookstudy' : t === 'onlineclasses' ? 'onlineclasses' : 'clubs');
  }, [searchParams]);
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [sgTab, setSgTab] = useState<'mine' | 'discover'>('mine');
  const [search, setSearch] = useState('');
  const [sgSearch, setSgSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<'club' | 'study_group' | 'online_class'>('club');
  const [myClasses, setMyClasses] = useState<Club[]>([]);
  const [publicClasses, setPublicClasses] = useState<Club[]>([]);
  const [ocTab, setOcTab] = useState<'mine' | 'discover'>('mine');
  const [ocSearch, setOcSearch] = useState('');
  const [joinRequestClub, setJoinRequestClub] = useState<Club | null>(null);
  const [requestedClubIds, setRequestedClubIds] = useState<Set<string>>(new Set());
  const [clubView, setClubView] = useState<'card' | 'list'>(() =>
    (localStorage.getItem('bookflow-club-view') as 'card' | 'list') || 'card'
  );
  const navigate = useNavigate();
  const { user } = useAuth();

  function toggleClubView(v: 'card' | 'list') {
    setClubView(v);
    localStorage.setItem('bookflow-club-view', v);
  }

  useEffect(() => {
    loadClubs();
  }, []);

  async function loadClubs() {
    try {
      const [mine, pub, minesg, pubsg, mineoc, puboc] = await Promise.all([
        api.getMyClubs('club').catch(() => []),
        api.getPublicClubs(undefined, 'club').catch(() => []),
        api.getMyClubs('study_group').catch(() => []),
        api.getPublicClubs(undefined, 'study_group').catch(() => []),
        api.getMyClubs('online_class').catch(() => []),
        api.getPublicClubs(undefined, 'online_class').catch(() => []),
      ]);
      setMyClubs(mine);
      setPublicClubs(pub);
      setMyStudyGroups(minesg);
      setPublicStudyGroups(pubsg);
      setMyClasses(mineoc);
      setPublicClasses(puboc);
    } catch (err) {
      console.error('Failed to load clubs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    try {
      const results = await api.getPublicClubs(search, 'club');
      setPublicClubs(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }

  async function handleSgSearch() {
    try {
      const results = await api.getPublicClubs(sgSearch, 'study_group');
      setPublicStudyGroups(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }

  async function handleOcSearch() {
    try {
      const results = await api.getPublicClubs(ocSearch, 'online_class');
      setPublicClasses(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }

  function openCreate(type: 'club' | 'study_group' | 'online_class') {
    if (!user) { navigate('/login'); return; }
    setCreateType(type);
    setShowCreate(true);
  }

  function handleCreated(club: Club) {
    if (club.club_type === 'study_group') {
      setMyStudyGroups(prev => [club, ...prev]);
    } else if (club.club_type === 'online_class') {
      setMyClasses(prev => [club, ...prev]);
    } else {
      setMyClubs(prev => [club, ...prev]);
    }
    setShowCreate(false);
    navigate(`/clubs/${club.id}`);
  }

  const myClubIds = new Set(myClubs.map(c => c.id));
  const mySgIds = new Set(myStudyGroups.map(c => c.id));
  const myClassIds = new Set(myClasses.map(c => c.id));
  const displayedPublic = publicClubs;
  const displayedPublicSg = publicStudyGroups;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero image — switches with tab */}
      <div className="mb-8 rounded-2xl overflow-hidden shadow-md">
        {mainTab === 'clubs'
          ? <ExpandableImage src="/bookflow_clubs.png" alt="Book Clubs" />
          : mainTab === 'onlineclasses'
            ? <ExpandableImage src="/bookflow_classes.png" alt="Online Classes" />
            : <ExpandableImage src="/bookstudy.png" alt="Book Study Groups" />
        }
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme theme-title">Book Clubs, Study Groups & Online Classes</h1>
          <p className="text-muted mt-1">Read together, discuss together</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Card / List toggle */}
          <div className="flex items-center gap-1 border border-[var(--color-border)] rounded-lg p-0.5">
            <button
              onClick={() => toggleClubView('card')}
              title="Card view"
              className={`p-1.5 rounded-md transition-colors ${clubView === 'card' ? 'text-accent bg-accent/10' : 'text-muted hover:text-theme'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => toggleClubView('list')}
              title="List view"
              className={`p-1.5 rounded-md transition-colors ${clubView === 'list' ? 'text-accent bg-accent/10' : 'text-muted hover:text-theme'}`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => openCreate(mainTab === 'bookstudy' ? 'study_group' : mainTab === 'onlineclasses' ? 'online_class' : 'club')}
            className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg font-medium"
          >
            <Plus className="h-5 w-5" />
            {mainTab === 'bookstudy' ? 'New Study Group' : mainTab === 'onlineclasses' ? 'New Class' : 'New Club'}
          </button>
        </div>
      </div>

      {/* Main tab bar — Clubs | Book Study Groups | Online Classes */}
      <div className="flex gap-1 mb-6 border-b border-surface-hover">
        <button
          onClick={() => setMainTab('clubs')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            mainTab === 'clubs'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted hover:text-theme'
          }`}
        >
          <Users className="h-4 w-4" />
          Clubs
        </button>
        <button
          onClick={() => setMainTab('bookstudy')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            mainTab === 'bookstudy'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted hover:text-theme'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Book Study Groups
        </button>
        <button
          onClick={() => setMainTab('onlineclasses')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            mainTab === 'onlineclasses'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted hover:text-theme'
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Online Classes
        </button>
      </div>

      {/* ── Clubs tab ──────────────────────────────────────────────────── */}
      {mainTab === 'clubs' && (
        <>
          <h2 className="text-xl font-bold text-theme mb-1">Book Clubs</h2>
          <p className="text-muted text-sm mb-6 max-w-2xl">Private reading communities around any book — create a club, invite members, and read together with shared progress and chapter chat.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <div className="theme-section rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <h3 className="font-semibold text-theme text-sm">Read Together</h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">Create a private club around any book and invite members with a single shareable link — done in under 60 seconds.</p>
              </div>
            </div>
            <div className="theme-section rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-theme text-sm">Chapter Chat</h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">Built-in group chat per chapter lets members discuss what they're reading in real time — no external app needed.</p>
              </div>
            </div>
            <div className="theme-section rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <Search className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-theme text-sm">Shared Progress</h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">Leaders see who has completed each chapter, who's ahead, and who needs a nudge — all from the club dashboard.</p>
              </div>
            </div>
          </div>

          {/* Sub-tabs: Mine | Discover */}
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
                <button onClick={() => openCreate('club')} className="theme-button-primary px-4 py-2 rounded-lg text-sm font-medium">
                  Create Your First Club
                </button>
              </div>
            ) : (
              <div className={clubView === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}>
                {myClubs.map(club => clubView === 'list'
                  ? <ClubRow key={club.id} club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                  : <ClubCard key={club.id} club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                )}
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
                <div className={clubView === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}>
                  {displayedPublic.map(club => {
                    const isMember = myClubIds.has(club.id);
                    const canRequest = club.allow_join_requests !== false;
                    const requested = requestedClubIds.has(club.id);
                    const joinBtn = isMember ? (
                      <button
                        onClick={() => navigate(`/clubs/${club.id}`)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs theme-button-primary rounded-lg flex-shrink-0"
                      >
                        <Check className="h-3.5 w-3.5" /> Member — Open
                      </button>
                    ) : (
                      <button
                        onClick={() => canRequest && !requested && setJoinRequestClub(club)}
                        disabled={requested || !canRequest}
                        title={!canRequest ? 'This club is not accepting join requests' : undefined}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs theme-button-secondary rounded-lg disabled:opacity-50 flex-shrink-0"
                      >
                        {requested
                          ? <><Check className="h-3.5 w-3.5 text-green-400" /> Request Sent</>
                          : !canRequest
                            ? <><Lock className="h-3.5 w-3.5" /> Requests Closed</>
                            : <><UserPlus className="h-3.5 w-3.5" /> Request to Join</>
                        }
                      </button>
                    );
                    return clubView === 'list' ? (
                      <div key={club.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <ClubRow club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                        </div>
                        {joinBtn}
                      </div>
                    ) : (
                      <div key={club.id} className="flex flex-col">
                        <ClubCard club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                        <div className="mt-1">{joinBtn}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Book Study Groups tab ──────────────────────────────────────── */}
      {mainTab === 'bookstudy' && (
        <>
          <h2 className="text-xl font-bold text-theme mb-1">Book Study Groups</h2>
          <p className="text-muted text-sm mb-6 max-w-2xl">Structured reading programs — work through a book together chapter by chapter with guided questions and group discussion.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <div className="theme-section rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <h3 className="font-semibold text-theme text-sm">Chapter-by-Chapter</h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">Progress through the book together at a shared pace. Each chapter unlocks on schedule so everyone stays in sync.</p>
              </div>
            </div>
            <div className="theme-section rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-theme text-sm">Group Discussion</h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">Built-in group chat lets your study group reflect, ask questions, and share insights as they read — no external app needed.</p>
              </div>
            </div>
            <div className="theme-section rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <Search className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-theme text-sm">Track Every Member</h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">See who's keeping up, who's ahead, and who needs encouragement — with per-chapter completion stats for every member.</p>
              </div>
            </div>
          </div>

          {/* Sub-tabs: Mine | Discover */}
          <div className="flex gap-1 mb-6 theme-section p-1 rounded-lg w-fit">
            <button
              onClick={() => setSgTab('mine')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${sgTab === 'mine' ? 'theme-button-primary' : 'text-muted hover:text-theme'}`}
            >
              My Groups {myStudyGroups.length > 0 && <span className="ml-1 opacity-60">({myStudyGroups.length})</span>}
            </button>
            <button
              onClick={() => setSgTab('discover')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${sgTab === 'discover' ? 'theme-button-primary' : 'text-muted hover:text-theme'}`}
            >
              Discover
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strong" />
            </div>
          ) : sgTab === 'mine' ? (
            myStudyGroups.length === 0 ? (
              <div className="text-center py-16 theme-section border-dashed rounded-xl">
                <BookOpen className="h-12 w-12 text-muted mx-auto mb-4" />
                <h3 className="font-semibold text-theme mb-2">No study groups yet</h3>
                <p className="text-muted text-sm mb-4">Start a study group or get invited to one to begin learning together.</p>
                <button onClick={() => openCreate('study_group')} className="theme-button-primary px-4 py-2 rounded-lg text-sm font-medium">
                  Start Your First Study Group
                </button>
              </div>
            ) : (
              <div className={clubView === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}>
                {myStudyGroups.map(club => clubView === 'list'
                  ? <ClubRow key={club.id} club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                  : <ClubCard key={club.id} club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                )}
              </div>
            )
          ) : (
            <div>
              <div className="flex gap-2 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    type="text"
                    value={sgSearch}
                    onChange={e => setSgSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSgSearch()}
                    placeholder="Search public study groups..."
                    className="w-full pl-9 pr-3 py-2 theme-input rounded-lg text-sm"
                  />
                </div>
                <button onClick={handleSgSearch} className="theme-button-secondary px-4 py-2 rounded-lg text-sm">
                  Search
                </button>
              </div>

              {displayedPublicSg.length === 0 ? (
                <div className="text-center py-16 text-muted">
                  <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No public study groups found.</p>
                </div>
              ) : (
                <div className={clubView === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}>
                  {displayedPublicSg.map(club => {
                    const isMember = mySgIds.has(club.id);
                    const canRequest = club.allow_join_requests !== false;
                    const requested = requestedClubIds.has(club.id);
                    const joinBtn = isMember ? (
                      <button
                        onClick={() => navigate(`/clubs/${club.id}`)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs theme-button-primary rounded-lg flex-shrink-0"
                      >
                        <Check className="h-3.5 w-3.5" /> Member — Open
                      </button>
                    ) : (
                      <button
                        onClick={() => canRequest && !requested && setJoinRequestClub(club)}
                        disabled={requested || !canRequest}
                        title={!canRequest ? 'This group is not accepting join requests' : undefined}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs theme-button-secondary rounded-lg disabled:opacity-50 flex-shrink-0"
                      >
                        {requested
                          ? <><Check className="h-3.5 w-3.5 text-green-400" /> Request Sent</>
                          : !canRequest
                            ? <><Lock className="h-3.5 w-3.5" /> Requests Closed</>
                            : <><UserPlus className="h-3.5 w-3.5" /> Request to Join</>
                        }
                      </button>
                    );
                    return clubView === 'list' ? (
                      <div key={club.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <ClubRow club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                        </div>
                        {joinBtn}
                      </div>
                    ) : (
                      <div key={club.id} className="flex flex-col">
                        <ClubCard club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                        <div className="mt-1">{joinBtn}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Online Classes tab ─────────────────────────────────────────── */}
      {mainTab === 'onlineclasses' && (
        <>
          <h2 className="text-xl font-bold text-theme mb-1">Online Classes</h2>
          <p className="text-muted text-sm mb-6 max-w-2xl">Host or join interactive online classes built around your books — combine live sessions, structured lessons, and group interaction in one place.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <div className="theme-section rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-theme text-sm">Structured Lessons</h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">Deliver your book content as a series of lessons with embedded questions, quizzes, and assignments — all inside BookFlow.</p>
              </div>
            </div>
            <div className="theme-section rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                <Video className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <h3 className="font-semibold text-theme text-sm">Live Sessions</h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">Schedule and host live class sessions. Participants follow along in the book while you present — everyone stays on the same page.</p>
              </div>
            </div>
            <div className="theme-section rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-teal-500" />
              </div>
              <div>
                <h3 className="font-semibold text-theme text-sm">Student Interaction</h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">Students submit answers, participate in polls, and chat with classmates — all tracked so you can see who's engaged and progressing.</p>
              </div>
            </div>
          </div>

          {/* Sub-tabs: Mine | Discover */}
          <div className="flex gap-1 mb-6 theme-section p-1 rounded-lg w-fit">
            <button
              onClick={() => setOcTab('mine')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${ocTab === 'mine' ? 'theme-button-primary' : 'text-muted hover:text-theme'}`}
            >
              My Classes {myClasses.length > 0 && <span className="ml-1 opacity-60">({myClasses.length})</span>}
            </button>
            <button
              onClick={() => setOcTab('discover')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${ocTab === 'discover' ? 'theme-button-primary' : 'text-muted hover:text-theme'}`}
            >
              Discover
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strong" />
            </div>
          ) : ocTab === 'mine' ? (
            myClasses.length === 0 ? (
              <div className="text-center py-16 theme-section border-dashed rounded-xl">
                <GraduationCap className="h-12 w-12 text-muted mx-auto mb-4" />
                <h3 className="font-semibold text-theme mb-2">No online classes yet</h3>
                <p className="text-muted text-sm mb-4">Create your first online class or ask a teacher for an invite link to join one.</p>
                <button onClick={() => openCreate('online_class')} className="theme-button-primary px-4 py-2 rounded-lg text-sm font-medium">
                  Create Your First Class
                </button>
              </div>
            ) : (
              <div className={clubView === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}>
                {myClasses.map(club => clubView === 'list'
                  ? <ClubRow key={club.id} club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                  : <ClubCard key={club.id} club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                )}
              </div>
            )
          ) : (
            <div>
              <div className="flex gap-2 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    type="text"
                    value={ocSearch}
                    onChange={e => setOcSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleOcSearch()}
                    placeholder="Search public online classes..."
                    className="w-full pl-9 pr-3 py-2 theme-input rounded-lg text-sm"
                  />
                </div>
                <button onClick={handleOcSearch} className="theme-button-secondary px-4 py-2 rounded-lg text-sm">
                  Search
                </button>
              </div>

              {publicClasses.length === 0 ? (
                <div className="text-center py-16 text-muted">
                  <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No public online classes found.</p>
                </div>
              ) : (
                <div className={clubView === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}>
                  {publicClasses.map(club => {
                    const isMember = myClassIds.has(club.id);
                    const requested = requestedClubIds.has(club.id);
                    const joinBtn = isMember ? (
                      <button
                        onClick={() => navigate(`/clubs/${club.id}`)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs theme-button-primary rounded-lg flex-shrink-0"
                      >
                        <Check className="h-3.5 w-3.5" /> Enrolled — Open
                      </button>
                    ) : (
                      <button
                        onClick={() => !requested && setJoinRequestClub(club)}
                        disabled={requested}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs theme-button-secondary rounded-lg disabled:opacity-50 flex-shrink-0"
                      >
                        {requested
                          ? <><Check className="h-3.5 w-3.5 text-green-400" /> Request Sent</>
                          : <><UserPlus className="h-3.5 w-3.5" /> Request to Enroll</>
                        }
                      </button>
                    );
                    return clubView === 'list' ? (
                      <div key={club.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0"><ClubRow club={club} onOpen={id => navigate(`/clubs/${id}`)} /></div>
                        {joinBtn}
                      </div>
                    ) : (
                      <div key={club.id} className="flex flex-col">
                        <ClubCard club={club} onOpen={id => navigate(`/clubs/${id}`)} />
                        <div className="mt-1">{joinBtn}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateClubModal clubType={createType} onClose={() => setShowCreate(false)} onCreate={handleCreated} />
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
