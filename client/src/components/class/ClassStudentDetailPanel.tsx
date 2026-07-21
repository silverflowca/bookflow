import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, BookOpen, MessageSquare, Send, ChevronDown, ChevronUp, FileText, Star } from 'lucide-react';
import api from '../../lib/api';
import ClassSubmissionThread from './ClassSubmissionThread';
import StudentProgressReport from './StudentProgressReport';

interface Comment {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: { id: string; display_name: string; avatar_url?: string };
}

interface AnswerFeedback {
  id: string;
  grade?: number | null;
  feedback_text?: string | null;
  created_at: string;
}

interface Answer {
  id: string;
  chapter_id: string;
  content_id: string;
  response_data: any;
  created_at: string;
  question_label: string | null;
  chapter_title: string | null;
  comments: Comment[];
  feedback?: AnswerFeedback | null;
}

interface Submission {
  id: string;
  title?: string;
  status: string;
  submitted_at?: string;
  body: string;
  prompt?: { id: string; title: string; prompt_type: string } | null;
  feedback?: { grade?: number; feedback_text?: string } | null;
}

interface StudentDetail {
  profile: { id: string; display_name: string; avatar_url?: string; email?: string } | null;
  book: { id: string; title: string; cover_image_url?: string } | null;
  items_completed: number;
  items_total: number;
  completion_pct: number;
  chapters: { chapter_id: string; title: string; completed: number; total: number }[];
  answers: Answer[];
  submissions: Submission[];
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-strong/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted w-9 text-right">{pct}%</span>
    </div>
  );
}

