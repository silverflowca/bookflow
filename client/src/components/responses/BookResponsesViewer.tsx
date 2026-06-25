import { useEffect, useState, useMemo } from 'react';
import {
  Loader2, Search, BarChart2, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Filter, X, Users, MessageSquare,
  HelpCircle, List, SlidersHorizontal,
} from 'lucide-react';
import api from '../../lib/api';
import type { BookResponseItem } from '../../types';

interface Props {
  bookId: string;
  chapterId?: string;
  compact?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  question:    { label: 'Question',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   icon: <HelpCircle className="h-3.5 w-3.5" /> },
  poll:        { label: 'Poll',        color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: <BarChart2 className="h-3.5 w-3.5" /> },
  textbox:     { label: 'Text Field',  color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  textarea:    { label: 'Text Area',   color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  radio:       { label: 'Radio',       color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <List className="h-3.5 w-3.5" /> },
  checkbox:    { label: 'Checkbox',    color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  select:      { label: 'Select',      color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200',   icon: <ChevronDown className="h-3.5 w-3.5" /> },
  multiselect: { label: 'Multi-select',color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200',   icon: <ChevronDown className="h-3.5 w-3.5" /> },
};

const RESPONSE_TYPES = Object.keys(TYPE_META);

function typeMeta(type: string) {
  return TYPE_META[type] || { label: type, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: null };
}

function TypeBadge({ type }: { type: string }) {
  const m = typeMeta(type);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border ${m.bg} ${m.color}`}>
      {m.icon}{m.label}
    </span>
  );
}

function Avatar({ name, url }: { name?: string; url?: string }) {
  if (url) return <img src={url} alt={name} className="h-7 w-7 rounded-full object-cover shrink-0" />;
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-purple-200 text-purple-700', 'bg-blue-200 text-blue-700', 'bg-green-200 text-green-700', 'bg-orange-200 text-orange-700', 'bg-rose-200 text-rose-700'];
  const idx = (name || '').charCodeAt(0) % colors.length;
  return (
    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colors[idx]}`}>
      {initials}
    </div>
  );
}

function fmtDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// ── Aggregated bar chart for choice-type items ────────────────────────────────

function AggregateChart({ item }: { item: BookResponseItem }) {
  if (!item.aggregates || item.total === 0) {
    return <p className="text-xs text-gray-400 italic py-2">No responses yet</p>;
  }
  return (
    <div className="space-y-2 mt-3">
      {item.aggregates.options.map((opt: any) => (
        <div key={opt.id} className="group">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-700 font-medium truncate pr-4 flex-1">{opt.text}</span>
            <span className="text-gray-500 shrink-0 tabular-nums">{opt.count} · {opt.percent}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${opt.percent}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-gray-400 pt-1">{item.total} {item.total === 1 ? 'response' : 'total responses'}</p>
    </div>
  );
}

// ── Individual response row ───────────────────────────────────────────────────

function ResponseRow({ r, type }: { r: any; type: string }) {
  const user = r.user || {};
  const name = user.display_name || 'Anonymous';
  const date = r.updated_at || r.created_at || '';

  let value = '';
  if (type === 'poll') {
    value = r.selected_option || '—';
  } else if (type === 'question') {
    value = r.answer_text || (r.selected_options || []).join(', ') || '—';
  } else {
    value = typeof r.response_data?.value === 'string'
      ? r.response_data.value
      : Array.isArray(r.response_data?.value)
        ? r.response_data.value.join(', ')
        : JSON.stringify(r.response_data?.value ?? '—');
  }

  const isCorrect: boolean | null = r.is_correct ?? null;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <Avatar name={name} url={user.avatar_url} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-800">{name}</span>
          {isCorrect === true && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
              <CheckCircle className="h-2.5 w-2.5" /> Correct
            </span>
          )}
          {isCorrect === false && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
              <XCircle className="h-2.5 w-2.5" /> Incorrect
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-400 shrink-0">{fmtDate(date)}</span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed break-words">{value}</p>
      </div>
    </div>
  );
}

// ── Options list (shows original options + correct answer marker) ─────────────

function OptionsList({ item }: { item: BookResponseItem }) {
  const cd = item.content_data || {};
  const options: { id: string; text: string }[] = cd.options || [];
  if (options.length === 0) return null;

  const correctAnswer = cd.correct_answer;
  const correctIds = new Set<string>(
    Array.isArray(correctAnswer) ? correctAnswer : correctAnswer ? [correctAnswer] : []
  );

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Options</p>
      <div className="flex flex-col gap-1">
        {options.map(opt => {
          const isCorrect = correctIds.has(opt.id);
          return (
            <div
              key={opt.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                isCorrect
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-gray-50 border-gray-100 text-gray-700'
              }`}
            >
              <span className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'
              }`}>
                {isCorrect && <CheckCircle className="h-3 w-3 text-white" />}
              </span>
              <span className="flex-1">{opt.text}</span>
              {isCorrect && (
                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide shrink-0">Correct</span>
              )}
            </div>
          );
        })}
      </div>
      {cd.explanation && (
        <div className="mt-1 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Explanation</p>
          <p className="text-xs text-blue-800">{cd.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ── Single question/form card ─────────────────────────────────────────────────

function ItemCard({ item, searchQuery }: { item: BookResponseItem; searchQuery: string }) {
  const [expanded, setExpanded] = useState(true);
  const isChoice = ['select', 'multiselect', 'radio', 'checkbox', 'poll'].includes(item.content_type);
  const isText = ['textbox', 'textarea'].includes(item.content_type);
  const hasOptions = !!(item.content_data?.options?.length);

  const label =
    item.content_data?.question ||
    item.content_data?.label ||
    item.content_data?.title ||
    item.content_data?.placeholder ||
    `(${item.content_type})`;

  // Highlight search match in label
  const highlightedLabel = useMemo(() => {
    if (!searchQuery) return label;
    const idx = label.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (idx < 0) return label;
    return (
      <>
        {label.slice(0, idx)}
        <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{label.slice(idx, idx + searchQuery.length)}</mark>
        {label.slice(idx + searchQuery.length)}
      </>
    );
  }, [label, searchQuery]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Card header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="mt-0.5 shrink-0 text-gray-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <TypeBadge type={item.content_type} />
            {item.content_data?.type && (
              <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md capitalize">
                {item.content_data.type.replace(/_/g, ' ')}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              item.total > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <Users className="h-3 w-3" />
              {item.total} {item.total === 1 ? 'response' : 'responses'}
            </span>
          </div>
          {/* Original question/prompt — the key thing a teacher needs to see */}
          <p className="text-sm font-semibold text-gray-900 leading-snug">{highlightedLabel}</p>
        </div>
      </button>

      {/* Card body */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">

          {/* Original options + correct answer (for questions/polls/radio/checkbox/select) */}
          {hasOptions && <OptionsList item={item} />}

          {/* Aggregate bar chart for choice types */}
          {isChoice && (
            <div className={hasOptions ? 'mt-4 pt-4 border-t border-gray-100' : ''}>
              {hasOptions && <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Results</p>}
              <AggregateChart item={item} />
            </div>
          )}

          {/* Individual text/open-answer responses */}
          {(isText || item.content_type === 'question') && item.total > 0 && (
            <div className={`${hasOptions ? 'mt-4 pt-4 border-t border-gray-100' : 'mt-3'}`}>
              {hasOptions && <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Responses</p>}
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {item.responses.map((r: any) => (
                  <ResponseRow key={r.id} r={r} type={item.content_type} />
                ))}
              </div>
            </div>
          )}

          {/* Choice types also show per-user responses below the chart */}
          {isChoice && item.total > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Individual Responses</p>
              <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {item.responses.map((r: any) => (
                  <ResponseRow key={r.id} r={r} type={item.content_type} />
                ))}
              </div>
            </div>
          )}

          {item.total === 0 && (
            <p className="text-xs text-gray-400 italic py-3">No responses yet</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chapter sidebar item ──────────────────────────────────────────────────────

function ChapterSidebarItem({
  title,
  order,
  count,
  active,
  onClick,
}: {
  title: string;
  order: number;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
        active
          ? 'bg-purple-50 border border-purple-200 text-purple-800'
          : 'hover:bg-gray-50 text-gray-700'
      }`}
    >
      <span className={`text-xs font-bold shrink-0 w-5 text-center ${active ? 'text-purple-600' : 'text-gray-400'}`}>
        {order + 1}
      </span>
      <span className="flex-1 text-xs font-medium leading-tight truncate">{title}</span>
      {count > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
          active ? 'bg-purple-200 text-purple-700' : 'bg-gray-200 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookResponsesViewer({ bookId, chapterId: initialChapterId, compact = false }: Props) {
  const [items, setItems] = useState<BookResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(initialChapterId || null);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getBookResponses(bookId)
      .then(setItems)
      .catch(e => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [bookId]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const responseItems = useMemo(
    () => items.filter(i => RESPONSE_TYPES.includes(i.content_type)),
    [items]
  );

  // Build chapter list from data
  const chapters = useMemo(() => {
    const map = new Map<string, { id: string; title: string; order: number; count: number }>();
    for (const item of responseItems) {
      if (!map.has(item.chapter_id)) {
        map.set(item.chapter_id, { id: item.chapter_id, title: item.chapter_title, order: item.chapter_order, count: 0 });
      }
      map.get(item.chapter_id)!.count++;
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [responseItems]);

  // Types present in current chapter filter
  const availableTypes = useMemo(() => {
    const s = new Set<string>();
    for (const item of responseItems) {
      if (!activeChapterId || item.chapter_id === activeChapterId) s.add(item.content_type);
    }
    return [...s];
  }, [responseItems, activeChapterId]);

  // Filtered + searched items
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return responseItems.filter(item => {
      // Chapter filter
      if (activeChapterId && item.chapter_id !== activeChapterId) return false;
      // Type filter
      if (activeTypes.length && !activeTypes.includes(item.content_type)) return false;
      // Search
      if (q) {
        const label = (
          item.content_data?.question ||
          item.content_data?.label ||
          item.content_data?.title ||
          item.content_data?.placeholder ||
          ''
        ).toLowerCase();
        const chapterTitle = item.chapter_title.toLowerCase();
        // Also search response values
        const responseText = item.responses.map((r: any) => {
          if (item.content_type === 'poll') return r.selected_option || '';
          if (item.content_type === 'question') return `${r.answer_text || ''} ${(r.selected_options || []).join(' ')}`;
          const v = r.response_data?.value;
          return typeof v === 'string' ? v : Array.isArray(v) ? v.join(' ') : '';
        }).join(' ').toLowerCase();
        const userName = item.responses.map((r: any) => r.user?.display_name || '').join(' ').toLowerCase();

        if (!label.includes(q) && !chapterTitle.includes(q) && !responseText.includes(q) && !userName.includes(q)) return false;
      }
      return true;
    });
  }, [responseItems, activeChapterId, activeTypes, search]);

  // Summary stats
  const totalResponses = useMemo(() => filtered.reduce((s, i) => s + i.total, 0), [filtered]);
  const totalRespondents = useMemo(() => {
    const ids = new Set<string>();
    filtered.forEach(item => item.responses.forEach((r: any) => { if (r.user_id) ids.add(r.user_id); }));
    return ids.size;
  }, [filtered]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <p className="text-sm text-gray-500">Loading responses…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <XCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (responseItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="p-4 bg-purple-50 rounded-full mb-4">
          <BarChart2 className="h-8 w-8 text-purple-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-800 mb-1">No interactive content yet</h3>
        <p className="text-sm text-gray-500 max-w-xs">Add questions, polls, or form fields to your chapters to see reader responses here.</p>
      </div>
    );
  }

  const hasActiveFilters = !!activeChapterId || activeTypes.length > 0 || search.trim();

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-5 py-4 bg-white border-b border-gray-200">

        {/* Row 1: search + filter toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions, responses, reader names, chapters…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors shrink-0 ${
              showFilters || activeChapterId || activeTypes.length
                ? 'bg-purple-50 border-purple-300 text-purple-700'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {(activeChapterId || activeTypes.length > 0) && (
              <span className="ml-0.5 bg-purple-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {(activeChapterId ? 1 : 0) + activeTypes.length}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: filter panel (collapsible) */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 pt-1">
            {/* Chapter filter */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Chapter</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveChapterId(null)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                    !activeChapterId ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  All chapters
                </button>
                {chapters.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChapterId(prev => prev === ch.id ? null : ch.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      activeChapterId === ch.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Ch {ch.order + 1}: {ch.title.length > 22 ? ch.title.slice(0, 22) + '…' : ch.title}
                    {ch.count > 0 && <span className="ml-1 opacity-70">({ch.count})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Type filter */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Response type</p>
              <div className="flex flex-wrap gap-1.5">
                {availableTypes.map(type => {
                  const m = typeMeta(type);
                  const on = activeTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveTypes(prev => on ? prev.filter(t => t !== type) : [...prev, type])}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                        on ? 'bg-purple-600 text-white border-purple-600' : `${m.bg} ${m.color} hover:opacity-80`
                      }`}
                    >
                      {m.icon}{m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasActiveFilters && !showFilters && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {activeChapterId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                Ch: {chapters.find(c => c.id === activeChapterId)?.title?.slice(0, 20) || '…'}
                <button onClick={() => setActiveChapterId(null)} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            {activeTypes.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                {typeMeta(t).label}
                <button onClick={() => setActiveTypes(p => p.filter(x => x !== t))} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <button onClick={() => { setActiveChapterId(null); setActiveTypes([]); setSearch(''); }} className="text-xs text-gray-500 hover:text-gray-700 underline">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Body: sidebar + cards ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Chapter sidebar — hidden on compact */}
        {!compact && chapters.length > 1 && (
          <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto p-3 flex flex-col gap-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1">Chapters</p>
            <ChapterSidebarItem
              title="All Chapters"
              order={-1}
              count={responseItems.reduce((s, i) => s + i.total, 0)}
              active={!activeChapterId}
              onClick={() => setActiveChapterId(null)}
            />
            <div className="my-1 border-t border-gray-200" />
            {chapters.map(ch => (
              <ChapterSidebarItem
                key={ch.id}
                title={ch.title}
                order={ch.order}
                count={ch.count}
                active={activeChapterId === ch.id}
                onClick={() => setActiveChapterId(prev => prev === ch.id ? null : ch.id)}
              />
            ))}
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">

          {/* Summary bar */}
          <div className="flex items-center gap-4 px-5 py-3 bg-white border-b border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              <span><strong className="text-gray-700">{filtered.length}</strong> {filtered.length === 1 ? 'item' : 'items'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              <span><strong className="text-gray-700">{totalResponses}</strong> {totalResponses === 1 ? 'response' : 'responses'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span><strong className="text-gray-700">{totalRespondents}</strong> {totalRespondents === 1 ? 'respondent' : 'respondents'}</span>
            </span>
          </div>

          {/* Cards */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Search className="h-8 w-8 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">No matching responses</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Group by chapter */}
              {(() => {
                const byChapter: Record<string, BookResponseItem[]> = {};
                const chapOrder: string[] = [];
                for (const item of filtered) {
                  if (!byChapter[item.chapter_id]) { byChapter[item.chapter_id] = []; chapOrder.push(item.chapter_id); }
                  byChapter[item.chapter_id].push(item);
                }
                const uniqueChapters = chapOrder.filter((id, i) => chapOrder.indexOf(id) === i);

                return uniqueChapters.map(chapId => {
                  const chapItems = byChapter[chapId];
                  const chapTitle = chapItems[0].chapter_title;
                  const chapOrder2 = chapItems[0].chapter_order;
                  return (
                    <div key={chapId}>
                      {/* Chapter heading */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-purple-600">{chapOrder2 + 1}</span>
                          </div>
                          <h3 className="text-sm font-bold text-gray-800">{chapTitle}</h3>
                          <span className="text-xs text-gray-400">{chapItems.length} {chapItems.length === 1 ? 'item' : 'items'}</span>
                        </div>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <div className="space-y-3 mb-6">
                        {chapItems.map(item => (
                          <ItemCard key={item.id} item={item} searchQuery={search} />
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
