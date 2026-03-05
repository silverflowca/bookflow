import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  InlineContent, InlineDisplayMode, SelectData, MultiselectData, TextboxData, TextareaData,
  RadioData, CheckboxData, CodeBlockData, ScriptureBlockData
} from '../../types';

interface FormProps {
  onSubmit: (data: Partial<InlineContent>) => void;
  onClose: () => void;
  isEditing?: boolean;
}

// Display mode selector component
function DisplayModeSelector({
  value,
  onChange
}: {
  value: InlineDisplayMode;
  onChange: (mode: InlineDisplayMode) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">Display Mode</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as InlineDisplayMode)}
        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
      >
        <option value="inline">Inline (directly in text)</option>
        <option value="sidebar">Sidebar (click to view)</option>
        <option value="start_of_chapter">Start of Chapter</option>
        <option value="end_of_chapter">End of Chapter</option>
      </select>
      <p className="text-xs text-gray-500 mt-1">
        {value === 'inline' && 'Form appears directly within the text where readers can interact with it.'}
        {value === 'sidebar' && 'Text is highlighted and readers click to view the form in a side panel.'}
        {value === 'start_of_chapter' && 'Form appears at the beginning of the chapter.'}
        {value === 'end_of_chapter' && 'Form appears at the end of the chapter.'}
      </p>
    </div>
  );
}

function FormButtons({
  onClose,
  disabled = false,
  loading = false,
  loadingText = 'Processing...',
  submitText = 'Add'
}: {
  onClose: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  submitText?: string;
}) {
  return (
    <div className="flex gap-3 pt-4 border-t">
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        className="flex-1 px-4 py-2 border rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            {loadingText}
          </>
        ) : (
          submitText
        )}
      </button>
    </div>
  );
}

