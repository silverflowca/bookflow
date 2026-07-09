import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  User, BookOpen, Users, BarChart2, MapPin, Globe,
  Check, BookMarked, CheckCircle2, Mail, AtSign, Camera, Loader2,
  GraduationCap, Bell, Lock, Eye, EyeOff,
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
    share_my_progress: boolean;
    notification_prefs?: Record<string, boolean>;
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
    study_groups_count?: number;
    books_authored: number;
  } | null;
  is_own?: boolean;
  is_private?: boolean;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

const NOTIF_TYPES = [
  { type: 'comment',               label: 'New comments',           desc: 'Someone comments on your book' },
  { type: 'comment_reply',         label: 'Comment replies',         desc: 'Someone replies to a comment' },
  { type: 'invite',                label: 'Collaboration invites',   desc: 'Invited to co-author a book' },
  { type: 'review_submitted',      label: 'Review submitted',        desc: 'A review is created on your book' },
  { type: 'review_approved',       label: 'Review approved',         desc: 'Your review was approved' },
  { type: 'review_rejected',       label: 'Review not approved',     desc: 'Your review was not approved' },
  { type: 'feedback_reply',        label: 'Feedback replies',        desc: 'An admin replied to your feedback' },
  { type: 'club_invite',           label: 'Club invites',            desc: 'Invited to join a book club' },
  { type: 'club_book_added',       label: 'New club book',           desc: 'A book is added to your club' },
  { type: 'club_discussion',       label: 'Club discussions',        desc: 'New discussion in your club' },
  { type: 'club_discussion_reply', label: 'Discussion replies',      desc: 'Someone replies to your discussion' },
  { type: 'chat_mention',          label: 'Chat mentions',           desc: 'You are @mentioned in chat' },
  { type: 'chat_message',          label: 'Club chat messages',      desc: 'New messages in club chat' },
] as const;

