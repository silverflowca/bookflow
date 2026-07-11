import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Send } from 'lucide-react';
import api from '../../lib/api';
import type { ClassPrompt, ClassSubmission } from '../../types';

interface Props {
  clubId: string;
  prompt?: ClassPrompt;
  submission?: ClassSubmission;
  onSaved: (sub: ClassSubmission) => void;
  onCancel: () => void;
}

export default function ClassSubmissionEditor({ clubId, prompt, submission, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(submission?.title ?? '');
  const [body, setBody] = useState(submission?.body ?? '');
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmitted = submission?.status === 'submitted' || submission?.status === 'graded';

  const saveDraft = useCallback(async () => {
    if (!body.trim() || isSubmitted) return;
    try {
      let saved: ClassSubmission;
      if (submission) {
        saved = await api.updateClassSubmission(clubId, submission.id, { title: title || undefined, body });
      } else {
        saved = await api.createClassSubmission(clubId, { title: title || undefined, body, prompt_id: prompt?.id, status: 'draft' });
      }
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
      onSaved(saved);
    } catch (_) {}
  }, [body, title, clubId, submission, prompt, isSubmitted]);

  // Debounced autosave every 30s
  useEffect(() => {
    if (isSubmitted) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(saveDraft, 30000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [body, title, saveDraft, isSubmitted]);

  async function handleSave(submit: boolean) {
    if (!body.trim()) return;
    setSaving(true);
    try {
      let saved: ClassSubmission;
      const payload = { title: title || undefined, body, prompt_id: prompt?.id, status: submit ? 'submitted' : 'draft' };
      if (submission) {
        saved = await api.updateClassSubmission(clubId, submission.id, { title: title || undefined, body, status: submit ? 'submitted' : 'draft' });
      } else {
        saved = await api.createClassSubmission(clubId, payload);
      }
      onSaved(saved);
      if (submit) onCancel();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-muted hover:text-theme text-sm mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to assignments
      </button>

      {/* Prompt context */}
      {prompt && (
        <div className="theme-section rounded-xl p-4 mb-6 border-l-4 border-violet-500">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
              {prompt.prompt_type}
            </span>
            {prompt.is_required && (
              <span className="text-xs text-red-500">Required</span>
            )}
          </div>
          <h2 className="font-semibold text-theme">{prompt.title}</h2>
          {prompt.body && <p className="text-sm text-muted mt-2 whitespace-pre-wrap">{prompt.body}</p>}
          {prompt.due_date && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Due: {new Date(prompt.due_date).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Feedback display (if graded) */}
      {submission?.status === 'graded' && submission.feedback && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
            {submission.feedback.grade !== undefined && submission.feedback.grade !== null
              ? `Grade: ${submission.feedback.grade}/100`
              : 'Teacher Feedback'
            }
          </p>
          {submission.feedback.feedback_text && (
            <p className="text-sm text-theme">{submission.feedback.feedback_text}</p>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="theme-section rounded-xl p-5 space-y-4">
        <input
          className="w-full theme-input rounded-lg px-3 py-2 text-sm font-medium"
          placeholder="Title (optional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={isSubmitted}
        />

        <textarea
          className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none min-h-[240px]"
          placeholder={
            prompt?.prompt_type === 'scribe'
              ? "Begin scribing what God is saying to you..."
              : "Start writing your response here..."
          }
          value={body}
          onChange={e => setBody(e.target.value)}
          disabled={isSubmitted}
          rows={12}
        />

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted">
            {body.length} characters
            {autoSaved && <span className="ml-2 text-emerald-500">Draft saved</span>}
          </div>

          {!isSubmitted && (
            <div className="flex gap-2">
              <button
                onClick={() => handleSave(false)}
                disabled={saving || !body.trim()}
                className="flex items-center gap-1.5 theme-button-secondary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Save Draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving || !body.trim()}
                className="flex items-center gap-1.5 theme-button-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {saving ? 'Submitting...' : 'Submit Assignment'}
              </button>
            </div>
          )}

          {isSubmitted && (
            <span className="text-xs text-muted italic">
              {submission?.status === 'graded' ? 'Graded — read only' : 'Submitted — read only'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
