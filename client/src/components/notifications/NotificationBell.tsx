import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, UserPlus, MessageSquare, Star, XCircle } from 'lucide-react';
import api from '../../lib/api';
import type { UserNotification } from '../../types';

function notificationIcon(type: UserNotification['type']) {
  switch (type) {
    case 'invite': return <UserPlus className="h-3.5 w-3.5 text-blue-500" />;
    case 'comment':
    case 'comment_reply': return <MessageSquare className="h-3.5 w-3.5 text-green-500" />;
    case 'review_submitted': return <Star className="h-3.5 w-3.5 text-yellow-500" />;
    case 'review_approved': return <Check className="h-3.5 w-3.5 text-green-500" />;
    case 'review_rejected': return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    default: return <Bell className="h-3.5 w-3.5 text-muted" />;
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll for unread count every 30 seconds
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function fetchCount() {
    try {
      const { count } = await api.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // silently fail
    }
  }

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setRecent(data.slice(0, 5));
      setUnreadCount(data.filter((n: UserNotification) => !n.read_at).length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 text-muted hover:text-theme rounded-md transition-colors hover:bg-surface-hover"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 theme-modal rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-theme">
            <span className="font-semibold text-theme text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* List */}
          <div className="divide-y divide-theme max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent"></div>
              </div>
            ) : recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted text-sm">
                No notifications yet
              </div>
            ) : (
              recent.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 flex gap-3 items-start ${!n.read_at ? 'bg-accent/5' : ''}`}
                >
                  <div className="mt-0.5 flex-shrink-0">{notificationIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${!n.read_at ? 'font-medium text-theme' : 'text-muted'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted mt-0.5 truncate">{n.body}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted flex-shrink-0">{timeAgo(n.created_at)}</span>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <Link
            to="/inbox"
            onClick={() => setOpen(false)}
            className="block text-center text-sm text-accent hover:underline px-4 py-3 border-t-2 border-theme"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
