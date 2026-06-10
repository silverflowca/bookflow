import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, CheckCircle2, Circle, Clock,
  MessageSquare, Volume2, Video, ChevronDown, ChevronRight,
} from 'lucide-react';
import api from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubmissionItem {
  item_key: string;
  item_type: string;
  content_type: string;
  prompt: string | null;
  response: any;
  completed_at: string;
}

interface ChapterData {
  chapter_id: string;
  chapter_title: string;
  order_index: number;
  completed: number;
  total: number;
  items: SubmissionItem[];
}

interface MemberData {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString();
}

// Each segment width ∝ chapter's share of total items; fill ∝ items completed in that chapter
function SegmentedBar({ breakdown }: { breakdown: { completed: number; total: number }[] }) {
  if (!breakdown.length) return null;
  const grandTotal = breakdown.reduce((s, b) => s + (b.total || 1), 0);
  return (
    <div className="flex gap-px w-full h-3 rounded-full overflow-hidden">
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

function ResponseValue({ item, canSee }: { item: SubmissionItem; canSee: boolean }) {
  const isMedia = item.item_type === 'audio' || item.item_type === 'video';

  if (isMedia) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {item.item_type === 'audio'
          ? <Volume2 className="h-3.5 w-3.5" />
          : <Video className="h-3.5 w-3.5" />}
        {item.item_type === 'audio' ? 'Listened' : 'Watched'} · {timeAgo(item.completed_at)}
      </span>
    );
  }

  if (!canSee) {
    return <span className="text-xs text-muted italic">Completed · {timeAgo(item.completed_at)}</span>;
  }

  const r = item.response;

  if (item.content_type === 'question') {
    if (!r) return <span className="text-xs text-muted italic">No response recorded</span>;
    return (
      <div className="text-sm text-theme">
        {r.answer_text && <p>{r.answer_text}</p>}
        {r.selected_options?.length > 0 && (
          <p className="text-xs text-muted mt-0.5">{(r.selected_options as string[]).join(', ')}</p>
        )}
        {r.is_correct !== null && r.is_correct !== undefined && (
          <span className={`text-xs font-medium ${r.is_correct ? 'text-green-600' : 'text-red-500'}`}>
            {r.is_correct ? '✓ Correct' : '✗ Incorrect'}
          </span>
        )}
      </div>
    );
  }

  if (item.content_type === 'poll') {
    if (!r?.selected_option) return <span className="text-xs text-muted italic">No vote recorded</span>;
    return <span className="text-sm text-theme">{r.selected_option}</span>;
  }

  // Generic form response
  if (!r) return <span className="text-xs text-muted italic">No response recorded</span>;
  if (typeof r === 'string') return <p className="text-sm text-theme">{r}</p>;
  if (typeof r === 'object') {
    const val = r.value ?? r.text ?? r.selected ?? r.answer;
    if (val !== undefined) {
      if (Array.isArray(val)) return <span className="text-sm text-theme">{val.join(', ')}</span>;
      return <span className="text-sm text-theme">{String(val)}</span>;
    }
    return <pre className="text-xs text-muted">{JSON.stringify(r, null, 2)}</pre>;
  }
  return <span className="text-sm text-theme">{String(r)}</span>;
}

function ItemIcon({ contentType }: { contentType: string }) {
  if (contentType === 'audio') return <Volume2 className="h-3.5 w-3.5 text-muted flex-shrink-0" />;
  if (contentType === 'video') return <Video className="h-3.5 w-3.5 text-muted flex-shrink-0" />;
  if (contentType === 'poll') return <span className="text-xs">📊</span>;
  if (contentType === 'question') return <MessageSquare className="h-3.5 w-3.5 text-muted flex-shrink-0" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-muted flex-shrink-0" />;
}

// ── Chapter Card ──────────────────────────────────────────────────────────────

