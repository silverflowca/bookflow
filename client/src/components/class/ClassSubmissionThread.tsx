/**
 * ClassSubmissionThread
 *
 * Threaded comment panel on a class submission.
 * - Teacher and student can post comments back and forth
 * - Each comment can optionally reference a book chapter or Q&A response
 * - Student can leave a note replying to teacher's grade/feedback
 * - Teacher can add a follow-up note after the student replies
 *
 * Used in:
 *   ClassSubmissionsPanel   — inline expansion under each submission card
 *   ClassStudentDetailPanel — in the Assignments tab
 */

import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, MessageSquare, BookOpen, ChevronDown, ChevronUp, Star } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { SubmissionComment, ClassSubmissionFeedback } from '../../types';

interface Props {
  clubId: string;
  submissionId: string;
  /** feedback already loaded by parent — used to show grade + reply loop */
  feedback?: ClassSubmissionFeedback | null;
  isTeacher: boolean;
  /** chapter context to attach to new comments (optional) */
  chapterId?: string;
  /** Q&A response context to attach to new comments (optional) */
  responseId?: string;
  /** chapter title for display in context pill */
  chapterTitle?: string;
  onFeedbackUpdated?: (fb: ClassSubmissionFeedback) => void;
}

function Avatar({ name, url, size = 7 }: { name: string; url?: string; size?: number }) {
  const sz = `w-${size} h-${size}`;
  if (url) return <img src={url} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-semibold text-[10px]">{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

function CommentBubble({
  comment,
  isMine,
  onDelete,
}: {
  comment: SubmissionComment;
  isMine: boolean;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    setDeleting(true);
    onDelete(comment.id);
  }
  const time = new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className={`flex gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar name={comment.author.display_name} url={comment.author.avatar_url} size={7} />
      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        <div className={`flex items-center gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[11px] font-medium text-muted">{comment.author.display_name}</span>
          <span className="text-[10px] text-muted/60">{time}</span>
        </div>
        {comment.chapter_id && comment.chapter_id && (
          <div className={`flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-violet-500 flex items-center gap-0.5">
              <BookOpen className="h-2.5 w-2.5" /> Chapter context
            </span>
          </div>
        )}
        <div className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed ${
          isMine
            ? 'bg-violet-600 text-white rounded-tr-sm'
            : 'bg-strong/10 text-theme rounded-tl-sm'
        }`}>
          {comment.body}
          {isMine && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClassSubmissionThread({
  clubId, submissionId, feedback, isTeacher, chapterId, responseId, chapterTitle, onFeedbackUpdated,
}: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [studentNote, setStudentNote] = useState(feedback?.student_note ?? '');
  const [followUp, setFollowUp] = useState(feedback?.teacher_follow_up ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [showFeedbackThread, setShowFeedbackThread] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStudentNote(feedback?.student_note ?? '');
    setFollowUp(feedback?.teacher_follow_up ?? '');
  }, [feedback]);

  useEffect(() => {
    api.getSubmissionComments(clubId, submissionId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clubId, submissionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const comment = await api.postSubmissionComment(clubId, submissionId, input.trim(), {
        chapter_id: chapterId,
        response_id: responseId,
      });
      setComments(prev => [...prev, comment]);
      setInput('');
    } catch (_) {}
    setSending(false);
  }

  async function handleDelete(commentId: string) {
    await api.deleteSubmissionComment(clubId, submissionId, commentId).catch(() => {});
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  async function handleStudentNote() {
    setSavingNote(true);
    try {
      const fb = await api.studentNoteOnFeedback(clubId, submissionId, studentNote);
      onFeedbackUpdated?.(fb);
    } catch (_) {}
    setSavingNote(false);
  }

  async function handleFollowUp() {
    setSavingNote(true);
    try {
      const fb = await api.teacherFollowUpOnFeedback(clubId, submissionId, followUp);
      onFeedbackUpdated?.(fb);
    } catch (_) {}
    setSavingNote(false);
  }

  const hasFeedback = feedback && (feedback.grade != null || feedback.feedback_text);
  const hasStudentNote = feedback?.student_note;
  const hasFollowUp = feedback?.teacher_follow_up;

  return (
    <div className="space-y-4">

      {/* ── Feedback thread (grade → student note → teacher follow-up) ── */}
      {hasFeedback && (
        <div className="rounded-xl border border-strong/10 overflow-hidden">
          <button
            onClick={() => setShowFeedbackThread(p => !p)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-strong/5 hover:bg-strong/10 transition-colors text-left"
          >
            <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-theme flex-1">
              Feedback {feedback.grade != null ? `· ${feedback.grade}/100` : ''}
            </span>
            {showFeedbackThread ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
          </button>

          {showFeedbackThread && (
            <div className="px-3 pb-3 pt-2 space-y-3">
              {/* Teacher's grade + feedback */}
              <div className="flex gap-2">
                <div className="w-1 bg-amber-400 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  {feedback.grade != null && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-theme">{feedback.grade}</span>
                      <span className="text-xs text-muted">/100</span>
                    </div>
                  )}
                  {feedback.feedback_text && (
                    <p className="text-sm text-theme">{feedback.feedback_text}</p>
                  )}
                  <p className="text-[10px] text-muted">
                    {new Date(feedback.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Student reply to feedback */}
              {hasStudentNote ? (
                <div className="flex gap-2 ml-3">
                  <div className="w-1 bg-violet-400 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <p className="text-[10px] text-muted font-medium">Student replied</p>
                    <p className="text-sm text-theme">{feedback.student_note}</p>
                    {feedback.student_noted_at && (
                      <p className="text-[10px] text-muted">{new Date(feedback.student_noted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                    )}
                  </div>
                </div>
              ) : !isTeacher ? (
                <div className="ml-3 space-y-1.5">
                  <p className="text-[11px] text-muted">Reply to your teacher's feedback:</p>
                  <textarea
                    className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none"
                    rows={3}
                    value={studentNote}
                    onChange={e => setStudentNote(e.target.value)}
                    placeholder="Thank you, I've revised... / I have a question about..."
                  />
                  <button
                    onClick={handleStudentNote}
                    disabled={!studentNote.trim() || savingNote}
                    className="theme-button-primary px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
                  >
                    {savingNote ? 'Saving…' : 'Send Reply'}
                  </button>
                </div>
              ) : null}

              {/* Teacher follow-up after student replied */}
              {hasStudentNote && isTeacher && (
                hasFollowUp ? (
                  <div className="flex gap-2 ml-6">
                    <div className="w-1 bg-emerald-400 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-0.5">
                      <p className="text-[10px] text-muted font-medium">Teacher follow-up</p>
                      <p className="text-sm text-theme">{feedback.teacher_follow_up}</p>
                    </div>
                  </div>
                ) : (
                  <div className="ml-6 space-y-1.5">
                    <p className="text-[11px] text-muted">Follow-up to student's reply:</p>
                    <textarea
                      className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none"
                      rows={2}
                      value={followUp}
                      onChange={e => setFollowUp(e.target.value)}
                      placeholder="Great revision! Updated grade coming..."
                    />
                    <button
                      onClick={handleFollowUp}
                      disabled={!followUp.trim() || savingNote}
                      className="theme-button-primary px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
                    >
                      {savingNote ? 'Saving…' : 'Send Follow-up'}
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Comment thread ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">
            Comments {comments.length > 0 ? `(${comments.length})` : ''}
          </span>
          {chapterTitle && (
            <span className="text-[10px] text-violet-500 flex items-center gap-0.5 ml-auto">
              <BookOpen className="h-2.5 w-2.5" /> {chapterTitle}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-xs text-muted text-center py-3">Loading…</div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted text-center py-3 italic">
            {isTeacher ? 'Leave a comment to start the conversation.' : 'No comments yet. Your teacher will respond here.'}
          </p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {comments.map(c => (
              <CommentBubble
                key={c.id}
                comment={c}
                isMine={c.author_id === user?.id}
                onDelete={handleDelete}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 mt-3">
          <input
            className="flex-1 theme-input rounded-xl px-3 py-2 text-sm"
            placeholder={isTeacher ? 'Comment on this submission…' : 'Reply to teacher…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="theme-button-primary px-3 py-2 rounded-xl disabled:opacity-50 flex items-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
