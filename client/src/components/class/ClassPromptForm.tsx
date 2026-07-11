import { useState } from 'react';
import { X, Check } from 'lucide-react';
import api from '../../lib/api';
import type { ClassPrompt, ClassPromptType } from '../../types';

interface Props {
  clubId: string;
  initial: ClassPrompt | null;
  onSaved: (prompt: ClassPrompt) => void;
  onCancel: () => void;
}

export default function ClassPromptForm({ clubId, initial, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [promptType, setPromptType] = useState<ClassPromptType>(initial?.prompt_type ?? 'journal');
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? false);
  const [dueDate, setDueDate] = useState(initial?.due_date ? initial.due_date.slice(0, 16) : '');
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        body: body.trim() || undefined,
        prompt_type: promptType,
        is_required: isRequired,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        sort_order: sortOrder,
      };
      let saved: ClassPrompt;
      if (initial) {
        saved = await api.updateClassPrompt(clubId, initial.id, payload);
      } else {
        saved = await api.createClassPrompt(clubId, payload);
      }
      onSaved(saved);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const TYPES: ClassPromptType[] = ['journal', 'essay', 'assignment', 'scribe'];

  return (
    <div className="theme-section rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-theme text-sm">{initial ? 'Edit Assignment' : 'New Assignment'}</h3>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div>
        <label className="block text-xs text-muted mb-1">Title *</label>
        <input
          className="w-full theme-input rounded-lg px-3 py-2 text-sm"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Chapter 1 Journal"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Assignment Instructions</label>
        <textarea
          className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none"
          rows={3}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Describe the assignment, question, or journalling prompt..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1">Type</label>
          <select
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={promptType}
            onChange={e => setPromptType(e.target.value as ClassPromptType)}
          >
            {TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Sort Order</label>
          <input
            type="number"
            min={0}
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={sortOrder}
            onChange={e => setSortOrder(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Due Date (optional)</label>
          <input
            type="datetime-local"
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-theme">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={e => setIsRequired(e.target.checked)}
              className="rounded"
            />
            Required
          </label>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="theme-button-secondary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
          <X className="h-4 w-4" /> Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="theme-button-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
