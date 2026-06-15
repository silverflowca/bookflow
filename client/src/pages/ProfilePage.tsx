import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  User, BookOpen, Users, BarChart2, MapPin, Globe,
  Lock, Eye, EyeOff, Edit2, Save, X, Check,
  BookMarked, CheckCircle2, Mail, AtSign
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

interface ProfileData {
  profile: {
    id: string;
    display_name: string;
    email?: string;
    avatar_url: string | null;
    bio: string | null;
    is_author: boolean;
    created_at: string;
    website_url: string | null;
    location: string | null;
    profile_public: boolean;
    show_reading_progress: boolean;
    show_clubs: boolean;
    show_books_authored: boolean;
  };
  authored_books: any[];
  currently_reading: any[];
  completed_books: any[];
  clubs: any[];
  stats: {
    total_read: number;
    total_started: number;
    avg_progress?: number;
    clubs_count: number;
    books_authored: number;
  } | null;
  is_own?: boolean;
  is_private?: boolean;
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Edit form state
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    website_url: '',
    location: '',
    is_author: false,
    profile_public: true,
    show_reading_progress: true,
    show_clubs: true,
    show_books_authored: true,
  });

  const isOwnProfile = !userId || userId === user?.id;

  useEffect(() => {
    loadProfile();
  }, [userId, user]);

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      let result: ProfileData;
      if (isOwnProfile) {
        result = await api.getMyProfile();
      } else {
        result = await api.getPublicProfile(userId!);
      }
      setData(result);
      if (isOwnProfile) {
        setForm({
          display_name: result.profile.display_name || '',
          bio: result.profile.bio || '',
          website_url: result.profile.website_url || '',
          location: result.profile.location || '',
          is_author: result.profile.is_author ?? false,
          profile_public: result.profile.profile_public ?? true,
          show_reading_progress: result.profile.show_reading_progress ?? true,
          show_clubs: result.profile.show_clubs ?? true,
          show_books_authored: result.profile.show_books_authored ?? true,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateMyProfile(form);
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, ...updated } } : prev);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-red-600">{error || 'Profile not found'}</div>
    );
  }

  if (data.is_private) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-surface border-2 border-theme rounded-xl p-8 text-center">
          <Lock className="h-12 w-12 text-muted mx-auto mb-4" />
          <h2 className="text-xl font-bold text-theme mb-2">{data.profile.display_name}</h2>
          <p className="text-muted">This profile is private.</p>
        </div>
      </div>
    );
  }

  const p = data.profile;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header card */}
      <div className="bg-surface border-2 border-theme rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Avatar */}
          <div className="h-20 w-20 rounded-full bg-surface-hover border-2 border-theme flex items-center justify-center flex-shrink-0 overflow-hidden">
            {p.avatar_url
              ? <img src={p.avatar_url} alt={p.display_name} className="h-full w-full object-cover" />
              : <User className="h-9 w-9 text-muted" />}
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                className="text-2xl font-bold text-theme bg-transparent border-b-2 border-accent outline-none w-full mb-2"
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Display name"
              />
            ) : (
              <h1 className="text-2xl font-bold text-theme mb-1">{p.display_name}</h1>
            )}

            {/* Username + email (own profile only) */}
            {isOwnProfile && !editing && (
              <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <AtSign className="h-3 w-3" />{p.display_name}
                </span>
                {p.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />{p.email}
                  </span>
                )}
              </div>
            )}

            {p.is_author && !editing && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-accent/10 text-accent px-2 py-0.5 rounded-full mb-2">
                <BookOpen className="h-3 w-3" /> Author
              </span>
            )}

            {editing ? (
              <textarea
                className="w-full text-sm text-muted bg-surface-hover border border-theme rounded-lg p-2 outline-none resize-none mt-1"
                rows={2}
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Bio"
              />
            ) : p.bio ? (
              <p className="text-sm text-muted mb-2">{p.bio}</p>
            ) : null}

            {/* Location / website */}
            {editing ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <input
                  className="flex-1 text-sm bg-surface-hover border border-theme rounded-lg px-3 py-1.5 outline-none text-theme"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Location"
                />
                <input
                  className="flex-1 text-sm bg-surface-hover border border-theme rounded-lg px-3 py-1.5 outline-none text-theme"
                  value={form.website_url}
                  onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                  placeholder="Website URL"
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted">
                {p.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>
                )}
                {p.website_url && (
                  <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline">
                    <Globe className="h-3 w-3" />{p.website_url.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Joined {new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Edit / Save buttons (own profile only) */}
          {isOwnProfile && (
            <div className="flex gap-2 flex-shrink-0">
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 theme-button-primary px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted hover:text-theme border-2 border-theme"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted hover:text-theme border-2 border-theme hover:bg-surface-hover transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit Profile
                </button>
              )}
              {saved && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      {data.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Books Read', value: data.stats.total_read, icon: CheckCircle2 },
            { label: 'In Progress', value: data.stats.total_started - data.stats.total_read, icon: BookMarked },
            { label: 'Clubs', value: data.stats.clubs_count, icon: Users },
            { label: 'Authored', value: data.stats.books_authored, icon: BookOpen },
          ].map(stat => (
            <div key={stat.label} className="bg-surface border-2 border-theme rounded-xl p-4 text-center">
              <stat.icon className="h-5 w-5 text-accent mx-auto mb-1" />
              <div className="text-2xl font-bold text-theme">{stat.value}</div>
              <div className="text-xs text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Currently reading */}
          {data.currently_reading.length > 0 && (
            <section className="bg-surface border-2 border-theme rounded-xl p-5">
              <h2 className="text-base font-semibold text-theme mb-4 flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-accent" /> Currently Reading
              </h2>
              <div className="space-y-3">
                {data.currently_reading.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className="h-12 w-9 rounded bg-surface-hover border border-theme overflow-hidden flex-shrink-0">
                      {r.book?.cover_image_url
                        ? <img src={r.book.cover_image_url} alt="" className="h-full w-full object-cover" />
                        : <BookOpen className="h-4 w-4 text-muted m-auto" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/book/${r.book?.id}`} className="text-sm font-medium text-theme hover:text-accent truncate block">
                        {r.book?.title || 'Untitled'}
                      </Link>
                      <p className="text-xs text-muted">{r.book?.author?.display_name || ''}</p>
                      <div className="mt-1 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${r.percent_complete}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-accent flex-shrink-0">{r.percent_complete}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Completed books */}
          {data.completed_books.length > 0 && (
            <section className="bg-surface border-2 border-theme rounded-xl p-5">
              <h2 className="text-base font-semibold text-theme mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent" /> Completed Books
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {data.completed_books.map((r: any) => (
                  <Link key={r.id} to={`/book/${r.book?.id}`} className="group">
                    <div className="aspect-[2/3] rounded-lg bg-surface-hover border-2 border-theme group-hover:border-accent transition-colors overflow-hidden mb-1">
                      {r.book?.cover_image_url
                        ? <img src={r.book.cover_image_url} alt="" className="h-full w-full object-cover" />
                        : <BookOpen className="h-6 w-6 text-muted m-auto mt-6" />}
                    </div>
                    <p className="text-xs text-theme truncate leading-tight">{r.book?.title}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Authored books */}
          {data.authored_books.length > 0 && (
            <section className="bg-surface border-2 border-theme rounded-xl p-5">
              <h2 className="text-base font-semibold text-theme mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-accent" /> Books by {p.display_name}
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {data.authored_books.map((book: any) => (
                  <Link key={book.id} to={`/book/${book.id}`} className="group">
                    <div className="aspect-[2/3] rounded-lg bg-surface-hover border-2 border-theme group-hover:border-accent transition-colors overflow-hidden mb-1">
                      {book.cover_image_url
                        ? <img src={book.cover_image_url} alt="" className="h-full w-full object-cover" />
                        : <BookOpen className="h-6 w-6 text-muted m-auto mt-6" />}
                    </div>
                    <p className="text-xs text-theme truncate leading-tight">{book.title}</p>
                    {isOwnProfile && (
                      <p className="text-[10px] text-muted capitalize">{book.status}</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Clubs */}
          {data.clubs.length > 0 && (
            <section className="bg-surface border-2 border-theme rounded-xl p-5">
              <h2 className="text-base font-semibold text-theme mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Book Clubs
              </h2>
              <div className="space-y-2">
                {data.clubs.map((club: any) => (
                  <Link key={club.id} to={`/clubs/${club.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors border border-theme">
                    <div className="h-10 w-10 rounded-lg bg-surface-hover border border-theme overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {club.cover_image_url
                        ? <img src={club.cover_image_url} alt="" className="h-full w-full object-cover" />
                        : <Users className="h-5 w-5 text-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme truncate">{club.name}</p>
                      <p className="text-xs text-muted capitalize">{club.role}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar — privacy settings (own profile only) */}
        {isOwnProfile && editing && (
          <div className="space-y-4">
            <div className="bg-surface border-2 border-theme rounded-xl p-5">
              <h3 className="text-sm font-semibold text-theme mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" /> Privacy Settings
              </h3>
              <div className="space-y-3">
                <PrivacyToggle
                  label="Public profile"
                  description="Anyone can view your profile"
                  value={form.profile_public}
                  onChange={v => setForm(f => ({ ...f, profile_public: v }))}
                />
                <PrivacyToggle
                  label="Show reading progress"
                  description="Show books you're reading"
                  value={form.show_reading_progress}
                  onChange={v => setForm(f => ({ ...f, show_reading_progress: v }))}
                />
                <PrivacyToggle
                  label="Show clubs"
                  description="Show clubs you belong to"
                  value={form.show_clubs}
                  onChange={v => setForm(f => ({ ...f, show_clubs: v }))}
                />
                <PrivacyToggle
                  label="Show authored books"
                  description="Show books you've written"
                  value={form.show_books_authored}
                  onChange={v => setForm(f => ({ ...f, show_books_authored: v }))}
                />
                <PrivacyToggle
                  label="Author account"
                  description="Mark yourself as an author"
                  value={form.is_author}
                  onChange={v => setForm(f => ({ ...f, is_author: v }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Sidebar — privacy summary (own profile, not editing) */}
        {isOwnProfile && !editing && (
          <div className="space-y-4">
            <div className="bg-surface border-2 border-theme rounded-xl p-5">
              <h3 className="text-sm font-semibold text-theme mb-3 flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" /> Privacy
              </h3>
              <ul className="space-y-2 text-xs text-muted">
                <li className="flex items-center gap-2">
                  {p.profile_public ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted" />}
                  Profile is {p.profile_public ? 'public' : 'private'}
                </li>
                <li className="flex items-center gap-2">
                  {p.show_reading_progress ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted" />}
                  Reading progress {p.show_reading_progress ? 'visible' : 'hidden'}
                </li>
                <li className="flex items-center gap-2">
                  {p.show_clubs ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted" />}
                  Clubs {p.show_clubs ? 'visible' : 'hidden'}
                </li>
                <li className="flex items-center gap-2">
                  {p.show_books_authored ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted" />}
                  Authored books {p.show_books_authored ? 'visible' : 'hidden'}
                </li>
              </ul>
              <button
                onClick={() => setEditing(true)}
                className="mt-3 w-full text-xs text-accent hover:underline text-left"
              >
                Edit privacy settings →
              </button>
            </div>

            <div className="bg-surface border-2 border-theme rounded-xl p-5">
              <h3 className="text-sm font-semibold text-theme mb-2 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-accent" /> Reading Stats
              </h3>
              {data.stats && (
                <ul className="space-y-1 text-xs text-muted">
                  <li className="flex justify-between"><span>Books completed</span><span className="font-medium text-theme">{data.stats.total_read}</span></li>
                  <li className="flex justify-between"><span>In progress</span><span className="font-medium text-theme">{data.stats.total_started}</span></li>
                  {data.stats.avg_progress !== undefined && (
                    <li className="flex justify-between"><span>Avg progress</span><span className="font-medium text-theme">{data.stats.avg_progress}%</span></li>
                  )}
                  <li className="flex justify-between"><span>Clubs joined</span><span className="font-medium text-theme">{data.stats.clubs_count}</span></li>
                  <li className="flex justify-between"><span>Books authored</span><span className="font-medium text-theme">{data.stats.books_authored}</span></li>
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrivacyToggle({
  label, description, value, onChange,
}: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors ${value ? 'bg-accent' : 'bg-white/20 border border-white/30'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full shadow transition-transform ${value ? 'bg-white translate-x-4' : 'bg-white/70 translate-x-0.5'}`} />
      </button>
      <div>
        <p className="text-sm font-medium text-theme leading-tight">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
    </div>
  );
}