function ResponseCard({ answer, clubId, studentId, currentUserId }: { answer: Answer; clubId: string; studentId: string; currentUserId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>(answer.comments);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Teacher feedback state
  const [feedbackText, setFeedbackText] = useState(answer.feedback?.feedback_text ?? '');
  const [grade, setGrade] = useState<string>(answer.feedback?.grade != null ? String(answer.feedback.grade) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => { loadedRef.current = true; }, []);

  const saveFeedback = useCallback(async (text: string, gradeVal: string) => {
    setSaving(true);
    try {
      await api.postAnswerFeedback(clubId, answer.id, {
        feedback_text: text || undefined,
        grade: gradeVal !== '' ? Number(gradeVal) : undefined,
        student_id: studentId,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ } finally { setSaving(false); }
  }, [clubId, answer.id, studentId]);

  function triggerAutoSave(text: string, gradeVal: string) {
    if (!loadedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveFeedback(text, gradeVal), 800);
  }

  const responseText = typeof answer.response_data === 'string'
    ? answer.response_data
    : answer.response_data?.value ?? answer.response_data?.text ?? JSON.stringify(answer.response_data);

  async function postComment() {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const c = await api.postResponseComment(clubId, answer.id, newComment.trim());
      setComments(prev => [...prev, c]);
      setNewComment('');
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { /* silent */ }
    finally { setPosting(false); }
  }

  return (
    <div className="rounded-lg border border-strong/20 overflow-hidden">
      {/* Header — click to expand full answer + comments */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-strong/5 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted mb-0.5">{answer.chapter_title ?? 'Chapter'}</p>
          <p className="text-sm font-medium text-theme">{answer.question_label ?? 'Response'}</p>
          <p className="text-sm text-muted mt-1 line-clamp-2">{responseText}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {comments.length > 0 && (
            <span className="text-xs text-violet-500 flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> {comments.length}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
        </div>
      </button>

      {/* Teacher feedback — always visible */}
      <div className="border-t border-strong/10 bg-strong/3 px-3 pb-3 pt-2 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
            <Star className="h-3 w-3" /> Teacher Feedback
          </p>
          {saving && <span className="text-xs text-muted">Saving…</span>}
          {saved && !saving && <span className="text-xs text-emerald-500">Saved</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted flex-shrink-0">Grade</label>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="—"
            className="theme-input rounded-md px-2 py-1 text-sm w-20"
            value={grade}
            onChange={e => { setGrade(e.target.value); triggerAutoSave(feedbackText, e.target.value); }}
          />
          <span className="text-xs text-muted">/100</span>
        </div>
        <textarea
          rows={2}
          placeholder="Add feedback for this student's answer…"
          className="w-full theme-input rounded-md px-3 py-2 text-sm resize-none"
          value={feedbackText}
          onChange={e => { setFeedbackText(e.target.value); triggerAutoSave(e.target.value, grade); }}
        />
      </div>

      {/* Expanded: full answer + comments */}
      {expanded && (
        <div className="border-t border-strong/20 bg-strong/5 p-3 space-y-3">
          {/* Full answer */}
          <div className="bg-white dark:bg-black/20 rounded-lg p-3">
            <p className="text-xs text-muted mb-1">Student's answer</p>
            <p className="text-sm text-theme whitespace-pre-wrap">{responseText}</p>
            <p className="text-xs text-muted mt-1">{new Date(answer.created_at).toLocaleDateString()}</p>
          </div>

          {/* Comments thread */}
          {comments.length > 0 && (
            <div className="space-y-2">
              {comments.map(c => (
                <div key={c.id} className={`flex gap-2 ${c.author_id === currentUserId ? 'flex-row-reverse' : ''}`}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden mt-0.5">
                    {c.author?.avatar_url
                      ? <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (c.author?.display_name ?? '?').charAt(0)
                    }
                  </div>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${c.author_id === currentUserId ? 'bg-violet-600 text-white' : 'bg-white dark:bg-black/30 text-theme'}`}>
                    <p className="text-xs opacity-70 mb-0.5">{c.author?.display_name}</p>
                    <p className="text-sm">{c.body}</p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}

          {/* New comment input */}
          <div className="flex gap-2">
            <input
              className="flex-1 theme-input rounded-lg px-3 py-1.5 text-sm"
              placeholder="Add a comment…"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()}
            />
            <button
              onClick={postComment}
              disabled={posting || !newComment.trim()}
              className="theme-button-primary px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  clubId: string;
  studentId: string;
  currentUserId: string;
  onBack: () => void;
  onOpenDM: (studentId: string, name: string) => void;
}

export default function ClassStudentDetailPanel({ clubId, studentId, currentUserId, onBack, onOpenDM }: Props) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'progress' | 'answers' | 'assignments'>('progress');
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    api.getClassStudentDetail(clubId, studentId)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clubId, studentId]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strong" />
    </div>
  );

  if (!detail) return <p className="text-muted text-sm">Failed to load student detail.</p>;

  const { profile, book, completion_pct, items_completed, items_total, chapters, answers, submissions } = detail;
  const graded = submissions.filter(s => s.status === 'graded');

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-muted hover:text-theme transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            : (profile?.display_name ?? '?').charAt(0)
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-theme">{profile?.display_name ?? 'Student'}</p>
          {profile?.email && <p className="text-xs text-muted">{profile.email}</p>}
        </div>
        <button
          onClick={() => onOpenDM(studentId, profile?.display_name ?? 'Student')}
          className="flex items-center gap-1.5 theme-button-secondary px-3 py-2 rounded-lg text-sm"
        >
          <MessageSquare className="h-4 w-4" /> Message
        </button>
        <button
          onClick={() => setShowReport(true)}
          className="flex items-center gap-1.5 theme-button-secondary px-3 py-2 rounded-lg text-sm"
          title="View progress report"
        >
          <FileText className="h-4 w-4" /> Report
        </button>
      </div>

      {showReport && (
        <StudentProgressReport
          clubId={clubId}
          studentId={studentId}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Section tabs */}
      <div className="flex gap-1 mb-6 theme-section p-1 rounded-lg w-fit">
        {(['progress', 'answers', 'assignments'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${section === s ? 'theme-button-primary' : 'text-muted hover:text-theme'}`}
          >
            {s === 'answers' ? 'Q&A' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Progress section */}
      {section === 'progress' && (
        <div className="space-y-4">
          {book && (
            <div className="theme-section rounded-xl p-4 flex items-center gap-3">
              {book.cover_image_url
                ? <img src={book.cover_image_url} alt={book.title} className="w-9 h-12 object-cover rounded flex-shrink-0" />
                : <div className="w-9 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded flex items-center justify-center flex-shrink-0"><BookOpen className="h-3.5 w-3.5 text-white" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted mb-0.5">Currently reading</p>
                <p className="text-sm font-semibold text-theme truncate">{book.title}</p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="theme-section rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-theme">{completion_pct}%</p>
              <p className="text-xs text-muted mt-0.5">Completion</p>
            </div>
            <div className="theme-section rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-theme">{submissions.filter(s => s.status !== 'draft').length}</p>
              <p className="text-xs text-muted mt-0.5">Submitted</p>
            </div>
            <div className="theme-section rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-theme">{graded.length}</p>
              <p className="text-xs text-muted mt-0.5">Graded</p>
            </div>
          </div>

          {/* Overall bar */}
          <div className="theme-section rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted">Overall</span>
              <span className="text-muted">{items_completed}/{items_total} items</span>
            </div>
            <ProgressBar pct={completion_pct} />
          </div>

          {/* Per-chapter */}
          {chapters.length > 0 && (
            <div className="theme-section rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">By Chapter</h3>
              <div className="space-y-3">
                {chapters.map((ch, i) => {
                  const pct = ch.total > 0 ? Math.round((ch.completed / ch.total) * 100) : 0;
                  return (
                    <div key={ch.chapter_id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-theme truncate">{i + 1}. {ch.title}</span>
                        <span className="text-muted ml-2 flex-shrink-0">{ch.completed}/{ch.total}</span>
                      </div>
                      <ProgressBar pct={pct} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Q&A answers section */}
      {section === 'answers' && (
        <div className="space-y-3">
          {answers.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <p className="text-sm">No Q&A answers yet for this student.</p>
            </div>
          ) : (
            answers.map(a => (
              <ResponseCard key={a.id} answer={a} clubId={clubId} studentId={studentId} currentUserId={currentUserId} />
            ))
          )}
        </div>
      )}

      {/* Assignments section */}
      {section === 'assignments' && (
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <p className="text-sm">No submissions yet.</p>
            </div>
          ) : (
            submissions.map(sub => {
              const prompt = sub.prompt;
              const feedback = sub.feedback;
              return (
                <div key={sub.id} className="theme-section rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-theme">{sub.title || prompt?.title || 'Untitled'}</p>
                      {prompt && <p className="text-xs text-muted capitalize mt-0.5">{prompt.prompt_type}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      sub.status === 'graded' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : sub.status === 'submitted' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    }`}>{sub.status}</span>
                  </div>
                  {sub.body && (
                    <p className="text-sm text-muted whitespace-pre-wrap max-h-32 overflow-y-auto bg-strong/5 rounded-lg px-3 py-2">{sub.body}</p>
                  )}
                  {/* Thread: feedback loop + back-and-forth comments */}
                  <ClassSubmissionThread
                    clubId={clubId}
                    submissionId={sub.id}
                    feedback={feedback ? { ...feedback, id: '', submission_id: sub.id, club_id: clubId, created_by: '', created_at: '', updated_at: '' } : null}
                    isTeacher={true}
                    chapterId={(prompt as any)?.chapter_id}
                  />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
