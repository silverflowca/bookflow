import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft, Users, Search, Send, BookOpen,
  MessageSquare, BookOpenCheck, Clock, BarChart2, BookMarked
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { useBookChat } from '../hooks/useBookChat';
import type { Book, BookChatMessage, BookChatReader } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const USER_COLORS = [
  { avatarBg: '#ede9fe', avatarText: '#6d28d9', bubbleBg: '#f5f3ff', bubbleBorder: '#c4b5fd', nameColor: '#6d28d9' },
  { avatarBg: '#dbeafe', avatarText: '#1d4ed8', bubbleBg: '#eff6ff', bubbleBorder: '#93c5fd', nameColor: '#1d4ed8' },
  { avatarBg: '#dcfce7', avatarText: '#15803d', bubbleBg: '#f0fdf4', bubbleBorder: '#86efac', nameColor: '#15803d' },
  { avatarBg: '#ffedd5', avatarText: '#c2410c', bubbleBg: '#fff7ed', bubbleBorder: '#fdba74', nameColor: '#c2410c' },
  { avatarBg: '#fce7f3', avatarText: '#be185d', bubbleBg: '#fdf2f8', bubbleBorder: '#f9a8d4', nameColor: '#be185d' },
  { avatarBg: '#ccfbf1', avatarText: '#0f766e', bubbleBg: '#f0fdfa', bubbleBorder: '#5eead4', nameColor: '#0f766e' },
  { avatarBg: '#fee2e2', avatarText: '#b91c1c', bubbleBg: '#fef2f2', bubbleBorder: '#fca5a5', nameColor: '#b91c1c' },
  { avatarBg: '#fef9c3', avatarText: '#a16207', bubbleBg: '#fefce8', bubbleBorder: '#fde047', nameColor: '#a16207' },
];

