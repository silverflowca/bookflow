import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, Star, TrendingUp } from 'lucide-react';
import api from '../../lib/api';
import type { ClassSubmission, ClassSubmissionFeedback } from '../../types';

interface ChapterProgress {
  chapter_id: string;
  title: string;
  completed: number;
  total: number;
}

interface ProgressData {
  book: { id: string; title: string; cover_image_url?: string } | null;
  chapters: ChapterProgress[];
  items_completed: number;
  items_total: number;
  completion_pct: number;
  submissions: (ClassSubmission & { feedback?: ClassSubmissionFeedback | null })[];
}

function ProgressBar({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  const h = size === 'sm' ? 'h-1.5' : 'h-2';
  return (
    <div className={`flex-1 ${h} bg-strong/20 rounded-full overflow-hidden`}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'graded') return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">Graded</span>;
  if (status === 'submitted') return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">Submitted</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">Draft</span>;
}

export default function ClassProgressPanel({ clubId }: { clubId: string }) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyClassProgress(clubId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clubId]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strong" />
    </div>
  );

  if (!data || !data.book) return (
    <div className="text-center py-16 theme-section rounded-xl border-dashed">
      <BookOpen className="h-10 w-10 text-muted mx-auto mb-3" />
      <p className="text-theme font-semibold mb-1">No book assigned yet</p>
      <p className="text-sm text-muted">Your teacher hasn't assigned a book to this class yet.</p>
    </div>
  );

  const { book, chapters, completion_pct, items_completed, items_total, submissions } = data;
  const submitted = submissions.filter(s => s.status !== 'draft');
  const graded = submissions.filter(s => s.status === 'graded');

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Overall progress card ──────────────────────────────── */}
      <div className="theme-section rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-violet-500" />
          <h2 className="font-semibold text-theme">My Progress</h2>
        </div>

        {/* Book */}
        <div className="flex items-center gap-3 mb-5">
          {book.cover_image_url ? (
            <img src={book.cover_image_url} alt={book.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
          ) : (
            <div className="w-10 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
          )}
          <div>
            <p className="text-xs text-muted mb-0.5">Currently reading</p>
            <p className="font-semibold text-theme">{book.title}</p>
          </div>
        </div>

        {/* Overall % */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted">Overall completion</span>
          <span className="text-sm font-semibold text-theme">{completion_pct}%</span>
        </div>
        <ProgressBar pct={completion_pct} />
        <p className="text-xs text-muted mt-1.5">{items_completed} of {items_total} items completed</p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-strong/20">
          <div className="text-center">
            <p className="text-xl font-bold text-theme">{completion_pct}%</p>
            <p className="text-xs text-muted mt-0.5">Reading</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-theme">{submitted.length}</p>
            <p className="text-xs text-muted mt-0.5">Submitted</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-theme">{graded.length}</p>
            <p className="text-xs text-muted mt-0.5">Graded</p>
          </div>
        </div>
      </div>

      {/* ── Chapter breakdown ──────────────────────────────────── */}
      {chapters.length > 0 && (
        <div className="theme-section rounded-xl p-5">
          <h2 className="font-semibold text-theme mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-muted" /> Chapter Progress
          </h2>
          <div className="space-y-3">
            {chapters.map((ch, i) => {
              const pct = ch.total > 0 ? Math.round((ch.completed / ch.total) * 100) : 0;
              return (
                <div key={ch.chapter_id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted w-5 flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-theme truncate">{ch.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs text-muted">{ch.completed}/{ch.total}</span>
                      <span className={`text-xs font-medium w-8 text-right ${pct >= 80 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar pct={pct} size="sm" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Assignments & grades ───────────────────────────────── */}
      {submissions.length > 0 && (
        <div className="theme-section rounded-xl p-5">
          <h2 className="font-semibold text-theme mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-muted" /> Assignments
          </h2>
          <div className="space-y-3">
            {submissions.map(sub => {
              const prompt = Array.isArray(sub.prompt) ? (sub.prompt as any)[0] : sub.prompt;
              const feedback = Array.isArray(sub.feedback) ? (sub.feedback as any)[0] : sub.feedback;
              return (
                <div key={sub.id} className="rounded-lg bg-strong/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-theme truncate">
                        {sub.title || prompt?.title || 'Untitled assignment'}
                      </p>
                      {prompt && (
                        <p className="text-xs text-muted capitalize mt-0.5">{prompt.prompt_type}</p>
                      )}
                      {prompt?.due_date && sub.status === 'draft' && (
                        <p className="text-xs text-amber-500 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Due {new Date(prompt.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={sub.status} />
                  </div>
                  {feedback && (
                    <div className="mt-2 pt-2 border-t border-strong/20">
                      {feedback.grade !== undefined && feedback.grade !== null && (
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          Grade: {feedback.grade}/100
                        </p>
                      )}
                      {feedback.feedback_text && (
                        <p className="text-xs text-muted mt-1">{feedback.feedback_text}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {submissions.length === 0 && (
        <div className="theme-section rounded-xl p-5 text-center">
          <p className="text-sm text-muted">No assignments yet. Check the Assignments tab for prompts from your teacher.</p>
        </div>
      )}

    </div>
  );
}
