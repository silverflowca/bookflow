import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Users, BookOpen, Users2, Crown, X, Loader2, AlertCircle, Clapperboard, Settings, MessageSquarePlus, ArchiveRestore, Archive, ImagePlus, Bell } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Profile, SystemRole } from '../types';
import {
  CAROUSEL_SETTINGS_KEY,
  CAROUSEL_DEFAULTS,
  loadCarouselSettings,
  type CarouselSettings,
} from './Home';
import SettingsPage from './Settings';
import FeedbackAdminTab from '../components/feedback/FeedbackAdminTab';
import NotificationsAdminTab from '../components/admin/NotificationsAdminTab';

interface AdminStats {
  users: number;
  books: number;
  clubs: number;
  super_admins: number;
}

type Tab = 'users' | 'books' | 'clubs' | 'carousel' | 'settings' | 'feedback' | 'notifications';

function BookCover({ book, onUpdate }: { book: any; onUpdate: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useState<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { cover_image_url } = await api.uploadBookCover(book.id, file);
      onUpdate(cover_image_url);
    } catch (err) {
      console.error('Cover upload failed:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <label className="relative group cursor-pointer shrink-0" title="Change cover">
      <input type="file" accept="image/*" className="sr-only" onChange={handleFile} ref={el => { inputRef[0] = el; }} />
      <div className="w-10 h-14 rounded overflow-hidden bg-surface-hover border border-theme flex items-center justify-center">
        {book.cover_image_url
          ? <img src={book.cover_image_url} alt="" className="w-full h-full object-cover" />
          : <BookOpen className="h-4 w-4 text-muted" />
        }
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
            <Loader2 className="h-3 w-3 animate-spin text-white" />
          </div>
        )}
        {!uploading && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
            <ImagePlus className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>
    </label>
  );
}

