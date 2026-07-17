import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import type { BookResponseItem } from '../../types';
import {
  GraduationCap, Users, Calendar, BookOpen, MessageSquare,
  Settings, ArrowLeft, TrendingUp, ChevronRight, ClipboardList, Loader2, ChevronDown,
  X, ZoomIn, BarChart2, BookMarked, CheckCircle2, Activity,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ClubChatPanel from '../chat/ClubChatPanel';
import ClassRosterPanel from './ClassRosterPanel';
import ClassSessionsPanel from './ClassSessionsPanel';
import ClassSubmissionsPanel from './ClassSubmissionsPanel';
import ClassMembersPanel from './ClassMembersPanel';
import ClassSettingsPanel from './ClassSettingsPanel';
import ClassProgressPanel from './ClassProgressPanel';

type ClassTab = 'overview' | 'roster' | 'progress' | 'schedule' | 'assignments' | 'responses' | 'chat' | 'members' | 'settings';

interface ClubBook {
  id: string;
  book_id: string;
  is_current: boolean;
  book?: { id: string; title: string; cover_image_url?: string };
}

interface BookProgress {
  readPct: number;
  currentChapterId?: string;
  currentChapterTitle?: string;
  itemsCompleted: number;
  itemsTotal: number;
}

interface Club {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  visibility: 'public' | 'private';
  max_members: number;
  created_at: string;
  club_type?: string;
  my_role?: 'owner' | 'admin' | 'member' | null;
  member_count?: number;
  members?: { id: string; role: string; user_id?: string; invite_accepted_at?: string; profile?: { id: string; display_name: string; avatar_url?: string } }[];
  books?: ClubBook[];
}

interface Props {
  club: Club;
  role: 'owner' | 'admin' | 'member' | null;
  onReload: () => void;
}

export default function ClassDetailView({ club, role, onReload }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<ClassTab>('overview');
  const isTeacher = role === 'owner' || role === 'admin';
  const currentBook = club.books?.find(b => b.is_current);

  // Per-book progress map: bookId → BookProgress
  const [bookProgress, setBookProgress] = useState<Record<string, BookProgress>>({});

  const loadProgressForBook = useCallback(async (bookId: string) => {
    try {
      const [prog, breakdown, chapters] = await Promise.all([
        api.getReadingProgress(bookId).catch(() => null),
        api.getBookProgress(bookId).catch(() => [] as { chapter_id: string; completed: number; total: number }[]),
        api.getChapters(bookId).catch(() => [] as { id: string; title: string }[]),
      ]);
      const completed = breakdown.reduce((s: number, b: { completed: number }) => s + b.completed, 0);
      const total = breakdown.reduce((s: number, b: { total: number }) => s + b.total, 0);
      const currentChapterId = prog?.current_chapter_id;
      const currentChapterTitle = currentChapterId
        ? chapters.find((c: { id: string; title: string }) => c.id === currentChapterId)?.title
        : undefined;
      setBookProgress(prev => ({
        ...prev,
        [bookId]: {
          readPct: prog?.percent_complete ?? 0,
          currentChapterId,
          currentChapterTitle,
          itemsCompleted: completed,
          itemsTotal: total,
        },
      }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user || !club.books?.length) return;
    club.books.forEach(cb => {
      if (cb.book?.id) loadProgressForBook(cb.book.id);
    });
  }, [club.books, user, loadProgressForBook]);

  const memberCount = club.member_count ?? (club.members?.filter(m => m.invite_accepted_at).length ?? 0);

  const tabs: { key: ClassTab; label: string; icon: React.ReactNode; teacherOnly?: boolean; studentOnly?: boolean }[] = [
    { key: 'overview', label: 'Overview', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'roster', label: 'Roster', icon: <GraduationCap className="h-4 w-4" />, teacherOnly: true },
    { key: 'progress', label: 'My Progress', icon: <TrendingUp className="h-4 w-4" />, studentOnly: true },
    { key: 'schedule', label: 'Schedule', icon: <Calendar className="h-4 w-4" /> },
    { key: 'assignments', label: 'Assignments', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'responses', label: 'Responses', icon: <ClipboardList className="h-4 w-4" />, teacherOnly: true },
    { key: 'chat', label: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'members', label: `Members (${memberCount})`, icon: <Users className="h-4 w-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, teacherOnly: true },
  ];

  const visibleTabs = tabs.filter(t => {
    if (t.teacherOnly && !isTeacher) return false;
    if (t.studentOnly && isTeacher) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/clubs?tab=onlineclasses')} className="text-muted hover:text-theme transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {club.cover_image_url ? (
          <img src={club.cover_image_url} alt={club.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-theme truncate">{club.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium flex-shrink-0">
              Online Class
            </span>
          </div>
          {club.description && <p className="text-muted text-sm truncate">{club.description}</p>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 theme-section p-1 rounded-lg w-fit overflow-x-auto">
        {visibleTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'theme-button-primary' : 'text-muted hover:text-theme'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <ClassOverviewTab
          isTeacher={isTeacher}
          books={club.books ?? []}
          clubId={club.id}
          bookProgress={bookProgress}
          onGoToTab={setTab}
        />
      )}
      {tab === 'roster' && isTeacher && (
        <ClassRosterPanel clubId={club.id} currentUserId={user?.id ?? ''} />
      )}
      {tab === 'progress' && !isTeacher && (
        <ClassProgressPanel clubId={club.id} />
      )}
      {tab === 'schedule' && (
        <ClassSessionsPanel clubId={club.id} isTeacher={isTeacher} />
      )}
      {tab === 'assignments' && (
        <ClassSubmissionsPanel clubId={club.id} isTeacher={isTeacher} />
      )}
      {tab === 'chat' && (
        <ClubChatPanel clubId={club.id} clubName={club.name} />
      )}
      {tab === 'members' && (
        <ClassMembersPanel club={club} isTeacher={isTeacher} onReload={onReload} />
      )}
      {tab === 'responses' && isTeacher && currentBook?.book && (
        <ClassResponsesPanel bookId={currentBook.book.id} clubId={club.id} />
      )}
      {tab === 'settings' && isTeacher && (
        <ClassSettingsPanel club={club} onReload={onReload} />
      )}
    </div>
  );
}

function ClassOverviewTab({
  isTeacher,
  books,
  clubId,
  bookProgress,
  onGoToTab,
}: {
  isTeacher: boolean;
  books: ClubBook[];
  clubId: string;
  bookProgress: Record<string, BookProgress>;
  onGoToTab: (t: ClassTab) => void;
}) {
  const defaultBook = books.find(b => b.is_current) ?? books[0];
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>(defaultBook?.book?.id);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedCover, setExpandedCover] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [bookStats, setBookStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Keep selected book in sync if books list changes
  useEffect(() => {
    if (!selectedBookId && books.length > 0) {
      setSelectedBookId(books.find(b => b.is_current)?.book?.id ?? books[0]?.book?.id);
    }
  }, [books, selectedBookId]);

  const selectedCb = books.find(b => b.book?.id === selectedBookId) ?? books[0];
  const book = selectedCb?.book;
  const prog = book ? bookProgress[book.id] : undefined;
  const readPct = prog?.readPct ?? 0;
  const hasStarted = readPct > 0;
  const itemPct = prog && prog.itemsTotal > 0
    ? Math.round((prog.itemsCompleted / prog.itemsTotal) * 100)
    : 0;
  const readTo = book
    ? `/clubs/${clubId}/read/${book.id}${prog?.currentChapterId ? `?chapter=${prog.currentChapterId}` : ''}`
    : '#';

  return (
    <div className="space-y-6">

      {/* ── Books section ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
            Class Books
          </h2>
          {isTeacher && (
            <button
              onClick={() => onGoToTab('settings')}
              className="flex items-center gap-1.5 text-xs theme-button-secondary px-3 py-1.5 rounded-lg"
            >
              <BookOpen className="h-3.5 w-3.5" /> Manage Books
            </button>
          )}
        </div>

        {books.length === 0 ? (
          <div className="theme-section rounded-xl p-6 flex items-center gap-3">
            <p className="text-muted text-sm flex-1">No books assigned yet.</p>
            {isTeacher && (
              <button
                onClick={() => onGoToTab('settings')}
                className="theme-button-primary px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
              >
                <BookOpen className="h-4 w-4" /> Assign Book
              </button>
            )}
          </div>
        ) : (
          <div className="theme-section rounded-xl overflow-visible">
            {/* ── Book dropdown selector (only shown when >1 book) ── */}
            {books.length > 1 && (
              <div className="relative px-4 pt-4 pb-3 border-b border-white/8">
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 transition-all text-left"
                >
                  {book?.cover_image_url ? (
                    <img src={book.cover_image_url} alt={book.title} className="w-8 h-11 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-11 bg-gradient-to-br from-indigo-400 to-purple-500 rounded flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-theme truncate">{book?.title ?? 'Select a book'}</p>
                    {selectedCb?.is_current && (
                      <p className="text-xs text-violet-400 font-medium">★ Currently reading</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-muted">{books.length} books</span>
                    <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Dropdown list */}
                {dropdownOpen && (
                  <div className="absolute left-4 right-4 top-full mt-1 z-30 bg-surface border border-white/15 rounded-xl shadow-2xl overflow-hidden">
                    {books.map(cb => {
                      const cbBook = cb.book;
                      if (!cbBook) return null;
                      const cbProg = bookProgress[cbBook.id];
                      const cbPct = cbProg?.readPct ?? 0;
                      const isSelected = cbBook.id === selectedBookId;
                      return (
                        <button
                          key={cb.id}
                          onClick={() => { setSelectedBookId(cbBook.id); setDropdownOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/5 ${isSelected ? 'bg-violet-500/10' : ''}`}
                        >
                          {cbBook.cover_image_url ? (
                            <img src={cbBook.cover_image_url} alt={cbBook.title} className="w-8 h-11 object-cover rounded flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-11 bg-gradient-to-br from-indigo-400 to-purple-500 rounded flex items-center justify-center flex-shrink-0">
                              <BookOpen className="h-3.5 w-3.5 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-violet-400' : 'text-theme'}`}>{cbBook.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {cb.is_current && <span className="text-xs text-violet-400">★ Current</span>}
                              {cbPct > 0 && <span className="text-xs text-muted">{Math.round(cbPct)}% read</span>}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Selected book detail card ── */}
            {book && (
              <div className="p-4 flex gap-4">
                {/* Cover — click for stats, small zoom button */}
                <div className="flex-shrink-0 relative group">
                  {book.cover_image_url ? (
                    <>
                      <img
                        src={book.cover_image_url}
                        alt={book.title}
                        className="w-20 h-28 object-cover rounded-xl shadow-lg cursor-pointer"
                        onClick={async () => {
                          setShowStatsModal(true);
                          if (!bookStats || (bookStats as any).__bookId !== book.id) {
                            setStatsLoading(true);
                            try {
                              const s = await api.getBookStats(book.id);
                              setBookStats({ ...s, __bookId: book.id });
                            } catch { setBookStats(null); }
                            finally { setStatsLoading(false); }
                          }
                        }}
                      />
                      <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
                      {/* Zoom button — bottom-right corner */}
                      <button
                        className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => { e.stopPropagation(); setExpandedCover(book.cover_image_url!); }}
                        title="Zoom cover"
                      >
                        <ZoomIn className="h-3 w-3 text-white" />
                      </button>
                    </>
                  ) : (
                    <div
                      className="w-20 h-28 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg cursor-pointer hover:brightness-110 transition-all"
                      onClick={async () => {
                        setShowStatsModal(true);
                        if (!bookStats || (bookStats as any).__bookId !== book.id) {
                          setStatsLoading(true);
                          try {
                            const s = await api.getBookStats(book.id);
                            setBookStats({ ...s, __bookId: book.id });
                          } catch { setBookStats(null); }
                          finally { setStatsLoading(false); }
                        }
                      }}
                    >
                      <BookOpen className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>

                {/* Info column */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div>
                    <p className="font-bold text-theme text-base leading-tight">{book.title}</p>
                    {selectedCb?.is_current && (
                      <span className="text-xs text-violet-400 font-medium">★ Currently reading</span>
                    )}
                  </div>

                  {/* Progress — students only */}
                  {!isTeacher && (
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted">Reading progress</span>
                          <span className="text-xs font-bold text-theme">{Math.round(readPct)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent transition-all duration-500"
                            style={{ width: `${Math.round(readPct)}%` }}
                          />
                        </div>
                      </div>

                      {prog?.currentChapterTitle && (
                        <p className="text-xs text-muted truncate">
                          Last read: <span className="text-theme font-medium">{prog.currentChapterTitle}</span>
                        </p>
                      )}

                      {prog && prog.itemsTotal > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-muted">Activities</span>
                            <span className="text-xs font-medium text-theme">{itemPct}% · {prog.itemsCompleted}/{prog.itemsTotal}</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                              style={{ width: `${itemPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-auto pt-1">
                    <Link
                      to={readTo}
                      className="inline-flex items-center gap-1.5 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      {hasStarted ? 'Continue Reading' : 'Start Reading'}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cover lightbox */}
      {expandedCover && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setExpandedCover(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            onClick={() => setExpandedCover(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={expandedCover}
            alt="Book cover"
            className="max-h-[80vh] max-w-[80vw] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Book stats modal */}
      {showStatsModal && book && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowStatsModal(false)}
        >
          <div
            className="theme-modal rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-strong/20">
              {book.cover_image_url ? (
                <img src={book.cover_image_url} alt={book.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0 shadow" />
              ) : (
                <div className="w-10 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-theme text-sm leading-snug truncate">{book.title}</p>
                <p className="text-xs text-muted mt-0.5">Book Stats</p>
              </div>
              <button onClick={() => setShowStatsModal(false)} className="p-1.5 text-muted hover:text-theme transition-colors flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stats body */}
            <div className="p-4">
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted" />
                </div>
              ) : bookStats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="theme-section rounded-xl p-3 flex items-center gap-2.5">
                    <BookMarked className="h-5 w-5 text-violet-400 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-theme leading-none">{bookStats.overview.total_chapters}</p>
                      <p className="text-xs text-muted mt-0.5">Chapters</p>
                    </div>
                  </div>
                  <div className="theme-section rounded-xl p-3 flex items-center gap-2.5">
                    <Users className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-theme leading-none">{bookStats.overview.total_readers}</p>
                      <p className="text-xs text-muted mt-0.5">Readers</p>
                    </div>
                  </div>
                  <div className="theme-section rounded-xl p-3 flex items-center gap-2.5">
                    <Activity className="h-5 w-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-theme leading-none">{bookStats.overview.avg_progress}%</p>
                      <p className="text-xs text-muted mt-0.5">Avg Progress</p>
                    </div>
                  </div>
                  <div className="theme-section rounded-xl p-3 flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-theme leading-none">{bookStats.overview.completed_readers}</p>
                      <p className="text-xs text-muted mt-0.5">Completed</p>
                    </div>
                  </div>
                  <div className="theme-section rounded-xl p-3 flex items-center gap-2.5">
                    <TrendingUp className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-theme leading-none">{bookStats.overview.active_readers}</p>
                      <p className="text-xs text-muted mt-0.5">Active (30d)</p>
                    </div>
                  </div>
                  <div className="theme-section rounded-xl p-3 flex items-center gap-2.5">
                    <BarChart2 className="h-5 w-5 text-pink-400 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-theme leading-none">{bookStats.overview.total_form_responses}</p>
                      <p className="text-xs text-muted mt-0.5">Responses</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Student view — no access to book stats, show personal progress */
                <div className="grid grid-cols-2 gap-3">
                  <div className="theme-section rounded-xl p-3 flex items-center gap-2.5 col-span-2">
                    <Activity className="h-5 w-5 text-accent flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <p className="text-xs text-muted">Your reading progress</p>
                        <p className="text-xs font-bold text-theme">{Math.round(prog?.readPct ?? 0)}%</p>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(prog?.readPct ?? 0)}%` }} />
                      </div>
                    </div>
                  </div>
                  {prog && prog.itemsTotal > 0 && (
                    <div className="theme-section rounded-xl p-3 flex items-center gap-2.5 col-span-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <p className="text-xs text-muted">Activities</p>
                          <p className="text-xs font-bold text-theme">{prog.itemsCompleted}/{prog.itemsTotal}</p>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((prog.itemsCompleted / prog.itemsTotal) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                  {prog?.currentChapterTitle && (
                    <div className="theme-section rounded-xl p-3 col-span-2">
                      <p className="text-xs text-muted">Last read</p>
                      <p className="text-sm font-medium text-theme mt-0.5 truncate">{prog.currentChapterTitle}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 pb-4">
              <Link
                to={readTo}
                onClick={() => setShowStatsModal(false)}
                className="flex items-center justify-center gap-2 w-full theme-button-primary py-2.5 rounded-xl text-sm font-medium"
              >
                {(prog?.readPct ?? 0) > 0 ? 'Continue Reading' : 'Start Reading'}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {isTeacher ? (
          <button
            onClick={() => onGoToTab('roster')}
            className="theme-section rounded-xl p-4 text-left hover:shadow-md transition-shadow"
          >
            <GraduationCap className="h-5 w-5 text-violet-500 mb-2" />
            <p className="font-semibold text-theme text-sm">View Roster</p>
            <p className="text-xs text-muted mt-0.5">Track student progress</p>
          </button>
        ) : (
          <button
            onClick={() => onGoToTab('progress')}
            className="theme-section rounded-xl p-4 text-left hover:shadow-md transition-shadow"
          >
            <TrendingUp className="h-5 w-5 text-violet-500 mb-2" />
            <p className="font-semibold text-theme text-sm">My Progress</p>
            <p className="text-xs text-muted mt-0.5">Chapters & grades</p>
          </button>
        )}
        <button
          onClick={() => onGoToTab('schedule')}
          className="theme-section rounded-xl p-4 text-left hover:shadow-md transition-shadow"
        >
          <Calendar className="h-5 w-5 text-blue-500 mb-2" />
          <p className="font-semibold text-theme text-sm">Schedule</p>
          <p className="text-xs text-muted mt-0.5">Upcoming sessions</p>
        </button>
        <button
          onClick={() => onGoToTab('assignments')}
          className="theme-section rounded-xl p-4 text-left hover:shadow-md transition-shadow"
        >
          <BookOpen className="h-5 w-5 text-emerald-500 mb-2" />
          <p className="font-semibold text-theme text-sm">Assignments</p>
          <p className="text-xs text-muted mt-0.5">Journals & essays</p>
        </button>
        {isTeacher && (
          <button
            onClick={() => onGoToTab('responses')}
            className="theme-section rounded-xl p-4 text-left hover:shadow-md transition-shadow"
          >
            <ClipboardList className="h-5 w-5 text-orange-500 mb-2" />
            <p className="font-semibold text-theme text-sm">Responses</p>
            <p className="text-xs text-muted mt-0.5">All student answers</p>
          </button>
        )}
        <button
          onClick={() => onGoToTab('chat')}
          className="theme-section rounded-xl p-4 text-left hover:shadow-md transition-shadow"
        >
          <MessageSquare className="h-5 w-5 text-teal-500 mb-2" />
          <p className="font-semibold text-theme text-sm">Class Chat</p>
          <p className="text-xs text-muted mt-0.5">Group discussion</p>
        </button>
      </div>
    </div>
  );
}

// ── ClassResponsesPanel ──────────────────────────────────────────────────────

function ClassResponsesPanel({ bookId }: { bookId: string; clubId: string }) {
  const [items, setItems] = useState<BookResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.getBookResponses(bookId)
      .then(data => {
        setItems(data);
        if (data.length > 0) setExpanded({ [data[0].chapter_id]: true });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookId]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted" />
    </div>
  );

  if (!items.length) return (
    <div className="text-center py-16 text-muted">
      <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">No responses yet for this book.</p>
    </div>
  );

  const byChapter = items.reduce<Record<string, { title: string; order: number; items: BookResponseItem[] }>>((acc, item) => {
    if (!acc[item.chapter_id]) acc[item.chapter_id] = { title: item.chapter_title, order: item.chapter_order, items: [] };
    acc[item.chapter_id].items.push(item);
    return acc;
  }, {});
  const chapters = Object.entries(byChapter).sort((a, b) => a[1].order - b[1].order);

  function toggle(chapterId: string) {
    setExpanded(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-theme">Book Responses</h2>
        <span className="text-xs text-muted">
          {items.length} question{items.length !== 1 ? 's' : ''} · {items.reduce((s, i) => s + i.responses.length, 0)} responses
        </span>
      </div>

      {chapters.map(([chapterId, chapter]) => (
        <div key={chapterId} className="theme-section rounded-xl overflow-hidden">
          <button
            onClick={() => toggle(chapterId)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="h-4 w-4 text-muted flex-shrink-0" />
              <span className="font-semibold text-theme text-sm truncate">{chapter.title}</span>
              <span className="text-xs text-muted flex-shrink-0">({chapter.items.length} question{chapter.items.length !== 1 ? 's' : ''})</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted flex-shrink-0 transition-transform ${expanded[chapterId] ? 'rotate-180' : ''}`} />
          </button>

          {expanded[chapterId] && (
            <div className="border-t border-theme divide-y divide-theme">
              {chapter.items.map(item => (
                <div key={item.id} className="px-4 py-4">
                  <div className="mb-3">
                    {item.content_data?.question
                      ? <p className="text-sm font-medium text-theme">{item.content_data.question}</p>
                      : item.anchor_text
                        ? <p className="text-sm font-medium text-theme">{item.anchor_text}</p>
                        : null
                    }
                    <p className="text-xs text-muted mt-0.5 capitalize">
                      {item.content_type.replace(/_/g, ' ')} · {item.responses.length} response{item.responses.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {item.responses.length === 0 ? (
                    <p className="text-xs text-muted italic">No responses yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {item.responses.map((r, i) => (
                        <div key={r.id ?? i} className="flex items-start gap-2.5 bg-surface rounded-lg px-3 py-2.5">
                          <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                            {r.user?.avatar_url
                              ? <img src={r.user.avatar_url} alt="" className="h-7 w-7 object-cover" />
                              : <span className="text-xs font-bold text-accent">{(r.user?.display_name || '?')[0].toUpperCase()}</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-theme">{r.user?.display_name || 'Student'}</p>
                            <p className="text-sm text-muted mt-0.5 break-words">
                              {r.answer_text
                                || r.selected_option
                                || (Array.isArray(r.selected_options) ? r.selected_options.join(', ') : null)
                                || '—'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
