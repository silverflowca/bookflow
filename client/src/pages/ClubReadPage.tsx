import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, BookOpen, Loader2, ChevronDown, ChevronUp,
  MessageSquare, Eye, Volume2, Highlighter,
} from 'lucide-react';
import api from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  user_id: string;
  role: string;
  invite_accepted_at?: string;
  profile?: { id: string; display_name: string; avatar_url?: string };
}

interface ProgressEntry {
  book_id: string;
  chapter_id?: string;
  chapter_title?: string;
  progress_pct: number;
  last_read_at: string;
}

interface AnswerEntry {
  question_id: string;
  question_text?: string;
  answer_text?: string;
  chapter_title?: string;
  answered_at: string;
}

interface ClubSettings {
  show_member_reading_progress: boolean;
  show_member_answers: boolean;
  show_member_highlights: boolean;
  show_member_media: boolean;
}

interface Club {
  id: string;
  name: string;
  created_by: string;
  members?: Member[];
  settings?: ClubSettings;
  books?: { id: string; book_id: string; is_current: boolean; book?: { id: string; title: string; cover_image_url?: string } }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ profile, size = 'sm' }: { profile?: { display_name: string; avatar_url?: string }; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-12 w-12 text-base' : size === 'md' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs';
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={profile.display_name} className={`${cls} rounded-full object-cover`} />;
  }
  return (
    <div className={`${cls} rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold`}>
      {(profile?.display_name?.[0] ?? '?').toUpperCase()}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString();
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// ── Member Panel ──────────────────────────────────────────────────────────────

function MemberReadingCard({
  member,
  clubId,
  bookId,
  settings,
}: {
  member: Member;
  clubId: string;
  bookId: string;
  settings: ClubSettings;
}) {
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function handleExpand() {
    if (!member.user_id) return;
    setExpanded(e => !e);
    if (!loaded) {
      setLoading(true);
      try {
        const [prog, ans] = await Promise.all([
          settings.show_member_reading_progress
            ? api.getClubMemberProgress(clubId, member.user_id).catch(() => [])
            : Promise.resolve([]),
          settings.show_member_answers
            ? api.getClubMemberAnswers(clubId, member.user_id).catch(() => [])
            : Promise.resolve([]),
        ]);
        // Filter to this book
        setProgress((prog as ProgressEntry[]).filter(p => p.book_id === bookId));
        setAnswers(ans as AnswerEntry[]);
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    }
  }

  const latestProgress = progress.sort((a, b) => new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime())[0];

  return (
    <div className="theme-section rounded-xl overflow-hidden">
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
      >
        <Avatar profile={member.profile} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-theme">{member.profile?.display_name ?? 'Unknown'}</p>
          {settings.show_member_reading_progress && latestProgress ? (
            <div className="mt-1 flex items-center gap-2">
              <ProgressBar pct={latestProgress.progress_pct} />
              <span className="text-xs text-muted whitespace-nowrap">{Math.round(latestProgress.progress_pct)}%</span>
            </div>
          ) : (
            <p className="text-xs text-muted capitalize">{member.role}</p>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          )}

          {/* Reading Progress */}
          {!loading && settings.show_member_reading_progress && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Eye className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-theme uppercase tracking-wide">Reading Progress</span>
              </div>
              {progress.length === 0 ? (
                <p className="text-xs text-muted">No progress recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {progress.map((p, i) => (
                    <div key={i}>
                      {p.chapter_title && <p className="text-xs text-muted mb-0.5">{p.chapter_title}</p>}
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={p.progress_pct} />
                        <span className="text-xs text-muted whitespace-nowrap">{Math.round(p.progress_pct)}%</span>
                        <span className="text-xs text-muted">{timeAgo(p.last_read_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Q&A Answers */}
          {!loading && settings.show_member_answers && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs font-semibold text-theme uppercase tracking-wide">Answers</span>
              </div>
              {answers.length === 0 ? (
                <p className="text-xs text-muted">No answers shared yet.</p>
              ) : (
                <div className="space-y-3">
                  {answers.map((a, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      {a.chapter_title && <p className="text-xs text-muted mb-1">{a.chapter_title}</p>}
                      {a.question_text && <p className="text-xs font-medium text-theme mb-1">{a.question_text}</p>}
                      <p className="text-sm text-theme">{a.answer_text}</p>
                      <p className="text-xs text-muted mt-1">{timeAgo(a.answered_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Placeholder info for hidden features */}
          {!settings.show_member_reading_progress && !settings.show_member_answers && (
            <p className="text-xs text-muted italic">Member visibility is restricted by club settings.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClubReadPage() {
  const { clubId, bookId } = useParams<{ clubId: string; bookId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [book, setBook] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine current user
  const currentUserId = (() => {
    try {
      const token = localStorage.getItem('bookflow_token');
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || '';
    } catch { return ''; }
  })();

  useEffect(() => {
    if (clubId && bookId) loadData();
  }, [clubId, bookId]);

  async function loadData() {
    try {
      const [clubData, bookData] = await Promise.all([
        api.getClub(clubId!),
        api.getBook(bookId!).catch(() => null),
      ]);
      setClub(clubData);
      setBook(bookData);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
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

  const settings = club.settings ?? {
    show_member_reading_progress: true,
    show_member_answers: false,
    show_member_highlights: true,
    show_member_media: true,
  };

  const acceptedMembers = (club.members ?? []).filter(m => m.invite_accepted_at);
  const otherMembers = acceptedMembers.filter(m => m.user_id !== currentUserId);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link to={`/clubs/${clubId}`} className="flex items-center gap-1 text-sm text-muted hover:text-theme mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to {club.name}
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          {book?.cover_image_url ? (
            <img src={book.cover_image_url} alt={book.title} className="h-20 w-14 object-cover rounded-lg shadow" />
          ) : (
            <div className="h-20 w-14 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <BookOpen className="h-7 w-7 text-indigo-400" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-theme">{book?.title ?? 'Unknown Book'}</h1>
            <p className="text-muted text-sm">{club.name} · Reading Together</p>
            <p className="text-muted text-xs mt-1">{acceptedMembers.length} members</p>
          </div>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <Link
            to={`/books/${bookId}/read`}
            className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium"
          >
            <BookOpen className="h-4 w-4" /> Read Book
          </Link>
        </div>
      </div>

      {/* Visibility indicators */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { show: settings.show_member_reading_progress, label: 'Progress', icon: <Eye className="h-3.5 w-3.5" /> },
          { show: settings.show_member_answers, label: 'Answers', icon: <MessageSquare className="h-3.5 w-3.5" /> },
          { show: settings.show_member_highlights, label: 'Highlights', icon: <Highlighter className="h-3.5 w-3.5" /> },
          { show: settings.show_member_media, label: 'Media', icon: <Volume2 className="h-3.5 w-3.5" /> },
        ].map(({ show, label, icon }) => (
          <div
            key={label}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${show ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-white/5 text-muted border border-white/10'}`}
          >
            {icon}
            {label}
            {!show && <span className="opacity-60">hidden</span>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Member Cards */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            <Users className="h-4 w-4 inline mr-1" />
            Members ({otherMembers.length})
          </h2>
          {otherMembers.length === 0 ? (
            <div className="text-center py-10 theme-section rounded-xl text-muted">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No other members yet.</p>
            </div>
          ) : (
            otherMembers.map(member => (
              <MemberReadingCard
                key={member.id}
                member={member}
                clubId={clubId!}
                bookId={bookId!}
                settings={settings}
              />
            ))
          )}
        </div>

        {/* Sidebar: Club Discussions for this book */}
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            <MessageSquare className="h-4 w-4 inline mr-1" />
            Book Discussion
          </h2>
          <div className="theme-section rounded-xl p-4">
            <p className="text-sm text-muted mb-3">Discuss this book with the club.</p>
            <Link
              to={`/clubs/${clubId}?tab=discussions&book=${bookId}`}
              className="flex items-center gap-2 text-sm theme-button-primary px-3 py-2 rounded-lg w-full justify-center"
            >
              <MessageSquare className="h-4 w-4" />
              Go to Discussions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
