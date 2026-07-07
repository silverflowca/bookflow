import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, colorSchemes, ColorSchemeKey } from '../../contexts/ThemeContext';
import { BookOpen, User, LogOut, Plus, Settings, Sun, Moon, Check, Palette, Menu, X, Users, ChevronDown, ChevronRight, GraduationCap, CheckCircle, Volume2, MessageSquare, MessageSquarePlus, BarChart2, Video, Shield, Sparkles, HelpCircle, Inbox } from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import TutorialOverlay, { TutorialChapter } from '../reader/TutorialOverlay';
import FeedbackButton from '../feedback/FeedbackButton';
import FeedbackPanel from '../feedback/FeedbackPanel';
import { useFeedbackContext } from '../../contexts/FeedbackContext';
import api from '../../lib/api';

const TUTORIAL_BOOK_ID = 'f0c66a4a-ced2-4b75-ab42-84dafba9cd3d';
// Chapter IDs from the seeded tutorial book
const TUTORIAL_CH1 = 'd4b719dd-31f6-4bbc-8275-08270c06a6ad'; // Welcome — Navigating
const TUTORIAL_CH4 = '26093b88-1f29-4e4c-b0bf-a2471c89c637'; // Publishing

const EDITOR_URL = `/edit/book/${TUTORIAL_BOOK_ID}/chapter/${TUTORIAL_CH1}`;
const READER_URL = `/book/${TUTORIAL_BOOK_ID}/chapter/${TUTORIAL_CH1}`;

