/**
 * StudentProgressReport
 *
 * A richly formatted, printable progress summary.
 *
 * Teacher view: viewable per-student from Roster → Student Detail → "Progress Report" button
 * Student view: downloadable from their own Progress tab → "Download Report" button
 *
 * Print/download: Uses window.print() + @media print CSS.
 * The component is designed so that screen styles look clean AND the print
 * stylesheet produces a well-formatted A4/Letter page.
 */

import { useEffect, useState, useRef } from 'react';
import { Printer, X, BookOpen, CheckCircle2, Star, ClipboardList, TrendingUp, Award, BookMarked } from 'lucide-react';
import api from '../../lib/api';
import type { StudentProgressReport as Report } from '../../types';

interface Props {
  clubId: string;
  studentId?: string;    // if teacher viewing — pass studentId; if student viewing own — omit
  onClose: () => void;
}

function GradeRing({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="72" height="72" className="flex-shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>{pct}%</text>
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-700',
    submitted: 'bg-blue-100 text-blue-700',
    graded: 'bg-emerald-100 text-emerald-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

function ChapterBar({ completed, total, title }: { completed: number; total: number; title: string }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const color = pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-40 truncate flex-shrink-0">{title}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-10 text-right flex-shrink-0">{pct}%</span>
    </div>
  );
}

export default function StudentProgressReport({ clubId, studentId, onClose }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = studentId
      ? api.getStudentProgressReport(clubId, studentId)
      : api.getMyProgressReport(clubId);
    fn.then(setReport).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [clubId, studentId]);

  function handlePrint() {
    window.print();
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center space-y-2">
        <div className="h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted">Loading progress report…</p>
      </div>
    </div>
  );

  if (error || !report) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center space-y-3">
        <p className="text-sm text-red-500">{error || 'Failed to load report'}</p>
        <button onClick={onClose} className="theme-button-secondary px-4 py-2 rounded-lg text-sm">Close</button>
      </div>
    </div>
  );

  const { club, profile, enrollment, books, submissions, summary } = report;
  const generatedDate = new Date(report.generated_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const enrollDate = enrollment?.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <>
      {/* Print stylesheet */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #progress-report-print { display: block !important; position: static !important; background: white !important; }
          #progress-report-print .no-print { display: none !important; }
          #progress-report-print .print-page { page-break-after: always; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      {/* Modal overlay */}
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4 bg-black/50 backdrop-blur-sm no-print">
        <div
          id="progress-report-print"
          ref={printRef}
          className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl"
        >
          {/* ── Header bar ─────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 no-print">
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-lg">Progress Report</h2>
              <p className="text-xs text-gray-500">Generated {generatedDate}</p>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">

            {/* ── Student + class info ─────────────────────────── */}
            <div className="flex gap-4 items-start">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.display_name ?? ''} className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-gray-100" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-2xl font-bold">{profile?.display_name?.charAt(0) ?? '?'}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900">{profile?.display_name ?? 'Student'}</h1>
                {profile?.email && <p className="text-sm text-gray-500">{profile.email}</p>}
                <div className="flex flex-wrap gap-3 mt-1">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <BookMarked className="h-3 w-3" /> {club?.name ?? 'Class'}
                  </span>
                  <span className="text-xs text-gray-500">Enrolled {enrollDate}</span>
                </div>
              </div>
              {summary.avg_grade != null && (
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <GradeRing pct={summary.avg_grade} />
                  <span className="text-[10px] text-gray-500 font-medium">Avg Grade</span>
                </div>
              )}
            </div>

            {/* ── Summary stats ────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: ClipboardList, label: 'Submitted', value: `${summary.submissions_submitted} / ${summary.total_prompts_assigned}`, color: 'text-blue-600 bg-blue-50' },
                { icon: CheckCircle2, label: 'Graded', value: summary.submissions_graded, color: 'text-emerald-600 bg-emerald-50' },
                { icon: Award, label: 'Avg Grade', value: summary.avg_grade != null ? `${summary.avg_grade}/100` : 'N/A', color: 'text-amber-600 bg-amber-50' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="rounded-xl border border-gray-100 p-3 text-center">
                  <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center mx-auto mb-1`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">{value}</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {/* ── Books progress ──────────────────────────────── */}
            {books.map((br, bi) => (
              <div key={bi} className="space-y-3">
                <div className="flex items-center gap-3">
                  {br.book.cover_image_url ? (
                    <img src={br.book.cover_image_url} alt={br.book.title} className="w-10 h-14 object-cover rounded shadow-sm flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{br.book.title}</h3>
                      {br.is_current && <span className="text-[10px] text-violet-600 font-semibold bg-violet-50 px-1.5 py-0.5 rounded-full">Current</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${br.completion_pct >= 80 ? 'bg-emerald-500' : br.completion_pct > 0 ? 'bg-amber-400' : 'bg-gray-200'}`}
                          style={{ width: `${br.completion_pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{br.completion_pct}%</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{br.items_completed} of {br.items_total} items completed</p>
                  </div>
                </div>

                {/* Chapter breakdown */}
                {br.chapters.length > 0 && (
                  <div className="pl-4 space-y-1.5">
                    {br.chapters.map(ch => (
                      <ChapterBar key={ch.chapter_id} title={ch.title} completed={ch.completed} total={ch.total} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Divider */}
            <hr className="border-gray-100" />

            {/* ── Assignments ──────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Assignments</h3>
              </div>
              {submissions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No assignments yet.</p>
              ) : (
                <div className="space-y-3">
                  {submissions.map(sub => {
                    const prompt = Array.isArray(sub.prompt) ? sub.prompt[0] : sub.prompt;
                    const feedback = Array.isArray(sub.feedback) ? sub.feedback[0] : sub.feedback;
                    return (
                      <div key={sub.id} className="border border-gray-100 rounded-xl p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-gray-900">{sub.title || prompt?.title || 'Untitled'}</span>
                              <StatusBadge status={sub.status} />
                              {prompt?.prompt_type && (
                                <span className="text-[10px] text-gray-400 italic">{prompt.prompt_type}</span>
                              )}
                            </div>
                            {sub.submitted_at && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Submitted {new Date(sub.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          {feedback?.grade != null && (
                            <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg flex-shrink-0">
                              <Star className="h-3.5 w-3.5 text-amber-500" />
                              <span className="text-sm font-bold text-amber-700">{feedback.grade}/100</span>
                            </div>
                          )}
                        </div>

                        {/* Submission body preview */}
                        {sub.body && (
                          <p className="text-xs text-gray-600 line-clamp-3 bg-gray-50 rounded-lg px-3 py-2">
                            {sub.body}
                          </p>
                        )}

                        {/* Feedback */}
                        {feedback?.feedback_text && (
                          <div className="border-l-2 border-amber-300 pl-3 space-y-1">
                            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Teacher Feedback</p>
                            <p className="text-xs text-gray-700">{feedback.feedback_text}</p>
                          </div>
                        )}

                        {/* Student note */}
                        {feedback?.student_note && (
                          <div className="border-l-2 border-violet-300 pl-3 space-y-1">
                            <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">Student Reply</p>
                            <p className="text-xs text-gray-700">{feedback.student_note}</p>
                          </div>
                        )}

                        {/* Teacher follow-up */}
                        {feedback?.teacher_follow_up && (
                          <div className="border-l-2 border-emerald-300 pl-3 space-y-1">
                            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Teacher Follow-up</p>
                            <p className="text-xs text-gray-700">{feedback.teacher_follow_up}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer ──────────────────────────────────────── */}
            <div className="text-center pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">BookFlow · books.silverflow.ca · Generated {generatedDate}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