function userColor(userId?: string | null) {
  if (!userId) return USER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return USER_COLORS[hash % USER_COLORS.length];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

function Avatar({ displayName, avatarUrl, userId, size = 'md' }: {
  displayName: string;
  avatarUrl?: string | null;
  userId?: string | null;
  size?: 'sm' | 'md';
}) {
  const cls = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
  const color = userColor(userId);
  if (avatarUrl) {
    return <img src={avatarUrl} alt={displayName} className={`${cls} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
      style={{ backgroundColor: color.avatarBg, color: color.avatarText }}
    >
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Message renderer ─────────────────────────────────────────────────────────

function MessageItem({ msg, currentUserId }: { msg: BookChatMessage; currentUserId?: string }) {
  const isOwn = msg.sender_id === currentUserId;
  const isSystem = msg.message_type === 'system_status';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-hover rounded-full text-xs text-muted italic max-w-xs text-center">
          <BookOpenCheck className="h-3 w-3 text-accent flex-shrink-0" />
          <span>{msg.body}</span>
        </div>
      </div>
    );
  }

  const sender = msg.sender;
  const senderName = sender?.display_name || 'Unknown';
  const color = userColor(msg.sender_id);

  if (isOwn) {
    return (
      <div className="flex justify-end gap-2 mb-3">
        <div className="max-w-xs lg:max-w-md">
          <div className="rounded-2xl rounded-tr-sm px-4 py-2.5" style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 18%, white)', border: '1px solid color-mix(in srgb, var(--color-accent) 35%, white)', color: '#1e293b' }}>
            <p className="text-sm leading-relaxed break-words">{msg.body}</p>
          </div>
          <p className="text-[10px] text-muted mt-0.5 text-right">{formatTime(msg.created_at)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 mb-3">
      <Avatar displayName={senderName} avatarUrl={sender?.avatar_url} userId={msg.sender_id} size="sm" />
      <div className="max-w-xs lg:max-w-md">
        <p className="text-xs font-medium mb-0.5 text-accent">{senderName}</p>
        <div className="rounded-2xl rounded-tl-sm px-4 py-2.5" style={{ backgroundColor: color.bubbleBg, borderColor: color.bubbleBorder, borderWidth: '1px', borderStyle: 'solid' }}>
          <p className="text-sm leading-relaxed break-words" style={{ color: '#1e293b' }}>{msg.body}</p>
        </div>
        <p className="text-[10px] text-muted mt-0.5">{formatTime(msg.created_at)}</p>
      </div>
    </div>
  );
}

// ─── Reader list item ─────────────────────────────────────────────────────────

function ReaderItem({ reader }: { reader: BookChatReader }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors">
      <Avatar displayName={reader.display_name} avatarUrl={reader.avatar_url} userId={reader.user_id} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-theme truncate">{reader.display_name}</p>
        <p className="text-xs text-muted truncate">
          {reader.completed_at
            ? '✓ Completed'
            : reader.current_chapter_title || 'Not started'}
        </p>
      </div>
      {!reader.completed_at && reader.percent_complete > 0 && (
        <span className="text-xs text-accent font-medium flex-shrink-0">{Math.round(reader.percent_complete)}%</span>
      )}
    </div>
  );
}

// ─── Share My Progress toggle ─────────────────────────────────────────────────

function ShareToggle({ value, onChange, saving }: { value: boolean; onChange: (v: boolean) => void; saving?: boolean }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        disabled={saving}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-theme accent-[var(--color-accent)] cursor-pointer disabled:opacity-50"
      />
      <span className="text-xs text-muted">Share my progress in this chat</span>
      {saving && <span className="text-xs text-muted italic">Saving…</span>}
    </label>
  );
}

// ─── Chat input ───────────────────────────────────────────────────────────────

function BookChatInput({ onSend, disabled }: { onSend: (body: string) => void; disabled: boolean }) {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = body.trim();
    if (!text) return;
    onSend(text);
    setBody('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [body, onSend]);

  return (
    <div className="flex items-end gap-2 p-3 border-t border-theme">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={e => {
          setBody(e.target.value);
          // Auto-grow
          e.target.style.height = 'auto';
          e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        rows={1}
        placeholder="Type a message… (Enter to send)"
        disabled={disabled}
        className="flex-1 resize-none px-3 py-2 bg-surface border-2 border-theme rounded-xl text-sm focus:outline-none focus:border-accent text-theme placeholder-muted min-h-[38px] max-h-[120px] overflow-y-auto"
        style={{ height: 'auto' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !body.trim()}
        className="flex-shrink-0 p-2 rounded-xl bg-accent text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
        title="Send"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookChatPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { user } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [readers, setReaders] = useState<BookChatReader[]>([]);
  const [readerSearch, setReaderSearch] = useState('');
  const [showReaders, setShowReaders] = useState(true);
  const [shareMyProgress, setShareMyProgress] = useState(true);
  const [savingShare, setSavingShare] = useState(false);
  const [bookStats, setBookStats] = useState<{ total_words: number; avg_progress: number; total_readers: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { messages, loading, loadingMore, hasMore, error, loadMore, sendTextMessage, markRead } = useBookChat({
    bookId: bookId!,
    onNewMessage: () => {
      if (autoScroll) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    },
  });

  // Lock the Layout <main> so only the message list scrolls
  useEffect(() => {
    const main = document.getElementById('bf-main');
    if (!main) return;
    const prevOverflow = main.style.overflow;
    const prevDisplay = main.style.display;
    const prevHeight = main.style.height;
    main.style.overflow = 'hidden';
    main.style.display = 'flex';
    main.style.height = '100%';
    return () => {
      main.style.overflow = prevOverflow;
      main.style.display = prevDisplay;
      main.style.height = prevHeight;
    };
  }, []);

  const refreshStats = useCallback(() => {
    if (!bookId) return;
    api.getBookChatReaders(bookId).then(setReaders).catch(() => {});
    api.getBookChatStats(bookId).then(setBookStats).catch(() => {});
  }, [bookId]);

  // Load book data, readers, stats, and profile prefs
  useEffect(() => {
    if (!bookId) return;
    api.getBook(bookId).then(setBook).catch(() => {});
    api.getMyProfile().then((p: any) => {
      setShareMyProgress(p?.share_my_progress ?? true);
    }).catch(() => {});
    refreshStats();
  }, [bookId]);

  // Refresh stats when the tab regains focus (user navigated back from reading)
  useEffect(() => {
    window.addEventListener('focus', refreshStats);
    return () => window.removeEventListener('focus', refreshStats);
  }, [refreshStats]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' } as any);
    }
  }, [loading]);

  // Mark read when messages arrive
  useEffect(() => {
    if (messages.length > 0 && user) {
      markRead(messages[messages.length - 1].id);
    }
  }, [messages.length]);

  // Detect when user scrolls up (disable auto-scroll)
  const handleScroll = useCallback(() => {
    const el = messageListRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
    // Load more when near top
    if (el.scrollTop < 100 && hasMore && !loadingMore) {
      loadMore();
    }
  }, [hasMore, loadingMore, loadMore]);

  const handleSend = useCallback(async (body: string) => {
    setAutoScroll(true);
    await sendTextMessage(body);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [sendTextMessage]);

  const handleShareToggle = useCallback(async (val: boolean) => {
    setShareMyProgress(val);
    setSavingShare(true);
    try {
      await api.updateMyProfile({ share_my_progress: val });
    } catch (_) {
      setShareMyProgress(!val); // revert on error
    } finally {
      setSavingShare(false);
    }
  }, []);

  const filteredReaders = readers.filter(r =>
    r.display_name.toLowerCase().includes(readerSearch.toLowerCase())
  );

  // Group messages by date for date separators
  const groupedMessages: Array<{ date: string; messages: BookChatMessage[] }> = [];
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (!last || last.date !== date) {
      groupedMessages.push({ date, messages: [msg] });
    } else {
      last.messages.push(msg);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden bg-page w-full h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-theme bg-surface shadow-sm flex-shrink-0">
        <Link
          to={book ? `/book/${bookId}` : '/'}
          className="text-muted hover:text-theme transition-colors"
          title="Back to book"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        {book?.cover_image_url ? (
          <img
            src={book.cover_image_url}
            alt={book.title}
            className="w-9 h-12 rounded object-cover flex-shrink-0 shadow-sm"
          />
        ) : (
          <div className="w-9 h-12 rounded bg-surface-hover flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-5 w-5 text-muted" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-theme truncate leading-tight">
            {book?.title || 'Loading…'}
          </h1>
          <p className="text-xs text-muted leading-tight">Book Chat</p>
        </div>

        <button
          onClick={() => setShowReaders(v => !v)}
          className={`p-2 rounded-lg transition-colors ${showReaders ? 'text-accent bg-accent/10' : 'text-muted hover:text-theme hover:bg-surface-hover'}`}
          title={showReaders ? 'Hide readers' : 'Show readers'}
        >
          <Users className="h-5 w-5" />
        </button>
      </header>

      {/* Stats bar */}
      {(bookStats || readers.length > 0) && (() => {
        const totalWords = bookStats?.total_words ?? 0;
        const readTimeMin = (bookStats as any)?.total_read_minutes ?? (totalWords ? Math.round(totalWords / 238) : 0);
        const avgProgress = bookStats?.avg_progress ?? 0;
        const readerCount = bookStats?.total_readers ?? readers.length;

        return (
          <div className="flex items-center gap-0 border-b border-theme bg-surface-hover/50 flex-shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1.5 px-4 py-2 border-r border-theme min-w-fit">
              <Users className="h-3.5 w-3.5 text-accent flex-shrink-0" />
              <span className="text-xs text-muted">Readers</span>
              <span className="text-xs font-semibold text-theme">{readerCount}</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 border-r border-theme min-w-fit">
              <BarChart2 className="h-3.5 w-3.5 text-accent flex-shrink-0" />
              <span className="text-xs text-muted">Avg progress</span>
              <span className="text-xs font-semibold text-theme">{avgProgress}%</span>
              <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden ml-1">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${avgProgress}%` }}
                />
              </div>
            </div>
            {totalWords > 0 && (
              <div className="flex items-center gap-1.5 px-4 py-2 border-r border-theme min-w-fit">
                <BookMarked className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                <span className="text-xs text-muted">Words</span>
                <span className="text-xs font-semibold text-theme">{totalWords.toLocaleString()}</span>
              </div>
            )}
            {readTimeMin > 0 && (
              <div className="flex items-center gap-1.5 px-4 py-2 min-w-fit">
                <Clock className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                <span className="text-xs text-muted">Read time</span>
                <span className="text-xs font-semibold text-theme">
                  {readTimeMin >= 60
                    ? `${Math.floor(readTimeMin / 60)}h ${readTimeMin % 60}m`
                    : `${readTimeMin}m`}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Readers Panel */}
        {showReaders && (
          <aside className="w-60 flex-shrink-0 border-r border-theme bg-surface flex flex-col min-h-0">
            <div className="px-3 pt-3 pb-2 border-b border-theme">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                  Readers ({filteredReaders.length})
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  value={readerSearch}
                  onChange={e => setReaderSearch(e.target.value)}
                  placeholder="Search readers…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-hover border border-theme rounded-lg focus:outline-none focus:border-accent text-theme"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filteredReaders.length === 0 ? (
                <p className="text-xs text-muted text-center py-4">
                  {readerSearch ? 'No matches' : 'No readers yet'}
                </p>
              ) : (
                filteredReaders.map(r => <ReaderItem key={r.user_id} reader={r} />)
              )}
            </div>
          </aside>
        )}

        {/* Chat Panel */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Share my progress bar */}
          {user && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-theme bg-surface-hover/40 flex-shrink-0">
              <ShareToggle value={shareMyProgress} onChange={handleShareToggle} saving={savingShare} />
            </div>
          )}

          {/* Messages */}
          <div
            ref={messageListRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
          >
            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load earlier messages'}
                </button>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {error && (
              <div className="flex justify-center py-4">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            {!loading && messages.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-12 w-12 text-muted/30 mb-3" />
                <p className="text-sm font-medium text-muted">No messages yet</p>
                <p className="text-xs text-muted/70 mt-1">Be the first to say hello!</p>
              </div>
            )}

            {groupedMessages.map(group => (
              <div key={group.date}>
                <div className="flex justify-center my-4">
                  <span className="text-[10px] text-muted bg-surface-hover px-2.5 py-0.5 rounded-full">
                    {group.date}
                  </span>
                </div>
                {group.messages.map(msg => (
                  <MessageItem key={msg.id} msg={msg} currentUserId={user?.id} />
                ))}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {user ? (
            <BookChatInput onSend={handleSend} disabled={false} />
          ) : (
            <div className="p-4 border-t border-theme text-center">
              <p className="text-sm text-muted">
                <Link to="/auth/login" className="text-accent hover:underline">Sign in</Link> to join the chat
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
