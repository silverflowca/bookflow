import { useEffect, useState } from 'react';
import { Plus, Calendar, ExternalLink, Edit2, Trash2, Eye, EyeOff, X, Check, BookOpen, Link2, Unlink } from 'lucide-react';
import api from '../../lib/api';
import type { ClassSession, ClassPrompt } from '../../types';

function formatDate(str: string) {
  return new Date(str).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface SessionFormData {
  title: string;
  description: string;
  session_date: string;
  duration_minutes: number;
  meeting_url: string;
  notes: string;
  is_published: boolean;
}

const EMPTY_FORM: SessionFormData = {
  title: '', description: '', session_date: '', duration_minutes: 60,
  meeting_url: '', notes: '', is_published: false,
};

function SessionForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: SessionFormData;
  onSave: (data: SessionFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof SessionFormData, v: SessionFormData[typeof k]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="theme-section rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">Session Title *</label>
          <input
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Week 1 — Introduction"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Date & Time *</label>
          <input
            type="datetime-local"
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={form.session_date ? form.session_date.slice(0, 16) : ''}
            onChange={e => set('session_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Duration (minutes)</label>
          <input
            type="number"
            min={5}
            max={480}
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={form.duration_minutes}
            onChange={e => set('duration_minutes', Number(e.target.value))}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">Meeting URL</label>
          <input
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={form.meeting_url}
            onChange={e => set('meeting_url', e.target.value)}
            placeholder="https://zoom.us/j/..."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">Description</label>
          <textarea
            className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="What will be covered in this session?"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">Teacher Notes (not shown to students)</label>
          <textarea
            className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="published"
            checked={form.is_published}
            onChange={e => set('is_published', e.target.checked)}
            className="rounded"
          />
          <label htmlFor="published" className="text-sm text-theme cursor-pointer">
            Publish to students (show meeting link & details)
          </label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="theme-button-secondary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
          <X className="h-4 w-4" /> Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.title || !form.session_date}
          className="theme-button-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Session'}
        </button>
      </div>
    </div>
  );
}

/** Inline picker to link an unlinked prompt to this session */
function LinkAssignmentPicker({
  sessionId,
  clubId,
  unlinkedPrompts,
  onLinked,
  onCancel,
}: {
  sessionId: string;
  clubId: string;
  unlinkedPrompts: ClassPrompt[];
  onLinked: (prompt: ClassPrompt) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleLink() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.updateClassPrompt(clubId, selected, { session_id: sessionId });
      onLinked(updated);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  if (unlinkedPrompts.length === 0) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <p className="text-xs text-muted">No unlinked assignments. Create one in the Assignments tab first.</p>
        <button onClick={onCancel} className="text-xs text-muted hover:text-theme"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <select
        className="theme-input rounded-lg px-2 py-1.5 text-sm flex-1 min-w-0"
        value={selected}
        onChange={e => setSelected(e.target.value)}
      >
        <option value="">Select assignment…</option>
        {unlinkedPrompts.map(p => (
          <option key={p.id} value={p.id}>{p.title}</option>
        ))}
      </select>
      <button
        onClick={handleLink}
        disabled={!selected || saving}
        className="theme-button-primary px-3 py-1.5 rounded-lg text-xs disabled:opacity-50 flex items-center gap-1"
      >
        <Link2 className="h-3 w-3" /> {saving ? 'Linking…' : 'Link'}
      </button>
      <button onClick={onCancel} className="text-muted hover:text-theme">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ClassSessionsPanel({ clubId, isTeacher }: { clubId: string; isTeacher: boolean }) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [prompts, setPrompts] = useState<ClassPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkingSessionId, setLinkingSessionId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getClassSessions(clubId),
      api.getClassPrompts(clubId),
    ])
      .then(([s, p]) => { setSessions(s); setPrompts(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clubId]);

  async function handleCreate(data: SessionFormData) {
    setSaving(true);
    try {
      const s = await api.createClassSession(clubId, data as any);
      setSessions(prev => [...prev, s].sort((a, b) => a.session_date.localeCompare(b.session_date)));
      setShowForm(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, data: SessionFormData) {
    setSaving(true);
    try {
      const s = await api.updateClassSession(clubId, id, data as any);
      setSessions(prev => prev.map(x => x.id === id ? s : x));
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this session?')) return;
    await api.deleteClassSession(clubId, id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  async function togglePublish(session: ClassSession) {
    const updated = await api.updateClassSession(clubId, session.id, { is_published: !session.is_published } as any);
    setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
  }

  async function handleUnlinkPrompt(prompt: ClassPrompt) {
    try {
      const updated = await api.updateClassPrompt(clubId, prompt.id, { session_id: undefined });
      setPrompts(prev => prev.map(p => p.id === prompt.id ? updated : p));
    } catch { /* silent */ }
  }

  function handleLinked(updated: ClassPrompt) {
    setPrompts(prev => prev.map(p => p.id === updated.id ? updated : p));
    setLinkingSessionId(null);
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strong" /></div>;

  return (
    <div>
      {isTeacher && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium mb-6"
        >
          <Plus className="h-4 w-4" /> Add Session
        </button>
      )}

      {showForm && (
        <div className="mb-6">
          <SessionForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        </div>
      )}

      {sessions.length === 0 && !showForm ? (
        <div className="text-center py-16 theme-section border-dashed rounded-xl">
          <Calendar className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="font-semibold text-theme mb-2">No sessions scheduled</h3>
          <p className="text-muted text-sm">
            {isTeacher ? 'Add your first class session above.' : 'No sessions have been scheduled yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => {
            const linkedPrompts = prompts.filter(p => p.session_id === session.id);
            const unlinkedPrompts = prompts.filter(p => !p.session_id);

            return editingId === session.id ? (
              <SessionForm
                key={session.id}
                initial={{
                  title: session.title,
                  description: session.description ?? '',
                  session_date: session.session_date,
                  duration_minutes: session.duration_minutes,
                  meeting_url: session.meeting_url ?? '',
                  notes: session.notes ?? '',
                  is_published: session.is_published,
                }}
                onSave={data => handleUpdate(session.id, data)}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <div key={session.id} className="theme-section rounded-xl overflow-hidden">
                {/* Session header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-theme text-sm">{session.title}</h3>
                        {session.is_published ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Published</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Draft</span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1">{formatDate(session.session_date)} · {session.duration_minutes} min</p>
                      {session.description && <p className="text-sm text-theme mt-2">{session.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {session.meeting_url && (
                        <a
                          href={session.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs theme-button-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Join
                        </a>
                      )}
                      {isTeacher && (
                        <>
                          <button
                            onClick={() => togglePublish(session)}
                            title={session.is_published ? 'Unpublish' : 'Publish'}
                            className="p-1.5 rounded-lg text-muted hover:text-theme transition-colors"
                          >
                            {session.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setEditingId(session.id)}
                            className="p-1.5 rounded-lg text-muted hover:text-theme transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(session.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Linked assignments */}
                  {(linkedPrompts.length > 0 || isTeacher) && (
                    <div className="mt-3 pt-3 border-t border-strong/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" /> Assignments ({linkedPrompts.length})
                        </span>
                        {isTeacher && linkingSessionId !== session.id && (
                          <button
                            onClick={() => setLinkingSessionId(session.id)}
                            className="text-xs text-accent hover:underline flex items-center gap-1"
                          >
                            <Link2 className="h-3 w-3" /> Link assignment
                          </button>
                        )}
                      </div>

                      {linkedPrompts.length === 0 && linkingSessionId !== session.id && (
                        <p className="text-xs text-muted italic">No assignments linked to this session.</p>
                      )}

                      {linkedPrompts.map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-1.5 group">
                          <BookOpen className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                          <span className="text-sm text-theme flex-1 truncate">{p.title}</span>
                          <span className="text-xs text-muted capitalize">{p.prompt_type}</span>
                          {p.is_required && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Required</span>
                          )}
                          {isTeacher && (
                            <button
                              onClick={() => handleUnlinkPrompt(p)}
                              title="Unlink from session"
                              className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all p-0.5"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {isTeacher && linkingSessionId === session.id && (
                        <LinkAssignmentPicker
                          sessionId={session.id}
                          clubId={clubId}
                          unlinkedPrompts={unlinkedPrompts}
                          onLinked={handleLinked}
                          onCancel={() => setLinkingSessionId(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