function BooksAdminTab({ books, onBooksChange }: { books: any[]; onBooksChange: (b: any[]) => void }) {
  const [actioning, setActioning] = useState<string | null>(null);

  const active = books.filter(b => b.status !== 'archived');
  const archived = books.filter(b => b.status === 'archived');

  async function handleArchive(bookId: string) {
    if (!confirm('Archive this book? It will be hidden from readers but can be reinstated here.')) return;
    setActioning(bookId);
    try {
      await api.adminArchiveBook(bookId);
      onBooksChange(books.map(b => b.id === bookId ? { ...b, status: 'archived' } : b));
    } catch (err) {
      console.error('Archive failed:', err);
    } finally {
      setActioning(null);
    }
  }

  async function handleReinstate(bookId: string) {
    setActioning(bookId);
    try {
      await api.adminReinstateBook(bookId);
      onBooksChange(books.map(b => b.id === bookId ? { ...b, status: 'draft' } : b));
    } catch (err) {
      console.error('Reinstate failed:', err);
    } finally {
      setActioning(null);
    }
  }

  function updateCover(bookId: string, url: string) {
    onBooksChange(books.map(b => b.id === bookId ? { ...b, cover_image_url: url } : b));
  }

  return (
    <div className="space-y-4">
      {/* Active books */}
      <div className="space-y-2">
        {active.length === 0 && <p className="text-muted text-sm py-4 text-center">No active books.</p>}
        {active.map(book => (
          <div key={book.id} className="theme-section rounded-xl px-4 py-3 flex items-center gap-3">
            <BookCover book={book} onUpdate={url => updateCover(book.id, url)} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-theme text-sm truncate">{book.title}</p>
              <p className="text-xs text-muted">
                by {book.author?.display_name ?? '—'} · {book.status} · {book.visibility}
                {book.created_at && <> · Created {new Date(book.created_at).toLocaleDateString()}</>}
                {book.published_at && <> · Published {new Date(book.published_at).toLocaleDateString()}</>}
              </p>
            </div>
            <a href={`/edit/book/${book.id}`} className="text-xs text-blue-500 hover:underline shrink-0">Open</a>
            <button
              onClick={() => handleArchive(book.id)}
              disabled={actioning === book.id}
              title="Archive book"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg theme-button-secondary hover:text-amber-600 disabled:opacity-50 shrink-0"
            >
              {actioning === book.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Archive className="h-3.5 w-3.5" />}
              Archive
            </button>
          </div>
        ))}
      </div>

      {/* Archived books */}
      {archived.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-2">
            <ArchiveRestore className="h-4 w-4" />
            Archived ({archived.length})
          </h3>
          <div className="space-y-2">
            {archived.map(book => (
              <div key={book.id} className="theme-section rounded-xl px-4 py-3 flex items-center gap-3 opacity-70">
                <BookCover book={book} onUpdate={url => updateCover(book.id, url)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-theme text-sm truncate">{book.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium shrink-0">archived</span>
                  </div>
                  <p className="text-xs text-muted">
                    by {book.author?.display_name ?? '—'} · {book.visibility}
                    {book.created_at && <> · Created {new Date(book.created_at).toLocaleDateString()}</>}
                  </p>
                </div>
                <button
                  onClick={() => handleReinstate(book.id)}
                  disabled={actioning === book.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg theme-button-secondary hover:text-green-600 disabled:opacity-50"
                >
                  {actioning === book.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <ArchiveRestore className="h-3.5 w-3.5" />}
                  Reinstate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>(() => {
    const requested = searchParams.get('tab');
    return (requested && ['users', 'books', 'clubs', 'carousel', 'settings', 'feedback', 'notifications'].includes(requested))
      ? requested as Tab
      : 'settings';
  });
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleActionId, setRoleActionId] = useState<string | null>(null);
  const [carousel, setCarousel] = useState<CarouselSettings>(loadCarouselSettings);
  const [carouselSaved, setCarouselSaved] = useState(false);

  // Guard — non super-admins bounced to dashboard
  useEffect(() => {
    if (profile && profile.system_role !== 'super_admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [profile, navigate]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const requested = searchParams.get('tab');
    if (requested && ['users', 'books', 'clubs', 'carousel', 'settings', 'feedback', 'notifications'].includes(requested) && requested !== tab) {
      loadTab(requested as Tab);
    }
  }, [searchParams]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [s, u] = await Promise.all([api.adminGetStats(), api.adminGetUsers()]);
      setStats(s);
      setUsers(u);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTab(t: Tab) {
    setTab(t);
    const next = new URLSearchParams(searchParams);
    next.set('tab', t);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    if (t === 'books' && books.length === 0) {
      try {
        setBooks(await api.adminGetBooks());
      } catch (err: any) {
        setError(err.message);
      }
    }
    if (t === 'clubs' && clubs.length === 0) {
      try {
        setClubs(await api.adminGetClubs());
      } catch (err: any) {
        setError(err.message);
      }
    }
  }

  async function toggleSuperAdmin(user: Profile) {
    const newRole: SystemRole = user.system_role === 'super_admin' ? null : 'super_admin';
    setRoleActionId(user.id);
    try {
      const updated = await api.adminSetUserRole(user.id, newRole);
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, system_role: updated.system_role } : u));
      const s = await api.adminGetStats();
      setStats(s);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRoleActionId(null);
    }
  }

  if (!profile || profile.system_role !== 'super_admin') return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/40">
          <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-theme">System Administration</h1>
          <p className="text-sm text-muted">Super admin — full system access</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-500' },
            { label: 'Total Books', value: stats.books, icon: BookOpen, color: 'text-green-500' },
            { label: 'Total Clubs', value: stats.clubs, icon: Users2, color: 'text-orange-500' },
            { label: 'Super Admins', value: stats.super_admins, icon: Crown, color: 'text-purple-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="theme-section rounded-xl p-4 flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color} shrink-0`} />
              <div>
                <p className="text-2xl font-bold text-theme">{value.toLocaleString()}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-surface-hover overflow-x-auto">
        {(['settings', 'users', 'books', 'clubs', 'carousel', 'feedback', 'notifications'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => loadTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === t
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-muted hover:text-theme'
            }`}
          >
            {t === 'carousel' && <Clapperboard className="h-3.5 w-3.5" />}
            {t === 'settings' && <Settings className="h-3.5 w-3.5" />}
            {t === 'feedback' && <MessageSquarePlus className="h-3.5 w-3.5" />}
            {t === 'notifications' && <Bell className="h-3.5 w-3.5" />}
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        <>
          {/* ── Users tab ─────────────────────────────────────────────────────── */}
          {tab === 'users' && (
            <div className="space-y-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className="theme-section rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  {/* Avatar */}
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    : (
                      <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-purple-600 dark:text-purple-300">
                          {user.display_name?.[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                    )
                  }

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-theme text-sm truncate">{user.display_name}</span>
                      {user.system_role === 'super_admin' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                          <Crown className="h-2.5 w-2.5" /> Super Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted truncate">
                      {user.email}
                      {user.created_at && <> · Joined {new Date(user.created_at).toLocaleDateString()}</>}
                    </p>
                  </div>

                  {/* Role toggle */}
                  {user.id !== profile.id ? (
                    <button
                      onClick={() => toggleSuperAdmin(user)}
                      disabled={roleActionId === user.id}
                      title={user.system_role === 'super_admin' ? 'Remove super admin' : 'Grant super admin'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        user.system_role === 'super_admin'
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-300'
                          : 'bg-surface-hover text-muted hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:text-purple-600 dark:hover:text-purple-300'
                      }`}
                    >
                      {roleActionId === user.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : user.system_role === 'super_admin'
                          ? <><Crown className="h-3.5 w-3.5" /> Remove</>
                          : <><Crown className="h-3.5 w-3.5" /> Grant Admin</>
                      }
                    </button>
                  ) : (
                    <span className="text-xs text-muted px-3 py-1.5">(you)</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Books tab ─────────────────────────────────────────────────────── */}
          {tab === 'books' && (
            <BooksAdminTab books={books} onBooksChange={setBooks} />
          )}

          {/* ── Clubs tab ─────────────────────────────────────────────────────── */}
          {tab === 'clubs' && (
            <div className="space-y-2">
              {clubs.length === 0 && <p className="text-muted text-sm py-8 text-center">No clubs found.</p>}
              {clubs.map(club => (
                <div key={club.id} className="theme-section rounded-xl px-4 py-3 flex items-center gap-3">
                  <Users2 className="h-5 w-5 text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-theme text-sm truncate">{club.name}</p>
                    <p className="text-xs text-muted">
                      by {club.creator?.display_name ?? '—'} · {club.visibility}
                      {club.created_at && <> · Created {new Date(club.created_at).toLocaleDateString()}</>}
                    </p>
                  </div>
                  <a
                    href={`/clubs/${club.id}`}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Open
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* ── Carousel tab ──────────────────────────────────────────────────── */}
          {/* ── Settings tab ──────────────────────────────────────────────────── */}
          {tab === 'settings' && (
            <div className="-mx-4">
              <SettingsPage />
            </div>
          )}

          {tab === 'carousel' && (
            <div className="max-w-lg space-y-8">
              <p className="text-sm text-muted">
                Configure the spinning book carousel displayed in the home page hero section.
                Changes take effect the next time the home page loads.
              </p>

              {/* Speed */}
              <div className="theme-section rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-theme text-sm">Rotation speed</label>
                  <span className="text-sm font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                    {carousel.secondsPerRev}s / revolution
                  </span>
                </div>
                <input
                  type="range"
                  min={4} max={30} step={1}
                  value={carousel.secondsPerRev}
                  onChange={e => setCarousel(prev => ({ ...prev, secondsPerRev: Number(e.target.value) }))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-xs text-muted">
                  <span>Fast (4 s)</span>
                  <span>Slow (30 s)</span>
                </div>
              </div>

              {/* Book count */}
              <div className="theme-section rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-theme text-sm">Max books shown</label>
                  <span className="text-sm font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                    {carousel.maxBooks} books
                  </span>
                </div>
                <input
                  type="range"
                  min={4} max={20} step={1}
                  value={carousel.maxBooks}
                  onChange={e => setCarousel(prev => ({ ...prev, maxBooks: Number(e.target.value) }))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-xs text-muted">
                  <span>4 books</span>
                  <span>20 books</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    localStorage.setItem(CAROUSEL_SETTINGS_KEY, JSON.stringify(carousel));
                    setCarouselSaved(true);
                    setTimeout(() => setCarouselSaved(false), 2500);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save settings
                </button>
                <button
                  onClick={() => {
                    setCarousel(CAROUSEL_DEFAULTS);
                    localStorage.removeItem(CAROUSEL_SETTINGS_KEY);
                    setCarouselSaved(true);
                    setTimeout(() => setCarouselSaved(false), 2500);
                  }}
                  className="px-4 py-2 bg-surface-hover hover:bg-surface text-muted text-sm font-medium rounded-lg transition-colors border border-theme"
                >
                  Reset to defaults
                </button>
                {carouselSaved && (
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Saved</span>
                )}
              </div>
            </div>
          )}

          {/* ── Feedback tab ───────────────────────────────────────────────────── */}
          {tab === 'feedback' && (
            <FeedbackAdminTab />
          )}

          {/* ── Notifications tab ─────────────────────────────────────────────── */}
          {tab === 'notifications' && (
            <NotificationsAdminTab />
          )}
        </>
      )}
    </div>
  );
}
