import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Check, AlertCircle, GripVertical, X } from 'lucide-react';
import api from '../../lib/api';
import type { RegistrationField, ClubRegistrationSettings } from '../../types';

interface Props {
  clubId: string;
  settings: ClubRegistrationSettings;
  onSaved: (updated: ClubRegistrationSettings) => void;
}

type FieldType = RegistrationField['type'];

const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: 'textbox', label: 'Short Text', icon: '🔤' },
  { type: 'textarea', label: 'Long Text', icon: '📝' },
  { type: 'select', label: 'Dropdown', icon: '⬇️' },
  { type: 'radio', label: 'Multiple Choice', icon: '🔘' },
  { type: 'checkbox', label: 'Checkboxes', icon: '☑️' },
  { type: 'signature', label: 'Signature', icon: '✍️' },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeField(type: FieldType): RegistrationField {
  return {
    id: genId(),
    type,
    label: FIELD_TYPES.find(t => t.type === type)?.label || type,
    required: false,
    options: ['select', 'radio', 'checkbox'].includes(type) ? ['Option 1', 'Option 2'] : undefined,
  };
}

export default function RegistrationFormBuilder({ clubId, settings, onSaved }: Props) {
  const [fields, setFields] = useState<RegistrationField[]>(settings.registration_fields || []);
  const [enabled, setEnabled] = useState(settings.registration_enabled ?? false);
  const [welcomeHeading, setWelcomeHeading] = useState(settings.welcome_heading || 'Welcome!');
  const [welcomeBody, setWelcomeBody] = useState(settings.welcome_body || '');
  const [welcomeCta, setWelcomeCta] = useState(settings.welcome_cta_label || 'Go to Class');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  function addField(type: FieldType) {
    const f = makeField(type);
    setFields(prev => [...prev, f]);
    setEditingField(f.id);
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id));
    if (editingField === id) setEditingField(null);
  }

  function updateField(id: string, patch: Partial<RegistrationField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  function moveField(id: string, dir: -1 | 1) {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function updateOption(fieldId: string, optIdx: number, val: string) {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f;
      const opts = [...(f.options || [])];
      opts[optIdx] = val;
      return { ...f, options: opts };
    }));
  }

  function addOption(fieldId: string) {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f;
      return { ...f, options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] };
    }));
  }

  function removeOption(fieldId: string, optIdx: number) {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f;
      return { ...f, options: (f.options || []).filter((_, i) => i !== optIdx) };
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await api.updateClubRegistrationSettings(clubId, {
        registration_enabled: enabled,
        registration_fields: fields,
        welcome_heading: welcomeHeading,
        welcome_body: welcomeBody,
        welcome_cta_label: welcomeCta,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved({
        registration_bg_url: settings.registration_bg_url,
        ...updated,
        registration_enabled: enabled,
        registration_fields: fields,
        welcome_heading: welcomeHeading,
        welcome_body: welcomeBody,
        welcome_cta_label: welcomeCta,
      });
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-theme">Enable Registration Form</p>
          <p className="text-xs text-muted mt-0.5">When enabled, invite links send people to your registration flow instead of auto-joining.</p>
        </div>
        <button
          onClick={() => setEnabled(prev => !prev)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-strong/20'}`}
        >
          <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Field list */}
      <div className="space-y-2">
        {fields.map((field, idx) => (
          <div key={field.id} className="border border-theme rounded-xl overflow-hidden">
            {/* Field header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 bg-surface hover:bg-surface-hover cursor-pointer transition-colors"
              onClick={() => setEditingField(editingField === field.id ? null : field.id)}
            >
              <GripVertical className="h-4 w-4 text-muted flex-shrink-0" />
              <span className="text-xs flex-shrink-0">{FIELD_TYPES.find(t => t.type === field.type)?.icon}</span>
              <span className="text-sm font-medium text-theme flex-1 truncate">{field.label}</span>
              {field.required && <span className="text-xs text-red-500 flex-shrink-0">required</span>}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); moveField(field.id, -1); }} disabled={idx === 0} className="p-1 text-muted hover:text-theme disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); moveField(field.id, 1); }} disabled={idx === fields.length - 1} className="p-1 text-muted hover:text-theme disabled:opacity-30">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); removeField(field.id); }} className="p-1 text-muted hover:text-red-500 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Field editor */}
            {editingField === field.id && (
              <div className="px-4 py-3 border-t border-theme bg-surface space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Label</label>
                  <input
                    className="w-full theme-input rounded-lg px-3 py-1.5 text-sm"
                    value={field.label}
                    onChange={e => updateField(field.id, { label: e.target.value })}
                    placeholder="Field label"
                  />
                </div>

                {field.type === 'textbox' && (
                  <div>
                    <label className="block text-xs text-muted mb-1">Placeholder (optional)</label>
                    <input
                      className="w-full theme-input rounded-lg px-3 py-1.5 text-sm"
                      value={field.placeholder || ''}
                      onChange={e => updateField(field.id, { placeholder: e.target.value })}
                      placeholder="e.g. Enter your answer..."
                    />
                  </div>
                )}

                {['select', 'radio', 'checkbox'].includes(field.type) && (
                  <div>
                    <label className="block text-xs text-muted mb-1.5">Options</label>
                    <div className="space-y-1.5">
                      {(field.options || []).map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            className="flex-1 theme-input rounded-lg px-2.5 py-1.5 text-sm"
                            value={opt}
                            onChange={e => updateOption(field.id, i, e.target.value)}
                          />
                          <button onClick={() => removeOption(field.id, i)} className="text-muted hover:text-red-500 p-1">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => addOption(field.id)} className="text-xs text-accent hover:underline flex items-center gap-1">
                        <Plus className="h-3 w-3" /> Add option
                      </button>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${field.required ? 'bg-accent border-accent' : 'border-strong/40'}`}>
                    {field.required && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <input type="checkbox" className="sr-only" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} />
                  <span className="text-sm text-theme">Required</span>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add field picker */}
      <div>
        <p className="text-xs text-muted mb-2">Add a field</p>
        <div className="grid grid-cols-3 gap-2">
          {FIELD_TYPES.map(ft => (
            <button
              key={ft.type}
              onClick={() => addField(ft.type)}
              className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-theme bg-surface hover:bg-surface-hover transition-colors text-center"
            >
              <span className="text-lg">{ft.icon}</span>
              <span className="text-xs text-muted">{ft.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Welcome page */}
      <div className="border border-theme rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-theme">Welcome Page</p>
        <div>
          <label className="block text-xs text-muted mb-1">Heading</label>
          <input
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={welcomeHeading}
            onChange={e => setWelcomeHeading(e.target.value)}
            placeholder="Welcome!"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Body text (optional)</label>
          <textarea
            className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            value={welcomeBody}
            onChange={e => setWelcomeBody(e.target.value)}
            placeholder="We're so glad you're here…"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Button label</label>
          <input
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={welcomeCta}
            onChange={e => setWelcomeCta(e.target.value)}
            placeholder="Go to Class"
          />
        </div>
      </div>

      {saveError && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> {saveError}
        </p>
      )}

      <div className="flex items-center justify-between">
        {saved ? <span className="text-xs text-emerald-500 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Saved</span> : <span />}
        <button
          onClick={handleSave}
          disabled={saving}
          className="theme-button-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Registration Form'}
        </button>
      </div>
    </div>
  );
}
