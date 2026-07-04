import { useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Crown,
  Filter,
  Globe,
  HelpCircle,
  List,
  Loader2,
  Lock,
  MessageSquare,
  Search,
  Share2,
  SlidersHorizontal,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import api from '../../lib/api';
import { getExternalEmbedUrl } from '../../lib/videoEmbeds';
import type { BookResponseItem } from '../../types';

interface Props {
  bookId: string;
  chapterId?: string;
  compact?: boolean;
  mode?: 'author' | 'accessible';
  viewerUserId?: string | null;
}

type ResponseVisibility = 'private' | 'shared' | 'public';

type ResponseRowData = {
  id: string;
  user_id?: string | null;
  user?: { display_name?: string | null; avatar_url?: string | null } | null;
  created_at?: string;
  updated_at?: string;
  selected_option?: string | null;
  answer_text?: string | null;
  selected_options?: string[] | null;
  response_data?: { value?: unknown } | null;
  response_type?: 'text' | 'audio' | 'video';
  body?: string | null;
  media_url?: string | null;
  is_correct?: boolean | null;
  visibility?: ResponseVisibility;
  club_contexts?: { id: string; name: string; club_type?: string | null }[];
  shared_with_users?: { id: string; display_name: string; avatar_url?: string | null }[];
};

type PassiveContentType =
  | 'link'
  | 'highlight'
  | 'note'
  | 'audio'
  | 'video'
  | 'code_block'
  | 'scripture_block';

type ResponseSectionKey = 'author' | 'reader';

const TYPE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  question: { label: 'Question', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <HelpCircle className="h-3.5 w-3.5" /> },
  poll: { label: 'Poll', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: <BarChart2 className="h-3.5 w-3.5" /> },
  textbox: { label: 'Text Field', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  textarea: { label: 'Text Area', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  link: { label: 'Link', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200', icon: <Share2 className="h-3.5 w-3.5" /> },
  highlight: { label: 'Highlight', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  note: { label: 'Note', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  audio: { label: 'Audio', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <BarChart2 className="h-3.5 w-3.5" /> },
  video: { label: 'Video', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <BarChart2 className="h-3.5 w-3.5" /> },
  code_block: { label: 'Code', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', icon: <List className="h-3.5 w-3.5" /> },
  scripture_block: { label: 'Scripture', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  media_response: { label: 'Reader Response', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  radio: { label: 'Radio', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <List className="h-3.5 w-3.5" /> },
  checkbox: { label: 'Checkbox', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  select: { label: 'Select', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', icon: <ChevronDown className="h-3.5 w-3.5" /> },
  multiselect: { label: 'Multi-select', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', icon: <ChevronDown className="h-3.5 w-3.5" /> },
};

const VISIBILITY_META: Record<ResponseVisibility, { label: string; icon: React.ReactNode; className: string }> = {
  private: {
    label: 'Private',
    icon: <Lock className="h-3 w-3" />,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  shared: {
    label: 'Shared',
    icon: <Share2 className="h-3 w-3" />,
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  public: {
    label: 'Public',
    icon: <Globe className="h-3 w-3" />,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

const RESPONSE_TYPES = Object.keys(TYPE_META);
const CHOICE_TYPES = ['select', 'multiselect', 'radio', 'checkbox', 'poll'];
const TEXT_TYPES = ['textbox', 'textarea'];
const PASSIVE_TYPES: PassiveContentType[] = ['link', 'highlight', 'note', 'audio', 'video', 'code_block', 'scripture_block'];

function typeMeta(type: string) {
  return TYPE_META[type] || {
    label: type,
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-200',
    icon: null,
  };
}

function typeAccent(type: string) {
  switch (type) {
    case 'media_response':
      return {
        ring: 'border-blue-300',
        header: 'bg-gradient-to-r from-blue-50 via-white to-white',
        circle: 'bg-blue-600 text-white shadow-blue-100',
        body: 'bg-blue-50/30',
      };
    case 'question':
      return {
        ring: 'border-blue-300',
        header: 'bg-gradient-to-r from-blue-50 via-white to-white',
        circle: 'bg-blue-600 text-white shadow-blue-100',
        body: 'bg-blue-50/30',
      };
    case 'poll':
      return {
        ring: 'border-purple-300',
        header: 'bg-gradient-to-r from-purple-50 via-white to-white',
        circle: 'bg-purple-600 text-white shadow-purple-100',
        body: 'bg-purple-50/30',
      };
    case 'textbox':
    case 'textarea':
      return {
        ring: 'border-emerald-300',
        header: 'bg-gradient-to-r from-emerald-50 via-white to-white',
        circle: 'bg-emerald-600 text-white shadow-emerald-100',
        body: 'bg-emerald-50/30',
      };
    case 'radio':
    case 'checkbox':
      return {
        ring: 'border-orange-300',
        header: 'bg-gradient-to-r from-orange-50 via-white to-white',
        circle: 'bg-orange-500 text-white shadow-orange-100',
        body: 'bg-orange-50/30',
      };
    case 'select':
    case 'multiselect':
      return {
        ring: 'border-teal-300',
        header: 'bg-gradient-to-r from-teal-50 via-white to-white',
        circle: 'bg-teal-600 text-white shadow-teal-100',
        body: 'bg-teal-50/30',
      };
    default:
      return {
        ring: 'border-gray-300',
        header: 'bg-gradient-to-r from-gray-50 via-white to-white',
        circle: 'bg-gray-700 text-white shadow-gray-100',
        body: 'bg-gray-50/30',
      };
  }
}

function TypeBadge({ type }: { type: string }) {
  const meta = typeMeta(type);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border ${meta.bg} ${meta.color}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

function Avatar({ name, url }: { name?: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-7 w-7 rounded-full object-cover shrink-0" />;
  const initials = (name || '?').split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
  const colors = [
    'bg-purple-200 text-purple-700',
    'bg-blue-200 text-blue-700',
    'bg-green-200 text-green-700',
    'bg-orange-200 text-orange-700',
    'bg-rose-200 text-rose-700',
  ];
  const idx = (name || '').charCodeAt(0) % colors.length;
  return <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colors[idx]}`}>{initials}</div>;
}

function fmtDate(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getItemLabel(item: BookResponseItem) {
  return (
    item.content_data?.question ||
    item.content_data?.label ||
    item.content_data?.prompt ||
    item.content_data?.title ||
    item.anchor_text ||
    item.content_data?.placeholder ||
    `(${item.content_type})`
  );
}

function normalizeDisplayText(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getResponseText(response: ResponseRowData, type: string) {
  if (type === 'poll') return response.selected_option || '—';
  if (type === 'question') return response.answer_text || response.selected_options?.join(', ') || '—';
  if (type === 'media_response') return response.body || response.media_url || response.response_type || '—';
  const value = response.response_data?.value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (value == null) return '—';
  return JSON.stringify(value);
}

function buildAggregatesForResponses(item: BookResponseItem, responses: ResponseRowData[]) {
  if (!CHOICE_TYPES.includes(item.content_type)) return null;
  const options = item.content_data?.options || [];
  const counts: Record<string, number> = {};
  options.forEach((option: { id: string }) => { counts[option.id] = 0; });

  responses.forEach(response => {
    if (item.content_type === 'poll') {
      if (response.selected_option && counts[response.selected_option] !== undefined) counts[response.selected_option] += 1;
      return;
    }
    const value = response.response_data?.value;
    if (Array.isArray(value)) {
      value.forEach(optionId => {
        if (typeof optionId === 'string' && counts[optionId] !== undefined) counts[optionId] += 1;
      });
      return;
    }
    if (typeof value === 'string' && counts[value] !== undefined) counts[value] += 1;
  });

  return {
    counts,
    total: responses.length,
    options: options.map((option: { id: string; text: string }) => ({
      id: option.id,
      text: option.text,
      count: counts[option.id] || 0,
      percent: responses.length > 0 ? Math.round(((counts[option.id] || 0) / responses.length) * 100) : 0,
    })),
  };
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const index = lower.indexOf(q);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

function getResponseUser(response: ResponseRowData) {
  if (Array.isArray(response.user)) return response.user[0] || null;
  return response.user || null;
}

function sourceMeta(item: BookResponseItem) {
  if (item.is_author_content) {
    return {
      label: 'Author',
      icon: <Crown className="h-3 w-3" />,
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: 'Reader',
    icon: <User className="h-3 w-3" />,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  };
}

function PassiveContentCard({ item }: { item: BookResponseItem }) {
  const data = item.content_data || {};
  const type = item.content_type as PassiveContentType;
  const creator = item.creator || null;
  const headerLabel = normalizeDisplayText(getItemLabel(item));

  const sourceHeader = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {creator && (
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-2 py-1">
          <Avatar name={creator.display_name} url={creator.avatar_url} />
          <span className="text-xs font-medium text-gray-700">{creator.display_name}</span>
        </div>
      )}
    </div>
  );

  if (type === 'link') {
    const linkLabel = data.title || data.url || 'Open link';
    const showLinkLabel = normalizeDisplayText(linkLabel) !== headerLabel;
    return (
      <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
        {sourceHeader}
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 mb-2">Link</p>
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          className="block text-sm font-medium text-cyan-800 hover:underline break-all"
        >
          {showLinkLabel ? linkLabel : data.url || 'Open link'}
        </a>
        {data.description && <p className="mt-2 text-sm text-cyan-900/80">{data.description}</p>}
      </div>
    );
  }

  if (type === 'highlight') {
    return (
      <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
        {sourceHeader}
        <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700 mb-2">Highlight</p>
        {item.anchor_text && (
          <p className="text-sm italic text-yellow-900 mb-2">“{item.anchor_text}”</p>
        )}
        {data.note && <p className="text-sm text-yellow-950/85">{data.note}</p>}
      </div>
    );
  }

  if (type === 'note') {
    return (
      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
        {sourceHeader}
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 mb-2">
          {data.type ? `${String(data.type).replace(/_/g, ' ')} note` : 'Note'}
        </p>
        <p className="text-sm text-violet-950/85 whitespace-pre-wrap">{data.text || data.note || item.content_data?.anchor_text || 'Note'}</p>
      </div>
    );
  }

  if (type === 'audio' || type === 'video') {
    const mediaTitle = data.title || data.url || `${type} item`;
    const showMediaTitle = normalizeDisplayText(mediaTitle) !== headerLabel && mediaTitle !== data.url;
    const embedUrl = type === 'video' ? getExternalEmbedUrl(data.url) : null;
    return (
      <div className={`mt-4 rounded-xl border px-4 py-3 ${type === 'audio' ? 'border-orange-200 bg-orange-50' : 'border-red-200 bg-red-50'}`}>
        {sourceHeader}
        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${type === 'audio' ? 'text-orange-700' : 'text-red-700'}`}>
          {type === 'audio' ? 'Audio' : 'Video'}
        </p>
        {showMediaTitle && (
          <p className={`text-sm font-medium ${type === 'audio' ? 'text-orange-950/85' : 'text-red-950/85'}`}>{mediaTitle}</p>
        )}
        {type === 'audio' && data.url && (
          <audio src={data.url} controls className="mt-2 h-9 w-full" preload="metadata" />
        )}
        {type === 'video' && embedUrl && (
          <span className="mt-2 block aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={embedUrl}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={data.title || 'Video'}
            />
          </span>
        )}
        {type === 'video' && data.url && !embedUrl && (
          <video src={data.url} controls className="mt-2 max-h-64 w-full rounded-lg bg-black" preload="metadata" playsInline />
        )}
        {data.url && (
          <a href={data.url} target="_blank" rel="noreferrer" className={`mt-2 inline-block text-sm hover:underline break-all ${type === 'audio' ? 'text-orange-800' : 'text-red-800'}`}>
            {data.url}
          </a>
        )}
      </div>
    );
  }

  if (type === 'code_block') {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        {sourceHeader}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">Code Block</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
          <code>{data.code || ''}</code>
        </pre>
      </div>
    );
  }

  if (type === 'scripture_block') {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        {sourceHeader}
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Scripture</p>
        <p className="text-sm font-semibold text-amber-900">{data.reference || 'Scripture block'}</p>
        {data.text && <p className="mt-2 text-sm italic text-amber-950/85">“{data.text}”</p>}
        {data.notes && <p className="mt-2 text-sm text-amber-950/80">{data.notes}</p>}
      </div>
    );
  }

  return null;
}

function AggregateChart({ item }: { item: BookResponseItem }) {
  if (!item.aggregates || item.total === 0) return <p className="text-xs text-gray-400 italic py-2">No responses yet</p>;
  return (
    <div className="space-y-2 mt-3">
      {item.aggregates.options.map((option: { id: string; text: string; count: number; percent: number }) => (
        <div key={option.id}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-700 font-medium truncate pr-4 flex-1">{option.text}</span>
            <span className="text-gray-500 shrink-0 tabular-nums">{option.count} · {option.percent}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${option.percent}%` }} />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-gray-400 pt-1">{item.total} {item.total === 1 ? 'response' : 'responses'}</p>
    </div>
  );
}

function ResponseRow({ response, type }: { response: ResponseRowData; type: string }) {
  const user = getResponseUser(response);
  const name = user?.display_name || 'Anonymous';
  const badge = response.visibility ? VISIBILITY_META[response.visibility] : null;
  const sharedUsers = response.shared_with_users || [];
  const clubs = response.club_contexts || [];
  const value = getResponseText(response, type);

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <Avatar name={name} url={user?.avatar_url} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-800">{name}</span>
          {response.is_correct === true && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
              <CheckCircle className="h-2.5 w-2.5" />
              Correct
            </span>
          )}
          {response.is_correct === false && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
              <XCircle className="h-2.5 w-2.5" />
              Incorrect
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-400 shrink-0">{fmtDate(response.updated_at || response.created_at)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          {badge && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${badge.className}`}>
              {badge.icon}
              {badge.label}
            </span>
          )}
          {clubs.slice(0, 2).map(club => (
            <span key={club.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-amber-50 text-amber-700 border-amber-200">
              <Users className="h-3 w-3" />
              {club.club_type === 'study_group' ? 'Group' : 'Club'}: {club.name}
            </span>
          ))}
          {sharedUsers.slice(0, 1).map(sharedUser => (
            <span key={sharedUser.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-cyan-50 text-cyan-700 border-cyan-200">
              <Share2 className="h-3 w-3" />
              Shared with {sharedUser.display_name}
            </span>
          ))}
        </div>
        {type === 'media_response' && response.response_type === 'audio' && response.media_url ? (
          <audio src={response.media_url} controls className="mt-1 h-9 w-full" preload="metadata" />
        ) : type === 'media_response' && response.response_type === 'video' && response.media_url ? (
          <video src={response.media_url} controls className="mt-1 max-h-52 w-full rounded-lg bg-black" preload="metadata" playsInline />
        ) : (
          <p className="text-sm text-gray-600 leading-relaxed break-words">{value}</p>
        )}
      </div>
    </div>
  );
}

function OptionsList({ item }: { item: BookResponseItem }) {
  const options = item.content_data?.options || [];
  if (!options.length) return null;
  const correctAnswer = item.content_data?.correct_answer;
  const correctIds = new Set<string>(Array.isArray(correctAnswer) ? correctAnswer : correctAnswer ? [correctAnswer] : []);

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Options</p>
      <div className="flex flex-col gap-1">
        {options.map((option: { id: string; text: string }) => {
          const isCorrect = correctIds.has(option.id);
          return (
            <div key={option.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${isCorrect ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
              <span className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'}`}>
                {isCorrect && <CheckCircle className="h-3 w-3 text-white" />}
              </span>
              <span className="flex-1">{option.text}</span>
              {isCorrect && <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide shrink-0">Correct</span>}
            </div>
          );
        })}
      </div>
      {item.content_data?.explanation && (
        <div className="mt-1 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Explanation</p>
          <p className="text-xs text-blue-800">{item.content_data.explanation}</p>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, searchQuery, itemNumber }: { item: BookResponseItem; searchQuery: string; itemNumber: number }) {
  const [expanded, setExpanded] = useState(true);
  const isChoice = CHOICE_TYPES.includes(item.content_type);
  const isText = TEXT_TYPES.includes(item.content_type);
  const isMediaResponse = item.content_type === 'media_response';
  const isPassive = PASSIVE_TYPES.includes(item.content_type as PassiveContentType);
  const hasOptions = !!item.content_data?.options?.length;
  const label = getItemLabel(item);
  const accent = typeAccent(item.content_type);
  const source = sourceMeta(item);
  const creator = item.creator || null;

  return (
    <div className={`rounded-2xl overflow-hidden border-2 shadow-sm transition-all hover:shadow-md ${accent.ring} bg-white`}>
      <button
        onClick={() => setExpanded(value => !value)}
        className={`w-full flex items-start gap-3 px-5 py-4 text-left transition-colors ${accent.header}`}
      >
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm ${accent.circle}`}>
          {itemNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <TypeBadge type={item.content_type} />
            {item.is_author_content && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${source.className}`}>
                {source.icon}
                {source.label}
              </span>
            )}
            {!isPassive && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${item.total > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                <Users className="h-3 w-3" />
                {item.total} {item.total === 1 ? 'response' : 'responses'}
              </span>
            )}
          </div>
          {!item.is_author_content && creator && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-2 py-1">
              <Avatar name={creator.display_name} url={creator.avatar_url} />
              <span className="text-xs font-medium text-gray-700">{creator.display_name}</span>
            </div>
          )}
          <p className="text-sm font-semibold text-gray-900 leading-snug">{highlightText(label, searchQuery)}</p>
        </div>
        <div className="mt-1 shrink-0 text-gray-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className={`px-5 pb-5 border-t border-gray-100 ${accent.body}`}>
          {isPassive && <PassiveContentCard item={item} />}

          {hasOptions && <OptionsList item={item} />}

          {isChoice && (
            <div className={hasOptions ? 'mt-4 pt-4 border-t border-gray-100' : ''}>
              {hasOptions && <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Results</p>}
              <AggregateChart item={item} />
            </div>
          )}

          {(isText || item.content_type === 'question' || isMediaResponse) && item.total > 0 && (
            <div className={`${hasOptions ? 'mt-4 pt-4 border-t border-gray-100' : 'mt-3'}`}>
              {hasOptions && <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Responses</p>}
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {item.responses.map((response: ResponseRowData) => (
                  <ResponseRow key={response.id} response={response} type={item.content_type} />
                ))}
              </div>
            </div>
          )}

          {isChoice && item.total > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Individual Responses</p>
              <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {item.responses.map((response: ResponseRowData) => (
                  <ResponseRow key={response.id} response={response} type={item.content_type} />
                ))}
              </div>
            </div>
          )}

          {item.total === 0 && !isPassive && <p className="text-xs text-gray-500 italic py-3">No responses yet</p>}
        </div>
      )}
    </div>
  );
}

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
      className={`w-full min-w-[170px] lg:min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${active ? 'bg-purple-50 border border-purple-200 text-purple-800' : 'hover:bg-gray-50 text-gray-700'}`}
    >
      <span className={`text-xs font-bold shrink-0 w-5 text-center ${active ? 'text-purple-600' : 'text-gray-400'}`}>{order >= 0 ? order + 1 : ''}</span>
      <span className="flex-1 text-xs font-medium leading-tight truncate">{title}</span>
      {count > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${active ? 'bg-purple-200 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>{count}</span>}
    </button>
  );
}

export default function BookResponsesViewer({
  bookId,
  chapterId: initialChapterId,
  compact = false,
  mode = 'author',
}: Props) {
  const [responseItems, setResponseItems] = useState<BookResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(initialChapterId || null);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [activeVisibilities, setActiveVisibilities] = useState<ResponseVisibility[]>([]);
  const [activeClubIds, setActiveClubIds] = useState<string[]>([]);
  const [activeSharedUserIds, setActiveSharedUserIds] = useState<string[]>([]);

  useEffect(() => {
    setActiveChapterId(initialChapterId || null);
  }, [initialChapterId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = mode === 'accessible'
          ? await api.getAccessibleBookResponses(bookId, initialChapterId)
          : await api.getBookResponses(bookId, initialChapterId);
        if (!cancelled) setResponseItems(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load responses');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [bookId, initialChapterId, mode]);

  const chapters = useMemo(() => {
    const byChapter = new Map<string, { id: string; title: string; order: number; count: number }>();
    responseItems.forEach(item => {
      const current = byChapter.get(item.chapter_id) || {
        id: item.chapter_id,
        title: item.chapter_title,
        order: item.chapter_order,
        count: 0,
      };
      current.count += item.total;
      byChapter.set(item.chapter_id, current);
    });
    return [...byChapter.values()].sort((a, b) => a.order - b.order);
  }, [responseItems]);

  const availableTypes = useMemo(() => RESPONSE_TYPES.filter(type => responseItems.some(item => item.content_type === type)), [responseItems]);

  const availableVisibilities = useMemo(() => {
    const seen = new Set<ResponseVisibility>();
    responseItems.forEach(item => item.responses.forEach((response: ResponseRowData) => {
      const visibility = response.visibility || 'shared';
      if (visibility === 'private' || visibility === 'shared' || visibility === 'public') seen.add(visibility);
    }));
    return ['private', 'shared', 'public'].filter(value => seen.has(value as ResponseVisibility)) as ResponseVisibility[];
  }, [responseItems]);

  const availableClubs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; club_type?: string | null }>();
    responseItems.forEach(item => item.responses.forEach((response: ResponseRowData) => {
      (response.club_contexts || []).forEach(club => {
        if (!map.has(club.id)) map.set(club.id, club);
      });
    }));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [responseItems]);

  const availableSharedUsers = useMemo(() => {
    const map = new Map<string, { id: string; display_name: string; avatar_url?: string | null }>();
    responseItems.forEach(item => item.responses.forEach((response: ResponseRowData) => {
      (response.shared_with_users || []).forEach(sharedUser => {
        if (!map.has(sharedUser.id)) map.set(sharedUser.id, sharedUser);
      });
    }));
    return [...map.values()].sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [responseItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return responseItems
      .filter(item => !activeChapterId || item.chapter_id === activeChapterId)
      .filter(item => activeTypes.length === 0 || activeTypes.includes(item.content_type))
      .map(item => {
        const label = getItemLabel(item).toLowerCase();
        const chapterTitle = item.chapter_title.toLowerCase();
        const labelMatches = !q || label.includes(q) || chapterTitle.includes(q);

        const responses = item.responses.filter((response: ResponseRowData) => {
          const visibility = (response.visibility || 'shared') as ResponseVisibility;
          if (activeVisibilities.length > 0 && !activeVisibilities.includes(visibility)) return false;
          if (activeClubIds.length > 0 && !(response.club_contexts || []).some(club => activeClubIds.includes(club.id))) return false;
          if (activeSharedUserIds.length > 0 && !(response.shared_with_users || []).some(sharedUser => activeSharedUserIds.includes(sharedUser.id))) return false;

          if (!q) return true;

          const name = getResponseUser(response)?.display_name?.toLowerCase() || '';
          const value = getResponseText(response, item.content_type).toLowerCase();
          const clubNames = (response.club_contexts || []).map(club => club.name.toLowerCase()).join(' ');
          const sharedNames = (response.shared_with_users || []).map(sharedUser => sharedUser.display_name.toLowerCase()).join(' ');

          return labelMatches || name.includes(q) || value.includes(q) || clubNames.includes(q) || sharedNames.includes(q);
        });

        const includeZeroResponseItem = activeVisibilities.length === 0 && activeClubIds.length === 0 && activeSharedUserIds.length === 0 && labelMatches;
        if (responses.length === 0 && !includeZeroResponseItem) return null;

        return {
          ...item,
          responses,
          total: responses.length,
          aggregates: buildAggregatesForResponses(item, responses),
        };
      })
      .filter((item): item is BookResponseItem => !!item);
  }, [responseItems, activeChapterId, activeTypes, activeVisibilities, activeClubIds, activeSharedUserIds, search]);

  const totalResponses = useMemo(() => filtered.reduce((sum, item) => sum + item.total, 0), [filtered]);
  const totalRespondents = useMemo(() => {
    const ids = new Set<string>();
    filtered.forEach(item => item.responses.forEach((response: ResponseRowData) => {
      if (response.user_id) ids.add(response.user_id);
    }));
    return ids.size;
  }, [filtered]);

  const groupedSections = useMemo(() => {
    const sections: {
      key: ResponseSectionKey;
      title: string;
      description: string;
      className: string;
      items: BookResponseItem[];
    }[] = [
      {
        key: 'author',
        title: 'Chapter Questions',
        description: mode === 'accessible'
          ? 'Questions and components built into the chapter, with reader answers grouped underneath.'
          : 'Questions and components built into the chapter, with submitted answers grouped underneath.',
        className: 'border-amber-200 bg-amber-50/70',
        items: filtered.filter(item => item.is_author_content),
      },
      {
        key: 'reader',
        title: 'Questions from Readers',
        description: 'Questions, notes, highlights, links, and other items added by readers while reading.',
        className: 'border-blue-200 bg-blue-50/70',
        items: filtered.filter(item => !item.is_author_content),
      },
    ];

    return sections.filter(section => section.items.length > 0);
  }, [filtered, mode]);

  const hasActiveFilters = !!activeChapterId || activeTypes.length > 0 || activeVisibilities.length > 0 || activeClubIds.length > 0 || activeSharedUserIds.length > 0 || !!search.trim();

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
        <h3 className="text-base font-semibold text-gray-800 mb-1">{mode === 'accessible' ? 'No accessible answers yet' : 'No interactive content yet'}</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          {mode === 'accessible'
            ? 'Public answers and shared club responses will appear here when they become available.'
            : 'Add questions, polls, or form fields to your chapters to see reader responses here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-col gap-3 px-5 py-4 bg-white border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search questions, answers, reader names, chapters…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(value => !value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors shrink-0 ${showFilters || hasActiveFilters ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {hasActiveFilters && (
              <span className="ml-0.5 bg-purple-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {(activeChapterId ? 1 : 0) + activeTypes.length + activeVisibilities.length + activeClubIds.length + activeSharedUserIds.length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 pt-1">
            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Chapter</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveChapterId(null)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${!activeChapterId ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  All chapters
                </button>
                {chapters.map(chapter => (
                  <button
                    key={chapter.id}
                    onClick={() => setActiveChapterId(current => current === chapter.id ? null : chapter.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${activeChapterId === chapter.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Ch {chapter.order + 1}: {chapter.title.length > 22 ? `${chapter.title.slice(0, 22)}…` : chapter.title}
                    {chapter.count > 0 && <span className="ml-1 opacity-70">({chapter.count})</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Response type</p>
              <div className="flex flex-wrap gap-1.5">
                {availableTypes.map(type => {
                  const meta = typeMeta(type);
                  const active = activeTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveTypes(current => active ? current.filter(entry => entry !== type) : [...current, type])}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${active ? 'bg-purple-600 text-white border-purple-600' : `${meta.bg} ${meta.color} hover:opacity-80`}`}
                    >
                      {meta.icon}
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {availableVisibilities.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Visibility</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableVisibilities.map(visibility => {
                    const active = activeVisibilities.includes(visibility);
                    const meta = VISIBILITY_META[visibility];
                    return (
                      <button
                        key={visibility}
                        onClick={() => setActiveVisibilities(current => active ? current.filter(entry => entry !== visibility) : [...current, visibility])}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${active ? 'bg-purple-600 text-white border-purple-600' : `${meta.className} hover:opacity-80`}`}
                      >
                        {meta.icon}
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {availableClubs.length > 0 && (
              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Club / Group</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableClubs.map(club => {
                    const active = activeClubIds.includes(club.id);
                    return (
                      <button
                        key={club.id}
                        onClick={() => setActiveClubIds(current => active ? current.filter(entry => entry !== club.id) : [...current, club.id])}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${active ? 'bg-purple-600 text-white border-purple-600' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                      >
                        {club.club_type === 'study_group' ? 'Group' : 'Club'}: {club.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {availableSharedUsers.length > 0 && (
              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Shared To User</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableSharedUsers.map(sharedUser => {
                    const active = activeSharedUserIds.includes(sharedUser.id);
                    return (
                      <button
                        key={sharedUser.id}
                        onClick={() => setActiveSharedUserIds(current => active ? current.filter(entry => entry !== sharedUser.id) : [...current, sharedUser.id])}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${active ? 'bg-purple-600 text-white border-purple-600' : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'}`}
                      >
                        {sharedUser.display_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {hasActiveFilters && !showFilters && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {activeChapterId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                Ch: {chapters.find(chapter => chapter.id === activeChapterId)?.title?.slice(0, 20) || '…'}
                <button onClick={() => setActiveChapterId(null)} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            {activeTypes.map(type => (
              <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                {typeMeta(type).label}
                <button onClick={() => setActiveTypes(current => current.filter(entry => entry !== type))} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {activeVisibilities.map(visibility => (
              <span key={visibility} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                {VISIBILITY_META[visibility].label}
                <button onClick={() => setActiveVisibilities(current => current.filter(entry => entry !== visibility))} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {activeClubIds.map(clubId => (
              <span key={clubId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                {availableClubs.find(club => club.id === clubId)?.name || 'Club'}
                <button onClick={() => setActiveClubIds(current => current.filter(entry => entry !== clubId))} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {activeSharedUserIds.map(sharedUserId => (
              <span key={sharedUserId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                {availableSharedUsers.find(sharedUser => sharedUser.id === sharedUserId)?.display_name || 'Shared user'}
                <button onClick={() => setActiveSharedUserIds(current => current.filter(entry => entry !== sharedUserId))} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <button
              onClick={() => {
                setActiveChapterId(null);
                setActiveTypes([]);
                setActiveVisibilities([]);
                setActiveClubIds([]);
                setActiveSharedUserIds([]);
                setSearch('');
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {!compact && chapters.length > 1 && (
          <div className="w-full lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Chapters</p>
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto pb-1 lg:pb-0">
              <ChapterSidebarItem
                title="All Chapters"
                order={-1}
                count={responseItems.reduce((sum, item) => sum + item.total, 0)}
                active={!activeChapterId}
                onClick={() => setActiveChapterId(null)}
              />
              {chapters.map(chapter => (
                <ChapterSidebarItem
                  key={chapter.id}
                  title={chapter.title}
                  order={chapter.order}
                  count={chapter.count}
                  active={activeChapterId === chapter.id}
                  onClick={() => setActiveChapterId(current => current === chapter.id ? null : chapter.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3 px-4 sm:px-5 py-3 bg-white border-b border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1.5 min-w-0">
              <Filter className="h-3.5 w-3.5" />
              <span><strong className="text-gray-700">{filtered.length}</strong> {filtered.length === 1 ? 'item' : 'items'}</span>
            </span>
            <span className="flex items-center gap-1.5 min-w-0">
              <MessageSquare className="h-3.5 w-3.5" />
              <span><strong className="text-gray-700">{totalResponses}</strong> {totalResponses === 1 ? 'response' : 'responses'}</span>
            </span>
            <span className="flex items-center gap-1.5 min-w-0">
              <Users className="h-3.5 w-3.5" />
              <span><strong className="text-gray-700">{totalRespondents}</strong> {totalRespondents === 1 ? 'respondent' : 'respondents'}</span>
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Search className="h-8 w-8 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">No matching responses</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="p-4 sm:p-5 space-y-4">
              {groupedSections.map(section => (
                <section key={section.key} className={`rounded-2xl border px-4 py-4 sm:px-5 ${section.className}`}>
                  <div className="mb-5">
                    <h3 className="text-base font-bold text-gray-900">{section.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{section.description}</p>
                  </div>

                  <div className="space-y-5">
                    {chapters
                      .filter(chapter => section.items.some(item => item.chapter_id === chapter.id))
                      .map(chapter => {
                        const chapterItems = section.items.filter(item => item.chapter_id === chapter.id);
                        return (
                          <div key={`${section.key}-${chapter.id}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="flex items-center gap-2 flex-1">
                                <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                  <span className="text-[9px] font-bold text-purple-600">{chapter.order + 1}</span>
                                </div>
                                <h4 className="text-sm font-bold text-gray-800 break-words">{chapter.title}</h4>
                                <span className="text-xs text-gray-400">{chapterItems.length} {chapterItems.length === 1 ? 'item' : 'items'}</span>
                              </div>
                              <div className="hidden sm:block flex-1 h-px bg-gray-200" />
                            </div>
                            <div className="space-y-4">
                              {chapterItems.map((item, index) => (
                                <ItemCard
                                  key={item.id}
                                  item={item}
                                  searchQuery={search}
                                  itemNumber={index + 1}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
