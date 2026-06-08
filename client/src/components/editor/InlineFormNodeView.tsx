import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type {
  TextboxData, TextareaData, SelectData, MultiselectData, RadioData, CheckboxData,
} from '../../types/index';

type FormType = 'textbox' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'audio' | 'video' | 'image';
type Position = 'inline' | 'start_of_chapter' | 'end_of_chapter';

// ─── Inline widget previews (read-only) ─────────────────────────────────────

const WIDTH_STYLE: Record<string, React.CSSProperties> = {
  xs:   { width: 80 },
  sm:   { width: 120 },
  md:   { width: 200 },
  lg:   { width: 320 },
  full: { flexGrow: 1, minWidth: 200 },
};

function FormPreview({ contentType, contentData }: { contentType: FormType; contentData: any }) {
  switch (contentType) {
    case 'textbox': {
      const d = contentData as TextboxData;
      const isFull = (d.width ?? 'md') === 'full';
      return (
        <span className={`${isFull ? 'flex flex-1 min-w-0' : 'inline-flex'} items-center gap-1 ml-1 align-middle`} data-testid="inline-form-preview-textbox">
          <input
            type="text"
            placeholder={d.placeholder || d.label || 'Type here…'}
            defaultValue={d.default_value || ''}
            maxLength={d.max_length}
            readOnly
            tabIndex={-1}
            className="px-2 py-0.5 text-sm border border-gray-300 rounded pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.45)', ...(isFull ? { width: '100%' } : WIDTH_STYLE[d.width ?? 'md']) }}
          />
        </span>
      );
    }
    case 'textarea': {
      const d = contentData as TextareaData;
      const isFull = (d.width ?? 'full') === 'full';
      return (
        <span className={`${isFull ? 'flex flex-1 min-w-0' : 'inline-flex'} items-start gap-1 ml-1 align-middle`} data-testid="inline-form-preview-textarea">
          <textarea
            placeholder={d.placeholder || d.label || 'Type here…'}
            defaultValue={d.default_value || ''}
            readOnly
            tabIndex={-1}
            rows={Math.min(d.rows || 2, 2)}
            className="px-2 py-0.5 text-sm border border-gray-300 rounded pointer-events-none resize-none"
            style={{ background: 'rgba(255,255,255,0.45)', ...(isFull ? { width: '100%' } : WIDTH_STYLE[d.width ?? 'full']) }}
          />
        </span>
      );
    }
    case 'select': {
      const d = contentData as SelectData;
      return (
        <span className="inline-flex items-center gap-1 ml-1 align-middle" data-testid="inline-form-preview-select">
          <select disabled tabIndex={-1}
            className="px-2 py-0.5 text-sm border border-indigo-300 rounded bg-indigo-50 pointer-events-none"
            style={{ minWidth: 100 }}>
            {d.placeholder && <option value="">{d.placeholder}</option>}
            {(d.options || []).map(opt => (
              <option key={opt.id} value={opt.id}>{opt.text}</option>
            ))}
          </select>
        </span>
      );
    }
    case 'multiselect': {
      const d = contentData as MultiselectData;
      return (
        <span className="inline-flex items-center gap-1 ml-1 align-middle flex-wrap" data-testid="inline-form-preview-multiselect">
          {(d.options || []).slice(0, 3).map(opt => (
            <span key={opt.id} className="px-1.5 py-0.5 text-xs bg-violet-100 text-violet-700 border border-violet-200 rounded-full">
              {opt.text}
            </span>
          ))}
          {(d.options || []).length > 3 && (
            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
              +{(d.options || []).length - 3}
            </span>
          )}
        </span>
      );
    }
    case 'radio': {
      const d = contentData as RadioData;
      return (
        <span className="inline-flex items-center gap-2 ml-1 align-middle" data-testid="inline-form-preview-radio">
          {(d.options || []).slice(0, 3).map(opt => (
            <label key={opt.id} className="inline-flex items-center gap-1 text-sm cursor-default">
              <input type="radio" readOnly tabIndex={-1} disabled className="pointer-events-none" />
              <span>{opt.text}</span>
            </label>
          ))}
          {(d.options || []).length > 3 && (
            <span className="text-xs text-gray-400">+{(d.options || []).length - 3} more</span>
          )}
        </span>
      );
    }
    case 'checkbox': {
      const d = contentData as CheckboxData;
      return (
        <span className="inline-flex items-center gap-2 ml-1 align-middle" data-testid="inline-form-preview-checkbox">
          {(d.options || []).slice(0, 3).map(opt => (
            <label key={opt.id} className="inline-flex items-center gap-1 text-sm cursor-default">
              <input type="checkbox" readOnly tabIndex={-1} disabled className="pointer-events-none" />
              <span>{opt.text}</span>
            </label>
          ))}
          {(d.options || []).length > 3 && (
            <span className="text-xs text-gray-400">+{(d.options || []).length - 3} more</span>
          )}
        </span>
      );
    }
    case 'audio': {
      const src = (contentData as any)?.url || (contentData as any)?.src;
      if (!src) return <span className="text-xs opacity-60 ml-1">[no audio]</span>;
      return (
        <span className="block w-full mt-1" contentEditable={false}>
          <audio
            src={src}
            controls
            preload="metadata"
            className="w-full rounded"
            style={{ height: 36 }}
          />
        </span>
      );
    }
    case 'video': {
      const src = (contentData as any)?.url || (contentData as any)?.src;
      if (!src) return <span className="text-xs opacity-60 ml-1">[no video]</span>;
      return (
        <span className="block w-full mt-1" contentEditable={false}>
          <video
            src={src}
            controls
            preload="metadata"
            className="w-full rounded-lg"
            style={{ maxHeight: 240, background: 'var(--color-surface-hover)' }}
          />
        </span>
      );
    }
    case 'image': {
      const src = (contentData as any)?.url || (contentData as any)?.src;
      const alt = (contentData as any)?.alt || (contentData as any)?.caption || '';
      if (!src) return <span className="text-xs opacity-60 ml-1">[no image]</span>;
      return (
        <span className="block w-full mt-1" contentEditable={false}>
          <img
            src={src}
            alt={alt}
            className="w-full rounded-lg object-cover"
            style={{ maxHeight: 300 }}
          />
          {alt && <span className="block text-xs text-center opacity-60 mt-0.5">{alt}</span>}
        </span>
      );
    }
    default:
      return null;
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<FormType, string> = {
  textbox: 'Text Input',
  textarea: 'Text Area',
  select: 'Dropdown',
  multiselect: 'Multi-Select',
  radio: 'Radio',
  checkbox: 'Checkbox',
  audio: 'Audio',
  video: 'Video',
  image: 'Image',
};

const BLOCK_MEDIA_TYPES = new Set<FormType>(['audio', 'video', 'image']);

// Per-type colour tokens used for the inline pill
const TYPE_COLOR: Record<FormType, string> = {
  textbox:     'bg-blue-50   border-blue-200   text-blue-700',
  textarea:    'bg-blue-50   border-blue-200   text-blue-700',
  select:      'bg-indigo-50 border-indigo-200 text-indigo-700',
  multiselect: 'bg-violet-50 border-violet-200 text-violet-700',
  radio:       'bg-orange-50 border-orange-200 text-orange-700',
  checkbox:    'bg-teal-50   border-teal-200   text-teal-700',
  audio:       'bg-yellow-50 border-yellow-200 text-yellow-700',
  video:       'bg-red-50    border-red-200    text-red-700',
  image:       'bg-pink-50   border-pink-200   text-pink-700',
};

// Location badge styles for non-inline placements
const POSITION_META: Record<Exclude<Position, 'inline'>, { label: string; classes: string; icon: string }> = {
  start_of_chapter: {
    label: 'Start of chapter',
    classes: 'bg-blue-50 border-blue-300 text-blue-600',
    icon: '↑',
  },
  end_of_chapter: {
    label: 'End of chapter',
    classes: 'bg-amber-50 border-amber-300 text-amber-700',
    icon: '↓',
  },
};

// ─── Main component ──────────────────────────────────────────────────────────

export function InlineFormNodeView({ node, selected }: NodeViewProps) {
  const { contentId, contentType, anchorText, contentData, position } = node.attrs as {
    contentId: string;
    contentType: FormType;
    anchorText: string;
    contentData: unknown | null;
    position: Position;
  };

  const isInline = !position || position === 'inline';
  const colorClass = TYPE_COLOR[contentType] ?? 'bg-gray-50 border-gray-200 text-gray-700';
  const label = TYPE_LABEL[contentType] ?? contentType;
  const ringClass = selected ? ' ring-2 ring-offset-1 ring-blue-400' : '';

  // ── Non-inline: compact location marker ──────────────────────────────────
  if (!isInline) {
    const meta = POSITION_META[position as Exclude<Position, 'inline'>];
    return (
      <NodeViewWrapper
        as="span"
        className={`inline-flex items-baseline gap-1 mx-0.5 px-1.5 py-0.5 rounded border align-baseline ${meta?.classes ?? 'bg-gray-50 border-gray-200 text-gray-600'}${ringClass}`}
        data-content-id={contentId}
        data-content-type={contentType}
        data-testid="inline-form-node"
      >
        {/* Anchor text */}
        <span className="font-medium underline decoration-dotted underline-offset-2" data-testid="inline-form-anchor">
          {anchorText}
        </span>
        {/* Location indicator */}
        <span className="text-xs opacity-70 font-normal" data-testid="inline-form-badge">
          {meta?.icon} {label} · {meta?.label}
        </span>
      </NodeViewWrapper>
    );
  }

  // ── Inline: full anchor + type badge + live widget preview ────────────────
  const isMedia = BLOCK_MEDIA_TYPES.has(contentType);
  const isFullWidth = isMedia || (contentData as any)?.width === 'full';

  if (isMedia) {
    return (
      <NodeViewWrapper
        as="span"
        className={`block my-2 px-1.5 py-1.5 rounded border ${colorClass}${ringClass}`}
        data-content-id={contentId}
        data-content-type={contentType}
        data-testid="inline-form-node"
      >
        <span className="flex items-center gap-1.5 mb-1 text-xs font-medium opacity-70" contentEditable={false}>
          <span>{label}</span>
          {anchorText && <span className="underline decoration-dotted underline-offset-2">{anchorText}</span>}
        </span>
        {contentData && (
          <FormPreview contentType={contentType} contentData={contentData} />
        )}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className={`${isFullWidth ? 'inline-flex w-full min-w-0' : 'inline-flex'} items-baseline gap-1 mx-0.5 px-1.5 py-0.5 rounded border align-baseline ${colorClass}${ringClass}`}
      data-content-id={contentId}
      data-content-type={contentType}
      data-testid="inline-form-node"
    >
      {/* Anchor text */}
      <span className="font-medium underline decoration-dotted underline-offset-2" data-testid="inline-form-anchor">
        {anchorText}
      </span>

      {/* Type badge */}
      <span className="text-xs opacity-60 font-normal" data-testid="inline-form-badge">
        [{label}]
      </span>

      {/* Live widget preview */}
      {contentData && (
        <FormPreview contentType={contentType} contentData={contentData} />
      )}
    </NodeViewWrapper>
  );
}

export default InlineFormNodeView;
