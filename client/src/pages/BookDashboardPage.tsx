import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft, BookOpen, Users, CheckCircle, TrendingUp,
  FileText, MessageSquare, Layers, Clock, BarChart2, Loader2,
  Eye, AlertCircle
} from 'lucide-react';
import api from '../lib/api';
import type { Book } from '../types';
import BookResponsesViewer from '../components/responses/BookResponsesViewer';

type BookStats = Awaited<ReturnType<typeof api.getBookStats>>;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'rose' | 'teal';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    rose: 'bg-rose-50 text-rose-600',
    teal: 'bg-teal-50 text-teal-600',
  };
  return (
    <div className="theme-section rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg shrink-0 ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted uppercase tracking-wide font-medium">{label}</p>
        <p className="text-2xl font-bold text-theme mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ContentTypeBadge({ type, count }: { type: string; count: number }) {
  const colors: Record<string, string> = {
    question: 'bg-blue-100 text-blue-700',
    poll: 'bg-purple-100 text-purple-700',
    textbox: 'bg-green-100 text-green-700',
    textarea: 'bg-green-100 text-green-700',
    radio: 'bg-orange-100 text-orange-700',
    checkbox: 'bg-orange-100 text-orange-700',
    select: 'bg-teal-100 text-teal-700',
    multiselect: 'bg-teal-100 text-teal-700',
    audio: 'bg-yellow-100 text-yellow-700',
    video: 'bg-red-100 text-red-700',
    image: 'bg-pink-100 text-pink-700',
    highlight: 'bg-amber-100 text-amber-700',
    note: 'bg-indigo-100 text-indigo-700',
    link: 'bg-cyan-100 text-cyan-700',
    code_block: 'bg-slate-100 text-slate-700',
    scripture_block: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${colors[type] || 'bg-gray-100 text-gray-700'}`}>
      {type.replace(/_/g, ' ')}
      <span className="font-bold">{count}</span>
    </span>
  );
}

function wpm(words: number) {
  const mins = Math.round(words / 200);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function BookDashboardPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [stats, setStats] = useState<BookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'responses'>('overview');

  useEffect(() => {
    if (bookId) load();
  }, [bookId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [bookData, statsData] = await Promise.all([
        api.getBook(bookId!),
        api.getBookStats(bookId!),
      ]);
      setBook(bookData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <p className="text-muted">{error || 'No data available'}</p>
        <Link to={`/edit/book/${bookId}/settings`} className="mt-4 inline-block text-sm text-accent hover:underline">
          Back to settings
        </Link>
      </div>
    );
  }

  const { overview, content_by_type, chapter_stats } = stats;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to={`/edit/book/${bookId}/settings`}
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-muted" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted uppercase tracking-wide font-medium">Dashboard</p>
          <h1 className="text-xl font-bold text-theme truncate">{book?.title || 'Book Dashboard'}</h1>
        </div>
        <Link
          to={`/edit/book/${bookId}`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted hover:bg-surface-hover transition-colors"
        >
          <Eye className="h-4 w-4" />
          Editor
        </Link>
      </div>

      {/* Tab strip */}
      <div className="flex border-b border-[var(--color-border)] mb-6">
        <button
          onClick={() => setTab('overview')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'overview'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-theme'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          Overview
        </button>
        <button
          onClick={() => setTab('responses')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'responses'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-theme'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Responses
          {overview.total_form_responses > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
              {overview.total_form_responses}
            </span>
          )}
        </button>
      </div>

      {tab === 'responses' && bookId && (
        <div className="theme-section rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-theme">All Reader Responses</h2>
          </div>
          <div className="p-4">
            <BookResponsesViewer bookId={bookId} />
          </div>
        </div>
      )}

      {tab === 'overview' && (
      <>
      {/* Stat cards — row 1: readers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Readers" value={overview.total_readers} color="blue" />
        <StatCard icon={TrendingUp} label="Active (30d)" value={overview.active_readers} color="teal" />
        <StatCard icon={CheckCircle} label="Completed" value={overview.completed_readers} color="green" />
        <StatCard
          icon={BarChart2}
          label="Avg Progress"
          value={`${overview.avg_progress}%`}
          color="purple"
        />
      </div>

      {/* Stat cards — row 2: content */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={BookOpen}
          label="Chapters"
          value={overview.published_chapters}
          sub={`${overview.total_chapters} total`}
          color="blue"
        />
        <StatCard
          icon={FileText}
          label="Total Words"
          value={overview.total_words.toLocaleString()}
          sub={wpm(overview.total_words) + ' read time'}
          color="orange"
        />
        <StatCard
          icon={Layers}
          label="Components"
          value={overview.total_components}
          sub={`${overview.total_form_responses} responses`}
          color="purple"
        />
        <StatCard
          icon={MessageSquare}
          label="Comments"
          value={overview.total_comments}
          sub={`${overview.open_comments} open · ${overview.resolved_comments} resolved`}
          color="rose"
        />
      </div>

      {/* Component breakdown */}
      {Object.keys(content_by_type).length > 0 && (
        <div className="theme-section rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-theme mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-500" />
            Component Types
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(content_by_type).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <ContentTypeBadge key={type} type={type} count={count} />
            ))}
          </div>
        </div>
      )}

      {/* Chapter table */}
      {chapter_stats.length > 0 && (
        <div className="theme-section rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-theme">Chapters</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Title</th>
                  <th className="text-right px-4 py-3 font-medium">Words</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                    <Clock className="h-3.5 w-3.5 inline mr-1" />
                    Read time
                  </th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Components</th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Responses</th>
                  <th className="text-right px-4 py-3 font-medium">Readers</th>
                  <th className="text-right px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {chapter_stats.map((ch) => (
                  <tr key={ch.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-3 text-muted">{ch.order_index + 1}</td>
                    <td className="px-4 py-3 font-medium text-theme max-w-[180px] truncate">
                      <Link
                        to={`/edit/book/${bookId}/chapter/${ch.id}`}
                        className="hover:text-accent transition-colors"
                      >
                        {ch.title || 'Untitled'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{ch.word_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-muted hidden sm:table-cell">
                      {ch.read_time > 0 ? `${ch.read_time} min` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted hidden md:table-cell">{ch.components || '—'}</td>
                    <td className="px-4 py-3 text-right text-muted hidden md:table-cell">{ch.form_responses || '—'}</td>
                    <td className="px-4 py-3 text-right text-muted">{ch.unique_readers || '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        ch.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : ch.status === 'review'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {ch.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {overview.total_readers === 0 && (
        <div className="text-center py-10 text-muted">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No readers yet. Share your book to start gathering stats.</p>
        </div>
      )}
      </>
      )}
    </div>
  );
}