/** A toggle that uses inline style for color so CSS vars resolve correctly */
function Toggle({
  value, onChange, disabled, size = 'md',
}: {
  value: boolean; onChange: () => void; disabled?: boolean; size?: 'sm' | 'md';
}) {
  const ismd = size === 'md';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={onChange}
      className={`relative flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 cursor-pointer ${ismd ? 'h-6 w-11' : 'h-5 w-9'}`}
      style={{ backgroundColor: value ? 'var(--color-accent)' : '#d1d5db' }}
    >
      <span
        className="pointer-events-none inline-block rounded-full bg-white shadow transition-transform duration-200 ease-in-out"
        style={{
          width: ismd ? '1.25rem' : '1rem',
          height: ismd ? '1.25rem' : '1rem',
          transform: value
            ? `translateX(${ismd ? '1.375rem' : '1.125rem'})`
            : 'translateX(0.125rem)',
          display: 'block',
          marginTop: ismd ? '1px' : '2px',
        }}
      />
    </button>
  );
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Form fields (text inputs — debounced save)
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    website_url: '',
    location: '',
  });

  // Boolean toggles (instant save)
  const [toggles, setToggles] = useState({
    is_author: false,
    profile_public: true,
    show_reading_progress: true,
    show_clubs: true,
    show_books_authored: true,
    share_my_progress: true,
  });

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [savingNotif, setSavingNotif] = useState<string | null>(null);

  const isOwnProfile = !userId || userId === user?.id;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    loadProfile();
  }, [userId, user]);

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      const result: ProfileData = isOwnProfile
        ? await api.getMyProfile()
        : await api.getPublicProfile(userId!);
      setData(result);
      if (isOwnProfile) {
        setForm({
          display_name: result.profile.display_name || '',
          bio: result.profile.bio || '',
          website_url: result.profile.website_url || '',
          location: result.profile.location || '',
        });
        setToggles({
          is_author: result.profile.is_author ?? false,
          profile_public: result.profile.profile_public ?? true,
          show_reading_progress: result.profile.show_reading_progress ?? true,
          show_clubs: result.profile.show_clubs ?? true,
          show_books_authored: result.profile.show_books_authored ?? true,
          share_my_progress: result.profile.share_my_progress ?? true,
        });
        setNotifPrefs(result.profile.notification_prefs ?? {});
        isFirstLoad.current = true; // reset so text debounce doesn't fire on init
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  // Debounced save for text fields
  const saveForm = useCallback(async (values: typeof form) => {
    setSaveStatus('saving');
    try {
      await api.updateMyProfile(values);
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, ...values } } : prev);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, []);

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveForm(form), 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form, saveForm]);

  // Instant save for boolean toggles
  async function handleToggle(key: keyof typeof toggles) {
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    try {
      await api.updateMyProfile({ [key]: next[key] });
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, [key]: next[key] } } : prev);
    } catch {
      setToggles(toggles); // revert
    }
  }

  // Notification prefs
  const allNotifEnabled = NOTIF_TYPES.every(({ type }) => notifPrefs[type] !== false);

  async function saveNotifPrefs(updated: Record<string, boolean>) {
    const prev = notifPrefs;
    setNotifPrefs(updated);
    try {
      await api.updateMyProfile({ notification_prefs: updated });
    } catch {
      setNotifPrefs(prev);
    }
  }

  async function toggleNotif(type: string, enabled: boolean) {
    setSavingNotif(type);
    await saveNotifPrefs({ ...notifPrefs, [type]: enabled });
    setSavingNotif(null);
  }

  async function toggleAllNotif() {
    setSavingNotif('__all__');
    const updated: Record<string, boolean> = {};
    if (allNotifEnabled) {
      NOTIF_TYPES.forEach(({ type }) => { updated[type] = false; });
    }
    await saveNotifPrefs(updated);
    setSavingNotif(null);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const { avatar_url } = await api.uploadAvatar(file);
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, avatar_url } } : prev);
      window.dispatchEvent(new CustomEvent('bf-profile-updated', { detail: { avatar_url } }));
    } catch (err: any) {
      alert(err.message || 'Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
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
          <div className="relative flex-shrink-0">
            <div className="h-20 w-20 rounded-full bg-surface-hover border-2 border-theme flex items-center justify-center overflow-hidden">
              {avatarUploading
                ? <Loader2 className="h-7 w-7 text-accent animate-spin" />
                : p.avatar_url
                  ? <img src={p.avatar_url} alt={p.display_name} className="h-full w-full object-cover" />
                  : <User className="h-9 w-9 text-muted" />}
            </div>
            {isOwnProfile && !avatarUploading && (
              <label
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#7c3aed', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
                title="Change photo"
              >
                <Camera className="h-3.5 w-3.5" style={{ color: '#fff' }} />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {isOwnProfile ? (
              <input
                className="text-2xl font-bold text-theme bg-transparent border-b-2 border-transparent hover:border-theme focus:border-accent outline-none w-full mb-2 transition-colors"
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Display name"
              />
            ) : (
              <h1 className="text-2xl font-bold text-theme mb-1">{p.display_name}</h1>
            )}

            {/* Username + email row */}
            {isOwnProfile && (
              <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-muted">
                <span className="flex items-center gap-1"><AtSign className="h-3 w-3" />{p.display_name}</span>
                {p.email && (
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>
                )}
              </div>
            )}

            {p.is_author && !isOwnProfile && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-accent/10 text-accent px-2 py-0.5 rounded-full mb-2">
                <BookOpen className="h-3 w-3" /> Author
              </span>
            )}

            {isOwnProfile ? (
              <textarea
                className="w-full text-sm text-theme bg-transparent border-b-2 border-transparent hover:border-theme focus:border-accent outline-none resize-none mt-1 transition-colors"
                rows={2}
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Write a short bio…"
              />
            ) : p.bio ? (
              <p className="text-sm text-muted mb-2">{p.bio}</p>
            ) : null}

            {isOwnProfile ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <input
                  className="flex-1 text-sm text-theme bg-transparent border-b border-transparent hover:border-theme focus:border-accent outline-none transition-colors placeholder:text-muted"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Location"
                />
                <input
                  className="flex-1 text-sm text-theme bg-transparent border-b border-transparent hover:border-theme focus:border-accent outline-none transition-colors placeholder:text-muted"
                  value={form.website_url}
                  onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                  placeholder="Website URL"
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted">
                {p.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>}
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

          {/* Auto-save status */}
          {isOwnProfile && (
            <div className="flex-shrink-0 flex items-center gap-1.5 text-xs min-w-[70px] justify-end">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      {data.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Books Read',    value: data.stats.total_read,                              icon: CheckCircle2 },
            { label: 'In Progress',   value: data.stats.total_started - data.stats.total_read,   icon: BookMarked },
            { label: 'Clubs',         value: data.stats.clubs_count,                             icon: Users },
            { label: 'Study Groups',  value: data.stats.study_groups_count ?? 0,                 icon: GraduationCap },
            { label: 'Authored',      value: data.stats.books_authored,                          icon: BookOpen },
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
                      <p className="text-xs text-muted">
                        {r.book?.author?.display_name || ''}
                        {r.started_at && <> · Started {fmtDate(r.started_at)}</>}
                        {r.last_read_at && <> · Last read {fmtDate(r.last_read_at)}</>}
                      </p>
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
                    {r.completed_at && <p className="text-[10px] text-muted mt-0.5">{fmtDate(r.completed_at)}</p>}
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
                    {isOwnProfile && <p className="text-[10px] text-muted capitalize">{book.status}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Clubs */}
          {data.clubs.length > 0 && (
            <section className="bg-surface border-2 border-theme rounded-xl p-5">
              <h2 className="text-base font-semibold text-theme mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Book Clubs & Study Groups
              </h2>
              <div className="space-y-2">
                {data.clubs.map((club: any) => (
                  <div key={club.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors border border-theme">
                    <div className="h-10 w-10 rounded-lg bg-surface-hover border border-theme overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {club.cover_image_url
                        ? <img src={club.cover_image_url} alt="" className="h-full w-full object-cover" />
                        : <Users className="h-5 w-5 text-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/clubs/${club.id}`} className="block text-sm font-medium text-theme truncate hover:text-accent transition-colors">
                        {club.name}
                      </Link>
                      <p className="text-xs text-muted capitalize">{club.role}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link to={`/clubs/${club.id}?tab=books`} className="inline-flex items-center gap-1.5 rounded-md border border-theme px-2.5 py-1 text-xs font-medium text-theme hover:bg-surface-hover transition-colors">
                          <BookOpen className="h-3.5 w-3.5 text-accent" /> Books
                        </Link>
                        <Link to={`/clubs/${club.id}?tab=members`} className="inline-flex items-center gap-1.5 rounded-md border border-theme px-2.5 py-1 text-xs font-medium text-theme hover:bg-surface-hover transition-colors">
                          <Users className="h-3.5 w-3.5 text-accent" /> Members
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar — own profile only */}
        {isOwnProfile && (
          <div className="space-y-4">
            {/* Reading Stats — top of sidebar */}
            <div className="bg-surface border-2 border-theme rounded-xl p-5">
              <h3 className="text-sm font-semibold text-theme mb-3 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-accent" /> Reading Stats
              </h3>
              {data.stats && (
                <ul className="space-y-1.5 text-xs text-muted">
                  <li className="flex justify-between"><span>Books completed</span><span className="font-medium text-theme">{data.stats.total_read}</span></li>
                  <li className="flex justify-between"><span>In progress</span><span className="font-medium text-theme">{data.stats.total_started}</span></li>
                  {data.stats.avg_progress !== undefined && (
                    <li className="flex justify-between"><span>Avg progress</span><span className="font-medium text-theme">{data.stats.avg_progress}%</span></li>
                  )}
                  <li className="flex justify-between"><span>Clubs joined</span><span className="font-medium text-theme">{data.stats.clubs_count}</span></li>
                  <li className="flex justify-between"><span>Study groups</span><span className="font-medium text-theme">{data.stats.study_groups_count ?? 0}</span></li>
                  <li className="flex justify-between"><span>Books authored</span><span className="font-medium text-theme">{data.stats.books_authored}</span></li>
                </ul>
              )}
            </div>

            {/* Privacy Settings */}
            <div className="bg-surface border-2 border-theme rounded-xl p-5">
              <h3 className="text-sm font-semibold text-theme mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" /> Privacy Settings
              </h3>
              <div className="space-y-3">
                {([
                  { key: 'profile_public',        label: 'Public profile',              desc: 'Anyone can view your profile' },
                  { key: 'show_reading_progress', label: 'Show reading progress',        desc: 'Show books you\'re reading' },
                  { key: 'show_clubs',            label: 'Show clubs',                  desc: 'Show clubs you belong to' },
                  { key: 'show_books_authored',   label: 'Show authored books',          desc: 'Show books you\'ve written' },
                  { key: 'share_my_progress',     label: 'Share progress in book chats', desc: 'Chapter completions posted as chat status updates' },
                  { key: 'is_author',             label: 'Author account',              desc: 'Mark yourself as an author' },
                ] as const).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-start gap-3">
                    <Toggle value={toggles[key]} onChange={() => handleToggle(key)} size="sm" />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleToggle(key)}>
                      <p className="text-sm font-medium text-theme leading-tight">{label}</p>
                      <p className="text-xs text-muted">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy summary pills */}
            <div className="bg-surface border-2 border-theme rounded-xl p-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Visibility</p>
              <ul className="space-y-1.5 text-xs text-muted">
                <li className="flex items-center gap-2">
                  {toggles.profile_public ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted" />}
                  Profile is {toggles.profile_public ? 'public' : 'private'}
                </li>
                <li className="flex items-center gap-2">
                  {toggles.show_reading_progress ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted" />}
                  Reading progress {toggles.show_reading_progress ? 'visible' : 'hidden'}
                </li>
                <li className="flex items-center gap-2">
                  {toggles.show_clubs ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted" />}
                  Clubs {toggles.show_clubs ? 'visible' : 'hidden'}
                </li>
                <li className="flex items-center gap-2">
                  {toggles.show_books_authored ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted" />}
                  Authored books {toggles.show_books_authored ? 'visible' : 'hidden'}
                </li>
              </ul>
            </div>

            {/* Email Notifications */}
            <div className="bg-surface border-2 border-theme rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-theme flex items-center gap-2">
                  <Bell className="h-4 w-4 text-accent" /> Email Notifications
                </h3>
                <Toggle
                  value={allNotifEnabled}
                  onChange={toggleAllNotif}
                  disabled={savingNotif === '__all__'}
                  size="md"
                />
              </div>
              <div className="space-y-2.5">
                {NOTIF_TYPES.map(({ type, label, desc }) => {
                  const on = notifPrefs[type] !== false;
                  return (
                    <div key={type} className="flex items-start gap-3">
                      <Toggle
                        value={on}
                        onChange={() => toggleNotif(type, !on)}
                        disabled={savingNotif === type || savingNotif === '__all__'}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleNotif(type, !on)}>
                        <p className="text-xs font-medium text-theme leading-tight">{label}</p>
                        <p className="text-[11px] text-muted leading-tight mt-0.5">{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted mt-3">In-app notifications always appear regardless of these settings.</p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