export default function Layout() {
  const { user, profile, logout } = useAuth();
  const { colorScheme, setColorScheme } = useTheme();
  const { openFeedback } = useFeedbackContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileTheme, setShowMobileTheme] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Close mobile menu on route change
  useEffect(() => { setShowMobileMenu(false); }, [location.pathname]);
  const [tutorialActive, setTutorialActive] = useState(false);

  const TUTORIAL_CHAPTERS: TutorialChapter[] = [
    // ── Chapter 0: Navigating ────────────────────────────────────────────────
    {
      title: 'Navigating',
      description: 'Table of contents, progress tracking, text-to-speech & the reader layout.',
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
          placement: 'top', chapter: 0, action: { type: 'none', instruction: '' },
          navigateTo: READER_URL,
        },
      ],
    },
    // ── Chapter 1: Dashboard ─────────────────────────────────────────────────
    {
      title: 'Dashboard',
      description: 'Your home base — view, create and manage all your books and clubs.',
      steps: [
        {
          target: '#bf-dash-header',
          title: 'My Books Dashboard',
          description: <>The <strong>Dashboard</strong> is your home base. It shows all the books you have created. Click <strong>Read Books</strong> in the nav, or the <strong><BookOpen className="inline h-3.5 w-3.5 mb-0.5" /> BookFlow</strong> logo, to get here from anywhere.</>,
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
      description: 'Write chapters, format content and collaborate with co-authors.',
      steps: [
        {
          target: '#bf-book-meta',
          title: 'Book Title & Metadata',
          description: <>The sidebar shows the book title, subtitle and author. As an author you also see a <strong>Dashboard</strong> link that opens analytics for your book.</>,
          placement: 'right', chapter: 2, action: { type: 'none', instruction: '' },
          navigateTo: READER_URL,
        },
        {
          target: '#bf-editor-toolbar [title="Bold"]',
          title: '✏️ Text Formatting',
          description: <><strong>B</strong> Bold · <strong>I</strong> Italic · <strong>U</strong> Underline · <strong>H2</strong> Heading · bullet list · numbered list · block quote. These apply to selected text or at your cursor position.</>,
          placement: 'bottom', chapter: 2, action: { type: 'none', instruction: '' },
          navigateTo: EDITOR_URL,
        },
        {
          target: '#bf-editor-toolbar [title="Add Question"]',
          title: '💬 Interactive Content',
          description: <>Engage your readers with embedded content: <strong>Question</strong> (reader types a response), <strong>Poll</strong>, <strong>Highlight</strong>, <strong>Note</strong>, <strong>Link</strong>, <strong>Audio</strong> clip, and <strong>Video</strong>.</>,
          placement: 'bottom', chapter: 2, action: { type: 'none', instruction: '' },
          navigateTo: EDITOR_URL,
        },
        {
          target: '#bf-editor-toolbar [title="Add Select Dropdown"]',
          title: '📋 Form Fields',
          description: <>Collect reader input with form elements: <strong>Select</strong> dropdown, <strong>Multi-select</strong>, <strong>Text input</strong> (single line), <strong>Text area</strong> (multi-line), <strong>Radio</strong> options, and <strong>Checkboxes</strong>.</>,
          placement: 'bottom', chapter: 2, action: { type: 'none', instruction: '' },
          navigateTo: EDITOR_URL,
        },
        {
          target: '#bf-editor-toolbar [title="Add Code Block"]',
          title: '🧱 Blocks & Media',
          description: <>Insert structured content: <strong>Code block</strong> (syntax-highlighted), <strong>Scripture</strong> reference, <strong>Image</strong>, and <strong>Column layout</strong> (2–5 side-by-side columns).</>,
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
      description: 'Embed video, audio, polls and questions to make chapters interactive.',
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
      description: 'Make your book public, invite readers and create book clubs.',
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

  // Saved books count for badge
  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => {
    if (!user) { setSavedCount(0); return; }
    api.getSavedBooksCount().then(r => setSavedCount(r.count)).catch(() => {});
  }, [user]);

  // Listen for saves triggered from elsewhere (e.g. carousel click)
  useEffect(() => {
    function onSave() {
      if (!user) return;
      api.getSavedBooksCount().then(r => setSavedCount(r.count)).catch(() => {});
    }
    window.addEventListener('bf-book-saved', onSave);
    return () => window.removeEventListener('bf-book-saved', onSave);
  }, [user]);

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
      {/* More Settings — goes to Admin for super admins, otherwise Settings */}
      <Link
        to={profile?.system_role === 'super_admin' ? '/admin' : '/settings'}
        onClick={() => { setShowThemeDropdown(false); setShowMobileMenu(false); }}
        className="flex items-center gap-3 px-4 py-3 border-b border-theme text-sm font-semibold text-theme hover:bg-surface-hover transition-colors"
      >
        <Settings className="h-4 w-4 text-accent" />
        <span>{profile?.system_role === 'super_admin' ? 'Admin & Settings' : 'More Settings'}</span>
      </Link>
      <Link
        to="/my-feedback"
        onClick={() => { setShowThemeDropdown(false); setShowMobileMenu(false); }}
        className="flex items-center gap-3 px-4 py-3 border-b-2 border-theme text-sm font-semibold text-theme hover:bg-surface-hover transition-colors"
      >
        <Inbox className="h-4 w-4 text-accent" />
        <span>My Feedback</span>
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
    <div className="h-screen flex flex-col overflow-hidden bg-theme">
      {/* Header */}
      <header id="bf-app-header" className="theme-header flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex flex-col items-start">
              <Link to="/" className="flex items-center gap-2 text-accent hover:opacity-80 transition-opacity">
                <BookOpen className="h-8 w-8" />
                <span className="text-xl font-bold">BookFlow</span>
              </Link>
              {/* Concept stamp — sits below logo, rotated slightly */}
              <Link to="/bl/about" className="select-none self-end mt-2 rotate-[-8deg]">
                <div className="border-[2px] border-red-600 text-red-600 font-black uppercase text-[8px] px-1.5 py-px rounded-sm tracking-widest whitespace-nowrap hover:bg-red-50 transition-colors">
                  Concept Website
                </div>
              </Link>
            </div>

            {/* Desktop Navigation — always shown */}
            <nav className="flex items-center gap-1">
              {user ? (
                <>
                  {/* Core nav — always visible, text label shown on lg+ */}
                  <Link to="/dashboard" id="bf-nav-books" className="relative flex items-center gap-1 text-muted hover:text-theme px-2 md:px-3 py-2 rounded-md text-sm font-medium transition-colors" title="Books">
                    <BookOpen className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden md:inline">Books</span>
                    {savedCount > 0 && (
                      <span
                        key={savedCount}
                        className="bf-wiggle absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none"
                      >
                        {savedCount > 99 ? '99+' : savedCount}
                      </span>
                    )}
                  </Link>
                  <Link id="bf-nav-clubs" to="/clubs" className="flex items-center gap-1 text-muted hover:text-theme px-2 md:px-3 py-2 rounded-md text-sm font-medium transition-colors" title="Clubs">
                    <Users className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden md:inline">Clubs</span>
                  </Link>
                  <Link to="/clubs?tab=bookstudy" id="bf-nav-study" className="flex items-center gap-1 text-muted hover:text-theme px-2 md:px-3 py-2 rounded-md text-sm font-medium transition-colors" title="Study Groups">
                    <BookOpen className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden md:inline">Study Groups</span>
                  </Link>
                  <span id="bf-nav-live" className="flex items-center gap-1 text-muted/40 px-2 md:px-3 py-2 rounded-md text-sm font-medium cursor-not-allowed select-none" title="Live — coming soon">
                    <Video className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden md:inline">Live</span>
                  </span>
                  {/* Tutorial + Help + Admin — only on xl screens */}
                  <button id="bf-tutorial-btn" onClick={() => setTutorialActive(true)} className="hidden xl:flex items-center gap-1 text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    <GraduationCap className="h-4 w-4" /> Tutorial
                  </button>
                  <Link to="/docs" className="hidden xl:flex items-center gap-1 text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    <HelpCircle className="h-4 w-4" /> Help
                  </Link>
                  {profile?.system_role === 'super_admin' && (
                    <Link to="/admin" className="hidden xl:flex items-center gap-1 text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                  )}
                  {/* Profile / settings strip */}
                  <div className="flex items-center gap-1 ml-2 pl-3 border-l-2 border-strong">
                    <div className="hidden md:flex items-center gap-1">
                      <NotificationBell />
                      <FeedbackButton onClick={openFeedback} />
                    </div>
                    <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity p-1" title={profile?.display_name || user.email}>
                      <div className="h-8 w-8 rounded-full bg-surface-hover flex items-center justify-center border-2 border-theme overflow-hidden flex-shrink-0">
                        {profile?.avatar_url
                          ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                          : <User className="h-4 w-4 text-accent" />}
                      </div>
                      <span className="hidden xl:inline text-sm font-medium text-theme">{profile?.display_name || user.email}</span>
                    </Link>
                    <div className="relative hidden md:block" ref={dropdownRef}>
                      <button onClick={() => setShowThemeDropdown(!showThemeDropdown)} className="text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover" title="Settings">
                        <Settings className="h-5 w-5" />
                      </button>
                      {showThemeDropdown && (
                        <div className="absolute right-0 mt-2 w-72 z-50">
                          <ThemeDropdownContent />
                        </div>
                      )}
                    </div>
                    <button onClick={handleLogout} className="hidden md:flex text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover" title="Logout">
                      <LogOut className="h-5 w-5" />
                    </button>
                    {/* Overflow hamburger — hidden on xl+ */}
                    <button
                      onClick={() => setShowMobileMenu(!showMobileMenu)}
                      className="xl:hidden text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover"
                    >
                      {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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

            {/* Mobile notification bell — always hidden since nav is always shown */}
            <div className="hidden items-center gap-2">
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

        {/* Mobile menu — slide-down sheet */}
        {showMobileMenu && (
          <div className="border-t-2 border-strong bg-surface shadow-xl">
            {user ? (
              <>
                {/* Profile row */}
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-4 border-b border-theme hover:bg-surface-hover transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-surface-hover flex items-center justify-center border-2 border-theme overflow-hidden flex-shrink-0">
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      : <User className="h-5 w-5 text-accent" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-theme truncate">{profile?.display_name || user.email}</p>
                    <p className="text-xs text-muted">View profile →</p>
                  </div>
                </Link>

                {/* Nav links */}
                <div id="bf-mobile-nav-links" className="py-2">
                  <Link to="/dashboard" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-theme hover:bg-surface-hover transition-colors">
                    <BookOpen className="h-5 w-5 text-accent flex-shrink-0" /> Books
                  </Link>
                  <Link to="/clubs" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-theme hover:bg-surface-hover transition-colors">
                    <Users className="h-5 w-5 text-accent flex-shrink-0" /> Book Clubs
                  </Link>
                  <Link to="/clubs?tab=bookstudy" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-theme hover:bg-surface-hover transition-colors">
                    <BookOpen className="h-5 w-5 text-accent flex-shrink-0" /> Study Groups
                  </Link>
                  <span className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-muted/40 cursor-not-allowed select-none">
                    <Video className="h-5 w-5 flex-shrink-0" /> Live <span className="ml-1 text-xs">(coming soon)</span>
                  </span>
                  <button
                    onClick={() => { setTutorialActive(true); setShowMobileMenu(false); }}
                    className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-theme hover:bg-surface-hover transition-colors w-full"
                  >
                    <GraduationCap className="h-5 w-5 text-accent flex-shrink-0" /> Tutorial
                  </button>
                  <button
                    onClick={() => { openFeedback(); setShowMobileMenu(false); }}
                    className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-theme hover:bg-surface-hover transition-colors w-full"
                  >
                    <MessageSquarePlus className="h-5 w-5 text-accent flex-shrink-0" /> Submit Feedback
                  </button>
                  <Link to="/my-feedback" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-theme hover:bg-surface-hover transition-colors">
                    <Inbox className="h-5 w-5 text-accent flex-shrink-0" /> My Feedback
                  </Link>
                  <Link to="/docs" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-theme hover:bg-surface-hover transition-colors">
                    <HelpCircle className="h-5 w-5 text-accent flex-shrink-0" /> Help & Documentation
                  </Link>
                  {profile?.system_role === 'super_admin' && (
                    <Link to="/admin" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-purple-500 hover:bg-surface-hover transition-colors">
                      <Shield className="h-5 w-5 flex-shrink-0" /> Admin Panel
                    </Link>
                  )}
                </div>

                {/* Theme toggle */}
                <div className="border-t border-theme">
                  <button
                    onClick={() => setShowMobileTheme(v => !v)}
                    className="flex items-center justify-between w-full px-4 py-3.5 text-sm font-medium text-theme hover:bg-surface-hover transition-colors"
                  >
                    <span className="flex items-center gap-3"><Palette className="h-5 w-5 text-accent" /> Colour Theme</span>
                    <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${showMobileTheme ? 'rotate-180' : ''}`} />
                  </button>
                  {showMobileTheme && (
                    <div className="px-4 pb-4">
                      <ThemeDropdownContent />
                    </div>
                  )}
                </div>

                {/* Sign out */}
                <div className="border-t border-theme">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full"
                  >
                    <LogOut className="h-5 w-5 flex-shrink-0" /> Sign Out
                  </button>
                </div>
              </>
            ) : (
              <div className="px-4 py-4 flex flex-col gap-3">
                <Link to="/login" className="flex items-center justify-center py-3 text-sm font-medium text-theme border-2 border-theme rounded-xl hover:bg-surface-hover transition-colors">
                  Login
                </Link>
                <Link to="/register" className="flex items-center justify-center py-3 text-sm font-medium theme-button-primary rounded-xl">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content — flex-1 so it fills remaining height; overflow-auto for normal pages */}
      <main className={`flex-1 overflow-auto${user ? ' pb-20 md:pb-0' : ''}`}>
        <Outlet />
      </main>

      {/* Tutorial overlay — rendered at layout level so it persists across page navigation */}
      {tutorialActive && (
        <TutorialOverlay
          chapters={TUTORIAL_CHAPTERS}
          bookId={TUTORIAL_BOOK_ID}
          onClose={() => setTutorialActive(false)}
          onBeforeStep={(step) => {
            // Open the BookReader sidebar before steps that target it, so the element
            // is visible in the DOM when TutorialOverlay measures it.
            const SIDEBAR_TARGETS = new Set(['#bf-toc-sidebar', '#bf-chapter-list', '#bf-progress-btn', '#bf-book-meta']);
            if (step?.target && SIDEBAR_TARGETS.has(step.target)) {
              window.dispatchEvent(new CustomEvent('bf-open-sidebar'));
            }
          }}
        />
      )}

      {/* Feedback panel — rendered at layout level, persists across navigation */}
      {user && <FeedbackPanel />}

      {/* Mobile bottom navigation — hidden on md+ */}
      {user && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t-2 border-strong flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Link
            to="/dashboard"
            className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-2.5 text-xs font-medium transition-colors ${location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/edit') ? 'text-accent' : 'text-gray-600 dark:text-gray-400 hover:text-accent'}`}
          >
            <BookOpen className="h-5 w-5" />
            <span>Books</span>
            {savedCount > 0 && (
              <span
                key={savedCount}
                className="bf-wiggle absolute top-1.5 right-[calc(50%-16px)] min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none"
              >
                {savedCount > 99 ? '99+' : savedCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => {
              const scrollToFeatures = () => {
                const el = document.getElementById('features');
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 64;
                  window.scrollTo({ top, behavior: 'smooth' });
                }
              };
              if (location.pathname === '/') {
                // Defer past the current rAF tick so carousel doesn't interrupt
                setTimeout(scrollToFeatures, 50);
              } else {
                window.location.href = '/#features';
              }
            }}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-2.5 text-xs font-medium transition-colors ${location.hash === '#features' ? 'text-accent' : 'text-gray-600 dark:text-gray-400 hover:text-accent'}`}
          >
            <Sparkles className="h-5 w-5" />
            <span>Features</span>
          </button>
          <Link
            to="/clubs"
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-2.5 text-xs font-medium transition-colors ${location.pathname.startsWith('/clubs') ? 'text-accent' : 'text-gray-600 dark:text-gray-400 hover:text-accent'}`}
          >
            <Users className="h-5 w-5" />
            <span>Clubs</span>
          </Link>
          <Link
            to="/profile"
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-2.5 text-xs font-medium transition-colors ${location.pathname === '/profile' ? 'text-accent' : 'text-gray-600 dark:text-gray-400 hover:text-accent'}`}
          >
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
              : <User className="h-5 w-5" />
            }
            <span>Profile</span>
          </Link>
        </nav>
      )}

      {/* Footer */}
      <footer className="bg-surface border-t-2 border-strong mt-auto hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-1">
            <p className="text-xs text-muted">
              &copy; {new Date().getFullYear()} BookFlow. Interactive book platform.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-xs text-muted hover:text-theme transition-colors">About</a>
              <Link to="/docs" className="text-xs text-muted hover:text-theme transition-colors">Help</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
