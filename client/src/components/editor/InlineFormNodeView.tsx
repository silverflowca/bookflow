import { BookOpen } from 'lucide-react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type {
  TextboxData, TextareaData, SelectData, MultiselectData, RadioData, CheckboxData, PollData, ScriptureBlockData,
} from '../../types/index';
import { useEditorPreviewMode } from '../../contexts/EditorPreviewContext';
import { getExternalEmbedUrl } from '../../lib/videoEmbeds';

type FormType = 'textbox' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'audio' | 'video' | 'image' | 'poll' | 'scripture_block' | 'drawing' | 'media_response';
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
        <span className="block w-full mt-1 align-middle" data-testid="inline-form-preview-checkbox">
          <span className="block rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm">
            <span className="flex items-center gap-2 mb-2">
              <span className="font-medium text-teal-800">Select All That Apply</span>
              {d.required && <span className="text-red-500 text-sm">*</span>}
            </span>
            {d.label && <span className="block text-gray-800 mb-2">{d.label}</span>}
            <span className="flex flex-col gap-2">
              {(d.options || []).map(opt => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 cursor-default"
                >
                  <input
                    type="checkbox"
                    readOnly
                    tabIndex={-1}
                    disabled
                    className="pointer-events-none accent-teal-600"
                  />
                  <span>{opt.text}</span>
                </label>
              ))}
            </span>
            {d.min_selections && (
              <span className="block text-xs text-gray-500 mt-2">
                Select at least {d.min_selections} option{d.min_selections > 1 ? 's' : ''}
              </span>
            )}
          </span>
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
            className="rounded"
            style={{ height: 36, width: '100%' }}
          />
        </span>
      );
    }
    case 'video': {
      const src = (contentData as any)?.url || (contentData as any)?.src;
      const title = (contentData as any)?.title || 'Video';
      const embedUrl = getExternalEmbedUrl(src);
      if (!src) return <span className="text-xs opacity-60 ml-1">[no video]</span>;
      if (embedUrl) {
        return (
          <div style={{ display: 'block', width: '100%' }} contentEditable={false}>
            <div
              style={{
                width: '100%',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#000',
                aspectRatio: '16 / 9',
              }}
            >
              <iframe
                src={embedUrl}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ display: 'block', width: '100%', height: '100%', border: 0, background: '#000' }}
              />
            </div>
          </div>
        );
      }
      return (
        <div style={{ display: 'block', width: '100%' }} contentEditable={false}>
          <video
            src={src}
            controls
            preload="metadata"
            style={{ display: 'block', width: '100%', borderRadius: 8, background: 'var(--color-surface-hover)' }}
          />
        </div>
      );
    }
    case 'image': {
      const src = (contentData as any)?.url || (contentData as any)?.src;
      const alt = (contentData as any)?.alt || '';
      const caption = (contentData as any)?.caption || '';
      const widthClass: Record<string, string> = {
        small: 'max-w-xs',
        medium: 'max-w-md',
        large: 'max-w-2xl',
        full: 'w-full',
      };
      const wClass = widthClass[(contentData as any)?.width || 'full'] ?? 'w-full';
      if (!src) return <span className="text-xs opacity-60 ml-1">[no image]</span>;
      return (
        <figure className={`${wClass} mx-auto my-2`} contentEditable={false}>
          <img
            src={src}
            alt={alt}
            className="w-full rounded-lg object-contain bg-surface-hover"
          />
          {caption && (
            <figcaption className="text-center text-xs text-muted mt-1.5 italic">{caption}</figcaption>
          )}
        </figure>
      );
    }
    case 'poll': {
      const d = contentData as PollData;
      return (
        <span className="block w-full mt-1" contentEditable={false}>
          {d.question && (
            <span className="block text-sm font-medium text-gray-800 mb-1">{d.question}</span>
          )}
          <span className="block space-y-0.5">
            {(d.options || []).slice(0, 4).map(opt => (
              <label key={opt.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-default">
                <input type={d.allow_multiple ? 'checkbox' : 'radio'} readOnly tabIndex={-1} disabled className="pointer-events-none" />
                <span>{opt.text}</span>
              </label>
            ))}
            {(d.options || []).length > 4 && (
              <span className="text-xs text-gray-400 pl-5">+{(d.options || []).length - 4} more</span>
            )}
          </span>
        </span>
      );
    }
    case 'scripture_block': {
      const d = contentData as ScriptureBlockData;
      return (
        <span className="block w-full mt-1" contentEditable={false}>
          <span className="block bg-amber-50 border-l-4 border-amber-600 rounded-r-lg p-4">
            <span className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-amber-700" />
              <span className="font-semibold text-amber-800">{d.reference}</span>
              {d.version && (
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                  {d.version}
                </span>
              )}
            </span>
            <span className="block italic text-lg leading-relaxed text-gray-800">
              "{d.text}"
            </span>
            {d.notes && (
              <span className="block mt-3 text-sm text-gray-500 border-t border-amber-200 pt-3">
                {d.notes}
              </span>
            )}
          </span>
        </span>
      );
    }
    case 'drawing': {
      const src = (contentData as any)?.dataUrl;
      const caption = (contentData as any)?.caption || '';
      const widthClass: Record<string, string> = {
        small: 'max-w-xs',
        medium: 'max-w-md',
        large: 'max-w-2xl',
        full: 'w-full',
      };
      const wClass = widthClass[(contentData as any)?.width || 'full'] ?? 'w-full';
      if (!src) return <span className="text-xs opacity-60 ml-1">[empty drawing]</span>;
      return (
        <figure className={`${wClass} mx-auto my-2`} contentEditable={false}>
          <img
            src={src}
            alt={(contentData as any)?.title || 'Drawing'}
            className="w-full rounded-lg object-contain bg-white border border-gray-100"
          />
          {caption && (
            <figcaption className="text-center text-xs text-muted mt-1.5 italic">{caption}</figcaption>
          )}
        </figure>
      );
    }
    case 'media_response': {
      const d = contentData as any;
      return (
        <span className="block w-full mt-1" contentEditable={false}>
          <span className="block rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
            <span className="block text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1">Reader Response</span>
            <span className="block text-sm font-medium text-gray-900 mb-2">{d.prompt || 'Share your response'}</span>
            <span className="inline-flex flex-wrap gap-1.5">
              {(d.allow_text ?? true) && <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 border">Text</span>}
              {(d.allow_audio ?? true) && <span className="rounded-full bg-white px-2 py-0.5 text-xs text-orange-700 border">Audio</span>}
              {(d.allow_video ?? true) && <span className="rounded-full bg-white px-2 py-0.5 text-xs text-red-700 border">Video</span>}
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                max {d.max_responses_per_user || 1}/reader
              </span>
            </span>
          </span>
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
  poll: 'Poll',
  scripture_block: 'Scripture',
  drawing: 'Drawing',
  media_response: 'Reader Response',
};

const BLOCK_MEDIA_TYPES = new Set<FormType>(['audio', 'video', 'image', 'drawing', 'media_response']);

// Per-type colour tokens used for the inline pill
const TYPE_COLOR: Record<FormType, string> = {
  textbox:        'bg-blue-50   border-blue-200   text-blue-700',
  textarea:       'bg-blue-50   border-blue-200   text-blue-700',
  select:         'bg-indigo-50 border-indigo-200 text-indigo-700',
  multiselect:    'bg-violet-50 border-violet-200 text-violet-700',
  radio:          'bg-orange-50 border-orange-200 text-orange-700',
  checkbox:       'bg-teal-50   border-teal-200   text-teal-700',
  audio:          'bg-yellow-50 border-yellow-200 text-yellow-700',
  video:          'bg-red-50    border-red-200    text-red-700',
  image:          'bg-pink-50   border-pink-200   text-pink-700',
  poll:           'bg-green-50  border-green-200  text-green-700',
  scripture_block:'bg-amber-50  border-amber-200  text-amber-700',
  drawing:        'bg-purple-50 border-purple-200 text-purple-700',
  media_response: 'bg-blue-50   border-blue-200   text-blue-700',
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

  const previewMode = useEditorPreviewMode();
  const isInline = !position || position === 'inline';
  const colorClass = TYPE_COLOR[contentType] ?? 'bg-gray-50 border-gray-200 text-gray-700';
  const label = TYPE_LABEL[contentType] ?? contentType;
  const ringClass = selected ? ' ring-2 ring-offset-1 ring-blue-400' : '';

  function handleDoubleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.dispatchEvent(new CustomEvent('inlineform:edit', {
      bubbles: true,
      detail: { contentId },
    }));
  }

  // ── Non-inline: compact location marker ──────────────────────────────────
  if (!isInline) {
    const meta = POSITION_META[position as Exclude<Position, 'inline'>];
    return (
      <NodeViewWrapper
        as="span"
        className={`inline-flex items-baseline gap-1 mx-0.5 px-1.5 py-0.5 rounded border align-baseline ${meta?.classes ?? 'bg-gray-50 border-gray-200 text-gray-600'}${ringClass} cursor-pointer`}
        data-content-id={contentId}
        data-content-type={contentType}
        data-testid="inline-form-node"
        onDoubleClick={handleDoubleClick}
        title="Double-click to edit"
      >
        {/* Anchor text */}
        <span className="font-medium" data-testid="inline-form-anchor">
          {anchorText}
        </span>
        {/* Location indicator */}
        <span className="text-xs opacity-70 font-normal" data-testid="inline-form-badge">
          {meta?.icon} {label} · {meta?.label}
        </span>
      </NodeViewWrapper>
    );
  }

  // ── Minimal mode: compact labelled badge for all inline components ───────
  if (previewMode === 'minimal') {
    const isBlockMedia = BLOCK_MEDIA_TYPES.has(contentType);
    return (
      <NodeViewWrapper
        as={isBlockMedia ? 'div' : 'span'}
        className={isBlockMedia ? 'my-1' : undefined}
        data-content-id={contentId}
        data-content-type={contentType}
        data-testid="inline-form-node"
        onDoubleClick={handleDoubleClick}
        title="Double-click to edit"
      >
        <span
          className={`inline-flex items-baseline gap-1 mx-0.5 px-1.5 py-0.5 rounded border align-baseline cursor-pointer ${colorClass}${ringClass}`}
        >
          {anchorText && (
            <span className="font-medium">
              {anchorText}
            </span>
          )}
          <span className="text-xs opacity-60 font-normal">[{label}]</span>
        </span>
      </NodeViewWrapper>
    );
  }

  // ── Scripture block: render as live preview (no pill wrapper) ────────────
  if (contentType === 'scripture_block') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-content-id={contentId} data-content-type={contentType} data-testid="inline-form-node">
        <div
          className={`rounded${ringClass} cursor-pointer`}
          onDoubleClick={handleDoubleClick}
          title="Double-click to edit"
        >
          {!!contentData && (
            <FormPreview contentType={contentType} contentData={contentData as any} />
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  // ── Inline: full anchor + type badge + live widget preview ────────────────
  const isMedia = BLOCK_MEDIA_TYPES.has(contentType);
  const isFullWidth = isMedia || (contentData as any)?.width === 'full';

  if (isMedia) {
    const mediaSizePct = (contentData as any)?.size ?? 100;

    // Images render as a clean live preview (no pill border) — identical to the reader
    if (contentType === 'image') {
      return (
        <NodeViewWrapper as="div" className="my-2" data-content-id={contentId} data-content-type={contentType} data-testid="inline-form-node">
          <div
            className={`rounded${ringClass} cursor-pointer`}
            onDoubleClick={handleDoubleClick}
            title="Double-click to edit"
          >
            {!!contentData && (
              <FormPreview contentType={contentType} contentData={contentData as any} />
            )}
          </div>
        </NodeViewWrapper>
      );
    }

    return (
      <NodeViewWrapper as="div" className="my-2" data-content-id={contentId} data-content-type={contentType} data-testid="inline-form-node">
        <div
          className={`px-1.5 py-1.5 rounded border ${colorClass}${ringClass} cursor-pointer`}
          style={{ width: `${mediaSizePct}%`, boxSizing: 'border-box' }}
          onDoubleClick={handleDoubleClick}
          title="Double-click to edit"
        >
          <span className="flex items-center gap-1.5 mb-1 text-xs font-medium opacity-70" contentEditable={false}>
            <span>{label}</span>
            {anchorText && <span>{anchorText}</span>}
          </span>
          {!!contentData && (
            <FormPreview contentType={contentType} contentData={contentData as any} />
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className={`${isFullWidth ? 'inline-flex w-full min-w-0' : 'inline-flex'} items-baseline gap-1 mx-0.5 px-1.5 py-0.5 rounded border align-baseline ${colorClass}${ringClass} cursor-pointer`}
      data-content-id={contentId}
      data-content-type={contentType}
      data-testid="inline-form-node"
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    >
      {/* Anchor text */}
      <span className="font-medium" data-testid="inline-form-anchor">
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
