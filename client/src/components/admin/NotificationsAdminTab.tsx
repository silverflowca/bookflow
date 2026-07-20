import { useEffect, useState, useCallback } from 'react';
import { Bell, Mail, CheckCircle2, XCircle, RefreshCw, ChevronDown, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface NotificationLogEntry {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  email_to: string | null;
  email_sent: boolean;
  email_error: string | null;
  book_id: string | null;
  club_id: string | null;
  created_at: string;
  recipient?: { display_name: string } | null;
}

interface NotificationConfig {
  email_notifications_enabled: boolean;
  notification_type_config: Record<string, boolean>;
}

// All known notification types
const ALL_TYPES = [
  'comment', 'comment_reply',
  'invite',
  'review_submitted', 'review_approved', 'review_rejected',
  'feedback_reply',
  'club_invite', 'club_book_added', 'club_discussion', 'club_discussion_reply',
  'club_join_request', 'club_request_declined', 'club_invite_cancelled',
  'chat_message', 'chat_mention', 'status_update',
  'group_invite', 'group_book_added', 'group_session',
  'group_chapter_due', 'group_discussion', 'group_discussion_reply', 'group_progress',
];

const TYPE_LABELS: Record<string, string> = {
  comment: 'Comment', comment_reply: 'Comment Reply',
  invite: 'Book Invite',
  review_submitted: 'Review Submitted', review_approved: 'Review Approved', review_rejected: 'Review Rejected',
  feedback_reply: 'Feedback Reply',
  club_invite: 'Club Invite', club_book_added: 'Club Book Added',
  club_discussion: 'Club Discussion', club_discussion_reply: 'Club Discussion Reply',
  club_join_request: 'Join Request', club_request_declined: 'Request Declined', club_invite_cancelled: 'Invite Cancelled',
  chat_message: 'Chat Message', chat_mention: 'Chat Mention', status_update: 'Status Update',
  group_invite: 'Group Invite', group_book_added: 'Group Book Added', group_session: 'Group Session',
  group_chapter_due: 'Chapter Due', group_discussion: 'Group Discussion',
  group_discussion_reply: 'Group Discussion Reply', group_progress: 'Group Progress',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    comment: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    comment_reply: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    invite: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    club_invite: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    club_join_request: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    chat_message: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    chat_mention: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    feedback_reply: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    review_submitted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    review_approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    review_rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  const cls = colors[type] ?? 'bg-strong/10 text-muted';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function NotificationsAdminTab() {
  const [log, setLog] = useState<NotificationLogEntry[]>([]);
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [logLoading, setLogLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const data = await api.adminGetNotificationLog(filterType ? { type: filterType } : undefined);
      setLog(data);
    } catch (e) {
      console.error('Failed to load notification log:', e);
    } finally {
      setLogLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  useEffect(() => {
    api.adminGetNotificationConfig()
      .then(setConfig)
      .catch(console.error);
  }, []);

  async function toggleMaster() {
    if (!config) return;
    const updated = { ...config, email_notifications_enabled: !config.email_notifications_enabled };
    setConfig(updated);
    setConfigSaving(true);
    try {
      await api.adminUpdateNotificationConfig({ email_notifications_enabled: updated.email_notifications_enabled });
    } catch (e) {
      console.error('Failed to save config:', e);
      setConfig(config); // revert
    } finally {
      setConfigSaving(false);
    }
  }

  async function toggleType(type: string) {
    if (!config) return;
    const current = config.notification_type_config[type] ?? true;
    const updated = {
      ...config,
      notification_type_config: { ...config.notification_type_config, [type]: !current },
    };
    setConfig(updated);
    setConfigSaving(true);
    try {
      await api.adminUpdateNotificationConfig({ notification_type_config: updated.notification_type_config });
    } catch (e) {
      console.error('Failed to save config:', e);
      setConfig(config);
    } finally {
      setConfigSaving(false);
    }
  }

  const filtered = log.filter(entry => {
    if (filterStatus === 'sent' && !entry.email_sent) return false;
    if (filterStatus === 'failed' && (entry.email_sent || !entry.email_to)) return false;
    return true;
  });

  const sentCount = log.filter(e => e.email_sent).length;
  const failedCount = log.filter(e => e.email_to && !e.email_sent).length;
  const noEmailCount = log.filter(e => !e.email_to).length;

  return (
    <div className="space-y-6">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="theme-section rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-theme">{log.length}</p>
          <p className="text-xs text-muted mt-0.5">Total (last 200)</p>
        </div>
        <div className="theme-section rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-500">{sentCount}</p>
          <p className="text-xs text-muted mt-0.5">Emails sent</p>
        </div>
        <div className="theme-section rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{failedCount}</p>
          <p className="text-xs text-muted mt-0.5">Failed / blocked</p>
        </div>
      </div>

      {/* ── Config section ── */}
      <div className="theme-section rounded-xl overflow-hidden">
        <button
          onClick={() => setShowConfig(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted" />
            <span className="font-semibold text-theme text-sm">Email Notification Settings</span>
            {configSaving && <span className="text-xs text-muted ml-2">Saving…</span>}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted transition-transform ${showConfig ? 'rotate-180' : ''}`} />
        </button>

        {showConfig && config && (
          <div className="border-t border-strong/10 px-5 py-4 space-y-5">
            {/* Master toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-theme">Email Notifications</p>
                <p className="text-xs text-muted mt-0.5">Master on/off switch for all email sends</p>
              </div>
              <button
                onClick={toggleMaster}
                className={`flex items-center gap-1.5 text-sm font-medium ${config.email_notifications_enabled ? 'text-emerald-600' : 'text-muted'}`}
              >
                {config.email_notifications_enabled
                  ? <ToggleRight className="h-7 w-7 text-emerald-500" />
                  : <ToggleLeft className="h-7 w-7 text-muted" />
                }
                {config.email_notifications_enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {/* Per-type toggles */}
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Per-type email toggle</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_TYPES.map(type => {
                  const enabled = config.notification_type_config[type] !== false;
                  return (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                        enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-strong/5 text-muted'
                      }`}
                    >
                      <span className="text-sm">{TYPE_LABELS[type] ?? type}</span>
                      {enabled
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        : <XCircle className="h-4 w-4 text-muted flex-shrink-0" />
                      }
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Log ── */}
      <div className="theme-section rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-strong/10">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted" />
            <span className="font-semibold text-theme text-sm">Notification Log</span>
            <span className="text-xs text-muted">({filtered.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Type filter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-xs theme-input rounded-lg px-2 py-1.5 border border-strong/20"
            >
              <option value="">All types</option>
              {ALL_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
            </select>
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as 'all' | 'sent' | 'failed')}
              className="text-xs theme-input rounded-lg px-2 py-1.5 border border-strong/20"
            >
              <option value="all">All</option>
              <option value="sent">Email sent</option>
              <option value="failed">Failed/blocked</option>
            </select>
            <button
              onClick={loadLog}
              disabled={logLoading}
              className="p-1.5 rounded-lg hover:bg-strong/10 text-muted disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${logLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {logLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-strong" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted text-sm">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No notifications logged yet.</p>
            <p className="text-xs mt-1 opacity-60">Notifications will appear here as they are sent.</p>
          </div>
        ) : (
          <div className="divide-y divide-strong/5">
            {filtered.map(entry => (
              <div key={entry.id}>
                <button
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-strong/5 transition-colors"
                >
                  {/* Status icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {!entry.email_to ? (
                      <div className="w-2 h-2 rounded-full bg-strong/30 mt-1" title="In-app only" />
                    ) : entry.email_sent ? (
                      <span title="Email sent"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></span>
                    ) : (
                      <span title="Email failed/blocked"><XCircle className="h-4 w-4 text-red-400" /></span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TypeBadge type={entry.type} />
                      <span className="text-sm font-medium text-theme truncate">{entry.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                      {entry.recipient?.display_name && (
                        <span>→ {entry.recipient.display_name}</span>
                      )}
                      {entry.email_to && !entry.email_sent && entry.email_error && (
                        <span className="text-red-400 truncate">{entry.email_error}</span>
                      )}
                      <span className="ml-auto flex-shrink-0">{timeAgo(entry.created_at)}</span>
                    </div>
                  </div>

                  <ChevronDown className={`h-3.5 w-3.5 text-muted flex-shrink-0 mt-1 transition-transform ${expandedId === entry.id ? 'rotate-180' : ''}`} />
                </button>

                {expandedId === entry.id && (
                  <div className="px-5 pb-4 pt-1 bg-strong/3 text-xs space-y-1.5 text-muted border-t border-strong/5">
                    {entry.body && <p><span className="text-theme font-medium">Body:</span> {entry.body}</p>}
                    <p><span className="text-theme font-medium">Email to:</span> {entry.email_to ?? '—'}</p>
                    <p><span className="text-theme font-medium">Email sent:</span> {entry.email_sent ? 'Yes' : 'No'}</p>
                    {entry.email_error && <p><span className="text-red-400 font-medium">Reason:</span> {entry.email_error}</p>}
                    {entry.book_id && <p><span className="text-theme font-medium">Book:</span> {entry.book_id}</p>}
                    {entry.club_id && <p><span className="text-theme font-medium">Club:</span> {entry.club_id}</p>}
                    <p><span className="text-theme font-medium">Time:</span> {new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!logLoading && log.length > 0 && (
          <div className="px-5 py-3 border-t border-strong/10 text-xs text-muted text-center">
            Showing last {log.length} notifications · {noEmailCount} in-app only · {sentCount} emails sent · {failedCount} failed
          </div>
        )}
      </div>
    </div>
  );
}
