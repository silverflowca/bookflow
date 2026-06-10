import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, BookOpen, Loader2, MessageSquare,
  Trophy, Clock, CheckSquare, BarChart2,
} from 'lucide-react';
import api from '../lib/api';

// Each segment width ∝ chapter's share of total items; fill ∝ items completed in that chapter
function SegmentedBar({ breakdown }: { breakdown: { completed: number; total: number }[] }) {
  if (!breakdown.length) return null;
  const grandTotal = breakdown.reduce((s, b) => s + (b.total || 1), 0);
  return (
    <div className="flex gap-px w-full h-2.5 rounded-full overflow-hidden">
      {breakdown.map((seg, i) => {
        const widthPct = ((seg.total || 1) / grandTotal) * 100;
        const fillPct = seg.total > 0 ? Math.min(100, (seg.completed / seg.total) * 100) : 0;
        const done = seg.total > 0 && seg.completed >= seg.total;
        const started = fillPct > 0 && !done;
        return (
          <div key={i} style={{ width: `${widthPct}%` }} className="relative h-full bg-white/10 rounded-sm overflow-hidden flex-shrink-0">
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberStat {
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

interface Club {
  id: string;
  name: string;
  created_by: string;
  members?: { id: string; user_id: string; role: string; invite_accepted_at?: string }[];
  settings?: {
    show_member_reading_progress: boolean;
    show_member_answers: boolean;
  };
  books?: { id: string; book_id: string; is_current: boolean }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name, url, size = 'sm' }: { name: string; url?: string | null; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs';
  if (url) return <img src={url} alt={name} className={`${cls} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${cls} rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {(name?.[0] ?? '?').toUpperCase()}
    </div>
  );
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString();
}


function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-400 font-bold text-sm">🥇</span>;
  if (rank === 2) return <span className="text-slate-300 font-bold text-sm">🥈</span>;
  if (rank === 3) return <span className="text-orange-400 font-bold text-sm">🥉</span>;
  return <span className="text-xs text-muted font-medium w-5 text-center">{rank}</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClubReadPage() {
  const { clubId, bookId: bookIdParam } = useParams<{ clubId: string; bookId?: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [book, setBook] = useState<any | null>(null);
  const [stats, setStats] = useState<MemberStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  const currentUserId = (() => {
    try {
      const token = localStorage.getItem('bookflow_token');
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || '';
    } catch { return ''; }
  })();

  useEffect(() => {
    if (clubId) loadData();
  }, [clubId, bookIdParam]);

  async function loadData() {
    try {
      const clubData = await api.getClub(clubId!);
      setClub(clubData);

      const resolvedBookId = bookIdParam
        || clubData.books?.find((b: any) => b.is_current)?.book_id
        || clubData.books?.[0]?.book_id;

      if (resolvedBookId) {
        const bookData = await api.getBook(resolvedBookId).catch(() => null);
        setBook(bookData);
      }

      // Load bulk member stats
      setStatsLoading(true);
      const progressData = await api.getClubProgress(clubId!).catch((e: any) => {
        setStatsError(e?.message || 'Could not load progress');
        return { members: [], chapters: [] };
      });
      // Sort by chapters completed desc, then items completed desc
      const sorted = [...(progressData.members || [])].sort((a, b) =>
        b.chapters_completed - a.chapters_completed || b.items_completed - a.items_completed
      );
      setStats(sorted);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
      setStatsLoading(false);
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

  const acceptedMembers = (club.members ?? []).filter(m => m.invite_accepted_at);
  const totalChapters = stats[0]?.chapters_total ?? 0;
  const totalItems = stats[0]?.items_total ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link to={`/clubs/${clubId}`} className="flex items-center gap-1 text-sm text-muted hover:text-theme mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to {club.name}
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          {book?.cover_image_url ? (
            <img src={book.cover_image_url} alt={book.title} className="h-16 w-11 object-cover rounded-lg shadow" />
          ) : (
            <div className="h-16 w-11 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-6 w-6 text-indigo-400" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-theme">{book?.title ?? 'Club Reading'}</h1>
            <p className="text-muted text-sm">{club.name}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted flex items-center gap-1">
                <Users className="h-3 w-3" /> {acceptedMembers.length} members
              </span>
              {totalChapters > 0 && (
                <span className="text-xs text-muted flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> {totalChapters} chapters
                </span>
              )}
            </div>
          </div>
        </div>
        {book?.id && (
          <Link
            to={`/book/${book.id}`}
            className="sm:ml-auto flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium"
          >
            <BookOpen className="h-4 w-4" /> Read Book
          </Link>
        )}
      </div>

      {/* Summary stat tiles */}
      {stats.length > 0 && totalChapters > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="theme-section rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-theme">
              {stats.filter(s => s.chapters_completed === totalChapters).length}
            </p>
            <p className="text-xs text-muted mt-0.5">Finished</p>
          </div>
          <div className="theme-section rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-theme">
              {stats.filter(s => s.chapters_completed > 0 && s.chapters_completed < totalChapters).length}
            </p>
            <p className="text-xs text-muted mt-0.5">In Progress</p>
          </div>
          <div className="theme-section rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-theme">
              {stats.filter(s => s.chapters_completed === 0).length}
            </p>
            <p className="text-xs text-muted mt-0.5">Not Started</p>
          </div>
        </div>
      )}

      {/* Member progress table */}
      <div className="theme-section rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-theme">Member Progress</h2>
          {statsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted ml-auto" />}
        </div>

        {statsError ? (
          <div className="px-4 py-8 text-center text-sm text-muted">{statsError}</div>
        ) : statsLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : stats.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted">
            <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No progress data yet.</p>
            <p className="text-xs mt-1 opacity-60">Members need to start reading for data to appear.</p>
          </div>
        ) : (
          <>
            {/* Column labels */}
            <div className="hidden sm:grid sm:grid-cols-[2rem_1fr_2fr_5rem_5rem_5rem] gap-3 px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide border-b border-white/5">
              <div></div>
              <div>Member</div>
              <div className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> Progress</div>
              <div className="text-right flex items-center justify-end gap-1"><BookOpen className="h-3 w-3" /> Chapters</div>
              <div className="text-right flex items-center justify-end gap-1"><Trophy className="h-3 w-3" /> Items</div>
              <div className="text-right flex items-center justify-end gap-1"><Clock className="h-3 w-3" /> Last Active</div>
            </div>

            <div className="divide-y divide-white/5">
              {stats.map((s, i) => {
                const chapterPct = totalChapters > 0 ? (s.chapters_completed / totalChapters) * 100 : 0;
                const isMe = s.user_id === currentUserId;
                const finished = totalChapters > 0 && s.chapters_completed >= totalChapters;

                return (
                  <div
                    key={s.user_id}
                    className={`grid grid-cols-[2rem_1fr] sm:grid-cols-[2rem_1fr_2fr_5rem_5rem_5rem] gap-3 items-center px-4 py-3 ${isMe ? 'bg-indigo-500/5' : 'hover:bg-white/5'} transition-colors`}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center">
                      <RankBadge rank={i + 1} />
                    </div>

                    {/* Name + role */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={s.display_name} url={s.avatar_url} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-theme truncate">
                          {s.display_name}
                          {isMe && <span className="ml-1.5 text-xs text-indigo-400">(you)</span>}
                        </p>
                        <p className="text-xs text-muted capitalize">{s.role}</p>
                      </div>
                      {finished && <span className="ml-auto text-green-400 text-xs font-medium hidden sm:block">✓ Done</span>}
                    </div>

                    {/* Segmented progress bar — hidden on mobile */}
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-2">
                        <SegmentedBar breakdown={s.chapters_breakdown ?? []} />
                        <span className="text-xs text-muted whitespace-nowrap w-8 text-right">{Math.round(chapterPct)}%</span>
                      </div>
                    </div>

                    {/* Chapters — clickable to detail page */}
                    <div className="hidden sm:block text-right">
                      <Link
                        to={`/clubs/${clubId}/members/${s.user_id}/progress`}
                        className="hover:text-accent transition-colors"
                        title="View submissions"
                      >
                        <span className="text-sm font-medium text-theme">{s.chapters_completed}</span>
                        <span className="text-xs text-muted">/{totalChapters}</span>
                      </Link>
                    </div>

                    {/* Items */}
                    <div className="hidden sm:block text-right">
                      <span className="text-sm font-medium text-theme">{s.items_completed}</span>
                      {totalItems > 0 && <span className="text-xs text-muted">/{totalItems}</span>}
                    </div>

                    {/* Last active */}
                    <div className="hidden sm:block text-right">
                      <span className="text-xs text-muted">{timeAgo(s.last_active)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile: segmented bar + chapter count below each row */}
            <div className="sm:hidden divide-y divide-white/5">
              {stats.map((s) => (
                <div key={`mobile-bar-${s.user_id}`} className="px-4 pb-3 -mt-1">
                  <div className="flex items-center gap-2 pl-[calc(2rem+0.75rem)]">
                    <div className="flex-1">
                      <SegmentedBar breakdown={s.chapters_breakdown ?? []} />
                    </div>
                    <Link
                      to={`/clubs/${clubId}/members/${s.user_id}/progress`}
                      className="text-xs text-muted whitespace-nowrap hover:text-accent"
                    >
                      {s.chapters_completed}/{totalChapters}
                    </Link>
                    <span className="text-xs text-muted whitespace-nowrap">{timeAgo(s.last_active)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer links */}
      <div className="mt-4 flex gap-3 flex-wrap">
        <Link
          to={`/clubs/${clubId}?tab=discussions${book?.id ? `&book=${book.id}` : ''}`}
          className="flex items-center gap-2 text-sm text-muted hover:text-theme"
        >
          <MessageSquare className="h-4 w-4" /> Book Discussion
        </Link>
      </div>
    </div>
  );
}
