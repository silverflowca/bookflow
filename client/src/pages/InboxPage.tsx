import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, BookOpen, MessageSquare, UserPlus, Star, XCircle, Loader2 } from 'lucide-react';
import api from '../lib/api';
import type { UserNotification } from '../types';

function notificationIcon(type: UserNotification['type']) {
  switch (type) {
    case 'invite': return <UserPlus className="h-4 w-4 text-blue-500" />;
    case 'comment':
    case 'comment_reply': return <MessageSquare className="h-4 w-4 text-green-500" />;
    case 'review_submitted': return <Star className="h-4 w-4 text-yellow-500" />;
    case 'review_approved': return <Check className="h-4 w-4 text-green-500" />;
    case 'review_rejected': return <XCircle className="h-4 w-4 text-red-500" />;
    default: return <Bell className="h-4 w-4 text-muted" />;
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function InboxPage() {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-theme">Inbox</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 text-sm text-muted hover:text-theme transition-colors"
          >
            {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 theme-section rounded-xl">
          <Bell className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-1">All caught up!</h3>
          <p className="text-muted">You have no notifications.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`theme-section rounded-xl p-4 flex gap-4 transition-colors ${
                !notification.read_at ? 'border-l-4 border-accent' : ''
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {notificationIcon(notification.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${!notification.read_at ? 'text-theme' : 'text-muted'}`}>
                  {notification.title}
                </p>
                {notification.body && (
                  <p className="text-sm text-muted mt-0.5 truncate">{notification.body}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted">{timeAgo(notification.created_at)}</span>
                  {notification.book_id && (
                    <Link
                      to={`/edit/book/${notification.book_id}`}
                      className="flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      <BookOpen className="h-3 w-3" />
                      View book
                    </Link>
                  )}
                  {notification.invite_token && (
                    <Link
                      to={`/invite/${notification.invite_token}`}
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      Accept invite →
                    </Link>
                  )}
                </div>
              </div>

              {/* Mark read button */}
              {!notification.read_at && (
                <button
                  onClick={() => handleMarkRead(notification.id)}
                  className="flex-shrink-0 text-muted hover:text-accent transition-colors"
                  title="Mark as read"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
