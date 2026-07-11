import { useState } from 'react';
import { X, Star } from 'lucide-react';
import api from '../../lib/api';
import type { ClassSubmission } from '../../types';

interface Props {
  clubId: string;
  submission: ClassSubmission;
  onSaved: (sub: ClassSubmission) => void;
  onClose: () => void;
}

export default function ClassFeedbackModal({ clubId, submission, onSaved, onClose }: Props) {
  const profile = Array.isArray(submission.student) ? submission.student[0] : submission.student;
  const [grade, setGrade] = useState<string>(
    submission.feedback?.grade !== undefined && submission.feedback.grade !== null
      ? String(submission.feedback.grade)
      : ''
  );
  const [feedbackText, setFeedbackText] = useState(submission.feedback?.feedback_text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const gradeNum = grade !== '' ? Number(grade) : undefined;
    if (gradeNum !== undefined && (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100)) {
      setError('Grade must be 0–100');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.postSubmissionFeedback(clubId, submission.id, {
        grade: gradeNum,
        feedback_text: feedbackText.trim() || undefined,
      });
      // Optimistically update the submission
      const updated: ClassSubmission = {
        ...submission,
        status: 'graded',
        feedback: {
          id: submission.feedback?.id ?? '',
          submission_id: submission.id,
          club_id: clubId,
          created_by: '',
          grade: gradeNum,
          feedback_text: feedbackText.trim() || undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
      onSaved(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-section rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-strong/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : (profile?.display_name ?? 'S').charAt(0)
              }
            </div>
            <div>
              <p className="font-semibold text-theme text-sm">{profile?.display_name ?? 'Student'}</p>
              {submission.prompt && (
                <p className="text-xs text-muted">{submission.prompt.title}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-theme transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Student's submission */}
        <div className="p-5 border-b border-strong/20">
          {submission.title && <h3 className="font-semibold text-theme mb-2">{submission.title}</h3>}
          <p className="text-sm text-theme whitespace-pre-wrap max-h-48 overflow-y-auto">{submission.body}</p>
          <p className="text-xs text-muted mt-2">
            Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : ''}
          </p>
        </div>

        {/* Feedback form */}
        <div className="p-5 space-y-4">
          <h3 className="font-semibold text-theme text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" /> Teacher Feedback
          </h3>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div>
            <label className="block text-xs text-muted mb-1">Grade (0–100, optional)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="w-32 theme-input rounded-lg px-3 py-2 text-sm"
              value={grade}
              onChange={e => setGrade(e.target.value)}
              placeholder="—"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Feedback Comment</label>
            <textarea
              className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none"
              rows={4}
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="Write your feedback for the student..."
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="theme-button-secondary px-4 py-2 rounded-lg text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="theme-button-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
