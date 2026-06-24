import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronRight, BookOpen, BarChart2, AlignLeft, CheckCircle, XCircle } from 'lucide-react';
import api from '../../lib/api';
import type { BookResponseItem } from '../../types';

interface Props {
  bookId: string;
  chapterId?: string;   // scopes to one chapter
  compact?: boolean;    // true = narrow panel layout
}

const TYPE_COLORS: Record<string, string> = {
  question:       'bg-blue-100 text-blue-700',
  poll:           'bg-purple-100 text-purple-700',
  textbox:        'bg-green-100 text-green-700',
  textarea:       'bg-green-100 text-green-700',
  radio:          'bg-orange-100 text-orange-700',
  checkbox:       'bg-orange-100 text-orange-700',
  select:         'bg-teal-100 text-teal-700',
  multiselect:    'bg-teal-100 text-teal-700',
};

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function ChoiceChart({ item, compact }: { item: BookResponseItem; compact: boolean }) {
  if (!item.aggregates || item.total === 0) return <p className="text-xs text-muted italic mt-1">No responses yet</p>;
  return (
    <div className="mt-2 space-y-1.5">
      {item.aggregates.options.map(opt => (
        <div key={opt.id}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-theme truncate pr-2">{opt.text}</span>
            <span className="text-muted shrink-0">{opt.count} ({opt.percent}%)</span>
          </div>
          <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${opt.percent}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted pt-0.5">{item.total} {item.total === 1 ? 'response' : 'responses'}</p>
    </div>
  );
}

function TextResponses({ item, compact }: { item: BookResponseItem; compact: boolean }) {
  if (item.total === 0) return <p className="text-xs text-muted italic mt-1">No responses yet</p>;
  return (
    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
      {item.responses.map(r => (
        <div key={r.id} className="text-xs border-l-2 border-theme/20 pl-2">
          <span className="font-medium text-theme">{(r as any).user?.display_name || 'Reader'}:</span>
          <span className="text-muted ml-1">{String((r as any).response_data?.value || '').slice(0, 200) || '—'}</span>
        </div>
      ))}
      <p className="text-[10px] text-muted">{item.total} {item.total === 1 ? 'response' : 'responses'}</p>
    </div>
  );
}

function QuestionResponses({ item }: { item: BookResponseItem }) {
  if (item.total === 0) return <p className="text-xs text-muted italic mt-1">No responses yet</p>;
  return (
    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
      {item.responses.map(r => {
        const answer = (r as any).answer_text || ((r as any).selected_options || []).join(', ') || '—';
        const isCorrect = (r as any).is_correct;
        return (
          <div key={r.id} className="text-xs flex items-start gap-1.5 border-l-2 border-theme/20 pl-2">
            {isCorrect === true && <CheckCircle className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />}
            {isCorrect === false && <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />}
            {isCorrect === undefined || isCorrect === null ? <span className="w-3 shrink-0" /> : null}
            <span>
              <span className="font-medium text-theme">{(r as any).user?.display_name || 'Reader'}:</span>
              <span className="text-muted ml-1">{answer.slice(0, 200)}</span>
            </span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted">{item.total} {item.total === 1 ? 'answer' : 'answers'}</p>
    </div>
  );
}

function ResponseItem({ item, compact }: { item: BookResponseItem; compact: boolean }) {
  const [open, setOpen] = useState(true);
  const choiceTypes = ['select', 'multiselect', 'radio', 'checkbox', 'poll'];
  const textTypes = ['textbox', 'textarea'];

  const label =
    item.content_data?.question ||
    item.content_data?.label ||
    item.content_data?.title ||
    `(${item.content_type})`;

  return (
    <div className={`border border-theme/20 rounded-lg overflow-hidden ${compact ? '' : ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-2 px-3 py-2 hover:bg-surface-hover transition-colors text-left"
      >
        <span className="mt-0.5 shrink-0">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 flex-wrap">
            <TypeBadge type={item.content_type} />
            <span className="text-xs text-muted">{item.total} {item.total === 1 ? 'response' : 'responses'}</span>
          </span>
          <span className="block text-xs font-medium text-theme mt-0.5 truncate">{label}</span>
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-theme/10">
          {choiceTypes.includes(item.content_type) && <ChoiceChart item={item} compact={compact} />}
          {item.content_type === 'question' && <QuestionResponses item={item} />}
          {textTypes.includes(item.content_type) && <TextResponses item={item} compact={compact} />}
        </div>
      )}
    </div>
  );
}

export default function BookResponsesViewer({ bookId, chapterId, compact = false }: Props) {
  const [items, setItems] = useState<BookResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getBookResponses(bookId, chapterId)
      .then(setItems)
      .catch(e => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [bookId, chapterId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-500 px-3 py-4">{error}</p>;
  }

  // Filter to only response-capable types
  const responseTypes = ['poll', 'question', 'select', 'multiselect', 'radio', 'checkbox', 'textbox', 'textarea'];
  const filtered = items.filter(i => responseTypes.includes(i.content_type));

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <BarChart2 className="h-8 w-8 text-muted/40 mb-2" />
        <p className="text-sm text-muted">No interactive content yet</p>
        <p className="text-xs text-muted/70 mt-0.5">Add polls, questions, or forms to see responses here</p>
      </div>
    );
  }

  if (chapterId) {
    // Single-chapter view — no chapter grouping
    return (
      <div className={`space-y-2 ${compact ? 'p-2' : 'p-4'}`}>
        {filtered.map(item => <ResponseItem key={item.id} item={item} compact={compact} />)}
      </div>
    );
  }

  // Group by chapter
  const byChapter: Record<string, BookResponseItem[]> = {};
  const chapterMeta: Record<string, { title: string; order: number }> = {};
  for (const item of filtered) {
    if (!byChapter[item.chapter_id]) {
      byChapter[item.chapter_id] = [];
      chapterMeta[item.chapter_id] = { title: item.chapter_title, order: item.chapter_order };
    }
    byChapter[item.chapter_id].push(item);
  }

  const sortedChapters = Object.keys(byChapter).sort(
    (a, b) => chapterMeta[a].order - chapterMeta[b].order
  );

  return (
    <div className={compact ? 'p-2 space-y-4' : 'space-y-6'}>
      {sortedChapters.map(chapId => (
        <div key={chapId}>
          <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
            <BookOpen className="h-3.5 w-3.5 text-muted" />
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide truncate">
              {chapterMeta[chapId].title || 'Chapter'}
            </h3>
          </div>
          <div className="space-y-2">
            {byChapter[chapId].map(item => <ResponseItem key={item.id} item={item} compact={compact} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
