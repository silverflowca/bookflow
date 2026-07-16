import { useEffect, useState } from 'react';
import { Plus, BookOpen, Check, Clock, Star, Edit2, Trash2, Calendar } from 'lucide-react';
import api from '../../lib/api';
import type { ClassPrompt, ClassSession, ClassSubmission } from '../../types';
import ClassSubmissionEditor from './ClassSubmissionEditor';
import ClassFeedbackModal from './ClassFeedbackModal';
import ClassPromptForm from './ClassPromptForm';

function StatusBadge({ status }: { status: ClassSubmission['status'] }) {
  if (status === 'graded') return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1"><Star className="h-3 w-3" />Graded</span>;
  if (status === 'submitted') return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center gap-1"><Check className="h-3 w-3" />Submitted</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1"><Clock className="h-3 w-3" />Draft</span>;
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
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <StatusBadge status={mySub.status} />
                          {mySub.status === 'draft' && (
                            <button
                              onClick={() => setEditingSub({ promptId: prompt.id, subId: mySub.id })}
                              className="text-xs theme-button-secondary px-3 py-1.5 rounded-lg"
                            >
                              Edit Draft
                            </button>
                          )}
                        </div>
                        {mySub.status === 'graded' && mySub.feedback && (
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 mt-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Star className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                {mySub.feedback.grade !== undefined && mySub.feedback.grade !== null
                                  ? `Grade: ${mySub.feedback.grade}/100`
                                  : 'Feedback received'
                                }
                              </span>
                            </div>
                            {mySub.feedback.feedback_text && (
                              <p className="text-sm text-theme">{mySub.feedback.feedback_text}</p>
                            )}
                          </div>
                        )}
                      </div>
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
                  <div className="divide-y divide-strong/10">
                    {promptSubs.map(sub => {
                      const profile = Array.isArray(sub.student) ? sub.student[0] : sub.student;
                      return (
                        <div key={sub.id} className="flex items-center gap-3 p-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                            {profile?.avatar_url
                              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                              : (profile?.display_name ?? 'S').charAt(0)
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-theme truncate">{profile?.display_name ?? 'Student'}</p>
                            <p className="text-xs text-muted truncate">{sub.body.slice(0, 80)}…</p>
                          </div>
                          <StatusBadge status={sub.status} />
                          {sub.status !== 'graded' && sub.feedback?.grade !== undefined ? null : null}
                          <button
                            onClick={() => setGradingSub(sub)}
                            className="text-xs theme-button-secondary px-3 py-1.5 rounded-lg flex-shrink-0"
                          >
                            {sub.status === 'graded' ? 'View / Edit' : 'Grade'}
                          </button>
                        </div>
                      );
                    })}
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
