import { useEffect, useState } from 'react';
import { Plus, BookOpen, Check, Clock, Star, Edit2, Trash2, Calendar, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../lib/api';
import type { ClassPrompt, ClassSession, ClassSubmission, ClassSubmissionFeedback } from '../../types';
import ClassSubmissionEditor from './ClassSubmissionEditor';
import ClassFeedbackModal from './ClassFeedbackModal';
import ClassPromptForm from './ClassPromptForm';
import ClassSubmissionThread from './ClassSubmissionThread';

function StatusBadge({ status }: { status: ClassSubmission['status'] }) {
  if (status === 'graded') return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1"><Star className="h-3 w-3" />Graded</span>;
  if (status === 'submitted') return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center gap-1"><Check className="h-3 w-3" />Submitted</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1"><Clock className="h-3 w-3" />Draft</span>;
}

/** Single student submission row (teacher view) with inline thread */
function TeacherSubRow({
  sub, clubId, onGrade,
}: {
  sub: ClassSubmission;
  clubId: string;
  onGrade: (sub: ClassSubmission) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState<ClassSubmissionFeedback | undefined>(
    Array.isArray(sub.feedback) ? sub.feedback[0] : sub.feedback ?? undefined
  );
  const profile = Array.isArray(sub.student) ? sub.student[0] : sub.student;
  const prompt = Array.isArray(sub.prompt) ? sub.prompt[0] : sub.prompt;

  return (
    <div className="border-b border-strong/10 last:border-b-0">
      {/* Row header */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            : (profile?.display_name ?? 'S').charAt(0)
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-theme truncate">{profile?.display_name ?? 'Student'}</p>
          <p className="text-xs text-muted truncate">{sub.body?.slice(0, 80)}{sub.body?.length > 80 ? '…' : ''}</p>
        </div>
        <StatusBadge status={sub.status} />
        {feedback?.grade != null && (
          <span className="text-xs font-bold text-amber-600">{feedback.grade}/100</span>
        )}
        {/* Thread toggle */}
        <button
          onClick={() => setExpanded(p => !p)}
          className="p-1.5 text-muted hover:text-theme transition-colors"
          title="View / comment"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
        </button>
        <button
          onClick={() => onGrade(sub)}
          className="text-xs theme-button-secondary px-3 py-1.5 rounded-lg flex-shrink-0"
        >
          {sub.status === 'graded' ? 'Edit Grade' : 'Grade'}
        </button>
      </div>

      {/* Thread panel */}
      {expanded && (
        <div className="px-4 pb-4 bg-strong/3 border-t border-strong/10">
          {/* Full submission body */}
          <div className="py-3">
            <p className="text-[10px] text-muted uppercase tracking-wide font-semibold mb-1">
              {prompt?.title ?? 'Submission'} · {prompt?.prompt_type ?? ''}
            </p>
            <p className="text-sm text-theme whitespace-pre-wrap max-h-40 overflow-y-auto">{sub.body}</p>
            {sub.submitted_at && (
              <p className="text-[10px] text-muted mt-1">Submitted {new Date(sub.submitted_at).toLocaleDateString()}</p>
            )}
          </div>
          <ClassSubmissionThread
            clubId={clubId}
            submissionId={sub.id}
            feedback={feedback}
            isTeacher={true}
            chapterId={sub.chapter_id ?? prompt?.chapter_id}
            onFeedbackUpdated={fb => setFeedback(fb)}
          />
        </div>
      )}
    </div>
  );
}

/** Student view of their own submission with thread + reply to feedback */
function StudentSubCard({
  sub, clubId, prompt, onEdit,
}: {
  sub: ClassSubmission;
  clubId: string;
  prompt: ClassPrompt;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(sub.status === 'graded');
  const [feedback, setFeedback] = useState<ClassSubmissionFeedback | undefined>(
    Array.isArray(sub.feedback) ? sub.feedback[0] : sub.feedback ?? undefined
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <StatusBadge status={sub.status} />
        <div className="flex items-center gap-2">
          {sub.status === 'draft' && (
            <button onClick={onEdit} className="text-xs theme-button-secondary px-3 py-1.5 rounded-lg">
              Edit Draft
            </button>
          )}
          <button
            onClick={() => setExpanded(p => !p)}
            className="flex items-center gap-1 text-xs text-muted hover:text-theme transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {expanded ? 'Hide' : 'Thread'}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Submission body preview */}
      {sub.body && (
        <p className="text-sm text-muted line-clamp-2 bg-strong/5 rounded-lg px-3 py-2">{sub.body}</p>
      )}

      {/* Thread (feedback loop + comments) */}
      {expanded && (
        <div className="mt-2 rounded-xl border border-strong/10 p-3">
          <ClassSubmissionThread
            clubId={clubId}
            submissionId={sub.id}
            feedback={feedback}
            isTeacher={false}
            chapterId={sub.chapter_id ?? prompt?.chapter_id}
            onFeedbackUpdated={fb => setFeedback(fb)}
          />
        </div>
      )}
    </div>
  );
}

export default function ClassSubmissionsPanel({ clubId, isTeacher }: { clubId: string; isTeacher: boolean }) {
  const [prompts, setPrompts] = useState<ClassPrompt[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [submissions, setSubmissions] = useState<ClassSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<ClassPrompt | null>(null);

  // Student: editing own submission
  const [editingSub, setEditingSub] = useState<{ promptId: string | null; subId?: string } | null>(null);
  // Teacher: grading a submission
  const [gradingSub, setGradingSub] = useState<ClassSubmission | null>(null);

  useEffect(() => {
    Promise.all([
      api.getClassPrompts(clubId),
      api.getClassSubmissions(clubId),
      api.getClassSessions(clubId),
    ])
      .then(([p, s, sess]) => { setPrompts(p); setSubmissions(s); setSessions(sess); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clubId]);

  async function handleDeletePrompt(id: string) {
    if (!confirm('Delete this prompt? All student submissions linked to it will remain but lose the prompt link.')) return;
    await api.deleteClassPrompt(clubId, id);
    setPrompts(prev => prev.filter(p => p.id !== id));
  }

  async function handlePromptSaved(prompt: ClassPrompt) {
    if (editingPrompt) {
      setPrompts(prev => prev.map(p => p.id === prompt.id ? prompt : p));
    } else {
      setPrompts(prev => [...prev, prompt].sort((a, b) => a.sort_order - b.sort_order));
    }
    setShowPromptForm(false);
    setEditingPrompt(null);
  }

  function handleSubSaved(sub: ClassSubmission) {
    setSubmissions(prev => {
      const idx = prev.findIndex(s => s.id === sub.id);
      if (idx >= 0) return prev.map(s => s.id === sub.id ? sub : s);
      return [sub, ...prev];
    });
    setEditingSub(null);
  }

  function handleFeedbackSaved(sub: ClassSubmission) {
    setSubmissions(prev => prev.map(s => s.id === sub.id ? sub : s));
    setGradingSub(null);
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strong" /></div>;

  // Student writing editor
  if (editingSub !== null) {
    const existingSub = editingSub.subId ? submissions.find(s => s.id === editingSub.subId) : undefined;
    const prompt = editingSub.promptId ? prompts.find(p => p.id === editingSub.promptId) : undefined;
    return (
      <ClassSubmissionEditor
        clubId={clubId}
        prompt={prompt}
        submission={existingSub}
        onSaved={handleSubSaved}
        onCancel={() => setEditingSub(null)}
      />
    );
  }

  return (
    <div>
      {/* Teacher: add prompt */}
      {isTeacher && !showPromptForm && !editingPrompt && (
        <button
          onClick={() => setShowPromptForm(true)}
          className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium mb-6"
        >
          <Plus className="h-4 w-4" /> Add Assignment
        </button>
      )}

      {(showPromptForm || editingPrompt) && (
        <div className="mb-6">
          <ClassPromptForm
            clubId={clubId}
            initial={editingPrompt}
            onSaved={handlePromptSaved}
            onCancel={() => { setShowPromptForm(false); setEditingPrompt(null); }}
          />
        </div>
      )}

      {prompts.length === 0 ? (
        <div className="text-center py-16 theme-section border-dashed rounded-xl">
          <BookOpen className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="font-semibold text-theme mb-2">No assignments yet</h3>
          <p className="text-muted text-sm">
            {isTeacher ? 'Create your first assignment above.' : 'No assignments have been posted yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {prompts.map(prompt => {
            const promptSubs = submissions.filter(s => s.prompt_id === prompt.id);
            const mySub = !isTeacher ? promptSubs[0] : undefined;
            const linkedSession = prompt.session_id ? sessions.find(s => s.id === prompt.session_id) : null;

            return (
              <div key={prompt.id} className="theme-section rounded-xl overflow-hidden">
                {/* Prompt header */}
                <div className="p-4 border-b border-strong/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-theme text-sm">{prompt.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                          {prompt.prompt_type}
                        </span>
                        {prompt.is_required && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">Required</span>
                        )}
                        {linkedSession && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{linkedSession.title}
                          </span>
                        )}
                      </div>
                      {prompt.body && <p className="text-sm text-muted mt-1 line-clamp-2">{prompt.body}</p>}
                      {prompt.due_date && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Due: {new Date(prompt.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {isTeacher && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setEditingPrompt(prompt)} className="p-1.5 text-muted hover:text-theme transition-colors">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeletePrompt(prompt.id)} className="p-1.5 text-red-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Student: own submission area */}
                {!isTeacher && (
                  <div className="p-4">
                    {mySub ? (
                      <StudentSubCard
                        sub={mySub}
                        clubId={clubId}
                        prompt={prompt}
                        onEdit={() => setEditingSub({ promptId: prompt.id, subId: mySub.id })}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingSub({ promptId: prompt.id })}
                        className="flex items-center gap-2 text-sm theme-button-secondary px-3 py-2 rounded-lg"
                      >
                        <Plus className="h-4 w-4" /> Start Writing
                      </button>
                    )}
                  </div>
                )}

                {/* Teacher: all student submissions */}
                {isTeacher && promptSubs.length > 0 && (
                  <div>
                    {promptSubs.map(sub => (
                      <TeacherSubRow
                        key={sub.id}
                        sub={sub}
                        clubId={clubId}
                        onGrade={setGradingSub}
                      />
                    ))}
                  </div>
                )}
                {isTeacher && promptSubs.length === 0 && (
                  <p className="text-xs text-muted px-4 py-3">No submissions yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Teacher feedback modal */}
      {gradingSub && (
        <ClassFeedbackModal
          clubId={clubId}
          submission={gradingSub}
          onSaved={handleFeedbackSaved}
          onClose={() => setGradingSub(null)}
        />
      )}
    </div>
  );
}
