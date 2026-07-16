import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import {
  GraduationCap, Users, Calendar, BookOpen, MessageSquare,
  Settings, ArrowLeft, TrendingUp, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ClubChatPanel from '../chat/ClubChatPanel';
import ClassRosterPanel from './ClassRosterPanel';
import ClassSessionsPanel from './ClassSessionsPanel';
import ClassSubmissionsPanel from './ClassSubmissionsPanel';
import ClassMembersPanel from './ClassMembersPanel';
import ClassSettingsPanel from './ClassSettingsPanel';
import ClassProgressPanel from './ClassProgressPanel';

type ClassTab = 'overview' | 'roster' | 'progress' | 'schedule' | 'assignments' | 'chat' | 'members' | 'settings';

interface ClubBook {
  id: string;
  book_id: string;
  is_current: boolean;
  book?: { id: string; title: string; cover_image_url?: string };
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
  const [myReadPct, setMyReadPct] = useState<number>(0);
  const [myCurrentChapterId, setMyCurrentChapterId] = useState<string | undefined>(undefined);
  const [myItemProgress, setMyItemProgress] = useState<{ completed: number; total: number } | null>(null);

  useEffect(() => {
    const bookId = currentBook?.book?.id;
    if (!bookId || !user) return;
    api.getReadingProgress(bookId)
      .then(p => { if (p) { setMyReadPct(p.percent_complete); setMyCurrentChapterId(p.current_chapter_id); } })
      .catch(() => {});
    api.getBookProgress(bookId)
      .then(breakdown => {
        const completed = breakdown.reduce((s, b) => s + b.completed, 0);
        const total = breakdown.reduce((s, b) => s + b.total, 0);
        setMyItemProgress({ completed, total });
      })
      .catch(() => {});
  }, [currentBook?.book?.id, user]);
  const memberCount = club.member_count ?? (club.members?.filter(m => m.invite_accepted_at).length ?? 0);

  const tabs: { key: ClassTab; label: string; icon: React.ReactNode; teacherOnly?: boolean; studentOnly?: boolean }[] = [
    { key: 'overview', label: 'Overview', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'roster', label: 'Roster', icon: <GraduationCap className="h-4 w-4" />, teacherOnly: true },
    { key: 'progress', label: 'My Progress', icon: <TrendingUp className="h-4 w-4" />, studentOnly: true },
    { key: 'schedule', label: 'Schedule', icon: <Calendar className="h-4 w-4" /> },
    { key: 'assignments', label: 'Assignments', icon: <BookOpen className="h-4 w-4" /> },
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
          currentBook={currentBook}
          clubId={club.id}
          readPct={myReadPct}
          currentChapterId={myCurrentChapterId}
          itemProgress={myItemProgress}
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
      {tab === 'settings' && isTeacher && (
        <ClassSettingsPanel club={club} onReload={onReload} />
      )}
    </div>
  );
}

function ClassOverviewTab({
  isTeacher,
  currentBook,
  clubId,
  readPct,
  currentChapterId,
  itemProgress,
  onGoToTab,
}: {
  isTeacher: boolean;
  currentBook?: ClubBook;
  clubId: string;
  readPct: number;
  currentChapterId?: string;
  itemProgress: { completed: number; total: number } | null;
  onGoToTab: (t: ClassTab) => void;
}) {
  const hasStarted = readPct > 0;
  const itemPct = itemProgress && itemProgress.total > 0
    ? Math.round((itemProgress.completed / itemProgress.total) * 100)
    : 0;
  const readTo = currentBook?.book
    ? `/clubs/${clubId}/read/${currentBook.book.id}${currentChapterId ? `?chapter=${currentChapterId}` : ''}`
    : '#';

  return (
    <div className="space-y-6">
      {/* Current book */}
      <div className="theme-section rounded-xl p-5">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Current Book</h2>
        {currentBook?.book ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {currentBook.book.cover_image_url ? (
                <img src={currentBook.book.cover_image_url} alt={currentBook.book.title} className="w-14 h-20 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-14 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-theme">{currentBook.book.title}</p>
                <p className="text-xs text-muted mt-1">Currently reading</p>
                {isTeacher && (
                  <button onClick={() => onGoToTab('settings')} className="text-xs text-violet-500 hover:text-violet-600 mt-1 transition-colors">
                    Change book →
                  </button>
                )}
                <Link
                  to={readTo}
                  className="mt-3 inline-flex items-center gap-1.5 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {hasStarted ? 'Continue Reading' : 'Start Reading'}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            {/* Progress bars */}
            {!isTeacher && (
              <div className="space-y-2 pt-1">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted">Reading progress</span>
                    <span className="text-xs font-medium text-theme">{Math.round(readPct)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${Math.round(readPct)}%` }}
                    />
                  </div>
                </div>
                {itemProgress && itemProgress.total > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-muted">Components completed</span>
                      <span className="text-xs font-medium text-theme">{itemPct}% · {itemProgress.completed}/{itemProgress.total}</span>
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
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-muted text-sm flex-1">No book assigned yet.</p>
            {isTeacher && (
              <button
                onClick={() => onGoToTab('settings')}
                className="theme-button-primary px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
              >
                <BookOpen className="h-4 w-4" /> Assign Book
              </button>
            )}
          </div>
        )}
      </div>

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
