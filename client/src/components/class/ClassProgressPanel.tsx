import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, Star } from 'lucide-react';
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

/** Segmented bar — each segment width ∝ chapter's share of total items */
function SegmentedBar({ chapters }: { chapters: ChapterProgress[] }) {
  if (!chapters.length) return null;
  const grandTotal = chapters.reduce((s, c) => s + (c.total || 1), 0);
  return (
    <div className="flex gap-px w-full h-3 rounded-full overflow-hidden">
      {chapters.map((ch, i) => {
        const widthPct = ((ch.total || 1) / grandTotal) * 100;
        const fillPct = ch.total > 0 ? Math.min(100, (ch.completed / ch.total) * 100) : 0;
        const done = ch.total > 0 && ch.completed >= ch.total;
        const started = fillPct > 0 && !done;
        return (
          <div
            key={ch.chapter_id ?? i}
            style={{ width: `${widthPct}%` }}
            className="relative h-full bg-strong/15 rounded-sm overflow-hidden flex-shrink-0"
            title={`Ch ${i + 1}: ${ch.title} — ${ch.completed}/${ch.total}`}
          >
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-500 ${done ? 'bg-emerald-500' : started ? 'bg-amber-400' : ''}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'graded') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold">Graded</span>;
  if (status === 'submitted') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">Submitted</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold">Draft</span>;
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
  const chaptersCompleted = chapters.filter(c => c.total > 0 && c.completed >= c.total).length;
  const submitted = submissions.filter(s => s.status !== 'draft');
  const graded = submissions.filter(s => s.status === 'graded');
  const avgGrade = graded.length > 0
    ? Math.round(graded.reduce((s, sub) => {
        const fb = Array.isArray(sub.feedback) ? (sub.feedback as any)[0] : sub.feedback;
        return s + (fb?.grade ?? 0);
      }, 0) / graded.length)
    : null;

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Progress card ─────────────────────────────────────── */}
      <div className="theme-section rounded-xl overflow-hidden">
        {/* Book header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-strong/10">
          {book.cover_image_url ? (
            <img src={book.cover_image_url} alt={book.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0 shadow-sm" />
          ) : (
            <div className="w-10 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] text-muted uppercase tracking-wide font-semibold mb-0.5">Currently reading</p>
            <p className="font-bold text-theme text-base leading-tight truncate">{book.title}</p>
          </div>
        </div>

        {/* Segmented progress bar + legend */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">Chapter Progress</span>
            <span className="text-xs text-muted">{chaptersCompleted} of {chapters.length} chapters complete</span>
          </div>
          <SegmentedBar chapters={chapters} />
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Complete
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> In progress
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-2.5 h-2.5 rounded-sm bg-strong/15 inline-block" /> Not started
            </span>
          </div>
        </div>

        {/* Stat chips */}
        <div className="grid grid-cols-3 gap-px border-t border-strong/10">
          <div className="px-4 py-3 text-center">
            <p className="text-lg font-bold text-theme">{completion_pct}%</p>
            <p className="text-[11px] text-muted mt-0.5">{items_completed}/{items_total} items</p>
          </div>
          <div className="px-4 py-3 text-center border-x border-strong/10">
            <p className="text-lg font-bold text-theme">{submitted.length}</p>
            <p className="text-[11px] text-muted mt-0.5">Submitted</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-lg font-bold text-theme">{avgGrade !== null ? `${avgGrade}%` : graded.length > 0 ? `${graded.length}` : '—'}</p>
            <p className="text-[11px] text-muted mt-0.5">{avgGrade !== null ? 'Avg grade' : 'Graded'}</p>
          </div>
        </div>
      </div>

      {/* ── Chapter breakdown ──────────────────────────────────── */}
      {chapters.length > 0 && (
        <div className="theme-section rounded-xl p-5">
          <h2 className="font-semibold text-theme mb-4 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-muted" /> Chapters
          </h2>
          <div className="space-y-3">
            {chapters.map((ch, i) => {
              const pct = ch.total > 0 ? Math.round((ch.completed / ch.total) * 100) : 0;
              const done = ch.total > 0 && ch.completed >= ch.total;
              const started = pct > 0 && !done;
              return (
                <div key={ch.chapter_id} className="flex items-center gap-3">
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-emerald-500' : started ? 'bg-amber-400' : 'bg-strong/20'}`} />
                  {/* Chapter name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm text-theme truncate">
                        <span className="text-muted mr-1.5">{i + 1}.</span>{ch.title}
                      </span>
                      <span className="text-xs text-muted flex-shrink-0">{ch.completed}/{ch.total}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-strong/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : started ? 'bg-amber-400' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Assignments ────────────────────────────────────────── */}
      {submissions.length > 0 && (
        <div className="theme-section rounded-xl p-5">
          <h2 className="font-semibold text-theme mb-4 flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-muted" /> Assignments
          </h2>
          <div className="space-y-2.5">
            {submissions.map(sub => {
              const prompt = Array.isArray(sub.prompt) ? (sub.prompt as any)[0] : sub.prompt;
              const feedback = Array.isArray(sub.feedback) ? (sub.feedback as any)[0] : sub.feedback;
              return (
                <div key={sub.id} className="rounded-xl bg-strong/5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-theme truncate">
                        {sub.title || prompt?.title || 'Untitled assignment'}
                      </p>
                      {prompt?.prompt_type && (
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
                    <div className="mt-2.5 pt-2.5 border-t border-strong/10 flex items-start gap-3">
                      {feedback.grade !== undefined && feedback.grade !== null && (
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                          {feedback.grade}/100
                        </span>
                      )}
                      {feedback.feedback_text && (
                        <p className="text-xs text-muted leading-relaxed">{feedback.feedback_text}</p>
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
        <p className="text-sm text-muted text-center py-2">No assignments yet. Check the Assignments tab for prompts from your teacher.</p>
      )}
    </div>
  );
}
