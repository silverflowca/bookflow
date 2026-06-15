import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, colorSchemes, ColorSchemeKey } from '../../contexts/ThemeContext';
import { BookOpen, User, LogOut, Plus, Settings, Sun, Moon, Check, Palette, Menu, X, Users, Radio, ChevronDown, ChevronRight, GraduationCap, CheckCircle, Volume2, MessageSquare, BarChart2, Video, Shield } from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import TutorialOverlay, { TutorialChapter } from '../reader/TutorialOverlay';

const TUTORIAL_BOOK_ID = 'f0c66a4a-ced2-4b75-ab42-84dafba9cd3d';
// Chapter IDs from the seeded tutorial book
const TUTORIAL_CH1 = 'd4b719dd-31f6-4bbc-8275-08270c06a6ad'; // Welcome — Navigating
const TUTORIAL_CH4 = '26093b88-1f29-4e4c-b0bf-a2471c89c637'; // Publishing

const EDITOR_URL = `/edit/book/${TUTORIAL_BOOK_ID}/chapter/${TUTORIAL_CH1}`;
const READER_URL = `/book/${TUTORIAL_BOOK_ID}/chapter/${TUTORIAL_CH1}`;

export default function Layout() {
  const { user, profile, logout } = useAuth();
  const { colorScheme, setColorScheme } = useTheme();
  const navigate = useNavigate();
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileTheme, setShowMobileTheme] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [tutorialActive, setTutorialActive] = useState(false);

  const TUTORIAL_CHAPTERS: TutorialChapter[] = [
    // ── Chapter 0: Navigating ────────────────────────────────────────────────
    {
      title: 'Navigating',
      steps: [
        {
          target: '#bf-toc-sidebar',
          title: 'Table of Contents',
          description: <>This sidebar lists all chapters in the book. Click any chapter to jump to it. On mobile, tap the <strong>☰ menu icon</strong> at the top-left to open it.</>,
          placement: 'right', chapter: 0, action: { type: 'none', instruction: '' },
          navigateTo: READER_URL,
        },
        {
          target: '#bf-chapter-list',
          title: 'Chapter List',
          description: <>Each chapter is listed here. The active chapter is highlighted. Progress bars appear below each chapter when you click the <strong>Progress</strong> button.</>,
          placement: 'right', chapter: 0, action: { type: 'none', instruction: '' },
          navigateTo: READER_URL,
        },
        {
          target: '#bf-progress-btn',
          title: 'Progress Tracking',
          description: <>Click the <strong><CheckCircle className="inline h-3.5 w-3.5 mb-0.5 text-green-500" /> Progress</strong> button to toggle progress bars beneath each chapter. It turns bold green when all items in the current chapter are complete.</>,
          placement: 'right', chapter: 0, action: { type: 'none', instruction: '' },
          navigateTo: READER_URL,
        },
        {
          target: '#bf-tts-btn',
          title: 'Listen — Text to Speech',
          description: <>Click <strong><Volume2 className="inline h-3.5 w-3.5 mb-0.5" /> Listen</strong> to have the entire chapter read aloud using AI text-to-speech. Click <strong>Stop</strong> to end playback at any time.</>,
          placement: 'bottom', chapter: 0, action: { type: 'none', instruction: '' },
          navigateTo: READER_URL,
        },
        {
          target: '#bf-tutorial-btn',
          title: 'Tutorial Button',
          description: <>This is the <strong><GraduationCap className="inline h-3.5 w-3.5 mb-0.5" /> Tutorial</strong> button you just clicked! It opens and closes this step-by-step walkthrough. Your progress is saved automatically so you can pick up where you left off.</>,
          placement: 'bottom', chapter: 0, action: { type: 'none', instruction: '' },
          navigateTo: READER_URL,
        },
        {
          target: '.reader-content',
          title: 'Chapter Content',
          description: <>The chapter text appears here. Interactive elements like questions, polls and form fields are embedded directly in the text or shown below it.</>,
          placement: 'top', chapter: 0, action: { type: 'scroll', instruction: 'Scroll down to read the chapter content.' },
          navigateTo: READER_URL,
        },
      ],
    },
    // ── Chapter 1: Dashboard ─────────────────────────────────────────────────
    {
      title: 'Dashboard',
      steps: [
        {
          target: '#bf-dash-header',
          title: 'My Books Dashboard',
          description: <>The <strong>Dashboard</strong> is your home base. It shows all the books you have created. Click <strong>My Books</strong> in the nav, or the <strong><BookOpen className="inline h-3.5 w-3.5 mb-0.5" /> BookFlow</strong> logo, to get here from anywhere.</>,
          placement: 'bottom', chapter: 1, action: { type: 'none', instruction: '' },
          navigateTo: '/dashboard',
        },
        {
          target: '#bf-new-book-btn',
          title: 'Creating a New Book',
          description: <>Click <strong><Plus className="inline h-3.5 w-3.5 mb-0.5" /> New Book</strong> to create your first book. Give it a title, an optional subtitle, and a description — you can always change these later in <strong>Settings</strong>.</>,
          placement: 'bottom', chapter: 1, action: { type: 'none', instruction: '' },
          navigateTo: '/dashboard',
        },
        {
          target: '#bf-dash-books-grid',
          title: 'Book Cards',
          description: <>Each book card shows the cover, title, chapter count, and visibility. Hover the cover to <strong>upload a new cover image</strong>. Use <strong>Edit</strong> to open the editor, <strong>View</strong> to read it as a reader, or the <strong>⋮ menu</strong> for Stats, Settings, Copy Link, and Delete.</>,
          placement: 'top', chapter: 1, action: { type: 'none', instruction: '' },
          navigateTo: '/dashboard',
        },
        {
          target: '#bf-dash-clubs',
          title: 'Book Clubs on the Dashboard',
          description: <>Your <strong>Book Clubs</strong> appear here. Click <strong>View all</strong> to manage clubs, or click a club card to open it. The <strong>Currently Reading</strong> section (when visible) shows your club books with live progress bars.</>,
          placement: 'top', chapter: 1, action: { type: 'none', instruction: '' },
          navigateTo: '/dashboard',
        },
      ],
    },
    // ── Chapter 2: Creating ──────────────────────────────────────────────────
    {
      title: 'Creating',
      steps: [
        {
          target: '#bf-book-meta',
          title: 'Book Title & Metadata',
          description: <>The sidebar shows the book title, subtitle and author. As an author you also see a <strong>Dashboard</strong> link that opens analytics for your book.</>,
          placement: 'right', chapter: 2, action: { type: 'none', instruction: '' },
          navigateTo: READER_URL,
        },
        {
          target: '#bf-editor-toolbar',
          title: 'Adding Chapters & Writing',
          description: <>Inside the book editor, this toolbar lets you format text and insert rich content. Click <strong>+ Add Chapter</strong> in the editor sidebar to create new chapters. Your work auto-saves every few seconds.</>,
          placement: 'bottom', chapter: 2, action: { type: 'none', instruction: '' },
          navigateTo: EDITOR_URL,
        },
        {
          target: '#bf-editor-content',
          title: 'The Writing Area',
          description: <>Type your chapter content here. Select any text to reveal formatting options. Use the toolbar above to add bold, headings, lists, and more.</>,
          placement: 'top', chapter: 2, action: { type: 'none', instruction: '' },
          navigateTo: EDITOR_URL,
        },
        {
          target: '#bf-editor-panel',
          title: 'Comments & Inline Content',
          description: <>The right panel shows <strong>Comments</strong> left by collaborators, and the <strong>Inline</strong> tab lists all interactive items embedded in this chapter — questions, polls, form fields and more.</>,
          placement: 'left', chapter: 2, action: { type: 'none', instruction: '' },
          navigateTo: EDITOR_URL,
        },
      ],
    },
    // ── Chapter 3: Rich Content ──────────────────────────────────────────────
    {
      title: 'Rich Content',
      steps: [
        {
          target: null,
          title: 'Adding Rich Content',
          description: <>BookFlow lets you embed <strong>video</strong>, <strong>audio</strong>, <strong>polls</strong>, <strong>questions</strong> and typed <strong>form fields</strong> directly in your chapters. All of these are trackable for reader progress.</>,
          placement: 'center', chapter: 3, action: { type: 'none', instruction: '' },
        },
        {
          target: 'button[title="Add Video"]',
          title: 'Embedding Video',
          description: <>Click the <strong><Video className="inline h-3.5 w-3.5 mb-0.5 text-pink-500" /> Video</strong> button in the toolbar to embed a YouTube or Vimeo URL. Readers earn progress credit for watching at least <strong>80%</strong> of the video.</>,
          placement: 'bottom', chapter: 3, action: { type: 'none', instruction: '' },
          navigateTo: EDITOR_URL,
        },
        {
          target: 'button[title="Add Question"]',
          title: 'Adding Questions',
          description: <>Click <strong><MessageSquare className="inline h-3.5 w-3.5 mb-0.5 text-blue-500" /> Question</strong> in the toolbar to add a reflection prompt. Readers type their response and it is saved privately to their account.</>,
          placement: 'bottom', chapter: 3, action: { type: 'none', instruction: '' },
          navigateTo: EDITOR_URL,
        },
        {
          target: 'button[title="Add Poll"]',
          title: 'Adding Polls',
          description: <>Click <strong><BarChart2 className="inline h-3.5 w-3.5 mb-0.5 text-green-500" /> Poll</strong> to gather opinions from readers. Poll results are shown as a live bar chart that updates as readers respond.</>,
          placement: 'bottom', chapter: 3, action: { type: 'none', instruction: '' },
          navigateTo: EDITOR_URL,
        },
        {
          target: '#bf-progress-btn',
          title: 'Check Your Progress',
          description: <>Click the <strong><CheckCircle className="inline h-3.5 w-3.5 mb-0.5 text-green-500" /> Progress</strong> button to toggle per-chapter progress bars. The overall percentage shows at a glance how far you have come.</>,
          placement: 'right', chapter: 3, action: { type: 'none', instruction: '' },
          navigateTo: READER_URL,
        },
      ],
    },
    // ── Chapter 4: Publishing ────────────────────────────────────────────────
    {
      title: 'Publishing',
      steps: [
        {
          target: '#bf-settings-publish',
          title: 'Publishing Your Book',
          description: <>Here you control who can read your book. Click the <strong><Settings className="inline h-3.5 w-3.5 mb-0.5" /> Private / Public</strong> toggle to make it public — this creates a shareable link anyone can open on any device, without logging in.</>,
          placement: 'top', chapter: 4, action: { type: 'none', instruction: '' },
          navigateTo: `/edit/book/${TUTORIAL_BOOK_ID}/settings`,
        },
        {
          target: '#bf-settings-quicklinks',
          title: 'Inviting Collaborators',
          description: <>Click <strong><Users className="inline h-3.5 w-3.5 mb-0.5" /> Collaborators</strong> to invite co-authors, editors or reviewers by email. <strong>Editors</strong> can change content; <strong>Commenters</strong> can only leave notes; <strong>Viewers</strong> can only read.</>,
          placement: 'bottom', chapter: 4, action: { type: 'none', instruction: '' },
          navigateTo: `/edit/book/${TUTORIAL_BOOK_ID}/settings`,
        },
        {
          target: '#bf-nav-clubs',
          title: 'Book Clubs',
          description: <>Go to <strong><Users className="inline h-3.5 w-3.5 mb-0.5" /> Clubs</strong> in the main navigation to create a reading group. Add your book, invite members, and they can read together with shared progress and chapter chat.</>,
          placement: 'bottom', chapter: 4, action: { type: 'none', instruction: '' },
          navigateTo: '/dashboard',
        },
        {
          target: '.progress-item',
          title: 'Final Steps',
          description: <>Complete the <strong>radio button</strong>, <strong>multiselect</strong> and <strong>reflection question</strong> below. When all items are done the <strong><CheckCircle className="inline h-3.5 w-3.5 mb-0.5 text-green-500" /> Progress</strong> button turns bold green — congratulations!</>,
          placement: 'top', chapter: 4, action: { type: 'none', instruction: '' },
          navigateTo: `/book/${TUTORIAL_BOOK_ID}/chapter/${TUTORIAL_CH4}`,
        },
        {
          target: null,
          title: '🎉 Tutorial Complete!',
          description: <>You have finished the BookFlow tutorial. You now know how to <strong>navigate</strong>, <strong>use the dashboard</strong>, <strong>create a book</strong>, <strong>add rich content</strong>, and <strong>publish to readers</strong>. Head to the <strong>Dashboard</strong> to start your first book!</>,
          placement: 'center', chapter: 4, action: { type: 'none', instruction: '' },
        },
      ],
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setShowMobileMenu(false);
    setShowMobileTheme(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowThemeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group color schemes by mode
  const lightSchemes = Object.entries(colorSchemes).filter(([_, s]) => s.mode === 'light');
  const darkSchemes = Object.entries(colorSchemes).filter(([_, s]) => s.mode === 'dark');

  const [showThemeSwatches, setShowThemeSwatches] = useState(false);

  const ThemeDropdownContent = () => (
    <div className="theme-modal rounded-lg overflow-hidden">
      {/* More Settings — prominent at top */}
      <Link
        to="/settings"
        onClick={() => { setShowThemeDropdown(false); setShowMobileMenu(false); }}
        className="flex items-center gap-3 px-4 py-3 border-b-2 border-theme text-sm font-semibold text-theme hover:bg-surface-hover transition-colors"
      >
        <Settings className="h-4 w-4 text-accent" />
        <span>More Settings</span>
      </Link>

      {/* Colour Themes — collapsible sub-section */}
      <button
        onClick={() => setShowThemeSwatches(v => !v)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider hover:bg-surface-hover transition-colors"
      >
        <span className="flex items-center gap-2">
          <Palette className="h-3.5 w-3.5" /> Colour Themes
        </span>
        {showThemeSwatches
          ? <ChevronDown className="h-3.5 w-3.5" />
          : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {showThemeSwatches && (
        <>
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted uppercase tracking-wider">
              <Sun className="h-3.5 w-3.5" /> Light
            </div>
            <div className="grid grid-cols-4 gap-2">
              {lightSchemes.map(([key, scheme]) => (
                <button key={key} onClick={() => { setColorScheme(key as ColorSchemeKey); setShowMobileMenu(false); }} className="group relative" title={scheme.name}>
                  <div className={`color-swatch ${colorScheme === key ? 'active' : ''}`} style={{ backgroundColor: scheme.accent }}>
                    {colorScheme === key && <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow-md" />}
                  </div>
                  <span className="text-[10px] text-muted mt-1 block truncate">{scheme.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 pb-3 border-t border-theme pt-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted uppercase tracking-wider">
              <Moon className="h-3.5 w-3.5" /> Dark
            </div>
            <div className="grid grid-cols-4 gap-2">
              {darkSchemes.map(([key, scheme]) => (
                <button key={key} onClick={() => { setColorScheme(key as ColorSchemeKey); setShowMobileMenu(false); }} className="group relative" title={scheme.name}>
                  <div className={`color-swatch ${colorScheme === key ? 'active' : ''}`} style={{ backgroundColor: scheme.accent }}>
                    {colorScheme === key && <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow-md" />}
                  </div>
                  <span className="text-[10px] text-muted mt-1 block truncate">{scheme.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-theme">
      {/* Header */}
      <header className="theme-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 text-accent hover:opacity-80 transition-opacity">
              <BookOpen className="h-8 w-8" />
              <span className="text-xl font-bold">BookFlow</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              {user ? (
                <>
                  <Link to="/dashboard" className="text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    My Books
                  </Link>
                  <Link id="bf-nav-clubs" to="/clubs" className="flex items-center gap-1 text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    <Users className="h-4 w-4" /> Clubs
                  </Link>
                  <Link to="/live" className="flex items-center gap-1 text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    <Radio className="h-4 w-4" /> Live
                  </Link>
                  <button id="bf-tutorial-btn" onClick={() => setTutorialActive(true)} className="flex items-center gap-1 text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    <GraduationCap className="h-4 w-4" /> Tutorial
                  </button>
                  {profile?.system_role === 'super_admin' && (
                    <Link to="/admin" className="flex items-center gap-1 text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                  )}
                  <Link to="/dashboard" className="flex items-center gap-1 theme-button-primary px-4 py-2 rounded-md text-sm font-medium">
                    <Plus className="h-4 w-4" /> New Book
                  </Link>
                  <div className="flex items-center gap-3 ml-4 pl-4 border-l-2 border-strong">
                    <NotificationBell />
                    <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <div className="h-8 w-8 rounded-full bg-surface-hover flex items-center justify-center border-2 border-theme overflow-hidden">
                        {profile?.avatar_url
                          ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                          : <User className="h-4 w-4 text-accent" />}
                      </div>
                      <span className="text-sm font-medium text-theme">{profile?.display_name || user.email}</span>
                    </Link>
                    <div className="relative" ref={dropdownRef}>
                      <button onClick={() => setShowThemeDropdown(!showThemeDropdown)} className="text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover" title="Theme Settings">
                        <Settings className="h-5 w-5" />
                      </button>
                      {showThemeDropdown && (
                        <div className="absolute right-0 mt-2 w-72 z-50">
                          <ThemeDropdownContent />
                        </div>
                      )}
                    </div>
                    <button onClick={handleLogout} className="text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover" title="Logout">
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors">Login</Link>
                  <Link to="/register" className="theme-button-primary px-4 py-2 rounded-md text-sm font-medium">Sign Up</Link>
                </>
              )}
            </nav>

            {/* Mobile right side */}
            <div className="flex md:hidden items-center gap-2">
              {user && <NotificationBell />}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover"
              >
                {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t-2 border-theme bg-surface px-4 py-4 space-y-3">
            {user ? (
              <>
                <Link to="/profile" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-3 pb-3 border-b border-theme">
                  <div className="h-8 w-8 rounded-full bg-surface-hover flex items-center justify-center border-2 border-theme overflow-hidden">
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      : <User className="h-4 w-4 text-accent" />}
                  </div>
                  <span className="text-sm font-medium text-theme">{profile?.display_name || user.email}</span>
                </Link>
                <Link to="/dashboard" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-2 py-2 text-sm font-medium text-theme">
                  <BookOpen className="h-4 w-4 text-accent" /> My Books
                </Link>
                <Link to="/clubs" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-2 py-2 text-sm font-medium text-theme">
                  <Users className="h-4 w-4 text-accent" /> Book Clubs
                </Link>
                <Link to="/live" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-2 py-2 text-sm font-medium text-theme">
                  <Radio className="h-4 w-4 text-accent" /> Live Shows
                </Link>
                <button onClick={() => { setTutorialActive(true); setShowMobileMenu(false); }} className="flex items-center gap-2 py-2 text-sm font-medium text-theme w-full">
                  <GraduationCap className="h-4 w-4 text-accent" /> Tutorial
                </button>
                {profile?.system_role === 'super_admin' && (
                  <Link to="/admin" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-2 py-2 text-sm font-medium text-purple-500">
                    <Shield className="h-4 w-4" /> Admin Panel
                  </Link>
                )}
                <Link to="/profile" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-2 py-2 text-sm font-medium text-theme">
                  <User className="h-4 w-4 text-accent" /> My Profile
                </Link>
                <Link to="/dashboard" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-2 py-2 text-sm font-medium theme-button-primary px-3 rounded-md">
                  <Plus className="h-4 w-4" /> New Book
                </Link>
                <div className="border-t border-theme pt-3">
                  <button
                    onClick={() => setShowMobileTheme(v => !v)}
                    className="flex items-center justify-between w-full py-2 text-sm font-medium text-theme"
                  >
                    <span className="flex items-center gap-2"><Palette className="h-4 w-4 text-accent" /> Colour Theme</span>
                    {showMobileTheme ? <X className="h-4 w-4 text-muted" /> : <Settings className="h-4 w-4 text-muted" />}
                  </button>
                  {showMobileTheme && <ThemeDropdownContent />}
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 py-2 text-sm text-red-600 w-full">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setShowMobileMenu(false)} className="flex items-center py-2 text-sm font-medium text-theme">Login</Link>
                <Link to="/register" onClick={() => setShowMobileMenu(false)} className="flex items-center py-2 text-sm font-medium theme-button-primary px-4 rounded-md">Sign Up</Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Tutorial overlay — rendered at layout level so it persists across page navigation */}
      {tutorialActive && (
        <TutorialOverlay
          chapters={TUTORIAL_CHAPTERS}
          bookId={TUTORIAL_BOOK_ID}
          onClose={() => setTutorialActive(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-surface border-t-2 border-strong mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <p className="text-sm text-muted">
              &copy; {new Date().getFullYear()} BookFlow. Interactive book platform.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-sm text-muted hover:text-theme transition-colors">About</a>
              <a href="#" className="text-sm text-muted hover:text-theme transition-colors">Help</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
