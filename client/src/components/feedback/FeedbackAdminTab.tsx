import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bug, Sparkles, HelpCircle, MessageSquare, ChevronLeft,
  Loader2, AlertCircle, Volume2, Image, X,
  ToggleLeft, ToggleRight, MessageSquarePlus,
  Send,
} from 'lucide-react';
import type { Feedback, FeedbackStatus, FeedbackType, FeedbackConfig, FeedbackComment, AnnotationCommand } from '../../types';
import api from '../../lib/api';

// ── Type & status configs ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<FeedbackType, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  bug:      { label: 'Bug',     color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',       Icon: Bug },
  feature:  { label: 'Feature', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',   Icon: Sparkles },
  question: { label: 'Question',color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: HelpCircle },
  comment:  { label: 'Comment', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',      Icon: MessageSquare },
};

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string }> = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  closed:      { label: 'Closed',      color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Admin Config Panel ────────────────────────────────────────────────────────

function AdminConfigSection() {
  const [config, setConfig] = useState<FeedbackConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.getFeedbackConfig().then(setConfig).catch(() => {});
  }, []);

  async function toggleEnabled() {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await api.updateFeedbackConfig({ enabled: !config.enabled });
      setConfig(updated);
    } finally {
      setSaving(false);
    }
  }

  if (!config) return null;

  return (
    <div className="mb-6 theme-section rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4 text-purple-500" />
          <span className="font-medium text-sm text-theme">Feedback Configuration</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${config.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <ChevronLeft className={`h-4 w-4 text-muted transition-transform ${open ? '-rotate-90' : 'rotate-180'}`} />
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)] px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme">Feedback enabled globally</p>
              <p className="text-xs text-muted">When disabled, no users can submit feedback</p>
            </div>
            <button onClick={toggleEnabled} disabled={saving} className="text-muted hover:text-theme transition-colors disabled:opacity-50">
              {config.enabled
                ? <ToggleRight className="h-7 w-7 text-green-500" />
                : <ToggleLeft className="h-7 w-7" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screenshot Viewer ─────────────────────────────────────────────────────────

function ScreenshotViewer({ screenshots, startIdx, onClose }: {
  screenshots: Feedback['screenshots'];
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  if (!screenshots || screenshots.length === 0) return null;
  const shot = screenshots[idx];

  return (
    <div className="fixed inset-0 z-[400] bg-black/90 flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-white/70 text-sm">Screenshot {idx + 1} of {screenshots.length}</span>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Image + annotations */}
      <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-4" onClick={e => e.stopPropagation()}>
        <div className="relative max-w-full">
          <img
            src={shot.storage_path}
            alt={`Screenshot ${idx + 1}`}
            className="block max-h-[80vh] w-auto"
            onLoad={e => {
              setNaturalW(e.currentTarget.naturalWidth);
              setNaturalH(e.currentTarget.naturalHeight);
            }}
          />
          <AnnotationOverlay
            annotations={shot.annotation_data ?? []}
            naturalW={naturalW}
            naturalH={naturalH}
          />
        </div>
      </div>

      {/* Note + audio strip */}
      {((shot as any).note || (shot as any).screenshot_audio_path) && (
        <div className="shrink-0 bg-gray-900 border-t border-gray-700 px-4 py-3 space-y-2" onClick={e => e.stopPropagation()}>
          {(shot as any).note && (
            <p className="text-sm text-gray-200 whitespace-pre-wrap">{(shot as any).note}</p>
          )}
          {(shot as any).screenshot_audio_path && (
            <audio src={(shot as any).screenshot_audio_path} controls className="w-full" style={{ height: 32 }} />
          )}
        </div>
      )}

      {/* Dot nav */}
      {screenshots.length > 1 && (
        <div className="shrink-0 flex justify-center gap-2 py-3" onClick={e => e.stopPropagation()}>
          {screenshots.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); setNaturalW(0); setNaturalH(0); }}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/30 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// AnnotationOverlay: SVG drawn in natural image coordinate space.
// The parent must be position:relative and the img must be block/w-full.
function AnnotationOverlay({ annotations, naturalW, naturalH }: {
  annotations: AnnotationCommand[];
  naturalW: number;
  naturalH: number;
}) {
  if (!annotations || annotations.length === 0 || !naturalW || !naturalH) return null;
  const strokeW = Math.max(naturalW, naturalH) * 0.003;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${naturalW} ${naturalH}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {annotations.map((cmd, i) => {
        if (cmd.tool === 'freehand' && cmd.points.length > 1) {
          const d = cmd.points.map((p, pi) => `${pi === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
          return <path key={i} d={d} stroke={cmd.color} strokeWidth={strokeW} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
        }
        if (cmd.tool === 'circle' && cmd.points.length >= 2) {
          const p0 = cmd.points[0], p1 = cmd.points[cmd.points.length - 1];
          const cx = (p0.x + p1.x) / 2, cy = (p0.y + p1.y) / 2;
          const rx = Math.abs(p1.x - p0.x) / 2, ry = Math.abs(p1.y - p0.y) / 2;
          return <ellipse key={i} cx={cx} cy={cy} rx={Math.max(rx, 1)} ry={Math.max(ry, 1)} stroke={cmd.color} strokeWidth={strokeW} fill="none" />;
        }
        if (cmd.tool === 'highlight' && cmd.points.length >= 2) {
          const p0 = cmd.points[0], p1 = cmd.points[cmd.points.length - 1];
          return <rect key={i}
            x={Math.min(p0.x, p1.x)} y={Math.min(p0.y, p1.y)}
            width={Math.abs(p1.x - p0.x)} height={Math.abs(p1.y - p0.y)}
            fill={cmd.color + '55'} stroke={cmd.color + '88'} strokeWidth={strokeW * 0.4}
          />;
        }
        return null;
      })}
    </svg>
  );
}

// Single screenshot card: image + annotations + note + audio all visible
function ScreenshotCard({ shot, index, onClick }: {
  shot: NonNullable<Feedback['screenshots']>[0];
  index: number;
  onClick: () => void;
}) {
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.naturalWidth) {
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);
    }
  }, []);

  return (
    <div className="theme-section rounded-xl overflow-hidden border border-[var(--color-border)]">
      {/* Screenshot number */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-xs font-medium text-muted">Screenshot {index + 1}</span>
        <button
          onClick={onClick}
          className="text-xs text-purple-500 hover:text-purple-600 transition-colors"
        >
          View fullscreen
        </button>
      </div>

      {/* Image with annotations overlaid */}
      <div className="relative bg-gray-100 dark:bg-gray-900 cursor-zoom-in" onClick={onClick}>
        <img
          ref={imgRef}
          src={shot.storage_path}
          alt={`Screenshot ${index + 1}`}
          className="w-full h-auto block"
          onLoad={e => {
            const img = e.currentTarget;
            setNaturalW(img.naturalWidth);
            setNaturalH(img.naturalHeight);
          }}
        />
        <AnnotationOverlay
          annotations={shot.annotation_data ?? []}
          naturalW={naturalW}
          naturalH={naturalH}
        />
      </div>

      {/* Note */}
      {(shot as any).note && (
        <div className="px-3 py-2.5 border-t border-[var(--color-border)] bg-blue-50 dark:bg-blue-950/30">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Note</p>
          <p className="text-sm text-theme whitespace-pre-wrap">{(shot as any).note}</p>
        </div>
      )}

      {/* Per-screenshot audio */}
      {(shot as any).screenshot_audio_path && (
        <div className="px-3 py-2.5 border-t border-[var(--color-border)]">
          <p className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
            <Volume2 className="h-3 w-3" /> Audio note
          </p>
          <audio src={(shot as any).screenshot_audio_path} controls className="w-full" style={{ height: 32 }} />
        </div>
      )}
    </div>
  );
}

// ── Detail View ───────────────────────────────────────────────────────────────

function FeedbackDetail({ feedback, onBack, onUpdated }: {
  feedback: Feedback;
  onBack: () => void;
  onUpdated: (f: Feedback) => void;
}) {
  const [detail, setDetail] = useState<Feedback>(feedback);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [screenshotViewIdx, setScreenshotViewIdx] = useState<number | null>(null);

  async function loadDetail() {
    try {
      const d = await api.getFeedbackDetail(feedback.id);
      setDetail(d);
      onUpdated(d);
    } catch {}
  }

  useEffect(() => { loadDetail(); }, [feedback.id]);

  async function changeStatus(status: FeedbackStatus) {
    setStatusUpdating(true);
    try {
      const updated = await api.updateFeedbackStatus(detail.id, status);
      setDetail(d => ({ ...d, status: updated.status }));
      onUpdated({ ...detail, status: updated.status });
    } finally {
      setStatusUpdating(false);
    }
  }

  async function sendReply() {
    if (!replyBody.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const comment: FeedbackComment = await api.addFeedbackComment(detail.id, replyBody.trim());
      setDetail(d => ({ ...d, comments: [...(d.comments ?? []), comment] }));
      setReplyBody('');
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  const TypeCfg = TYPE_CONFIG[detail.type];
  const StatusCfg = STATUS_CONFIG[detail.status];

  return (
    <div>
      {screenshotViewIdx !== null && detail.screenshots && (
        <ScreenshotViewer
          screenshots={detail.screenshots}
          startIdx={screenshotViewIdx}
          onClose={() => setScreenshotViewIdx(null)}
        />
      )}

      {/* Back + header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={onBack} className="mt-0.5 p-1.5 rounded-lg text-muted hover:text-theme hover:bg-surface-hover transition-colors shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TypeCfg.color}`}>
              <TypeCfg.Icon className="h-3 w-3" />
              {TypeCfg.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${StatusCfg.color}`}>{StatusCfg.label}</span>
          </div>
          <h2 className="font-semibold text-theme text-lg leading-tight">{detail.title}</h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted">
            {detail.user?.avatar_url
              ? <img src={detail.user.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
              : <div className="h-4 w-4 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center"><span className="text-[9px] text-purple-600">{detail.user?.display_name?.[0]?.toUpperCase() ?? '?'}</span></div>}
            <span>{detail.user?.display_name ?? detail.user?.email ?? 'Unknown'}</span>
            <span>·</span>
            <span>{timeAgo(detail.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Status changer */}
      <div className="theme-section rounded-xl p-4 mb-4">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_CONFIG) as FeedbackStatus[]).map(s => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              disabled={statusUpdating || s === detail.status}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:cursor-default ${
                s === detail.status
                  ? STATUS_CONFIG[s].color + ' border-transparent ring-2 ring-purple-400'
                  : 'border-[var(--color-border)] text-muted hover:bg-surface-hover'
              }`}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      {detail.description && (
        <div className="theme-section rounded-xl p-4 mb-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Description</p>
          <p className="text-sm text-theme whitespace-pre-wrap">{detail.description}</p>
        </div>
      )}

      {/* Page URL */}
      {detail.page_url && (
        <div className="theme-section rounded-xl p-4 mb-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Page URL</p>
          <p className="text-xs text-muted font-mono break-all">{detail.page_url}</p>
        </div>
      )}

      {/* Screenshots — each shown full-width with annotations, note, audio */}
      {detail.screenshots && detail.screenshots.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3 flex items-center gap-1 px-1">
            <Image className="h-3.5 w-3.5" />
            Screenshots ({detail.screenshots.length})
          </p>
          <div className="space-y-4">
            {detail.screenshots.map((s, i) => (
              <ScreenshotCard
                key={s.id ?? i}
                shot={s}
                index={i}
                onClick={() => setScreenshotViewIdx(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Audio */}
      {detail.audio && (
        <div className="theme-section rounded-xl p-4 mb-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
            <Volume2 className="h-3.5 w-3.5" />
            Audio Message {detail.audio.duration_seconds ? `(${Math.round(detail.audio.duration_seconds)}s)` : ''}
          </p>
          <audio src={detail.audio.storage_path} controls className="w-full" style={{ height: 36 }} />
        </div>
      )}

      {/* Discussion thread */}
      <div className="theme-section rounded-xl p-4 mb-4">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Discussion</p>
        {(!detail.comments || detail.comments.length === 0) && (
          <p className="text-sm text-muted">No replies yet. Add a reply below to notify the user.</p>
        )}
        <div className="space-y-3">
          {(detail.comments ?? []).map(c => (
            <div key={c.id} className="flex gap-3">
              {c.author?.avatar_url
                ? <img src={c.author.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mt-0.5" />
                : <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs text-purple-600">{c.author?.display_name?.[0]?.toUpperCase() ?? '?'}</span>
                  </div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-theme">{c.author?.display_name ?? 'Admin'}</span>
                  <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm text-muted mt-0.5 whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Reply input */}
        <div className="mt-4 space-y-2">
          {sendError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />{sendError}
            </p>
          )}
          <textarea
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            placeholder="Write a reply (the user will be notified)…"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-theme text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
          />
          <button
            onClick={sendReply}
            disabled={!replyBody.trim() || sending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Reply
          </button>
        </div>
      </div>
    </div>
  );
}

// ── List Card ─────────────────────────────────────────────────────────────────

function FeedbackCard({ item, onClick }: { item: Feedback; onClick: () => void }) {
  const TypeCfg = TYPE_CONFIG[item.type];
  const StatusCfg = STATUS_CONFIG[item.status];

  return (
    <button
      onClick={onClick}
      className="w-full text-left theme-section rounded-xl p-4 hover:bg-surface-hover transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* User avatar */}
        {item.user?.avatar_url
          ? <img src={item.user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0 mt-0.5" />
          : <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm text-purple-600">{item.user?.display_name?.[0]?.toUpperCase() ?? '?'}</span>
            </div>}

        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TypeCfg.color}`}>
              <TypeCfg.Icon className="h-2.5 w-2.5" />
              {TypeCfg.label}
            </span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${StatusCfg.color}`}>{StatusCfg.label}</span>
            {item.audio && <span title="Has audio"><Volume2 className="h-3 w-3 text-muted" /></span>}
          </div>

          {/* Title */}
          <p className="font-medium text-sm text-theme truncate">{item.title}</p>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted">
            <span className="truncate">{item.user?.display_name ?? item.user?.email ?? '—'}</span>
            <span>·</span>
            <span className="shrink-0">{timeAgo(item.created_at)}</span>
          </div>

          {/* Screenshot thumbnails */}
          {item.screenshots && item.screenshots.length > 0 && (
            <div className="flex gap-1 mt-2">
              {item.screenshots.slice(0, 3).map((s, i) => (
                <img
                  key={s.id ?? i}
                  src={s.storage_path}
                  alt=""
                  className="h-8 w-12 object-cover rounded border border-surface-hover"
                />
              ))}
              {item.screenshots.length > 3 && (
                <div className="h-8 w-8 rounded border border-surface-hover bg-surface-hover flex items-center justify-center text-[10px] text-muted">
                  +{item.screenshots.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main Tab Component ────────────────────────────────────────────────────────

export default function FeedbackAdminTab() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Feedback | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | ''>('');
  const [filterType, setFilterType] = useState<FeedbackType | ''>('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminGetFeedback({
        ...(filterStatus ? { status: filterStatus as FeedbackStatus } : {}),
        ...(filterType ? { type: filterType as FeedbackType } : {}),
        page: p,
        limit: 20,
      });
      setItems(res.data ?? []);
      setCount(res.count ?? 0);
      setPage(p);
    } catch (err: any) {
      console.error('[FeedbackAdminTab] load error:', err);
      setError(err.message || 'Unknown error loading feedback');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => { load(1); }, [load]);

  const totalPages = Math.ceil(count / 20);

  if (selected) {
    return (
      <FeedbackDetail
        feedback={selected}
        onBack={() => setSelected(null)}
        onUpdated={(updated) => {
          setItems(prev => prev.map(i => i.id === updated.id ? { ...i, status: updated.status } : i));
          setSelected(updated);
        }}
      />
    );
  }

  return (
    <div>
      <AdminConfigSection />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as FeedbackStatus | '')}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-theme text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_CONFIG) as FeedbackStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as FeedbackType | '')}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-theme text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">All types</option>
          {(Object.keys(TYPE_CONFIG) as FeedbackType[]).map(t => (
            <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
          ))}
        </select>

        <span className="text-sm text-muted self-center ml-auto">{count} total</span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm mb-4">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Failed to load feedback</p>
            <p className="mt-0.5 opacity-80">{error}</p>
            <button onClick={() => load(1)} className="mt-2 text-xs underline opacity-80 hover:opacity-100">Retry</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <MessageSquarePlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No feedback found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <FeedbackCard key={item.id} item={item} onClick={() => setSelected(item)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-muted hover:text-theme disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-muted hover:text-theme disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