export function SelectForm({ onSubmit, onClose, initialData, isEditing, initialDisplayMode }: FormProps & { initialData?: SelectData; initialDisplayMode?: InlineDisplayMode }) {
  const [label, setLabel] = useState(initialData?.label || '');
  const [placeholder, setPlaceholder] = useState(initialData?.placeholder || '');
  const [options, setOptions] = useState<{ id: string; text: string }[]>(
    initialData?.options || [{ id: 'opt_1', text: '' }]
  );
  const [required, setRequired] = useState(initialData?.required || false);
  const [displayMode, setDisplayMode] = useState<InlineDisplayMode>(initialDisplayMode || 'inline');

  const addOption = () => {
    setOptions([...options, { id: `opt_${Date.now()}`, text: '' }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: SelectData = {
      label,
      placeholder: placeholder || undefined,
      options: options.filter(o => o.text.trim()),
      required,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers', display_mode: displayMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          required
          placeholder="Select an option..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Placeholder (optional)</label>
        <input
          type="text"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="Choose..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Options</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={opt.id} className="flex gap-2">
              <input
                type="text"
                value={opt.text}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[i].text = e.target.value;
                  setOptions(newOptions);
                }}
                className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
                placeholder={`Option ${i + 1}`}
              />
              {options.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-4 w-4" /> Add Option
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span className="text-sm">Required</span>
      </label>

      <DisplayModeSelector value={displayMode} onChange={setDisplayMode} />

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

export function MultiselectForm({ onSubmit, onClose, initialData, isEditing, initialDisplayMode }: FormProps & { initialData?: MultiselectData; initialDisplayMode?: InlineDisplayMode }) {
  const [label, setLabel] = useState(initialData?.label || '');
  const [placeholder, setPlaceholder] = useState(initialData?.placeholder || '');
  const [options, setOptions] = useState<{ id: string; text: string }[]>(
    initialData?.options || [{ id: 'opt_1', text: '' }]
  );
  const [required, setRequired] = useState(initialData?.required || false);
  const [minSelections, setMinSelections] = useState(initialData?.min_selections?.toString() || '');
  const [maxSelections, setMaxSelections] = useState(initialData?.max_selections?.toString() || '');
  const [displayMode, setDisplayMode] = useState<InlineDisplayMode>(initialDisplayMode || 'inline');

  const addOption = () => {
    setOptions([...options, { id: `opt_${Date.now()}`, text: '' }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: MultiselectData = {
      label,
      placeholder: placeholder || undefined,
      options: options.filter(o => o.text.trim()),
      required,
      min_selections: minSelections ? parseInt(minSelections) : undefined,
      max_selections: maxSelections ? parseInt(maxSelections) : undefined,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers', display_mode: displayMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          required
          placeholder="Select multiple options..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Placeholder (optional)</label>
        <input
          type="text"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="Select options..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Options</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={opt.id} className="flex gap-2">
              <input
                type="text"
                value={opt.text}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[i].text = e.target.value;
                  setOptions(newOptions);
                }}
                className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
                placeholder={`Option ${i + 1}`}
              />
              {options.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-4 w-4" /> Add Option
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Min Selections</label>
          <input
            type="number"
            value={minSelections}
            onChange={(e) => setMinSelections(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            min="0"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Selections</label>
          <input
            type="number"
            value={maxSelections}
            onChange={(e) => setMaxSelections(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            min="1"
            placeholder="No limit"
          />
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span className="text-sm">Required</span>
      </label>

      <DisplayModeSelector value={displayMode} onChange={setDisplayMode} />

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

export function TextboxForm({ onSubmit, onClose, initialData, isEditing, initialDisplayMode }: FormProps & { initialData?: TextboxData; initialDisplayMode?: InlineDisplayMode }) {
  const [label, setLabel] = useState(initialData?.label || '');
  const [placeholder, setPlaceholder] = useState(initialData?.placeholder || '');
  const [required, setRequired] = useState(initialData?.required || false);
  const [maxLength, setMaxLength] = useState(initialData?.max_length?.toString() || '');
  const [defaultValue, setDefaultValue] = useState(initialData?.default_value || '');
  const [displayMode, setDisplayMode] = useState<InlineDisplayMode>(initialDisplayMode || 'inline');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: TextboxData = {
      label,
      placeholder: placeholder || undefined,
      required,
      max_length: maxLength ? parseInt(maxLength) : undefined,
      default_value: defaultValue || undefined,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers', display_mode: displayMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          required
          placeholder="Enter your response..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Placeholder (optional)</label>
        <input
          type="text"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="Type here..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Default Value (optional)</label>
        <input
          type="text"
          value={defaultValue}
          onChange={(e) => setDefaultValue(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="Pre-filled value"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Max Length (optional)</label>
        <input
          type="number"
          value={maxLength}
          onChange={(e) => setMaxLength(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          min="1"
          placeholder="No limit"
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span className="text-sm">Required</span>
      </label>

      <DisplayModeSelector value={displayMode} onChange={setDisplayMode} />

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

export function TextareaForm({ onSubmit, onClose, initialData, isEditing, initialDisplayMode }: FormProps & { initialData?: TextareaData; initialDisplayMode?: InlineDisplayMode }) {
  const [label, setLabel] = useState(initialData?.label || '');
  const [placeholder, setPlaceholder] = useState(initialData?.placeholder || '');
  const [required, setRequired] = useState(initialData?.required || false);
  const [maxLength, setMaxLength] = useState(initialData?.max_length?.toString() || '');
  const [rows, setRows] = useState(initialData?.rows?.toString() || '4');
  const [defaultValue, setDefaultValue] = useState(initialData?.default_value || '');
  const [displayMode, setDisplayMode] = useState<InlineDisplayMode>(initialDisplayMode || 'inline');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: TextareaData = {
      label,
      placeholder: placeholder || undefined,
      required,
      max_length: maxLength ? parseInt(maxLength) : undefined,
      rows: rows ? parseInt(rows) : 4,
      default_value: defaultValue || undefined,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers', display_mode: displayMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          required
          placeholder="Enter your detailed response..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Placeholder (optional)</label>
        <input
          type="text"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="Type your response here..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Default Value (optional)</label>
        <textarea
          value={defaultValue}
          onChange={(e) => setDefaultValue(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder="Pre-filled text"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Rows</label>
          <input
            type="number"
            value={rows}
            onChange={(e) => setRows(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            min="2"
            max="20"
            placeholder="4"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Length</label>
          <input
            type="number"
            value={maxLength}
            onChange={(e) => setMaxLength(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            min="1"
            placeholder="No limit"
          />
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span className="text-sm">Required</span>
      </label>

      <DisplayModeSelector value={displayMode} onChange={setDisplayMode} />

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

export function RadioForm({ onSubmit, onClose, initialData, isEditing, initialDisplayMode }: FormProps & { initialData?: RadioData; initialDisplayMode?: InlineDisplayMode }) {
  const [label, setLabel] = useState(initialData?.label || '');
  const [options, setOptions] = useState<{ id: string; text: string; description?: string }[]>(
    initialData?.options || [{ id: 'opt_1', text: '' }]
  );
  const [required, setRequired] = useState(initialData?.required || false);
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>(initialData?.layout || 'vertical');
  const [displayMode, setDisplayMode] = useState<InlineDisplayMode>(initialDisplayMode || 'inline');

  const addOption = () => {
    setOptions([...options, { id: `opt_${Date.now()}`, text: '' }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: RadioData = {
      label,
      options: options.filter(o => o.text.trim()),
      required,
      layout,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers', display_mode: displayMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          required
          placeholder="Select one option..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Options</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={opt.id} className="space-y-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => {
                    const newOptions = [...options];
                    newOptions[i].text = e.target.value;
                    setOptions(newOptions);
                  }}
                  className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
                  placeholder={`Option ${i + 1}`}
                />
                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={opt.description || ''}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[i].description = e.target.value || undefined;
                  setOptions(newOptions);
                }}
                className="w-full px-3 py-1 text-sm border rounded focus:ring-2 focus:ring-primary-500"
                placeholder="Description (optional)"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-4 w-4" /> Add Option
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Layout</label>
        <select
          value={layout}
          onChange={(e) => setLayout(e.target.value as 'vertical' | 'horizontal')}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span className="text-sm">Required</span>
      </label>

      <DisplayModeSelector value={displayMode} onChange={setDisplayMode} />

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

export function CheckboxForm({ onSubmit, onClose, initialData, isEditing, initialDisplayMode }: FormProps & { initialData?: CheckboxData; initialDisplayMode?: InlineDisplayMode }) {
  const [label, setLabel] = useState(initialData?.label || '');
  const [options, setOptions] = useState<{ id: string; text: string; description?: string }[]>(
    initialData?.options || [{ id: 'opt_1', text: '' }]
  );
  const [required, setRequired] = useState(initialData?.required || false);
  const [minSelections, setMinSelections] = useState(initialData?.min_selections?.toString() || '');
  const [maxSelections, setMaxSelections] = useState(initialData?.max_selections?.toString() || '');
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>(initialData?.layout || 'vertical');
  const [displayMode, setDisplayMode] = useState<InlineDisplayMode>(initialDisplayMode || 'inline');

  const addOption = () => {
    setOptions([...options, { id: `opt_${Date.now()}`, text: '' }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: CheckboxData = {
      label,
      options: options.filter(o => o.text.trim()),
      required,
      min_selections: minSelections ? parseInt(minSelections) : undefined,
      max_selections: maxSelections ? parseInt(maxSelections) : undefined,
      layout,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers', display_mode: displayMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          required
          placeholder="Select all that apply..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Options</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={opt.id} className="space-y-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => {
                    const newOptions = [...options];
                    newOptions[i].text = e.target.value;
                    setOptions(newOptions);
                  }}
                  className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
                  placeholder={`Option ${i + 1}`}
                />
                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={opt.description || ''}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[i].description = e.target.value || undefined;
                  setOptions(newOptions);
                }}
                className="w-full px-3 py-1 text-sm border rounded focus:ring-2 focus:ring-primary-500"
                placeholder="Description (optional)"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-4 w-4" /> Add Option
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Min Selections</label>
          <input
            type="number"
            value={minSelections}
            onChange={(e) => setMinSelections(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            min="0"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Selections</label>
          <input
            type="number"
            value={maxSelections}
            onChange={(e) => setMaxSelections(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            min="1"
            placeholder="No limit"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Layout</label>
        <select
          value={layout}
          onChange={(e) => setLayout(e.target.value as 'vertical' | 'horizontal')}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span className="text-sm">Required</span>
      </label>

      <DisplayModeSelector value={displayMode} onChange={setDisplayMode} />

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

export function CodeBlockForm({ onSubmit, onClose, initialData, isEditing, initialDisplayMode }: FormProps & { initialData?: CodeBlockData; initialDisplayMode?: InlineDisplayMode }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [language, setLanguage] = useState(initialData?.language || 'javascript');
  const [code, setCode] = useState(initialData?.code || '');
  const [lineNumbers, setLineNumbers] = useState(initialData?.line_numbers !== false);
  const [caption, setCaption] = useState(initialData?.caption || '');
  const [displayMode, setDisplayMode] = useState<InlineDisplayMode>(initialDisplayMode || 'inline');

  const languages = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'csharp', label: 'C#' },
    { value: 'cpp', label: 'C++' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'php', label: 'PHP' },
    { value: 'swift', label: 'Swift' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'sql', label: 'SQL' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'json', label: 'JSON' },
    { value: 'yaml', label: 'YAML' },
    { value: 'bash', label: 'Bash/Shell' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'plaintext', label: 'Plain Text' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: CodeBlockData = {
      title: title || undefined,
      language,
      code,
      line_numbers: lineNumbers,
      caption: caption || undefined,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers', display_mode: displayMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="Code Example"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
        >
          {languages.map(lang => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Code</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500 font-mono text-sm"
          rows={10}
          required
          placeholder="// Enter your code here..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Caption (optional)</label>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="Figure 1: Example code"
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={lineNumbers}
          onChange={(e) => setLineNumbers(e.target.checked)}
        />
        <span className="text-sm">Show line numbers</span>
      </label>

      <DisplayModeSelector value={displayMode} onChange={setDisplayMode} />

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

export function ScriptureBlockForm({ onSubmit, onClose, initialData, isEditing, initialDisplayMode }: FormProps & { initialData?: ScriptureBlockData; initialDisplayMode?: InlineDisplayMode }) {
  const [reference, setReference] = useState(initialData?.reference || '');
  const [version, setVersion] = useState(initialData?.version || 'KJV');
  const [text, setText] = useState(initialData?.text || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [showReference, setShowReference] = useState(initialData?.show_reference !== false);
  const [displayMode, setDisplayMode] = useState<InlineDisplayMode>(initialDisplayMode || 'inline');

  const versions = [
    { value: 'KJV', label: 'King James Version (KJV)' },
    { value: 'NKJV', label: 'New King James Version (NKJV)' },
    { value: 'NIV', label: 'New International Version (NIV)' },
    { value: 'ESV', label: 'English Standard Version (ESV)' },
    { value: 'NASB', label: 'New American Standard Bible (NASB)' },
    { value: 'NLT', label: 'New Living Translation (NLT)' },
    { value: 'CSB', label: 'Christian Standard Bible (CSB)' },
    { value: 'AMP', label: 'Amplified Bible (AMP)' },
    { value: 'MSG', label: 'The Message (MSG)' },
    { value: 'Other', label: 'Other' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: ScriptureBlockData = {
      reference,
      version: version || undefined,
      text,
      title: title || undefined,
      notes: notes || undefined,
      show_reference: showReference,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers', display_mode: displayMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="The Promise of Salvation"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Reference</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            required
            placeholder="John 3:16"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Version</label>
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          >
            {versions.map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Scripture Text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          rows={4}
          required
          placeholder="For God so loved the world..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Author Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder="Additional context or commentary..."
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showReference}
          onChange={(e) => setShowReference(e.target.checked)}
        />
        <span className="text-sm">Show reference below text</span>
      </label>

      <DisplayModeSelector value={displayMode} onChange={setDisplayMode} />

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}