function ChapterCard({ chapter, canSeeResponses, isLast }: { chapter: ChapterData; canSeeResponses: boolean; isLast: boolean }) {
  const [open, setOpen] = useState(chapter.completed > 0);

  const done = chapter.total > 0 && chapter.completed >= chapter.total;
  const started = chapter.completed > 0 && !done;
  const notStarted = chapter.completed === 0;

  const statusChip = done
    ? <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> Complete</span>
    : started
    ? <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full"><Clock className="h-3 w-3" /> {chapter.completed}/{chapter.total} items</span>
    : <span className="flex items-center gap-1 text-xs font-medium text-muted bg-surface-hover px-2 py-0.5 rounded-full"><Circle className="h-3 w-3" /> Not started</span>;

  return (
    <div className={`border-l-2 pl-4 ${done ? 'border-green-500' : started ? 'border-amber-400' : 'border-surface-hover'} ${!isLast ? 'pb-5' : ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium text-theme truncate">{chapter.chapter_title}</span>
          {statusChip}
        </div>
        {!notStarted && (
          open
            ? <ChevronDown className="h-4 w-4 text-muted flex-shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted flex-shrink-0" />
        )}
      </button>

      {open && chapter.items.length > 0 && (
        <div className="mt-3 space-y-3">
          {chapter.items.map((item, idx) => (
            <div key={item.item_key + idx} className="flex gap-3 text-sm">
              <div className="mt-0.5">
                <ItemIcon contentType={item.content_type} />
              </div>
              <div className="flex-1 min-w-0">
                {item.prompt && (
                  <p className="text-xs text-muted mb-1 leading-snug">{item.prompt}</p>
                )}
                <ResponseValue item={item} canSee={canSeeResponses} />
              </div>
            </div>
          ))}
        </div>
      )}

      {open && chapter.items.length === 0 && chapter.completed > 0 && (
        <p className="text-xs text-muted mt-2 italic">Items completed but no details available.</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClubMemberProgressPage() {
  const { clubId, memberId } = useParams<{ clubId: string; memberId: string }>();
  const [data, setData] = useState<{ member: MemberData; chapters: ChapterData[]; can_see_responses: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (clubId && memberId) load();
  }, [clubId, memberId]);

  async function load() {
    setLoading(true);
    try {
      const result = await api.getClubMemberSubmissions(clubId!, memberId!);
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Could not load progress');
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

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-muted mb-4">{error || 'Not found'}</p>
        <Link to={`/clubs/${clubId}`} className="text-accent text-sm hover:underline">← Back to club</Link>
      </div>
    );
  }

  const { member, chapters, can_see_responses } = data;

  // Build overview bar breakdown from chapter data
  const barBreakdown = chapters.map(ch => ({ completed: ch.completed, total: ch.total }));
  const totalCompleted = chapters.filter(c => c.total > 0 && c.completed >= c.total).length;
  const totalItems = chapters.reduce((s, c) => s + c.completed, 0);
  const grandTotal = chapters.reduce((s, c) => s + c.total, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <Link to={`/clubs/${clubId}/read`} className="flex items-center gap-1 text-sm text-muted hover:text-theme mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to progress
      </Link>

      {/* Member header */}
      <div className="flex items-center gap-4 mb-6">
        {member.avatar_url
          ? <img src={member.avatar_url} alt={member.display_name} className="h-12 w-12 rounded-full object-cover" />
          : <div className="h-12 w-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {member.display_name[0]?.toUpperCase()}
            </div>
        }
        <div>
          <h1 className="text-lg font-bold text-theme">{member.display_name}</h1>
          <p className="text-xs text-muted capitalize">{member.role}</p>
        </div>
      </div>

      {/* Overview bar */}
      {barBreakdown.length > 0 && (
        <div className="theme-section rounded-xl p-4 mb-6">
          <SegmentedBar breakdown={barBreakdown} />
          <div className="flex items-center justify-between mt-2 text-xs text-muted">
            <span>{totalCompleted}/{chapters.length} chapters complete</span>
            <span>{totalItems}/{grandTotal} items done</span>
          </div>
        </div>
      )}

      {/* Privacy note */}
      {!can_see_responses && (
        <div className="text-xs text-muted bg-surface-hover rounded-lg px-3 py-2 mb-5">
          Response details are private for this club. Showing completion timestamps only.
        </div>
      )}

      {/* Chapters */}
      {chapters.length === 0 ? (
        <p className="text-muted text-center py-12">No chapters found.</p>
      ) : (
        <div className="theme-section rounded-xl p-5">
          <div className="space-y-0">
            {chapters.map((ch, idx) => (
              <ChapterCard
                key={ch.chapter_id}
                chapter={ch}
                canSeeResponses={can_see_responses}
                isLast={idx === chapters.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
