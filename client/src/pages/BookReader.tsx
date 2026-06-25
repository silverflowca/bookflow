import React, { useEffect, useState, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Menu, X, BookOpen, BarChart2,
  Highlighter, StickyNote, Link2, Play, Video, Volume2, VolumeX, Square, Loader2,
  User, Crown, List, Type, AlignLeft, Circle, CheckSquare, Code, Pencil,
  Check, AlertCircle, Users, Lock, Globe, CheckCircle, ArrowUp, Maximize2, Star,
  Eye, EyeOff, HelpCircle, Share2
} from 'lucide-react';

// Context for progress tracking — avoids prop-drilling into deeply nested block components
interface ProgressCtx {
  completions: Set<string>;
  markComplete: (itemKey: string, itemType: string) => void;
  markIncomplete: (itemKey: string) => void;
  enabled: boolean;
}
const ProgressContext = createContext<ProgressCtx>({ completions: new Set(), markComplete: () => {}, markIncomplete: () => {}, enabled: false });

// Context for toggling inline component highlight visibility
const HighlightsContext = createContext<boolean>(true);

// Context for task-list checkbox state (per-chapter, persisted to localStorage)
interface TaskChecksCtx {
  checked: Set<string>;
  toggle: (key: string) => void;
  setChecked: (key: string, value: boolean) => void;
}
const TaskChecksContext = createContext<TaskChecksCtx>({ checked: new Set(), toggle: () => {}, setChecked: () => {} });

// Context for coordinating media playback — enforces one playing + one PiP at a time
interface MediaCtx {
  playingId: string | null;
  pipId: string | null;
  requestPlay: (id: string, pause: () => void) => void;
  requestPip: (id: string, close: () => void) => void;
  clearPlay: (id: string) => void;
  clearPip: (id: string) => void;
}
const MediaContext = createContext<MediaCtx>({
  playingId: null, pipId: null,
  requestPlay: () => {}, requestPip: () => {},
  clearPlay: () => {}, clearPip: () => {},
});
// Context that any interactive component can call to request a login/register modal
const AuthGateContext = createContext<() => void>(() => {});

import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import InlineContentModal from '../components/editor/InlineContentModal';
import TutorialOverlay from '../components/reader/TutorialOverlay';
import { buildFeatureTours } from '../components/reader/FeatureDemoTours';
import { DEMO_BOOK_ID } from '../config/demoBook';
import type {
  Book, Chapter, InlineContent, InlineContentType, PollData, MediaData, LinkData, NoteData, HighlightData,
  SelectData, MultiselectData, TextboxData, TextareaData, RadioData, CheckboxData, CodeBlockData, ScriptureBlockData, ImageData, DrawingData,
  AllFormResponsesResult,
} from '../types';


export default function BookReader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const highlightApplied = useRef(false);
  const [inlineContent, setInlineContent] = useState<InlineContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [activeContent, setActiveContent] = useState<InlineContent | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Reader inline content state
  const [selectedText, setSelectedText] = useState<{ text: string; range: Range | null } | null>(null);
  const [showReaderToolbar, setShowReaderToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showReaderModal, setShowReaderModal] = useState<{ type: InlineContentType } | null>(null);
  const [contentFilter, setContentFilter] = useState<'all' | 'author' | 'mine'>('all');
  const [showHighlights, setShowHighlights] = useState(true);

  // TTS State
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsSegmentsRef = useRef<{ text: string; charStart: number; charEnd: number; timeStart: number; timeEnd: number }[]>([]);
  const ttsHighlightRef = useRef<HTMLElement | null>(null);

  // Progress tracking
  const [chapterCompletions, setChapterCompletions] = useState<Set<string>>(new Set());
  const chapterCompletionsRef = useRef<Set<string>>(new Set()); // sync ref for stale-closure-safe checks
  const chapterProgressTotalRef = useRef(0);
  const [bookChapterStats, setBookChapterStats] = useState<Map<string, { completed: number; total: number }>>(new Map());
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  // Live episode banner
  const [liveEpisode, setLiveEpisode] = useState<{ id: string; title: string; guest_invite_url?: string; live_shows?: { guest_invite_url?: string } } | null>(null);
  const [liveBannerDismissed, setLiveBannerDismissed] = useState(false);

  // Media coordination — one playing + one PiP at a time
  const [mediaPlayingId, setMediaPlayingId] = useState<string | null>(null);
  const [mediaPipId, setMediaPipId] = useState<string | null>(null);

  // Pending tour from Home page feature cards
  const [pendingTour, setPendingTour] = useState<{ bookId: string; chapterIdx: number } | null>(null);

  // Auth gate modal — shown when a guest tries to interact with a component
  const [showAuthModal, setShowAuthModal] = useState(false);
  const requestAuth = useCallback(() => setShowAuthModal(true), []);

  // Focus / simple view mode — hides sidebar, filter bar, and inline panel
  const [focusMode, setFocusMode] = useState(false);
  const toggleFocusMode = () => {
    setFocusMode(v => {
      const entering = !v;
      if (entering) setShowToc(false);
      document.body.dataset.readerFocus = entering ? '1' : '';
      return entering;
    });
  };
  // Clean up body attribute on unmount
  useEffect(() => () => { document.body.dataset.readerFocus = ''; }, []);

  // Share toast
  const [shareToast, setShareToast] = useState<string | null>(null);
  const shareToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read sessionStorage after every navigation (useState initializer only runs once on first mount)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('BF_PENDING_TOUR');
      if (raw) {
        sessionStorage.removeItem('BF_PENDING_TOUR');
        // Small delay so chapter content finishes rendering before overlay mounts
        setTimeout(() => setPendingTour(JSON.parse(raw)), 600);
      }
    } catch { /* ignore */ }
  }, [bookId, chapterId]);

  // Auto-launch tour when reader navigates to a new chapter in the demo book
  useEffect(() => {
    if (!bookId || !chapterId || !book) return;
    // Only trigger for the configured demo book
    if (bookId !== DEMO_BOOK_ID) return;
    // Don't double-launch if a tour is already pending/showing
    if (pendingTour) return;
    // Find which order_index this chapter has
    const chapters = (book as any).chapters ?? [];
    const ch = chapters.find((c: any) => c.id === chapterId);
    if (!ch || ch.order_index == null) return;
    const chapterIdx: number = ch.order_index;
    // Track which chapters have already shown the tour this session
    const seenKey = `BF_TOURED_${bookId}`;
    try {
      const seen: number[] = JSON.parse(sessionStorage.getItem(seenKey) || '[]');
      if (seen.includes(chapterIdx)) return;
      seen.push(chapterIdx);
      sessionStorage.setItem(seenKey, JSON.stringify(seen));
    } catch { /* ignore */ }
    setTimeout(() => setPendingTour({ bookId, chapterIdx }), 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapterId, book]);
  const mediaPauseCallbacks = useRef<Map<string, () => void>>(new Map());
  const mediaPipCloseCallbacks = useRef<Map<string, () => void>>(new Map());
  const mediaCtx = useMemo<MediaCtx>(() => ({
    playingId: mediaPlayingId,
    pipId: mediaPipId,
    requestPlay: (id, pause) => {
      // Stop TTS if it's playing
      const ttsEl = ttsAudioRef.current;
      if (ttsEl && !ttsEl.paused) {
        ttsEl.pause();
        ttsEl.currentTime = 0;
        setTtsPlaying(false);
        setTtsAudio(null);
        ttsAudioRef.current = null;
        ttsSegmentsRef.current = [];
        if (ttsHighlightRef.current) {
          const mark = ttsHighlightRef.current;
          if (mark.parentNode) {
            while (mark.firstChild) mark.parentNode.insertBefore(mark.firstChild, mark);
            mark.parentNode.removeChild(mark);
          }
          ttsHighlightRef.current = null;
        }
      }
      mediaPauseCallbacks.current.set(id, pause);
      setMediaPlayingId(prev => {
        if (prev && prev !== id) mediaPauseCallbacks.current.get(prev)?.();
        return id;
      });
    },
    requestPip: (id, close) => {
      mediaPipCloseCallbacks.current.set(id, close);
      setMediaPipId(prev => {
        if (prev && prev !== id) mediaPipCloseCallbacks.current.get(prev)?.();
        return id;
      });
    },
    clearPlay: (id) => setMediaPlayingId(prev => prev === id ? null : prev),
    clearPip: (id) => setMediaPipId(prev => prev === id ? null : prev),
  }), [mediaPlayingId, mediaPipId]);

  // Check if current user can edit: owner, collaborator (author/editor), or super admin
  const isAuthor = book?.author_id === user?.id
    || profile?.system_role === 'super_admin'
    || !!(book?.collaborators?.some(
        c => c.user_id === user?.id && ['author', 'editor'].includes(c.role)
      ));

  // Get book settings for reader permissions
  const settings = book?.settings;

  // Check what reader can add based on settings
  const canAddHighlight = settings?.allow_reader_highlights ?? false;
  const canAddNote = settings?.allow_reader_notes ?? false;
  const canAddQuestion = settings?.allow_reader_questions ?? false;
  const canAddPoll = settings?.allow_reader_polls ?? false;
  const canAddAudio = settings?.allow_reader_audio ?? false;
  const canAddVideo = settings?.allow_reader_video ?? false;
  const canAddLink = settings?.allow_reader_links ?? false;

  // Check if reader has any permissions
  const hasAnyPermission = canAddHighlight || canAddNote || canAddQuestion || canAddPoll || canAddAudio || canAddVideo || canAddLink;

  // Handle text selection for reader content creation
  const handleTextSelection = useCallback((e: MouseEvent) => {
    if (!hasAnyPermission && !isAuthor) return;

    // Don't trigger if clicking inside a modal or popup
    const target = e.target as HTMLElement;
    if (target.closest('[role="dialog"]') ||
        target.closest('.theme-modal') ||
        target.closest('[data-modal]') ||
        target.closest('.fixed.inset-0')) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      // Only hide toolbar if we're not in a modal
      if (!showReaderModal) {
        setShowReaderToolbar(false);
        setSelectedText(null);
      }
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 1) {
      if (!showReaderModal) {
        setShowReaderToolbar(false);
        setSelectedText(null);
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Position toolbar above selection
    setToolbarPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setSelectedText({ text, range });
    setShowReaderToolbar(true);
  }, [hasAnyPermission, isAuthor, showReaderModal]);

  // Handle creating reader inline content
  const handleCreateReaderContent = async (type: InlineContentType, data: any) => {
    if (!selectedText || !chapter) return;

    try {
      const newContent = await api.createInlineContent(chapter.id, {
        content_type: type,
        anchor_text: selectedText.text,
        content_data: data,
        position_in_chapter: 'inline',
        start_offset: 0,
        end_offset: selectedText.text.length,
        visibility: 'all_readers',
        is_author_content: isAuthor
      });

      setInlineContent(prev => [...prev, newContent]);
      setShowReaderModal(null);
      setShowReaderToolbar(false);
      setSelectedText(null);
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error('Failed to create content:', err);
      alert('Failed to create content');
    }
  };

  // Open sidebar when the tutorial overlay is about to highlight a sidebar element
  useEffect(() => {
    const openHandler = () => setShowToc(true);
    window.addEventListener('bf-open-sidebar', openHandler);
    // Legacy: also handle the step event for backward compat
    const SIDEBAR_TARGETS = new Set(['#bf-toc-sidebar', '#bf-chapter-list', '#bf-progress-btn', '#bf-book-meta']);
    const stepHandler = (e: Event) => {
      const step = (e as CustomEvent).detail;
      if (step?.target && SIDEBAR_TARGETS.has(step.target)) setShowToc(true);
    };
    window.addEventListener('bf-tutorial-step', stepHandler);
    return () => {
      window.removeEventListener('bf-open-sidebar', openHandler);
      window.removeEventListener('bf-tutorial-step', stepHandler);
    };
  }, []);

  // Listen for mouseup events to detect text selection
  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [handleTextSelection]);

  // Visibility filter (no position exclusion) — used for icon strip counts
  const visibleInlineContent = useMemo(() => {
    return inlineContent.filter(ic => {
      // Never count other users' private items (even for author)
      if (ic.visibility === 'private' && ic.created_by !== user?.id) return false;
      if (isAuthor) {
        if (contentFilter === 'author') return ic.is_author_content;
        if (contentFilter === 'mine') return ic.created_by === user?.id;
        return true;
      }
      if (ic.visibility === 'author_only') return false;
      if (contentFilter === 'author') return ic.is_author_content;
      if (contentFilter === 'mine') return ic.created_by === user?.id;
      return true;
    });
  }, [inlineContent, contentFilter, isAuthor, user?.id]);

  // Filter inline content based on selected filter
  const filteredInlineContent = useMemo(() => {
    return visibleInlineContent.filter(ic => {
      // Exclude items positioned at start/end of chapter — rendered separately
      if (ic.position_in_chapter === 'start_of_chapter' || ic.position_in_chapter === 'end_of_chapter') return false;
      return true;
    });
  }, [visibleInlineContent]);

  useEffect(() => {
    if (bookId) {
      loadBook();
    }
  }, [bookId]);


  useEffect(() => {
    if (chapterId) {
      loadChapter();
      highlightApplied.current = false;
      // Reset completions ref so the new chapter starts clean (server data will repopulate)
      chapterCompletionsRef.current = new Set();
      // Stop TTS when chapter changes
      if (ttsAudio) {
        ttsAudio.pause();
        ttsAudio.currentTime = 0;
        setTtsPlaying(false);
        const mark = ttsHighlightRef.current;
        if (mark?.parentNode) {
          while (mark.firstChild) mark.parentNode.insertBefore(mark.firstChild, mark);
          mark.parentNode.removeChild(mark);
        }
        ttsHighlightRef.current = null;
        ttsSegmentsRef.current = [];
      }
      // Record that this reader visited this chapter
      if (book) saveReadingProgress(chapterId);
    } else if (book?.chapters?.length) {
      // Navigate to first chapter
      navigate(`/book/${bookId}/chapter/${book.chapters[0].id}`, { replace: true });
    }
  }, [chapterId, book]);

  // Cleanup TTS audio on unmount
  useEffect(() => {
    return () => {
      if (ttsAudio) {
        ttsAudio.pause();
        ttsAudio.currentTime = 0;
      }
    };
  }, [ttsAudio]);

  // Poll for a live episode for this book
  useEffect(() => {
    if (!bookId) return;
    let interval: number;
    const check = async () => {
      try {
        const r = await api.getLiveEpisodes({ status: 'live' });
        const ep = (r.episodes ?? []).find((e: any) => e.live_shows?.book_id === bookId || e.chapter?.book_id === bookId);
        setLiveEpisode(ep ?? null);
      } catch { /* silent */ }
    };
    check();
    interval = window.setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [bookId]);

  // Deep-link: highlight text range from chat snippet (?offset=start&highlight=end)
  useEffect(() => {
    const offsetStart = parseInt(searchParams.get('offset') || '', 10);
    const offsetEnd = parseInt(searchParams.get('highlight') || '', 10);
    if (!chapter || isNaN(offsetStart) || isNaN(offsetEnd) || highlightApplied.current) return;

    // Wait for DOM to render the content
    const timer = setTimeout(() => {
      const container = document.querySelector('.reader-content');
      if (!container) return;

      // Walk all text nodes and find the character at the given offsets
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let charCount = 0;
      let startNode: Text | null = null;
      let startOffset = 0;
      let endNode: Text | null = null;
      let endOffset = 0;
      let node: Node | null;

      while ((node = walker.nextNode())) {
        const text = node as Text;
        const len = text.length;
        if (!startNode && charCount + len > offsetStart) {
          startNode = text;
          startOffset = offsetStart - charCount;
        }
        if (!endNode && charCount + len >= offsetEnd) {
          endNode = text;
          endOffset = offsetEnd - charCount;
          break;
        }
        charCount += len;
      }

      if (startNode && endNode) {
        try {
          const range = document.createRange();
          range.setStart(startNode, Math.min(startOffset, startNode.length));
          range.setEnd(endNode, Math.min(endOffset, endNode.length));

          // Highlight using a mark element
          const mark = document.createElement('mark');
          mark.style.cssText = 'background: rgba(99,102,241,0.25); border-radius: 2px; padding: 0 1px;';
          mark.setAttribute('data-chat-highlight', '1');
          range.surroundContents(mark);

          // Scroll into view
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Remove highlight after 6 seconds
          setTimeout(() => mark.replaceWith(...Array.from(mark.childNodes)), 6000);

          highlightApplied.current = true;
        } catch {
          // Range may span multiple elements — fall back to scroll only
          const rect = (startNode.parentElement ?? container).getBoundingClientRect();
          window.scrollTo({ top: rect.top + window.scrollY - 120, behavior: 'smooth' });
          highlightApplied.current = true;
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [chapter, searchParams]);

  async function loadBook() {
    try {
      const data = await api.getBook(bookId!);
      setBook(data);
    } catch (err) {
      console.error('Failed to load book:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadChapter() {
    setChapterLoading(true);
    try {
      const [chapterData, contentData] = await Promise.all([
        api.getChapter(chapterId!),
        api.getInlineContent(chapterId!),
      ]);
      setChapter(chapterData);
      setInlineContent(contentData);
    } catch (err) {
      console.error('Failed to load chapter:', err);
    } finally {
      setChapterLoading(false);
    }
  }

  // Save reading progress whenever the user reads a chapter (non-author, logged-in only)
  const saveReadingProgress = useCallback(async (chapId: string) => {
    if (!user || !bookId || !book || isAuthor) return;
    try {
      const publishedChapters = (book.chapters ?? []).filter((c: any) => c.status === 'published');
      if (!publishedChapters.length) return;
      const chapIndex = publishedChapters.findIndex((c: any) => c.id === chapId);
      // percent = chapters reached / total, capped at 99 unless it's the last one
      const pct = chapIndex < 0 ? 0
        : chapIndex === publishedChapters.length - 1 ? 100
        : Math.round(((chapIndex + 1) / publishedChapters.length) * 100);
      await api.updateReadingProgress(bookId, {
        current_chapter_id: chapId,
        scroll_position: 0,
        percent_complete: pct,
      });
    } catch (e) {
      console.error('[Progress] save failed:', e);
    }
  }, [user, bookId, book, isAuthor]);

  const progressEnabled = !!(user && (book?.settings?.enable_progress_tracking || (book as any)?.club_progress_tracking_enabled));

  // Task-list checkbox state — persisted to localStorage per chapter
  // Each item key: `task-<nodeKey>` = checked, `task-<nodeKey>:set` = reader has overridden author value
  function taskChecksKey(cid: string) { return `bf-tasks-${cid}`; }
  function loadTaskChecks(cid: string): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(taskChecksKey(cid)) || '[]')); }
    catch { return new Set(); }
  }
  const [taskChecks, setTaskChecks] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (chapterId) setTaskChecks(loadTaskChecks(chapterId));
  }, [chapterId]);
  const saveTaskChecks = useCallback((next: Set<string>) => {
    if (!chapterId) return;
    localStorage.setItem(taskChecksKey(chapterId), JSON.stringify([...next]));
  }, [chapterId]);
  const toggleTaskCheck = useCallback((key: string) => {
    if (!chapterId) return;
    setTaskChecks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveTaskChecks(next);
      return next;
    });
  }, [chapterId, saveTaskChecks]);
  // Set a specific value (used by reader to override author's saved checked state)
  const setTaskCheckValue = useCallback((key: string, value: boolean) => {
    if (!chapterId) return;
    setTaskChecks(prev => {
      const next = new Set(prev);
      next.add(key + ':set'); // mark that reader has an explicit override
      if (value) next.add(key); else next.delete(key);
      saveTaskChecks(next);
      return next;
    });
  }, [chapterId, saveTaskChecks]);

  // Load progress when chapterId, bookId, or settings become available.
  // Guard on book !== null so we don't clear stats before settings are known.
  useEffect(() => {
    if (!chapterId || !bookId || book === null) return;
    if (!progressEnabled) {
      chapterCompletionsRef.current = new Set();
      setChapterCompletions(new Set());
      chapterProgressTotalRef.current = 0;
      return;
    }
    Promise.all([
      api.getChapterProgress(chapterId),
      api.getBookProgress(bookId),
    ]).then(([chapProg, bookProg]) => {
      const freshSet = new Set<string>(chapProg.completions);
      chapterCompletionsRef.current = freshSet;
      setChapterCompletions(freshSet);
      chapterProgressTotalRef.current = chapProg.total;
      const statsMap = new Map<string, { completed: number; total: number }>();
      bookProg.forEach(s => statsMap.set(s.chapter_id, { completed: s.completed, total: s.total }));
      setBookChapterStats(statsMap);
    }).catch(e => console.error('[Progress] load failed:', e));
  }, [progressEnabled, chapterId, bookId, book]);

  const markComplete = useCallback(async (itemKey: string, itemType: string) => {
    if (!progressEnabled || !chapterId) return;
    // Synchronous guard via ref — avoids the stale-closure problem with functional setState
    if (chapterCompletionsRef.current.has(itemKey)) return;
    chapterCompletionsRef.current = new Set([...chapterCompletionsRef.current, itemKey]);
    setChapterCompletions(new Set(chapterCompletionsRef.current));
    try {
      await api.markItemComplete(chapterId, itemKey, itemType);
      // Increment the chapter's completed count in the book stats map
      setBookChapterStats(prev => {
        const m = new Map(prev);
        const total = chapterProgressTotalRef.current;
        const s = m.get(chapterId) ?? { completed: 0, total };
        m.set(chapterId, { ...s, completed: Math.min(s.completed + 1, s.total > 0 ? s.total : total) });
        return m;
      });
    } catch (e) { console.error('[Progress] markComplete failed:', e); }
  }, [progressEnabled, chapterId]);

  const markIncomplete = useCallback((itemKey: string) => {
    if (!progressEnabled || !chapterId) return;
    const wasComplete = chapterCompletionsRef.current.has(itemKey);
    chapterCompletionsRef.current = new Set([...chapterCompletionsRef.current].filter(k => k !== itemKey));
    setChapterCompletions(new Set(chapterCompletionsRef.current));
    if (wasComplete) {
      setBookChapterStats(prev => {
        const m = new Map(prev);
        const s = m.get(chapterId);
        if (s) m.set(chapterId, { ...s, completed: Math.max(0, s.completed - 1) });
        return m;
      });
    }
    api.markItemIncomplete(chapterId, itemKey).catch(e => console.error('[Progress] markIncomplete failed:', e));
  }, [progressEnabled, chapterId]);

  const currentChapterIndex = useMemo(() => {
    return book?.chapters?.findIndex(c => c.id === chapterId) ?? -1;
  }, [book, chapterId]);

  const prevChapter = currentChapterIndex > 0 ? book?.chapters?.[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex < (book?.chapters?.length ?? 0) - 1
    ? book?.chapters?.[currentChapterIndex + 1]
    : null;

  async function handlePlayTTS() {
    if (ttsPlaying && ttsAudio) {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
      setTtsPlaying(false);
      // Clear highlight
      const mark = ttsHighlightRef.current;
      if (mark?.parentNode) {
        while (mark.firstChild) mark.parentNode.insertBefore(mark.firstChild, mark);
        mark.parentNode.removeChild(mark);
      }
      ttsHighlightRef.current = null;
      ttsSegmentsRef.current = [];
      return;
    }

    // Extract plain text from TipTap JSON content
    const extractText = (node: any): string => {
      if (!node) return '';

      // If it's a string, try to parse as JSON first (might be encoded)
      if (typeof node === 'string') {
        try {
          const parsed = JSON.parse(node);
          return extractText(parsed);
        } catch {
          // Not JSON, return as-is but filter out any remaining JSON-like content
          if (node.startsWith('{') || node.startsWith('[')) return '';
          return node;
        }
      }

      // Handle text nodes - this is the actual content we want
      if (node.type === 'text' && node.text) {
        return node.text;
      }

      // Recursively process content arrays
      if (node.content && Array.isArray(node.content)) {
        const texts = node.content.map((child: any) => extractText(child));
        // Add appropriate spacing based on node type
        if (node.type === 'paragraph' || node.type === 'heading') {
          return texts.join('') + '\n';
        }
        return texts.join('');
      }

      return '';
    };

    // Use content_text if available (plain text), otherwise extract from JSON
    let text = '';
    if (chapter?.content_text) {
      text = chapter.content_text;
    } else if (chapter?.content) {
      text = extractText(chapter.content);
    }

    // Clean up the text - remove extra whitespace and normalize
    text = text
      .replace(/\n{3,}/g, '\n\n')  // Reduce multiple newlines
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim();

    if (!text || text.length === 0) {
      alert('No content to read');
      return;
    }

    setTtsLoading(true);
    try {
      const audioBlob = await api.generateTTS(text);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Build sentence segments once duration is known
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration || 1;
        // Split into sentences — break on '. ', '! ', '? ', or '\n'
        const sentenceRe = /[^.!?\n]+[.!?\n]*/g;
        const sentences: { text: string; charStart: number; charEnd: number }[] = [];
        let match;
        while ((match = sentenceRe.exec(text)) !== null) {
          const t = match[0].trim();
          if (t.length > 0) sentences.push({ text: t, charStart: match.index, charEnd: match.index + match[0].length });
        }
        if (sentences.length === 0) sentences.push({ text, charStart: 0, charEnd: text.length });

        const totalChars = text.length;
        ttsSegmentsRef.current = sentences.map(s => ({
          ...s,
          timeStart: (s.charStart / totalChars) * duration,
          timeEnd: (s.charEnd / totalChars) * duration,
        }));
      });

      // Clear any existing highlight
      function clearHighlight() {
        if (ttsHighlightRef.current) {
          const mark = ttsHighlightRef.current;
          const parent = mark.parentNode;
          if (parent) {
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
          }
          ttsHighlightRef.current = null;
        }
      }

      // Highlight the sentence whose time window contains currentTime
      audio.addEventListener('timeupdate', () => {
        const t = audio.currentTime;
        const segs = ttsSegmentsRef.current;
        if (!segs.length) return;
        const seg = segs.find(s => t >= s.timeStart && t < s.timeEnd) ?? null;
        if (!seg) return;

        // Find text nodes in .reader-content that contain this sentence
        const container = document.querySelector('.reader-content');
        if (!container) return;

        // Walk all text nodes and find where the sentence text starts
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let node: Text | null;
        let accumulated = '';
        let found = false;

        // Build a flat list of text nodes + their cumulative char offsets
        const textNodes: { node: Text; start: number; end: number }[] = [];
        while ((node = walker.nextNode() as Text | null)) {
          const start = accumulated.length;
          accumulated += node.textContent ?? '';
          textNodes.push({ node, start, end: accumulated.length });
        }

        // The sentence charStart/charEnd are relative to `text` (extracted).
        // The DOM accumulated text may differ (extra whitespace, etc).
        // Use a fuzzy search: find the first node where the sentence text appears.
        const segText = seg.text.replace(/\s+/g, ' ').trim();
        const accNorm = accumulated.replace(/\s+/g, ' ');
        const pos = accNorm.indexOf(segText, Math.max(0, seg.charStart - 50));
        if (pos === -1) return; // can't locate — skip highlight

        const segEnd = pos + segText.length;

        // Find start node + offset
        let startNode: Text | null = null, startOffset = 0;
        let endNode: Text | null = null, endOffset = 0;

        // Re-walk with normalized offsets (map from accNorm pos to actual node)
        // Rebuild with normalised lengths per node
        let normAcc = 0;
        for (const tn of textNodes) {
          const nodeText = (tn.node.textContent ?? '').replace(/\s+/g, ' ');
          const nodeStart = normAcc;
          const nodeEnd = normAcc + nodeText.length;

          if (!startNode && pos < nodeEnd) {
            startNode = tn.node;
            startOffset = Math.min(pos - nodeStart, (tn.node.textContent ?? '').length);
          }
          if (!endNode && segEnd <= nodeEnd) {
            endNode = tn.node;
            endOffset = Math.min(segEnd - nodeStart, (tn.node.textContent ?? '').length);
            found = true;
          }
          normAcc = nodeEnd;
          if (found) break;
        }

        if (!startNode || !endNode) return;

        clearHighlight();
        try {
          const range = document.createRange();
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);

          const mark = document.createElement('mark');
          mark.className = 'tts-highlight';
          range.surroundContents(mark);
          ttsHighlightRef.current = mark;
          // Scroll into view if needed
          mark.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch {
          // Range may span multiple nodes — skip highlighting this segment
        }
      });

      audio.onended = () => {
        clearHighlight();
        ttsSegmentsRef.current = [];
        ttsAudioRef.current = null;
        setTtsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        clearHighlight();
        setTtsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        alert('Failed to play audio');
      };

      setTtsAudio(audio);
      ttsAudioRef.current = audio;
      await audio.play();
      setTtsPlaying(true);
    } catch (err) {
      console.error('TTS error:', err);
      alert('Failed to generate audio: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setTtsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <BookOpen className="h-12 w-12 text-muted mx-auto mb-4" />
        <p className="text-muted">Book not found</p>
        <Link to="/" className="text-accent hover:underline">
          Return Home
        </Link>
      </div>
    );
  }

  async function handleShareChapter() {
    // Build share URL: prefer /bl/<book-slug>?chapter=<chapter-slug>, fallback to direct reader URL
    let url: string;
    if (book?.slug && chapter?.slug) {
      url = `${window.location.origin}/bl/${book.slug}?chapter=${chapter.slug}`;
    } else if (book?.slug) {
      url = `${window.location.origin}/bl/${book.slug}`;
    } else {
      url = window.location.href;
    }

    const shareTitle = chapter?.title ? `${chapter.title} — ${book?.title ?? ''}` : (book?.title ?? 'BookFlow');
    const shareText = book?.description ? book.description.slice(0, 120) : shareTitle;

    // Use Web Share API if available (mobile / modern desktop)
    if (navigator.share) {
      const shareData: ShareData = { title: shareTitle, text: shareText, url };

      // Attach cover image as a File if the browser supports sharing files
      if (book?.cover_image_url && navigator.canShare) {
        try {
          const resp = await fetch(book.cover_image_url);
          const blob = await resp.blob();
          const ext = blob.type.split('/')[1]?.split('+')[0] || 'jpg';
          const file = new File([blob], `cover.${ext}`, { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ ...shareData, files: [file] });
            return;
          }
        } catch { /* image fetch failed — share without image */ }
      }

      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // user dismissed share sheet
      }
    }

    // Fallback: copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
      if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
      setShareToast('Link copied!');
      shareToastTimer.current = setTimeout(() => setShareToast(null), 2500);
    }).catch(() => {
      if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
      setShareToast('Could not copy');
      shareToastTimer.current = setTimeout(() => setShareToast(null), 2500);
    });
  }

  return (
    <AuthGateContext.Provider value={requestAuth}>
    <div className="h-full bg-surface-hover flex overflow-hidden">
      {/* Table of Contents Sidebar */}
      <aside id="bf-toc-sidebar" className={`fixed inset-y-0 left-0 w-72 bg-surface border-r border-theme transform transition-transform z-20 ${
        showToc ? 'translate-x-0' : '-translate-x-full'
      } ${focusMode ? '' : 'lg:relative lg:translate-x-0 lg:flex-shrink-0 lg:h-full'}`}>
        <div className="h-full flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-theme flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-accent">
              <BookOpen className="h-6 w-6" />
              <span className="font-semibold">BookFlow</span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowToc(false)}
                className="lg:hidden text-muted hover:text-theme"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div id="bf-book-meta" className="p-4">
            <h2 className="font-bold text-lg">{book.title}</h2>
            {book.subtitle && <p className="text-sm text-muted">{book.subtitle}</p>}
            <p className="text-sm text-muted mt-1">by {book.author?.display_name}</p>

            {/* Dashboard button — author only */}
            {isAuthor && (
              <Link
                to={`/edit/book/${bookId}/dashboard`}
                className="mt-2 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme text-sm text-muted hover:bg-surface-hover hover:text-theme transition-colors"
              >
                <BarChart2 className="h-4 w-4 shrink-0" />
                <span>Dashboard</span>
              </Link>
            )}

            {/* Progress button — shown when tracking is enabled */}
            {progressEnabled && (() => {
              const totalDone = Array.from(bookChapterStats.values()).reduce((a, s) => a + s.completed, 0);
              const totalItems = Array.from(bookChapterStats.values()).reduce((a, s) => a + s.total, 0);
              const chapterStat = chapterId ? bookChapterStats.get(chapterId) : undefined;
              const chapterAllDone = chapterStat && chapterStat.total > 0 && chapterStat.completed >= chapterStat.total;
              return (
                <div className="mt-3">
                  <button
                    id="bf-progress-btn"
                    onClick={() => setShowProgressPanel(v => !v)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      chapterAllDone
                        ? 'border-2 border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 font-semibold hover:bg-green-100 dark:hover:bg-green-900'
                        : 'border border-theme text-muted hover:bg-surface-hover hover:text-theme'
                    }`}
                  >
                    <CheckCircle className={`h-4 w-4 shrink-0 ${chapterAllDone ? 'text-green-600' : 'text-green-500'}`} />
                    <span className="flex-1 text-left">Progress</span>
                    <span className={`text-xs font-semibold ${chapterAllDone ? 'text-green-600' : 'text-blue-500'}`}>
                      {totalItems > 0 ? `${Math.round((totalDone / totalItems) * 100)}%` : '—'}
                    </span>
                  </button>
                  {totalItems > 0 && (
                    <div className="mt-1.5 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${chapterAllDone ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.round((totalDone / totalItems) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Star rating — shown to readers when author has enabled it */}
            {book.settings?.show_ratings !== false && !isAuthor && (
              <SidebarRating bookId={bookId!} />
            )}
            {/* Show aggregate to author even without interaction */}
            {book.settings?.show_ratings !== false && isAuthor && book.rating_count! > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium text-theme">{book.rating_average?.toFixed(1)}</span>
                <span>({book.rating_count})</span>
              </div>
            )}
          </div>

          <div className="px-4 pt-3 pb-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">Chapters</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <nav id="bf-chapter-list" className="px-2">
              {book.chapters?.map((ch, index) => {
                const stat = progressEnabled ? bookChapterStats.get(ch.id) : null;
                const chDone = stat && stat.total > 0 && stat.completed >= stat.total;
                const pct = stat && stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
                const isActive = ch.id === chapterId;
                return (
                  <div key={ch.id} className="group/ch relative">
                    <Link
                      to={`/book/${bookId}/chapter/${ch.id}`}
                      onClick={() => setShowToc(false)}
                      className={`flex items-center px-3 py-2 rounded text-sm ${
                        isActive
                          ? 'bg-primary-100 text-primary-700 font-medium pr-8'
                          : 'text-theme hover:bg-surface-hover'
                      }`}
                    >
                      <span className="flex-1 min-w-0 truncate">{index + 1}. {ch.title}</span>
                      {stat && stat.total > 0 && (
                        <span className={`ml-2 shrink-0 text-xs font-medium ${chDone ? 'text-green-500' : 'text-muted'}`}>
                          {chDone ? '✓' : `${stat.completed}/${stat.total}`}
                        </span>
                      )}
                    </Link>
                    {showProgressPanel && stat && stat.total > 0 && (
                      <div className="mx-3 mb-2 mt-0.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted">{stat.completed}/{stat.total} items</span>
                          <span className={`text-xs font-semibold ${chDone ? 'text-green-500' : 'text-blue-500'}`}>{pct}%</span>
                        </div>
                        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${chDone ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {showToc && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={() => setShowToc(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Live Episode Banner */}
        {liveEpisode && !liveBannerDismissed && (
          <div className="flex-shrink-0 bg-red-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="animate-pulse font-bold shrink-0">🔴 LIVE NOW</span>
              <span className="truncate font-medium">{liveEpisode.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(liveEpisode.guest_invite_url || liveEpisode.live_shows?.guest_invite_url) && (
                <a
                  href={liveEpisode.guest_invite_url || liveEpisode.live_shows?.guest_invite_url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white text-red-700 px-3 py-1 rounded text-xs font-bold hover:bg-red-50 transition-colors"
                >
                  Join Live ↗
                </a>
              )}
              <button onClick={() => setLiveBannerDismissed(true)} className="opacity-70 hover:opacity-100 text-white text-lg leading-none">×</button>
            </div>
          </div>
        )}

        {/* Focus mode: minimal bar — hamburger left, logo center, minimize right */}
        {focusMode && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-theme bg-surface relative z-30">
            <button
              onClick={() => setShowToc(v => !v)}
              className="p-1.5 rounded-lg text-muted hover:text-theme hover:bg-surface-hover transition-colors"
              title="Chapters"
            >
              {showToc ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" className="flex items-center gap-2 text-accent">
              <BookOpen className="h-6 w-6" />
              <span className="text-lg font-bold">BookFlow</span>
            </Link>
            <button
              onClick={toggleFocusMode}
              className="p-1.5 rounded-lg text-muted hover:text-theme hover:bg-surface-hover transition-colors"
              title="Exit focus mode"
            >
              <Maximize2 className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Header — hidden in focus mode */}
        {!focusMode && (
        <header id="bf-reader-header" className="flex-shrink-0 bg-surface border-b border-theme z-10">
          {/* Row 1: nav + chapter counter + TTS + Edit */}
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setShowToc(true)}
              className="lg:hidden text-muted hover:text-theme"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-sm text-muted">
                Chapter {currentChapterIndex + 1} of {book.chapters?.length}
              </p>
            </div>
            {/* TTS Button — shown to logged-in users always, or to public readers only if author enabled it */}
            <button
              id="bf-tts-btn"
              style={{ display: (user || settings?.allow_public_tts) ? undefined : 'none' }}
              onClick={handlePlayTTS}
              disabled={ttsLoading || !chapter}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                ttsPlaying
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={ttsPlaying ? 'Stop listening' : 'Listen to chapter'}
            >
              {ttsLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Loading...</span>
                </>
              ) : ttsPlaying ? (
                <>
                  <Square className="h-4 w-4" />
                  <span className="hidden sm:inline">Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Listen</span>
                </>
              )}
            </button>
            {/* Edit button — visible to book author only */}
            {isAuthor && chapterId && (
              <Link
                to={`/edit/book/${bookId}/chapter/${chapterId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-hover text-theme hover:bg-primary-100 hover:text-primary-700 transition-colors ml-2"
                title="Back to editor"
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            )}
            {/* Focus mode toggle */}
            <button
              onClick={toggleFocusMode}
              title="Focus mode — hide panels"
              className="ml-2 p-1.5 rounded-lg text-muted hover:text-theme hover:bg-surface-hover transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Row 2: content filter + component type icons */}
          <div className="border-t border-theme">
            <div className="max-w-3xl mx-auto px-4 py-1.5 flex items-center gap-2 overflow-x-auto">
              {/* Content filter pills */}
              {(isAuthor || inlineContent.some(ic => ic.created_by === user?.id)) && (
                <div className="flex items-center gap-1 shrink-0 border-r border-theme pr-2 mr-1">
                  <span className="text-xs text-muted">Show:</span>
                  {(['all', 'author', 'mine'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setContentFilter(f)}
                      className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                        contentFilter === f
                          ? f === 'all' ? 'bg-primary-600 text-white'
                            : f === 'author' ? 'bg-amber-500 text-white'
                            : 'bg-blue-500 text-white'
                          : 'text-muted hover:bg-surface-hover'
                      }`}
                    >
                      {f === 'author' && <Crown className="h-3 w-3" />}
                      {f === 'mine' && <User className="h-3 w-3" />}
                      {f === 'all' ? 'All' : f === 'author' ? 'Author' : isAuthor ? 'Mine' : 'My Notes'}
                    </button>
                  ))}
                </div>
              )}

              {/* Component type filter icons */}
              <HeaderComponentIcons
                inlineContent={visibleInlineContent}
                filterType={filterType}
                onFilterChange={setFilterType}
                onContentSelect={setActiveContent}
                completions={chapterCompletions}
                showComponentPanel={settings?.show_component_panel ?? false}
              />

              {/* Toggle component highlights visibility */}
              {inlineContent.length > 0 && (
                <button
                  onClick={() => setShowHighlights(v => !v)}
                  title={showHighlights ? 'Hide highlights' : 'Show highlights'}
                  className={`ml-auto shrink-0 flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                    showHighlights ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'text-muted hover:bg-surface-hover'
                  }`}
                >
                  {showHighlights ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{showHighlights ? 'Highlights' : 'Highlights'}</span>
                </button>
              )}
            </div>
          </div>
        </header>
        )} {/* end !focusMode header */}


        {/* Scrollable chapter content */}
        <div className="flex-1 overflow-y-auto">

        {/* Chapter Content */}
        {chapterLoading ? (
          <article className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg w-2/3 mb-8" />
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-10/12" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            </div>
          </article>
        ) : chapter ? (
          <HighlightsContext.Provider value={showHighlights}>
          <MediaContext.Provider value={mediaCtx}>
          <ProgressContext.Provider value={{ completions: chapterCompletions, markComplete, markIncomplete, enabled: progressEnabled }}>
          <TaskChecksContext.Provider value={{ checked: taskChecks, toggle: toggleTaskCheck, setChecked: setTaskCheckValue }}>
          <article className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex items-start gap-3 mb-6">
              <h1 className="text-3xl font-bold flex-1">{chapter.title}</h1>
              {book.visibility === 'public' && (
                <button
                  onClick={handleShareChapter}
                  title="Copy chapter link"
                  className="mt-1 p-2 rounded-lg text-muted hover:text-accent hover:bg-surface-hover transition-colors shrink-0"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Start of Chapter Content */}
            <StartOfChapterContent items={inlineContent} isAuthor={isAuthor} userId={user?.id} />

            <div
              className={`reader-content text-lg text-theme leading-relaxed${ttsPlaying ? ' tts-active' : ''}`}
              onClick={ttsPlaying ? (e) => {
                const segs = ttsSegmentsRef.current;
                const audio = ttsAudio;
                if (!segs.length || !audio) return;

                // Find the text node + offset at the click point
                let clickedNode: Text | null = null;
                let clickedOffset = 0;
                const pt = { x: e.clientX, y: e.clientY };

                // Standard (Chrome/Safari)
                if (document.caretRangeFromPoint) {
                  const r = document.caretRangeFromPoint(pt.x, pt.y);
                  if (r?.startContainer.nodeType === Node.TEXT_NODE) {
                    clickedNode = r.startContainer as Text;
                    clickedOffset = r.startOffset;
                  }
                // Firefox
                } else if ((document as any).caretPositionFromPoint) {
                  const cp = (document as any).caretPositionFromPoint(pt.x, pt.y);
                  if (cp?.offsetNode?.nodeType === Node.TEXT_NODE) {
                    clickedNode = cp.offsetNode as Text;
                    clickedOffset = cp.offset;
                  }
                }

                if (!clickedNode) return;

                // Walk all text nodes in reader-content to find the global char offset
                const container = document.querySelector('.reader-content');
                if (!container) return;
                const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
                let globalOffset = 0;
                let node: Text | null;
                while ((node = walker.nextNode() as Text | null)) {
                  if (node === clickedNode) {
                    globalOffset += clickedOffset;
                    break;
                  }
                  globalOffset += (node.textContent ?? '').length;
                }

                // Find the segment whose char range contains this offset
                // Normalise: segments use charStart/charEnd from extracted text;
                // globalOffset is from the DOM text which may have more whitespace.
                // Use ratio: globalOffset / totalDomChars → proportion → seek
                const totalDomChars = (() => {
                  let n = 0;
                  const w2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
                  let nd: Text | null;
                  while ((nd = w2.nextNode() as Text | null)) n += (nd.textContent ?? '').length;
                  return n || 1;
                })();
                const ratio = Math.min(1, globalOffset / totalDomChars);
                const targetTime = ratio * (audio.duration || 1);

                audio.currentTime = targetTime;
                if (audio.paused) audio.play();
              } : undefined}
            >
              <ChapterContent
                content={chapter.content}
                contentText={chapter.content_text}
                inlineContent={filteredInlineContent}
                onContentClick={setActiveContent}
              />
            </div>

            {/* End of Chapter Questions */}
            <EndOfChapterContent items={inlineContent} isAuthor={isAuthor} userId={user?.id} />

            {/* Navigation */}
            <nav className="flex justify-between items-center mt-12 pt-8 border-t">
              {prevChapter ? (
                <Link
                  to={`/book/${bookId}/chapter/${prevChapter.id}`}
                  className="flex items-center gap-2 text-accent hover:text-accent"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <div>
                    <p className="text-xs text-muted">Previous</p>
                    <p className="font-medium">{prevChapter.title}</p>
                  </div>
                </Link>
              ) : (
                <div />
              )}

              {nextChapter ? (
                <Link
                  to={`/book/${bookId}/chapter/${nextChapter.id}`}
                  className="flex items-center gap-2 text-accent hover:text-accent text-right"
                >
                  <div>
                    <p className="text-xs text-muted">Next</p>
                    <p className="font-medium">{nextChapter.title}</p>
                  </div>
                  <ChevronRight className="h-5 w-5" />
                </Link>
              ) : (
                <div />
              )}
            </nav>
          </article>
          </TaskChecksContext.Provider>
          </ProgressContext.Provider>
          </MediaContext.Provider>
          </HighlightsContext.Provider>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 text-center text-muted">
            Select a chapter to start reading
          </div>
        )}

        </div>{/* end scrollable chapter content */}
      </main>


      {/* Inline Content Panel — hidden in focus mode */}
      {activeContent && !focusMode && (
        <ProgressContext.Provider value={{ completions: chapterCompletions, markComplete, markIncomplete, enabled: progressEnabled }}>
          <MediaContext.Provider value={mediaCtx}>
            <InlineContentPanel
              content={activeContent}
              onClose={() => setActiveContent(null)}
              isAuthor={isAuthor}
              userId={user?.id}
            />
          </MediaContext.Provider>
        </ProgressContext.Provider>
      )}

      {/* Reader Text Selection Toolbar */}
      {showReaderToolbar && selectedText && (hasAnyPermission || isAuthor) && (
        <ReaderSelectionToolbar
          position={toolbarPosition}
          canAddHighlight={canAddHighlight || isAuthor}
          canAddNote={canAddNote || isAuthor}
          canAddQuestion={canAddQuestion || isAuthor}
          canAddPoll={canAddPoll || isAuthor}
          canAddLink={canAddLink || isAuthor}
          canAddAudio={canAddAudio || isAuthor}
          canAddVideo={canAddVideo || isAuthor}
          onSelect={(type) => {
            setShowReaderModal({ type });
            setShowReaderToolbar(false);
          }}
          onClose={() => {
            setShowReaderToolbar(false);
            setSelectedText(null);
          }}
        />
      )}

      {/* Reader Inline Content Modal */}
      {showReaderModal && selectedText && (
        <InlineContentModal
          type={showReaderModal.type}
          selectedText={selectedText.text}
          bookId={bookId}
          onClose={() => {
            setShowReaderModal(null);
            setSelectedText(null);
          }}
          onCreate={(data) => handleCreateReaderContent(showReaderModal.type, data.content_data)}
        />
      )}

      {/* Feature demo tour — launched from Home page feature cards */}
      {pendingTour && book && (
        <TutorialOverlay
          chapters={buildFeatureTours(
            pendingTour.bookId,
            [...(book.chapters ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)).map(c => c.id),
          )}
          bookId={pendingTour.bookId}
          initialChapter={pendingTour.chapterIdx}
          initialStep={0}
          onClose={() => setPendingTour(null)}
          onBeforeStep={step => {
            if (step?.target && ['#bf-toc-sidebar', '#bf-chapter-list', '#bf-progress-btn'].includes(step.target)) {
              setShowToc(true);
            }
          }}
        />
      )}

      {/* Share toast */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium shadow-xl pointer-events-none">
          {shareToast}
        </div>
      )}

      {/* Auth gate modal — shown when a guest tries to interact with a component */}
      {showAuthModal && (
        <ReaderAuthModal onClose={() => setShowAuthModal(false)} />
      )}

    </div>
    </AuthGateContext.Provider>
  );
}

// ─── Auth Gate Modal ────────────────────────────────────────────────────────
// Shown when a guest clicks on an interactive component. Provides inline
// login / register without leaving the page. On success the modal closes
// and the user is already on the same chapter — they can interact immediately.
function ReaderAuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-purple-200 max-h-[90vh] flex flex-col">

        {/* White header — same logo style as app header */}
        <div className="relative bg-white px-5 pt-5 pb-3 border-b-2 border-purple-600 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          {/* Logo — identical to app header */}
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <BookOpen className="h-8 w-8" />
            <span className="text-xl font-bold text-gray-900">BookFlow</span>
          </div>
          <p className="text-lg font-bold text-gray-900">
            {tab === 'login' ? 'Sign In' : 'Sign Up'}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">To track your response you can sign in or register.</p>
        </div>


        {/* Form body */}
        <form onSubmit={handleSubmit} className="bg-white px-5 py-4 space-y-3 overflow-y-auto">
          {tab === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  autoComplete="name"
                  className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tab === 'register' ? 'Create a password' : 'Your password'}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full pl-8 pr-9 py-2 text-sm text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Please wait…
              </>
            ) : tab === 'login' ? 'Sign In to BookFlow' : 'Create My Account'}
          </button>

          <p className="text-center text-sm text-gray-600 pb-1">
            {tab === 'login' ? (
              <>No account yet?{' '}
                <button type="button" onClick={() => { setTab('register'); setError(''); }} className="text-purple-600 font-semibold hover:underline">
                  Create one free
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" onClick={() => { setTab('login'); setError(''); }} className="text-purple-600 font-semibold hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

function ChapterContent({
  content,
  contentText,
  inlineContent,
  onContentClick
}: {
  content: any;
  contentText?: string;
  inlineContent: InlineContent[];
  onContentClick: (content: InlineContent) => void;
}) {
  const showHighlights = useContext(HighlightsContext);

  // Parse TipTap JSON content if available
  const parsedContent = useMemo(() => {
    if (!content) return null;

    // Helper to recursively unwrap double/triple encoded content
    function unwrapContent(data: any, depth = 0): any {
      if (depth > 5) return data; // Prevent infinite loops

      let parsed = data;

      // If it's a string, try to parse it as JSON
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return null;
        }
      }

      // Check if this is a valid TipTap doc
      if (parsed?.type === 'doc' && parsed?.content) {
        // Check for wrapped content: doc > paragraph > text containing JSON
        if (parsed.content.length === 1 &&
            parsed.content[0]?.type === 'paragraph' &&
            parsed.content[0]?.content?.length === 1 &&
            parsed.content[0]?.content[0]?.type === 'text') {
          const innerText = parsed.content[0].content[0].text;
          // Check if the inner text looks like JSON
          if (innerText && innerText.trim().startsWith('{')) {
            try {
              const innerParsed = JSON.parse(innerText);
              if (innerParsed?.type === 'doc') {
                // Recursively unwrap in case of multiple levels
                return unwrapContent(innerParsed, depth + 1);
              }
            } catch {
              // Not valid JSON, use original
            }
          }
        }
        return parsed;
      }

      return parsed;
    }

    return unwrapContent(content);
  }, [content]);

  if (!parsedContent && !contentText) {
    return <p className="text-muted italic">No content yet</p>;
  }

  // If we have TipTap JSON, render it properly
  if (parsedContent && parsedContent.type === 'doc' && parsedContent.content) {
    console.log('[BookReader] parsedContent nodes:', JSON.stringify(parsedContent.content.map((n: any) => ({ type: n.type, attrs: n.attrs, childTypes: n.content?.map((c: any) => c.type) }))));

    // Pre-assign each inline content item to exactly one text node, before any rendering.
    // This avoids mutating a Set during render (which breaks under React StrictMode double-invoke).
    const assignedIds = new Set<string>();
    const assignmentMap = new Map<string, InlineContent[]>(); // nodeKey → items assigned to it

    // Pre-mark any items already handled by inlineFormWidget atoms in the JSON
    // so the text-node matching path doesn't also render them (causing duplication)
    function collectWidgetIds(nodes: any[]) {
      nodes.forEach((node: any) => {
        if (node.type === 'inlineFormWidget' && node.attrs?.contentId) {
          assignedIds.add(node.attrs.contentId);
        }
        if (node.content) collectWidgetIds(node.content);
      });
    }
    collectWidgetIds(parsedContent.content);

    function collectTextNodes(nodes: any[], prefix: string) {
      nodes.forEach((node: any, i: number) => {
        const key = `${prefix}-${i}`;
        if (node.type === 'text' && node.text) {
          const matches = inlineContent.filter(
            ic => ic.anchor_text && node.text.includes(ic.anchor_text) && !assignedIds.has(ic.id)
          );
          if (matches.length > 0) {
            assignmentMap.set(key, matches);
            matches.forEach(ic => assignedIds.add(ic.id));
          }
        }
        if (node.content) collectTextNodes(node.content, key);
      });
    }
    collectTextNodes(parsedContent.content, 'n');

    const formTypes = ['select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox'];
    const blockMediaTypes = ['image', 'drawing'];
    const unmatched = inlineContent.filter(
      ic => (formTypes.includes(ic.content_type) || blockMediaTypes.includes(ic.content_type)) &&
            (!ic.position_in_chapter || ic.position_in_chapter === 'inline') &&
            !ic.anchor_text &&
            !assignedIds.has(ic.id)
    );
    // Highlights/notes/questions that couldn't be matched to a text node (e.g. span split by formatting)
    const unmatchedMarkers = inlineContent.filter(
      ic => !assignedIds.has(ic.id) &&
            !formTypes.includes(ic.content_type) &&
            !blockMediaTypes.includes(ic.content_type) &&
            (!ic.position_in_chapter || ic.position_in_chapter === 'inline')
    );

    return (
      <div className="prose prose-lg max-w-none">
        {parsedContent.content.map((node: any, index: number) => (
          <TipTapNode
            key={index}
            node={node}
            inlineContent={inlineContent}
            onContentClick={onContentClick}
            assignmentMap={assignmentMap}
            nodeKeyPrefix={`n-${index}`}
          />
        ))}
        {unmatched.map(ic => (
          <div key={ic.id} id={`reader-inline-${ic.id}`}
            className={blockMediaTypes.includes(ic.content_type)
              ? 'my-4'
              : 'my-3 p-3 border border-theme rounded-lg bg-surface-hover'}
          >
            <InlineFormElement content={ic} />
          </div>
        ))}
        {unmatchedMarkers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-theme">
            {unmatchedMarkers.map(ic => {
              const markerClass = showHighlights ? getInlineContentClass(ic.content_type) : '';
              const icon = getInlineContentIcon(ic.content_type);
              const hlStyle = (showHighlights && ic.content_type === 'highlight')
                ? { backgroundColor: (ic.content_data as HighlightData)?.color ?? undefined }
                : undefined;
              return (
                <span key={ic.id} id={`reader-inline-${ic.id}`}
                  className={`${markerClass} cursor-pointer text-sm px-1 rounded`}
                  style={hlStyle}
                  onClick={() => onContentClick(ic)}
                  title={ic.anchor_text || ic.content_type}
                >
                  {ic.anchor_text || ic.content_type}
                  {showHighlights && ic.content_type !== 'highlight' && <span className="ml-0.5 opacity-60">{icon}</span>}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Fallback to plain text rendering with inline content markers
  const text = contentText || '';
  const markers = inlineContent
    .filter(i => !i.position_in_chapter || i.position_in_chapter === 'inline')
    .sort((a, b) => a.start_offset - b.start_offset);

  if (markers.length === 0) {
    return <div dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br>') }} />;
  }

  // Render text with markers
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  markers.forEach((marker, i) => {
    if (marker.start_offset > lastIndex) {
      elements.push(
        <span key={`text-${i}`} dangerouslySetInnerHTML={{
          __html: text.slice(lastIndex, marker.start_offset).replace(/\n/g, '<br>')
        }} />
      );
    }

    const markerClass = {
      question: 'inline-question',
      poll: 'inline-poll',
      highlight: 'inline-highlight',
      note: 'inline-note',
      link: 'inline-link',
      audio: 'inline-media',
      video: 'inline-media',
      select: 'inline-form',
      multiselect: 'inline-form',
      textbox: 'inline-form',
      textarea: 'inline-form',
      radio: 'inline-form',
      checkbox: 'inline-form',
      code_block: 'inline-code',
      scripture_block: 'inline-scripture',
      image: 'inline-media',
    }[marker.content_type as string] as string | undefined;

    const highlightStyle = (showHighlights && marker.content_type === 'highlight')
      ? { backgroundColor: (marker.content_data as HighlightData)?.color ?? undefined }
      : undefined;

    elements.push(
      <span
        key={`marker-${marker.id}`}
        className={showHighlights ? markerClass : undefined}
        style={highlightStyle}
        onClick={() => onContentClick(marker)}
        title={`Click to view ${marker.content_type}`}
      >
        {text.slice(marker.start_offset, marker.end_offset)}
      </span>
    );

    lastIndex = marker.end_offset;
  });

  if (lastIndex < text.length) {
    elements.push(
      <span key="text-end" dangerouslySetInnerHTML={{
        __html: text.slice(lastIndex).replace(/\n/g, '<br>')
      }} />
    );
  }

  return <div>{elements}</div>;
}

// Briefly flash a ring on an element to draw attention
function pulseElement(el: HTMLElement) {
  el.classList.add('ring-2', 'ring-accent', 'ring-offset-2', 'rounded');
  setTimeout(() => el.classList.remove('ring-2', 'ring-accent', 'ring-offset-2', 'rounded'), 1500);
}

// Scroll to inline mark in text and pulse it
function scrollToInline(id: string) {
  const target = document.getElementById(`reader-inline-${id}`);
  if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); pulseElement(target); }
}

// Helper to get CSS class for inline content type
function getInlineContentClass(type: string): string {
  const classes: Record<string, string> = {
    question: 'inline-question',
    poll: 'inline-poll',
    highlight: 'inline-highlight',
    note: 'inline-note',
    link: 'inline-link',
    audio: 'inline-media inline-audio',
    video: 'inline-media inline-video',
    select: 'inline-form inline-select',
    multiselect: 'inline-form inline-multiselect',
    textbox: 'inline-form inline-textbox',
    textarea: 'inline-form inline-textarea',
    radio: 'inline-form inline-radio',
    checkbox: 'inline-form inline-checkbox',
    code_block: 'inline-code',
    scripture_block: 'inline-scripture',
  };
  return classes[type] || '';
}

// Helper to get icon for inline content type
function getInlineContentIcon(type: string): React.ReactNode {
  const iconClass = "h-3 w-3 inline-block";
  switch (type) {
    case 'question':
      return <HelpCircle className={`${iconClass} text-blue-600`} />;
    case 'poll':
      return <BarChart2 className={`${iconClass} text-green-600`} />;
    case 'highlight':
      return <Highlighter className={`${iconClass} text-yellow-600`} />;
    case 'note':
      return <StickyNote className={`${iconClass} text-purple-600`} />;
    case 'link':
      return <Link2 className={`${iconClass} text-cyan-600`} />;
    case 'audio':
      return <Play className={`${iconClass} text-orange-600`} />;
    case 'video':
      return <Video className={`${iconClass} text-red-600`} />;
    case 'select':
      return <ChevronRight className={`${iconClass} text-accent`} />;
    case 'multiselect':
      return <List className={`${iconClass} text-violet-600`} />;
    case 'textbox':
      return <Type className={`${iconClass} text-muted`} />;
    case 'textarea':
      return <AlignLeft className={`${iconClass} text-muted`} />;
    case 'radio':
      return <Circle className={`${iconClass} text-orange-600`} />;
    case 'checkbox':
      return <CheckSquare className={`${iconClass} text-teal-600`} />;
    case 'code_block':
      return <Code className={`${iconClass} text-slate-600`} />;
    case 'scripture_block':
      return <BookOpen className={`${iconClass} text-amber-700`} />;
    default:
      return null;
  }
}

// Helper to render text with TipTap marks (bold, italic, etc.)
function TextWithMarks({ text, marks }: { text: string; marks?: any[] }): React.ReactElement {
  let content: React.ReactNode = text;

  if (marks && marks.length > 0) {
    marks.forEach((mark: any) => {
      switch (mark.type) {
        case 'bold':
          content = <strong>{content}</strong>;
          break;
        case 'italic':
          content = <em>{content}</em>;
          break;
        case 'underline':
          content = <u>{content}</u>;
          break;
        case 'strike':
          content = <s>{content}</s>;
          break;
        case 'code':
          content = <code className="bg-surface-hover px-1 rounded text-sm font-mono">{content}</code>;
          break;
        case 'link':
          content = (
            <a
              href={mark.attrs?.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {content}
            </a>
          );
          break;
        case 'highlight': {
          const hlColor: string | undefined = mark.attrs?.color;
          content = hlColor
            ? <mark style={{ backgroundColor: hlColor, padding: '0 2px', borderRadius: '2px' }}>{content}</mark>
            : <mark className="bg-yellow-200 px-0.5 rounded">{content}</mark>;
          break;
        }
        case 'inlineContentMark':
          // Handled by TipTapNode via anchor_text matching — skip to avoid double render
          break;
      }
    });
  }

  return <>{content}</>;
}

// Render TipTap JSON nodes
function TipTapNode({
  node,
  inlineContent,
  onContentClick,
  assignmentMap,
  nodeKeyPrefix,
}: {
  node: any;
  inlineContent: InlineContent[];
  onContentClick: (content: InlineContent) => void;
  assignmentMap?: Map<string, InlineContent[]>;
  nodeKeyPrefix?: string;
}) {
  const showHighlights = useContext(HighlightsContext);
  const { checked: taskChecks, setChecked: setTaskChecksImperative } = useContext(TaskChecksContext);

  if (!node) return null;

  const childProps = { inlineContent, onContentClick, assignmentMap, nodeKeyPrefix };

  const renderChildren = (children: any[], keyPrefix: string) =>
    children.map((child: any, i: number) => (
      <TipTapNode key={i} node={child} {...childProps} nodeKeyPrefix={`${keyPrefix}-${i}`} />
    ));

  switch (node.type) {
    case 'paragraph': {
      if (!node.content || node.content.length === 0) return <p className="min-h-[1.5em]">&nbsp;</p>;
      // If paragraph contains only block-level widget nodes (image, drawing, etc.), render as div
      // to avoid invalid HTML (<div> inside <p>) which breaks browser DOM parsing
      const BLOCK_WIDGET_TYPES = new Set(['image', 'drawing', 'audio', 'video', 'code_block', 'scripture_block']);
      const isBlockWidget = node.content.length === 1 &&
        node.content[0].type === 'inlineFormWidget' &&
        BLOCK_WIDGET_TYPES.has(node.content[0].attrs?.contentType);
      if (isBlockWidget) return <div className="mb-4">{renderChildren(node.content, nodeKeyPrefix || 'p')}</div>;
      return <p className="mb-4">{renderChildren(node.content, nodeKeyPrefix || 'p')}</p>;
    }

    case 'heading': {
      const HeadingTag = `h${node.attrs?.level || 2}` as keyof JSX.IntrinsicElements;
      const hClasses: Record<number, string> = { 1: 'text-3xl font-bold mb-4 mt-6', 2: 'text-2xl font-bold mb-3 mt-5', 3: 'text-xl font-semibold mb-2 mt-4', 4: 'text-lg font-semibold mb-2 mt-3' };
      return <HeadingTag className={hClasses[node.attrs?.level] || hClasses[2]}>{renderChildren(node.content || [], nodeKeyPrefix || 'h')}</HeadingTag>;
    }

    case 'bulletList':
      return <ul className="list-disc list-inside mb-4 space-y-1">{renderChildren(node.content || [], nodeKeyPrefix || 'ul')}</ul>;

    case 'orderedList':
      return <ol className="list-decimal list-inside mb-4 space-y-1">{renderChildren(node.content || [], nodeKeyPrefix || 'ol')}</ol>;

    case 'listItem':
      return <li>{renderChildren(node.content || [], nodeKeyPrefix || 'li')}</li>;

    case 'blockquote':
      return <blockquote className="border-l-4 border-strong pl-4 italic text-muted mb-4">{renderChildren(node.content || [], nodeKeyPrefix || 'bq')}</blockquote>;

    case 'codeBlock':
      return (
        <pre className="bg-surface-hover rounded-lg p-4 mb-4 overflow-x-auto">
          <code className="text-sm font-mono">{renderChildren(node.content || [], nodeKeyPrefix || 'cb')}</code>
        </pre>
      );

    case 'horizontalRule':
      return <hr className="my-6 border-theme" />;

    case 'text': {
      const nodeText = node.text || '';
      const FORM_TYPES_SET = new Set(['select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox', 'code_block', 'scripture_block']);
      const MEDIA_TYPES_SET = new Set(['audio', 'video', 'image', 'drawing']);

      // Look up pre-assigned matches for this exact node key (computed before render, no mutation)
      const matchingContent = (nodeKeyPrefix && assignmentMap?.get(nodeKeyPrefix)) || [];

      if (matchingContent.length === 0) {
        return <TextWithMarks text={nodeText} marks={node.marks} />;
      }

      const sortedMatches = matchingContent
        .map(ic => ({ content: ic, index: nodeText.indexOf(ic.anchor_text!), length: ic.anchor_text!.length }))
        .filter(m => m.index !== -1)
        .sort((a, b) => a.index - b.index || b.length - a.length);

      const segments: React.ReactNode[] = [];
      let lastIndex = 0;
      const usedRanges: { start: number; end: number }[] = [];

      sortedMatches.forEach((match, idx) => {
        const start = match.index;
        const end = start + match.length;
        if (usedRanges.some(r => start < r.end && end > r.start)) return;
        usedRanges.push({ start, end });

        if (start > lastIndex) {
          segments.push(<TextWithMarks key={`pre-${idx}`} text={nodeText.slice(lastIndex, start)} marks={node.marks} />);
        }

        const ic = match.content;
        const isFormType = FORM_TYPES_SET.has(ic.content_type);
        const isMediaType = MEDIA_TYPES_SET.has(ic.content_type);
        const rawPos = ic.position_in_chapter;
        const position = (!rawPos || (rawPos as string) === 'sidebar') ? 'inline' : rawPos;
        const segText = nodeText.slice(start, end);
        const markerClass = showHighlights ? getInlineContentClass(ic.content_type) : '';
        const icon = getInlineContentIcon(ic.content_type);
        const hlColorStyle = (showHighlights && ic.content_type === 'highlight')
          ? { backgroundColor: (ic.content_data as HighlightData)?.color ?? undefined }
          : undefined;

        if (!ic.is_author_content) {
          // Reader-added content: show anchor text as a styled clickable marker only.
          // Highlights show their marked text; everything else shows the anchor + icon.
          // Clicking always opens the right-side panel — nothing renders inline.
          const isHighlight = ic.content_type === 'highlight';
          segments.push(
            <span key={`reader-${ic.id}`} id={`reader-inline-${ic.id}`}
              className={`${markerClass} cursor-pointer group`}
              style={hlColorStyle}
              onClick={() => onContentClick(ic)}
              title={`Click to view ${ic.content_type}`}
            >
              <TextWithMarks text={segText} marks={node.marks} />
              {showHighlights && !isHighlight && (
                <span className="inline-flex items-center ml-0.5 opacity-60 group-hover:opacity-100 gap-0.5">
                  {icon}
                  <User className="h-2.5 w-2.5 text-blue-500" />
                </span>
              )}
            </span>
          );
        } else if (isMediaType && position !== 'start_of_chapter' && position !== 'end_of_chapter') {
          // Author image/audio/video renders inline as a block player
          segments.push(
            <span key={`media-${ic.id}`} id={`reader-inline-${ic.id}`} className="block my-3 w-full">
              {(ic.content_type === 'image' || ic.content_type === 'drawing') ? <InlineFormElement content={ic} /> : <InlineMediaPlayer content={ic} />}
            </span>
          );
        } else if (isFormType && position === 'inline') {
          const isFullW2 = (ic.content_data as any)?.width === 'full' || (!((ic.content_data as any)?.width) && ic.content_type === 'textarea');
          segments.push(
            isFullW2 ? (
              <span key={`form-${ic.id}`} id={`reader-inline-${ic.id}`} className="block my-2">
                {segText && showHighlights && <mark className={`${markerClass} px-0.5 rounded text-sm mb-1 inline-block`}><TextWithMarks text={segText} marks={node.marks} /></mark>}
                {segText && !showHighlights && <TextWithMarks text={segText} marks={node.marks} />}
                <InlineFormElement content={ic} />
              </span>
            ) : (
              <span key={`form-${ic.id}`} id={`reader-inline-${ic.id}`} className="inline-flex items-baseline gap-2 flex-wrap">
                {segText && showHighlights && <mark className={`${markerClass} px-0.5 rounded`}><TextWithMarks text={segText} marks={node.marks} /></mark>}
                {segText && !showHighlights && <TextWithMarks text={segText} marks={node.marks} />}
                <InlineFormElement content={ic} />
              </span>
            )
          );
        } else if ((isFormType || isMediaType) && (position === 'start_of_chapter' || position === 'end_of_chapter')) {
          // Anchor text becomes a jump-link to the block at start/end
          const dest = position === 'start_of_chapter' ? 'start' : 'end';
          segments.push(
            <span key={`pos-${ic.id}`} id={`reader-inline-${ic.id}`} className={`${markerClass} cursor-pointer group`}
              title={`Click to go to ${ic.content_type} at ${dest} of chapter`}
              onClick={() => { const t = document.getElementById(`reader-block-${ic.id}`); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); pulseElement(t); } }}>
              <TextWithMarks text={segText} marks={node.marks} />
              {showHighlights && <span className="inline-flex items-center ml-0.5 opacity-60 group-hover:opacity-100">{icon}</span>}
            </span>
          );
        } else {
          const isHighlight = ic.content_type === 'highlight';
          segments.push(
            <span key={`click-${ic.id}`} id={`reader-inline-${ic.id}`} className={`${markerClass} cursor-pointer group`}
              onClick={() => onContentClick(ic)} title={`Click to view ${ic.content_type}`}>
              <TextWithMarks text={segText} marks={node.marks} />
              {showHighlights && !isHighlight && (
                <span className="inline-flex items-center ml-0.5 opacity-60 group-hover:opacity-100 gap-0.5">
                  {icon}
                  {ic.is_author_content ? <Crown className="h-2.5 w-2.5 text-amber-500" /> : <User className="h-2.5 w-2.5 text-blue-500" />}
                </span>
              )}
            </span>
          );
        }
        lastIndex = end;
      });

      if (lastIndex < nodeText.length) {
        segments.push(<TextWithMarks key="post" text={nodeText.slice(lastIndex)} marks={node.marks} />);
      }
      return <>{segments}</>;
    }

    case 'inlineFormWidget': {
      // Atom node inserted by InlineFormNode TipTap extension.
      // attrs: { contentId, contentType, anchorText, contentData }
      const contentId = node.attrs?.contentId;
      const anchorText: string = node.attrs?.anchorText || '';
      const attrContentType: string = node.attrs?.contentType || '';
      const attrContentData = node.attrs?.contentData;
      const ic = inlineContent.find(i => i.id === contentId);

      console.log('[inlineFormWidget] node.attrs=', JSON.stringify(node.attrs), 'ic=', ic, 'attrContentType=', attrContentType, 'attrContentData=', attrContentData);

      // Build a synthetic InlineContent from node attrs as fallback when DB record isn't loaded
      const effectiveIc = ic ?? (attrContentType && attrContentData ? {
        id: contentId || '',
        content_type: attrContentType,
        content_data: attrContentData,
        anchor_text: anchorText,
        position_in_chapter: 'inline',
      } as any : null);

      if (!effectiveIc) {
        return <span>{anchorText}</span>;
      }
      // Block-level types must render as block, not inline-flex
      const BLOCK_TYPES = new Set(['image', 'audio', 'video', 'code_block', 'scripture_block']);
      const isBlock = BLOCK_TYPES.has(effectiveIc.content_type);
      const isFullW = isBlock || (effectiveIc.content_data as any)?.width === 'full' || (!((effectiveIc.content_data as any)?.width) && effectiveIc.content_type === 'textarea');
      const markerClass = getInlineContentClass(effectiveIc.content_type);
      const hlStyle = effectiveIc.content_type === 'highlight'
        ? { backgroundColor: (effectiveIc.content_data as HighlightData)?.color ?? undefined }
        : undefined;
      return isFullW ? (
        <span id={`reader-inline-${effectiveIc.id}`} className="block my-3">
          {anchorText && !isBlock && <mark className={`${markerClass} px-0.5 rounded text-sm mb-1 inline-block`} style={hlStyle}>{anchorText}</mark>}
          <InlineFormElement content={effectiveIc} />
        </span>
      ) : (
        <span id={`reader-inline-${effectiveIc.id}`} className="inline-flex items-baseline gap-2 flex-wrap">
          {anchorText && <mark className={`${markerClass} px-0.5 rounded`} style={hlStyle}>{anchorText}</mark>}
          <InlineFormElement content={effectiveIc} />
        </span>
      );
    }

    case 'columnLayout': {
      const cols = node.attrs?.columns || 2;
      return (
        <div
          className="column-layout-reader my-4"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '16px' }}
        >
          {renderChildren(node.content || [], nodeKeyPrefix || 'col')}
        </div>
      );
    }

    case 'columnCell':
      return (
        <div className="column-cell min-w-0">
          {renderChildren(node.content || [], nodeKeyPrefix || 'cc')}
        </div>
      );

    case 'taskList':
      return (
        <ul className="space-y-1.5 mb-4 pl-0" style={{ listStyle: 'none' }}>
          {renderChildren(node.content || [], nodeKeyPrefix || 'tl')}
        </ul>
      );

    case 'taskItem': {
      const itemKey = `task-${nodeKeyPrefix}`;
      const readerHasOverride = taskChecks.has(itemKey + ':set');
      const isChecked = readerHasOverride ? taskChecks.has(itemKey) : !!node.attrs?.checked;
      // Flatten: taskItem contains a paragraph node — render its children directly as inline
      const innerNodes: any[] = [];
      (node.content || []).forEach((child: any) => {
        if (child.type === 'paragraph') innerNodes.push(...(child.content || []));
        else innerNodes.push(child);
      });
      return (
        <li className="flex items-center gap-3 leading-normal" style={{ listStyle: 'none' }}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => setTaskChecksImperative(itemKey, !isChecked)}
            className="h-4 w-4 shrink-0 cursor-pointer accent-indigo-500"
          />
          <span className={isChecked ? 'line-through text-muted' : ''}>
            {innerNodes.map((child: any, i: number) => (
              <TipTapNode key={i} node={child} {...childProps} nodeKeyPrefix={`${nodeKeyPrefix || 'ti'}-${i}`} />
            ))}
          </span>
        </li>
      );
    }

    case 'hardBreak':
      return <br />;

    default:
      if (node.content) return <>{renderChildren(node.content, nodeKeyPrefix || 'x')}</>;
      return null;
  }
}

function StartOfChapterContent({ items, isAuthor, userId }: { items: InlineContent[]; isAuthor: boolean; userId?: string }) {
  const startItems = items.filter(item => item.position_in_chapter === 'start_of_chapter');
  if (startItems.length === 0) return null;

  return (
    <div className="mb-8 pb-6 border-b space-y-4">
      {startItems.map((item) => (
        <div key={item.id} id={`reader-block-${item.id}`} className="scroll-mt-6">
          {item.anchor_text && (
            <button
              className="text-xs text-muted underline underline-offset-2 mb-1 hover:text-accent transition-colors"
              onClick={() => scrollToInline(item.id)}
            >
              ↓ Jump to "{item.anchor_text}" in text
            </button>
          )}
          <InlineContentBlock content={item} isAuthor={isAuthor} userId={userId} />
        </div>
      ))}
    </div>
  );
}

function EndOfChapterContent({ items, isAuthor, userId }: { items: InlineContent[]; isAuthor: boolean; userId?: string }) {
  const endItems = items.filter(item => item.position_in_chapter === 'end_of_chapter');
  if (endItems.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t space-y-6">
      {endItems.map((item) => (
        <div key={item.id} id={`reader-block-${item.id}`} className="scroll-mt-6">
          {item.anchor_text && (
            <button
              className="text-xs text-muted underline underline-offset-2 mb-1 hover:text-accent transition-colors"
              onClick={() => scrollToInline(item.id)}
            >
              ↑ Jump to "{item.anchor_text}" in text
            </button>
          )}
          <InlineContentBlock content={item} isAuthor={isAuthor} userId={userId} />
        </div>
      ))}
    </div>
  );
}

function InlineContentBlock({ content, isAuthor = false, userId }: { content: InlineContent; isAuthor?: boolean; userId?: string }) {
  if (content.content_type === 'question') {
    return <QuestionBlock content={content} />;
  }
  if (content.content_type === 'poll') {
    return <PollBlock content={content} />;
  }
  if (content.content_type === 'audio' || content.content_type === 'video') {
    return <MediaBlock content={content} />;
  }
  if (content.content_type === 'link') {
    return <LinkBlock content={content} />;
  }
  if (content.content_type === 'note') {
    return <NoteBlock content={content} />;
  }
  if (content.content_type === 'highlight') {
    return <HighlightBlock content={content} />;
  }
  if (content.content_type === 'select') {
    return <SelectBlock content={content} isAuthor={isAuthor} userId={userId} />;
  }
  if (content.content_type === 'multiselect') {
    return <MultiselectBlock content={content} isAuthor={isAuthor} userId={userId} />;
  }
  if (content.content_type === 'textbox') {
    return <TextboxBlock content={content} isAuthor={isAuthor} userId={userId} />;
  }
  if (content.content_type === 'textarea') {
    return <TextareaBlock content={content} isAuthor={isAuthor} userId={userId} />;
  }
  if (content.content_type === 'radio') {
    return <RadioBlock content={content} isAuthor={isAuthor} userId={userId} />;
  }
  if (content.content_type === 'checkbox') {
    return <CheckboxBlock content={content} isAuthor={isAuthor} userId={userId} />;
  }
  if (content.content_type === 'code_block') {
    return <CodeBlockDisplay content={content} />;
  }
  if (content.content_type === 'scripture_block') {
    return <ScriptureBlockDisplay content={content} />;
  }
  if (content.content_type === 'image') {
    return <ImageBlock content={content} />;
  }
  if (content.content_type === 'drawing') {
    return <DrawingBlock content={content} />;
  }
  return null;
}

function QuestionBlock({ content }: { content: InlineContent }) {
  // Support both field naming conventions:
  //   {question, type:'open'} (editor-created) and
  //   {question_text, question_type:'free_response'} (SQL-seeded)
  const raw = content.content_data as any;
  const questionText: string = raw.question || raw.question_text || '';
  const questionType: string = raw.type || raw.question_type || 'open';
  const isOpenResponse = !questionType || questionType === 'open' || questionType === 'free_response';

  const [answer, setAnswer] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const requestAuth = useContext(AuthGateContext);
  const itemKey = `ic:${content.id}`;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markCompleteRef = useRef(markComplete);
  markCompleteRef.current = markComplete;
  const markIncompleteRef = useRef(markIncomplete);
  markIncompleteRef.current = markIncomplete;

  // Load existing answer on mount
  useEffect(() => {
    if (!api.getToken()) return;
    api.getMyQuestionAnswer(content.id)
      .then(r => {
        const text = r?.answer_text ?? '';
        setAnswer(text);
        if (text.trim() && progressEnabled) markCompleteRef.current(itemKey, 'question');
      })
      .catch(() => {});
  }, [content.id, itemKey, progressEnabled]);

  const save = useCallback(async (text: string) => {
    setSaveStatus('saving');
    try {
      await api.answerQuestion(content.id, { answer_text: text });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [content.id]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setAnswer(val);
    setSaveStatus('idle');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (val.trim()) markComplete(itemKey, 'question');
    else markIncomplete(itemKey);
    saveTimer.current = setTimeout(() => save(val), 1000);
  };

  const isDone = progressEnabled && completions.has(itemKey);

  return (
    <div className={`border rounded-lg p-4${isDone ? ' border-green-400' : ' border-blue-200'}${progressEnabled ? ` progress-item${isDone ? ' progress-item--done' : ''}` : ''}`}
      style={{ background: 'var(--color-surface)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-500">Reflection Question</span>
        </div>
        <span className="text-xs text-muted">
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && <span className="text-green-500 flex items-center gap-1"><Check className="h-3 w-3" /> Saved</span>}
          {saveStatus === 'error' && <span className="text-red-500">Error saving</span>}
        </span>
      </div>
      <p className="text-theme font-medium mb-3">{questionText}</p>
      {isOpenResponse && (
        <textarea
          value={answer}
          onChange={handleChange}
          onFocus={() => { if (!api.getToken()) requestAuth(); }}
          rows={4}
          placeholder={api.getToken() ? 'Write your response…' : 'Sign in to write your response…'}
          className="w-full p-3 theme-input rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      )}
    </div>
  );
}

function MediaBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as MediaData;
  const isAudio = data.type === 'audio';
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const { requestPlay, requestPip, clearPlay, clearPip } = useContext(MediaContext);
  const mediaId = `media:${content.id}`;
  const itemKey = `ic:${content.id}`;
  const completedRef = useRef(false);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [sticky, setSticky] = useState(false);

  // Show PiP when block scrolls out of view (once activated by playing); dismiss only when back in view or closed
  const hasPlayedRef = useRef(false);
  useEffect(() => { if (playing) hasPlayedRef.current = true; }, [playing]);

  const closePip = useCallback(() => {
    setSticky(false);
    hasPlayedRef.current = false;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (hasPlayedRef.current) {
          if (entry.isIntersecting) {
            setSticky(false);
            clearPip(mediaId);
          } else {
            setSticky(true);
            requestPip(mediaId, closePip);
          }
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mediaId, requestPip, clearPip, closePip]);

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
    const el = e.target as HTMLVideoElement | HTMLAudioElement;
    setCurrentTime(el.currentTime);
    if (completedRef.current) return;
    if (el.duration && el.currentTime / el.duration >= 0.8) {
      completedRef.current = true;
      markComplete(itemKey, isAudio ? 'audio' : 'video');
    }
  }, [isAudio, itemKey, markComplete]);

  const pauseSelf = useCallback(() => {
    const el = mediaRef.current;
    if (el && !el.paused) { el.pause(); setPlaying(false); }
  }, []);

  const togglePlay = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      requestPlay(mediaId, pauseSelf);
      el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
      clearPlay(mediaId);
    }
  };

  const toggleMute = () => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setCurrentTime(el.currentTime);
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getEmbedUrl = (url: string): string | null => {
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}?dnt=1`;
    return null;
  };

  const embedUrl = !isAudio ? getEmbedUrl(data.url) : null;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const sizePct = (data as any).size ?? 100;

  return (
    <div ref={containerRef} className={progressEnabled ? `progress-item${completions.has(itemKey) ? ' progress-item--done' : ''}` : undefined} style={sizePct < 100 ? { width: `${sizePct}%` } : undefined}>
      <div className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">

        {/* Embed (YouTube/Vimeo) */}
        {!isAudio && embedUrl && (
          <>
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={data.title || 'Video'}
              />
            </div>
            {/* Manual completion for embeds — iframes can't report playback position */}
            {progressEnabled && (
              <div className="flex items-center justify-end px-3 py-2 border-t border-[var(--color-border)]">
                {completions.has(itemKey) ? (
                  <button
                    onClick={() => { markIncomplete(itemKey); }}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 hover:bg-red-50 dark:bg-green-950 dark:hover:bg-red-950 text-green-600 hover:text-red-600 dark:text-green-400 dark:hover:text-red-400 transition-colors group"
                    title="Click to mark as not watched"
                  >
                    <svg className="h-3.5 w-3.5 group-hover:hidden" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    <svg className="h-3.5 w-3.5 hidden group-hover:block" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                    <span className="group-hover:hidden">Watched</span>
                    <span className="hidden group-hover:inline">Mark as not watched</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { markComplete(itemKey, 'video'); }}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    Mark as watched
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Native video with custom controls */}
        {!isAudio && !embedUrl && (
          <>
            {/* Inline placeholder — keeps layout space while video is in PiP */}
            <div
              className="relative group bg-[var(--color-surface-hover)] p-2"
              style={sticky ? { minHeight: '160px' } : undefined}
            >
              {/* Always-mounted video — moves to PiP via fixed positioning, never unmounts */}
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={data.url}
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => { setDuration((e.target as HTMLVideoElement).duration || 0); setLoaded(true); }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                style={sticky
                  ? { position: 'fixed', bottom: '40px', right: '1rem', width: '280px', maxHeight: '200px', objectFit: 'contain', zIndex: 52, display: 'block', background: '#000', borderRadius: '8px 8px 0 0' }
                  : { width: '100%', maxHeight: '480px', objectFit: 'contain', display: 'block', background: 'var(--color-surface-hover)', borderRadius: '8px' }}
              />

              {/* Fullscreen button — inline only */}
              {!sticky && (
                <button
                  onClick={() => (mediaRef.current as HTMLVideoElement)?.requestFullscreen?.()}
                  className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-colors"
                  title="Fullscreen"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}
              {!playing && !sticky && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center transition-colors hover:bg-[var(--color-surface-hover)]/40"
                >
                  <span className="w-14 h-14 rounded-full bg-black/30 border border-white/30 flex items-center justify-center shadow-md backdrop-blur-sm">
                    <Play className="h-6 w-6 text-white ml-1" />
                  </span>
                </button>
              )}
            </div>

            {/* PiP overlay controls — shown fixed when sticky, video element itself is already fixed above */}
            {sticky && (
              <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', width: '280px', zIndex: 53, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', pointerEvents: 'none' }}>
                {/* Spacer matching video height */}
                <div style={{ height: '160px', pointerEvents: 'none' }} />

                {/* X — top right */}
                <button
                  onClick={() => { closePip(); clearPip(mediaId); }}
                  style={{ position: 'absolute', top: '6px', right: '6px', pointerEvents: 'all' }}
                  className="w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/90 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>

                {/* ↑ and ⛶ buttons */}
                <div style={{ position: 'absolute', bottom: '40px', right: '6px', pointerEvents: 'all' }} className="flex flex-col gap-1">
                  <button
                    onClick={() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-colors"
                    title="Scroll back to video"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => (mediaRef.current as HTMLVideoElement)?.requestFullscreen?.()}
                    className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-colors"
                    title="Fullscreen"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Controls bar */}
                <div className="flex items-center gap-2 px-2 py-1.5 bg-black/70" style={{ pointerEvents: 'all' }}>
                  <button onClick={togglePlay} className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-colors">
                    {playing
                      ? <span className="flex gap-[3px]"><span className="w-[2px] h-3 bg-current" /><span className="w-[2px] h-3 bg-current" /></span>
                      : <Play className="h-3 w-3 ml-0.5" />
                    }
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="media-seek flex-1"
                    style={{ background: `linear-gradient(to right, #fff ${progressPct}%, rgba(255,255,255,0.3) ${progressPct}%)` }}
                  />
                  <span className="text-xs text-white/70 tabular-nums flex-shrink-0">{formatTime(currentTime)}</span>
                  <button onClick={toggleMute} className="flex-shrink-0 text-white/70 hover:text-white transition-colors">
                    {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Audio element */}
        {isAudio && (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={data.url}
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={(e) => { setDuration((e.target as HTMLAudioElement).duration || 0); setLoaded(true); }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        )}

        {/* Controls bar — single compact row */}
        {(isAudio || (!isAudio && !embedUrl)) && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--color-border)]">
            {/* Type icon */}
            <div className="flex-shrink-0 text-[var(--color-accent)]">
              {isAudio ? <Volume2 className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
            </div>

            {/* Title (truncated) */}
            {data.title && (
              <span className="text-xs text-muted truncate max-w-[120px] flex-shrink-0">{data.title}</span>
            )}

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              disabled={!loaded && isAudio}
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-opacity bg-[var(--color-accent)] text-white hover:opacity-80"
            >
              {playing
                ? <span className="flex gap-[2px]"><span className="w-[2px] h-3 bg-current" /><span className="w-[2px] h-3 bg-current" /></span>
                : <Play className="h-3 w-3 ml-0.5" />
              }
            </button>

            {/* Current time */}
            <span className="text-xs tabular-nums shrink-0 text-muted">{formatTime(currentTime)}</span>

            {/* Seek */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="media-seek flex-1 min-w-0"
              style={{ background: `linear-gradient(to right, var(--color-accent) ${progressPct}%, var(--color-border) ${progressPct}%)` }}
            />

            {/* Duration */}
            <span className="text-xs tabular-nums shrink-0 text-muted">{formatTime(duration)}</span>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center transition-colors rounded text-muted hover:text-theme hover:bg-[var(--color-surface-hover)]"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Sticky mini-player — audio only; video uses the PiP widget instead */}
      {sticky && isAudio && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2.5 bg-[var(--color-surface)] border-b-2 border-[var(--color-accent)] shadow-lg">
          {/* Icon */}
          <div className={`flex-shrink-0 ${isAudio ? 'w-8 h-8 rounded-full bg-accent/10' : 'w-8 h-8 rounded bg-accent/10'} flex items-center justify-center`}>
            {isAudio ? <Volume2 className="h-4 w-4 text-accent" /> : <Video className="h-4 w-4 text-accent" />}
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-theme truncate">{data.title || (isAudio ? 'Audio' : 'Video')}</p>
            <p className="text-xs text-muted tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</p>
          </div>

          {/* Seek bar */}
          <div className="flex-1 hidden sm:block">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="media-seek w-full"
              style={{ background: `linear-gradient(to right, var(--color-accent) ${progressPct}%, var(--color-border) ${progressPct}%)` }}
            />
          </div>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-accent)] text-white hover:opacity-80 transition-opacity"
          >
            {playing
              ? <span className="flex gap-[3px]"><span className="w-[3px] h-3 bg-current" /><span className="w-[3px] h-3 bg-current" /></span>
              : <Play className="h-3.5 w-3.5 ml-0.5" />
            }
          </button>

          {/* Mute */}
          <button
            onClick={toggleMute}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-muted hover:text-theme transition-colors"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* Scroll back to player */}
          {isAudio && (
            <button
              onClick={() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="flex-shrink-0 text-xs text-accent hover:underline whitespace-nowrap"
            >
              Jump to ↓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LinkBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as LinkData;

  return (
    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="h-5 w-5 text-cyan-600" />
        <span className="font-medium text-cyan-800">External Link</span>
      </div>
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-700 hover:text-cyan-900 hover:underline font-medium block"
      >
        {data.title || data.url}
      </a>
      {data.description && (
        <p className="text-sm text-muted mt-2">{data.description}</p>
      )}
    </div>
  );
}

function NoteBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as NoteData;

  const typeStyles = {
    annotation: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
    definition: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' },
    reference: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800' },
  };
  const style = typeStyles[data.type] || typeStyles.annotation;

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <StickyNote className={`h-5 w-5 ${style.text}`} />
        <span className={`font-medium ${style.text} capitalize`}>{data.type}</span>
      </div>
      <p className="text-theme whitespace-pre-wrap">{data.text}</p>
    </div>
  );
}

function HighlightBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as HighlightData;

  const colorStyles: Record<string, string> = {
    yellow: 'bg-yellow-100 border-yellow-300',
    green: 'bg-green-100 border-green-300',
    blue: 'bg-blue-100 border-blue-300',
    pink: 'bg-pink-100 border-pink-300',
  };
  const style = colorStyles[data.color] || colorStyles.yellow;

  return (
    <div className={`${style} border rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Highlighter className="h-5 w-5 text-muted" />
        <span className="font-medium text-theme">Highlight</span>
      </div>
      {content.anchor_text && (
        <p className="italic text-muted mb-2">"{content.anchor_text}"</p>
      )}
      {data.note && (
        <p className="text-theme text-sm">{data.note}</p>
      )}
    </div>
  );
}

// ── Sidebar star-rating widget ────────────────────────────────────────────────
function SidebarRating({ bookId }: { bookId: string }) {
  const [aggregate, setAggregate] = useState<{ average: number; count: number } | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const token = api.getToken();

  useEffect(() => {
    api.getRatings(bookId)
      .then(r => {
        setAggregate({ average: r.average, count: r.count });
        setUserRating(r.user_rating);
      })
      .catch(() => {});
  }, [bookId]);

  async function handleRate(stars: number) {
    if (!token || submitting) return;
    setSubmitting(true);
    try {
      if (userRating === stars) {
        // Toggle off
        const res = await api.deleteRating(bookId);
        setUserRating(null);
        setAggregate(res.aggregate);
      } else {
        const res = await api.submitRating(bookId, stars);
        setUserRating(stars);
        setAggregate(res.aggregate);
      }
    } catch (e) {
      console.error('Rating error:', e);
    } finally {
      setSubmitting(false);
    }
  }

  const display = hover ?? userRating ?? 0;

  return (
    <div className="mt-3">
      <p className="text-xs text-muted mb-1">{token ? 'Rate this book' : 'Reader rating'}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            disabled={!token || submitting}
            onClick={() => handleRate(star)}
            onMouseEnter={() => token && setHover(star)}
            onMouseLeave={() => setHover(null)}
            className="p-0.5 disabled:cursor-default"
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                star <= display
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-none text-muted'
              }`}
            />
          </button>
        ))}
        {aggregate && aggregate.count > 0 && (
          <span className="ml-1 text-xs text-muted">
            {aggregate.average.toFixed(1)} ({aggregate.count})
          </span>
        )}
      </div>
      {!token && (
        <p className="text-xs text-muted mt-0.5">Sign in to rate</p>
      )}
    </div>
  );
}

function PollBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as PollData;
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, number>>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [voted, setVoted] = useState(false);
  const { completions, markComplete, enabled: progressEnabled } = useContext(ProgressContext);
  const requestAuth = useContext(AuthGateContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    try {
      const res = await api.getPollResults(content.id);
      setResults(res.results);
      setTotalVotes(res.total_votes);
      if (res.user_vote) {
        setSelected(res.user_vote);
        setVoted(true);
      }
    } catch (err) {
      console.error('Failed to load poll results:', err);
    }
  }

  async function handleVote() {
    if (!selected) return;
    if (!api.getToken()) { requestAuth(); return; }
    try {
      const res = await api.votePoll(content.id, selected);
      setResults(res.results);
      setTotalVotes(res.total_votes);
      setVoted(true);
      markComplete(itemKey, 'poll');
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  }

  const isDone = progressEnabled && (completions.has(itemKey) || voted);

  return (
    <div className={`bg-green-50 border rounded-lg p-4 ${isDone ? 'border-green-400' : 'border-green-200'}${progressEnabled ? ` progress-item${isDone ? ' progress-item--done' : ''}` : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-green-600" />
          <span className="font-medium text-green-800">Poll</span>
        </div>
        {isDone && <Check className="h-4 w-4 text-green-500 shrink-0" />}
      </div>
      <p className="text-theme mb-4">{data.question}</p>

      <div className="space-y-2">
        {data.options.map((opt) => {
          const count = results[opt.id] || results[opt.text] || 0;
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

          return (
            <div
              key={opt.id}
              onClick={() => { if (!voted) { if (!api.getToken()) { requestAuth(); return; } setSelected(opt.id); } }}
              className={`relative p-3 border rounded-lg cursor-pointer transition-colors ${
                selected === opt.id
                  ? 'border-green-500 bg-green-100'
                  : 'border-theme hover:border-green-300'
              } ${voted ? 'cursor-default' : ''}`}
            >
              {voted && (
                <div
                  className="absolute inset-0 bg-green-200 rounded-lg transition-all"
                  style={{ width: `${percent}%`, opacity: 0.5 }}
                />
              )}
              <div className="relative flex justify-between items-center">
                <span>{opt.text}</span>
                {voted && (
                  <span className="text-sm text-muted">{percent}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!voted && (
        <button
          onClick={handleVote}
          disabled={!selected}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          Vote
        </button>
      )}

      {voted && (
        <p className="mt-2 text-sm text-muted">{totalVotes} votes</p>
      )}
    </div>
  );
}

// ─── Form Response Helpers ───────────────────────────────────────────────────

// Small save status indicator shown in the top-right of form blocks
function SaveStatusDot({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  return (
    <span className="flex items-center gap-1 text-xs h-4 min-w-[3rem] transition-opacity duration-300" style={{ opacity: status === 'idle' ? 0 : 1 }}>
      {status === 'saving' && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
      {status === 'saved' && <><Check className="h-3 w-3 text-green-600" /><span className="text-green-600">Saved</span></>}
      {status === 'error' && <span title="Failed to save"><AlertCircle className="h-3 w-3 text-red-500" /></span>}
    </span>
  );
}

// Author-only: small pill toggle for response visibility
function VisibilityToggle({ content }: { content: InlineContent }) {
  const [vis, setVis] = useState<'private' | 'members_only' | 'all_readers'>(
    content.response_visibility || 'private'
  );

  const handleChange = (newVis: typeof vis) => {
    setVis(newVis);
    api.updateInlineContent(content.id, { response_visibility: newVis }).catch(() => {});
  };

  const options: { value: typeof vis; icon: React.ReactNode; label: string }[] = [
    { value: 'private', icon: <Lock className="h-3 w-3" />, label: 'Private' },
    { value: 'members_only', icon: <Users className="h-3 w-3" />, label: 'Club' },
    { value: 'all_readers', icon: <Globe className="h-3 w-3" />, label: 'All' },
  ];

  return (
    <div className="flex items-center rounded-full border border-theme bg-surface overflow-hidden text-xs">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => handleChange(opt.value)}
          title={opt.label}
          className={`flex items-center gap-1 px-2 py-0.5 transition-colors ${
            vis === opt.value
              ? 'bg-primary-100 text-primary-700'
              : 'text-muted hover:text-theme'
          }`}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// Author-only: response summary shown below a form block
function ResponseSummary({ result, type }: { result: AllFormResponsesResult; type: 'choice' | 'text' }) {
  const [expanded, setExpanded] = useState(false);
  if (result.total === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-theme/20">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-theme transition-colors"
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span>{result.total} {result.total === 1 ? 'response' : 'responses'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {type === 'choice' && result.aggregates && result.aggregates.options.map(opt => (
            <div key={opt.id} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="text-theme truncate">{opt.text}</span>
                <span className="text-muted ml-2 shrink-0">{opt.count} ({opt.percent}%)</span>
              </div>
              <div className="h-1.5 bg-theme/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-400 rounded-full transition-all"
                  style={{ width: `${opt.percent}%` }}
                />
              </div>
            </div>
          ))}

          {type === 'text' && result.responses.map(r => (
            <div key={r.id} className="flex gap-2 text-xs">
              <span className="font-medium text-theme shrink-0">{r.user?.display_name || 'User'}:</span>
              <span className="text-muted truncate">{String(r.response_data?.value || '').slice(0, 100)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// Select dropdown block
function SelectBlock({ content, isAuthor = false, userId }: { content: InlineContent; isAuthor?: boolean; userId?: string }) {
  const data = content.content_data as SelectData;
  const [value, setValue] = useState(data.default_value || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [allResponses, setAllResponses] = useState<AllFormResponsesResult | null>(null);
  const { completions, markComplete, enabled: progressEnabled } = useContext(ProgressContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!userId) return;
    api.getMyFormResponse(content.id).then(r => {
      if (r?.response_data?.value) { setValue(r.response_data.value); }
    }).catch(() => {});
    if (isAuthor) api.getAllFormResponses(content.id).then(setAllResponses).catch(() => {});
  }, [content.id, userId, isAuthor]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (!userId) return;
    if (newValue) markComplete(itemKey, 'form');
    setSaveStatus('saving');
    api.submitFormResponse(content.id, { value: newValue })
      .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); })
      .catch(() => setSaveStatus('error'));
  };

  return (
    <div className={progressEnabled ? `progress-item${completions.has(itemKey) ? ' progress-item--done' : ''}` : undefined}>
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ChevronRight className="h-5 w-5 text-accent" />
            <span className="font-medium text-indigo-800">Select</span>
            {data.required && <span className="text-red-500 text-sm">*</span>}
          </div>
          <div className="flex items-center gap-2">
            {isAuthor && <VisibilityToggle content={content} />}
            <SaveStatusDot status={saveStatus} />
          </div>
        </div>
        <label className="block text-theme mb-2">{data.label}</label>
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full p-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-surface"
        >
          <option value="">{data.placeholder || 'Select an option...'}</option>
          {data.options?.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.text}</option>
          ))}
        </select>
        {isAuthor && allResponses && <ResponseSummary result={allResponses} type="choice" />}
      </div>
    </div>
  );
}

// Multiselect block
function MultiselectBlock({ content, isAuthor = false, userId }: { content: InlineContent; isAuthor?: boolean; userId?: string }) {
  const data = content.content_data as MultiselectData;
  const [selected, setSelected] = useState<string[]>(data.default_values || []);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [allResponses, setAllResponses] = useState<AllFormResponsesResult | null>(null);
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!userId) return;
    api.getMyFormResponse(content.id).then(r => {
      const val = r?.response_data?.value;
      if (val?.length > 0) { setSelected(val); }
    }).catch(() => {});
    if (isAuthor) api.getAllFormResponses(content.id).then(setAllResponses).catch(() => {});
  }, [content.id, userId, isAuthor]);

  const handleToggle = (id: string) => {
    const newSelected = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(newSelected);
    if (!userId) return;
    // Update progress immediately
    if (newSelected.length > 0) markComplete(itemKey, 'form'); else markIncomplete(itemKey);
    setSaveStatus('saving');
    api.submitFormResponse(content.id, { value: newSelected })
      .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); })
      .catch(() => setSaveStatus('error'));
  };

  return (
    <div className={progressEnabled ? `progress-item${completions.has(itemKey) ? ' progress-item--done' : ''}` : undefined}>
    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-violet-600" />
          <span className="font-medium text-violet-800">Multi-Select</span>
          {data.required && <span className="text-red-500 text-sm">*</span>}
        </div>
        <div className="flex items-center gap-2">
          {isAuthor && <VisibilityToggle content={content} />}
          <SaveStatusDot status={saveStatus} />
        </div>
      </div>
      <label className="block text-theme mb-2">{data.label}</label>
      <div className="space-y-2">
        {data.options?.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
              selected.includes(opt.id)
                ? 'bg-violet-100 border-violet-400'
                : 'bg-surface border-theme hover:border-violet-300'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.id)}
              onChange={() => handleToggle(opt.id)}
              className="rounded border-violet-400 text-violet-600 focus:ring-violet-500"
            />
            <span>{opt.text}</span>
          </label>
        ))}
      </div>
      {isAuthor && allResponses && <ResponseSummary result={allResponses} type="choice" />}
    </div>
    </div>
  );
}

// Text input block
function TextboxBlock({ content, isAuthor = false, userId }: { content: InlineContent; isAuthor?: boolean; userId?: string }) {
  const data = content.content_data as TextboxData;
  const [value, setValue] = useState(data.default_value || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [allResponses, setAllResponses] = useState<AllFormResponsesResult | null>(null);
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!userId) return;
    api.getMyFormResponse(content.id).then(r => {
      const val = r?.response_data?.value ?? '';
      setValue(val);
    }).catch(() => {});
    if (isAuthor) api.getAllFormResponses(content.id).then(setAllResponses).catch(() => {});
  }, [content.id, userId, isAuthor]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (!userId) return;
    // Update progress immediately
    if (newValue.trim()) markComplete(itemKey, 'form'); else markIncomplete(itemKey);
    setSaveStatus('saving');
    api.submitFormResponse(content.id, { value: newValue })
      .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); })
      .catch(() => setSaveStatus('error'));
  };

  return (
    <div className={progressEnabled ? `progress-item${completions.has(itemKey) ? ' progress-item--done' : ''}` : undefined}>
    <div className="bg-surface-hover border border-theme rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Type className="h-5 w-5 text-muted" />
          <span className="font-medium text-theme">Text Input</span>
          {data.required && <span className="text-red-500 text-sm">*</span>}
        </div>
        <div className="flex items-center gap-2">
          {isAuthor && <VisibilityToggle content={content} />}
          <SaveStatusDot status={saveStatus} />
        </div>
      </div>
      {(data.show_label ?? true) && <label className="block text-theme mb-2">{data.label}</label>}
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={data.placeholder || ''}
        maxLength={data.max_length}
        className="p-2 theme-input rounded-lg focus:ring-2 focus:ring-gray-500"
        style={(data.width && data.width !== 'full') ? FIELD_WIDTH_STYLE[data.width] : { width: '100%' }}
      />
      {data.max_length && (
        <p className="text-xs text-muted mt-1">{value.length}/{data.max_length} characters</p>
      )}
      {isAuthor && allResponses && <ResponseSummary result={allResponses} type="text" />}
    </div>
    </div>
  );
}

// Textarea block
function TextareaBlock({ content, isAuthor = false, userId }: { content: InlineContent; isAuthor?: boolean; userId?: string }) {
  const data = content.content_data as TextareaData;
  const [value, setValue] = useState(data.default_value || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [allResponses, setAllResponses] = useState<AllFormResponsesResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!userId) return;
    api.getMyFormResponse(content.id).then(r => {
      const val = r?.response_data?.value ?? '';
      setValue(val);
    }).catch(() => {});
    if (isAuthor) api.getAllFormResponses(content.id).then(setAllResponses).catch(() => {});
  }, [content.id, userId, isAuthor]);

  useEffect(() => {
    if (data.auto_expand && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [data.auto_expand]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (data.auto_expand && e.target) {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }
    if (!userId) return;
    // Update progress immediately
    if (newValue.trim()) markComplete(itemKey, 'form'); else markIncomplete(itemKey);
    setSaveStatus('saving');
    api.submitFormResponse(content.id, { value: newValue })
      .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); })
      .catch(() => setSaveStatus('error'));
  };

  const widthStyle = (data.width && data.width !== 'full') ? FIELD_WIDTH_STYLE[data.width] : { width: '100%' };

  return (
    <div className={progressEnabled ? `progress-item${completions.has(itemKey) ? ' progress-item--done' : ''}` : undefined}>
    <div className="bg-surface-hover border border-theme rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlignLeft className="h-5 w-5 text-muted" />
          <span className="font-medium text-theme">Text Area</span>
          {data.required && <span className="text-red-500 text-sm">*</span>}
        </div>
        <div className="flex items-center gap-2">
          {isAuthor && <VisibilityToggle content={content} />}
          <SaveStatusDot status={saveStatus} />
        </div>
      </div>
      {(data.show_label ?? true) && <label className="block text-theme mb-2">{data.label}</label>}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={data.placeholder || ''}
        rows={data.rows || 4}
        maxLength={data.max_length}
        className="p-2 theme-input rounded-lg focus:ring-2 focus:ring-gray-500 resize-none"
        style={{ ...widthStyle, ...(data.auto_expand ? { overflow: 'hidden' } : {}) }}
      />
      {data.max_length && (
        <p className="text-xs text-muted mt-1">{value.length}/{data.max_length} characters</p>
      )}
      {isAuthor && allResponses && <ResponseSummary result={allResponses} type="text" />}
    </div>
    </div>
  );
}

// Radio button block
function RadioBlock({ content, isAuthor = false, userId }: { content: InlineContent; isAuthor?: boolean; userId?: string }) {
  const data = content.content_data as RadioData;
  const [selected, setSelected] = useState(data.default_value || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [allResponses, setAllResponses] = useState<AllFormResponsesResult | null>(null);
  const { completions, markComplete, enabled: progressEnabled } = useContext(ProgressContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!userId) return;
    api.getMyFormResponse(content.id)
      .then(r => {
        if (r?.response_data?.value) {
          setSelected(r.response_data.value);
        } else if (data.default_value && data.options?.length === 1) {
          // Single option pre-selected — auto-save
          api.submitFormResponse(content.id, { value: data.default_value }).catch(() => {});
        }
      })
      .catch(() => {});
    if (isAuthor) api.getAllFormResponses(content.id).then(setAllResponses).catch(() => {});
  }, [content.id, userId, isAuthor]);

  const handleChange = (optId: string) => {
    setSelected(optId);
    if (!userId) return;
    markComplete(itemKey, 'form');
    setSaveStatus('saving');
    api.submitFormResponse(content.id, { value: optId })
      .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); })
      .catch(() => setSaveStatus('error'));
  };

  return (
    <div className={progressEnabled ? `progress-item${completions.has(itemKey) ? ' progress-item--done' : ''}` : undefined}>
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Circle className="h-5 w-5 text-orange-600" />
          <span className="font-medium text-orange-800">Choose One</span>
          {data.required && <span className="text-red-500 text-sm">*</span>}
        </div>
        <div className="flex items-center gap-2">
          {isAuthor && <VisibilityToggle content={content} />}
          <SaveStatusDot status={saveStatus} />
        </div>
      </div>
      <label className="block text-theme mb-2">{data.label}</label>
      <div className="space-y-2">
        {data.options?.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
              selected === opt.id
                ? 'bg-orange-100 border-orange-400'
                : 'bg-surface border-theme hover:border-orange-300'
            }`}
          >
            <input
              type="radio"
              name={`radio-${content.id}`}
              checked={selected === opt.id}
              onChange={() => handleChange(opt.id)}
              className="border-orange-400 text-orange-600 focus:ring-orange-500"
            />
            <span>{opt.text}</span>
          </label>
        ))}
      </div>
      {isAuthor && allResponses && <ResponseSummary result={allResponses} type="choice" />}
    </div>
    </div>
  );
}

// Checkbox block
function CheckboxBlock({ content, isAuthor = false, userId }: { content: InlineContent; isAuthor?: boolean; userId?: string }) {
  const data = content.content_data as CheckboxData;
  const [selected, setSelected] = useState<string[]>(data.default_values || []);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [allResponses, setAllResponses] = useState<AllFormResponsesResult | null>(null);
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!userId) return;
    api.getMyFormResponse(content.id).then(r => {
      const val = r?.response_data?.value;
      if (val?.length > 0) { setSelected(val); }
    }).catch(() => {});
    if (isAuthor) api.getAllFormResponses(content.id).then(setAllResponses).catch(() => {});
  }, [content.id, userId, isAuthor]);

  const handleToggle = (id: string) => {
    const newSelected = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(newSelected);
    if (!userId) return;
    // Update progress immediately
    if (newSelected.length > 0) markComplete(itemKey, 'form'); else markIncomplete(itemKey);
    setSaveStatus('saving');
    api.submitFormResponse(content.id, { value: newSelected })
      .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); })
      .catch(() => setSaveStatus('error'));
  };

  return (
    <div className={progressEnabled ? `progress-item${completions.has(itemKey) ? ' progress-item--done' : ''}` : undefined}>
    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-teal-600" />
          <span className="font-medium text-teal-800">Select All That Apply</span>
          {data.required && <span className="text-red-500 text-sm">*</span>}
        </div>
        <div className="flex items-center gap-2">
          {isAuthor && <VisibilityToggle content={content} />}
          <SaveStatusDot status={saveStatus} />
        </div>
      </div>
      <label className="block text-theme mb-2">{data.label}</label>
      <div className="space-y-2">
        {data.options?.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
              selected.includes(opt.id)
                ? 'bg-teal-100 border-teal-400'
                : 'bg-surface border-theme hover:border-teal-300'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.id)}
              onChange={() => handleToggle(opt.id)}
              className="rounded border-teal-400 text-teal-600 focus:ring-teal-500"
            />
            <span>{opt.text}</span>
          </label>
        ))}
      </div>
      {data.min_selections && (
        <p className="text-xs text-muted mt-2">
          Select at least {data.min_selections} option{data.min_selections > 1 ? 's' : ''}
        </p>
      )}
      {isAuthor && allResponses && <ResponseSummary result={allResponses} type="choice" />}
    </div>
    </div>
  );
}

// Code block display
function CodeBlockDisplay({ content }: { content: InlineContent }) {
  const data = content.content_data as CodeBlockData;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-50 border border-slate-300 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-300">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-slate-600" />
          <span className="font-medium text-slate-800">{data.title || 'Code'}</span>
          {data.language && (
            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded font-mono">
              {data.language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-200 rounded transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-slate-900 text-slate-100">
        <code className="text-sm font-mono whitespace-pre">{data.code}</code>
      </pre>
      {data.line_numbers && (
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-300 text-xs text-slate-500">
          {data.code?.split('\n').length || 0} lines
        </div>
      )}
    </div>
  );
}

// Scripture block display
function ScriptureBlockDisplay({ content }: { content: InlineContent }) {
  const data = content.content_data as ScriptureBlockData;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-600 rounded-r-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-5 w-5 text-amber-700" />
        <span className="font-semibold text-amber-800">{data.reference}</span>
        {data.version && (
          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
            {data.version}
          </span>
        )}
      </div>
      <blockquote className="text-theme italic text-lg leading-relaxed">
        "{data.text}"
      </blockquote>
      {data.notes && (
        <p className="mt-3 text-sm text-muted border-t border-amber-200 pt-3">
          {data.notes}
        </p>
      )}
    </div>
  );
}

// Image block
function ImageBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as ImageData;
  const widthClass = {
    small: 'max-w-xs',
    medium: 'max-w-md',
    large: 'max-w-2xl',
    full: 'w-full',
  }[data.width || 'full'];

  return (
    <figure className={`${widthClass} mx-auto my-2`}>
      <img
        src={data.url}
        alt={data.alt || ''}
        className="w-full rounded-lg object-contain bg-surface-hover"
      />
      {data.caption && (
        <figcaption className="text-center text-xs text-muted mt-1.5 italic">{data.caption}</figcaption>
      )}
    </figure>
  );
}

// Drawing block
function DrawingBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as DrawingData;
  const widthClass = {
    small: 'max-w-xs',
    medium: 'max-w-md',
    large: 'max-w-2xl',
    full: 'w-full',
  }[data.width || 'full'];

  return (
    <figure className={`${widthClass} mx-auto my-2`}>
      <img
        src={data.dataUrl}
        alt={data.title || 'Drawing'}
        className="w-full rounded-lg object-contain bg-white border border-gray-100"
      />
      {data.caption && (
        <figcaption className="text-center text-xs text-muted mt-1.5 italic">{data.caption}</figcaption>
      )}
    </figure>
  );
}

// Compact inline media player — rendered directly in the text flow
function InlineMediaPlayer({ content }: { content: InlineContent }) {
  const data = content.content_data as MediaData;
  const isAudio = data.type === 'audio';
  const { requestPlay, clearPlay } = useContext(MediaContext);
  const { completions, markComplete } = useContext(ProgressContext);
  const itemKey = `ic:${content.id}`;
  const completedRef = useRef(false);
  const mediaId = `inline:${content.id}`;
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleTimeUpdate = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    if (completedRef.current) return;
    if (el.duration && el.currentTime / el.duration >= 0.8) {
      completedRef.current = true;
      markComplete(itemKey, isAudio ? 'audio' : 'video');
    }
  }, [isAudio, itemKey, markComplete]);

  // Mark complete on load if already completed in a previous session
  useEffect(() => {
    if (completions.has(itemKey)) completedRef.current = true;
  }, [completions, itemKey]);

  const getEmbedUrl = (url: string): string | null => {
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}?dnt=1`;
    return null;
  };

  const embedUrl = !isAudio ? getEmbedUrl(data.url) : null;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const pauseSelf = useCallback(() => {
    const el = mediaRef.current;
    if (el && !el.paused) { el.pause(); setPlaying(false); }
  }, []);

  const togglePlay = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      requestPlay(mediaId, pauseSelf);
      el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
      clearPlay(mediaId);
    }
  };
  const toggleMute = () => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  if (!isAudio && embedUrl) {
    return (
      <span className="block w-full rounded-xl overflow-hidden border border-[var(--color-border)] my-1">
        <span className="block aspect-video bg-[var(--color-surface-hover)]">
          <iframe src={embedUrl} className="w-full h-full rounded-xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen title={data.title || 'Video'} />
        </span>
        {data.title && <span className="block px-3 py-2 text-xs uppercase tracking-wide font-medium text-muted border-t border-[var(--color-border)]">{data.title}</span>}
      </span>
    );
  }

  return (
    <span className="block w-full rounded-xl overflow-hidden my-1 border border-[var(--color-border)] bg-[var(--color-surface)]">
      {!isAudio && (
        <span className="block relative group bg-black">
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={data.url}
            preload="metadata"
            className="w-full block"
            style={{ maxHeight: '320px', objectFit: 'contain', display: 'block', background: '#000' }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => setDuration(mediaRef.current?.duration || 0)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          {!playing && (
            <span onClick={togglePlay} className="absolute inset-0 flex items-center justify-center cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)]/40">
              <span className="w-12 h-12 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shadow-md">
                <Play className="h-5 w-5 text-theme ml-0.5" />
              </span>
            </span>
          )}
        </span>
      )}
      {isAudio && (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={data.url}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(mediaRef.current?.duration || 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
      {/* Controls */}
      <span className="flex items-center gap-2 px-3 py-2 border-t border-[var(--color-border)]">
        <button onClick={togglePlay} className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 transition-opacity bg-[var(--color-accent)] text-white hover:opacity-80">
          {playing
            ? <span className="flex gap-[3px]"><span className="w-[3px] h-3 bg-current" /><span className="w-[3px] h-3 bg-current" /></span>
            : <Play className="h-3 w-3 ml-0.5" />}
        </button>
        <span className="text-xs tabular-nums w-8 shrink-0 text-muted">{formatTime(currentTime)}</span>
        <input type="range" min={0} max={duration || 100} step={0.1} value={currentTime}
          onChange={e => { const el = mediaRef.current; if (el) { el.currentTime = Number(e.target.value); setCurrentTime(el.currentTime); } }}
          className="flex-1 h-1 appearance-none cursor-pointer rounded-none"
          style={{ background: `linear-gradient(to right, var(--color-accent) ${progressPct}%, var(--color-border) ${progressPct}%)` }} />
        <span className="text-xs tabular-nums w-8 shrink-0 text-right text-muted">{formatTime(duration)}</span>
        <button onClick={toggleMute} className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-theme transition-colors">
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </span>
      {data.title && (
        <span className="block px-3 pb-2 text-xs uppercase tracking-wide font-medium text-muted border-t border-[var(--color-border)]">{data.title}</span>
      )}
    </span>
  );
}

// Inline form element - renders interactive forms directly in the text
function InlineFormElement({ content }: { content: InlineContent }) {
  const type = content.content_type;

  switch (type) {
    case 'select':
      return <InlineSelect content={content} />;
    case 'multiselect':
      return <InlineMultiselect content={content} />;
    case 'textbox':
      return <InlineTextbox content={content} />;
    case 'textarea':
      return <InlineTextarea content={content} />;
    case 'radio':
      return <InlineRadio content={content} />;
    case 'checkbox':
      return <InlineCheckbox content={content} />;
    case 'code_block':
      return <InlineCodeBlock content={content} />;
    case 'scripture_block':
      return <InlineScripture content={content} />;
    case 'image':
      return <ImageBlock content={content} />;
    case 'drawing':
      return <DrawingBlock content={content} />;
    case 'audio':
    case 'video':
      return <MediaBlock content={content} />;
    default:
      return null;
  }
}

// Inline Select dropdown
function InlineSelect({ content }: { content: InlineContent }) {
  const data = content.content_data as SelectData;
  const [value, setValue] = useState(data.default_value || '');
  const { completions, markComplete, enabled: progressEnabled } = useContext(ProgressContext);
  const requestAuth = useContext(AuthGateContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!api.getToken()) return;
    api.getMyFormResponse(content.id).then(r => { if (r?.response_data?.value) setValue(r.response_data.value); }).catch(() => {});
  }, [content.id]);

  const handleChange = (newValue: string) => {
    if (!api.getToken()) { requestAuth(); return; }
    setValue(newValue);
    if (newValue) markComplete(itemKey, 'form');
    api.submitFormResponse(content.id, { value: newValue }).catch(() => {});
  };

  return (
    <span className={`inline-flex items-center gap-1 mx-1${progressEnabled && completions.has(itemKey) ? ' opacity-70' : ''}`}>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="inline-block px-2 py-0.5 text-sm border border-indigo-300 rounded bg-indigo-50 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
        style={{ minWidth: '120px' }}
      >
        <option value="">{data.placeholder || 'Select...'}</option>
        {data.options?.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.text}</option>
        ))}
      </select>
      {data.required && <span className="text-red-500 text-xs">*</span>}
      {progressEnabled && completions.has(itemKey) && <Check className="h-3 w-3 text-green-500 shrink-0" />}
    </span>
  );
}

// Inline Multiselect (shown as compact checkboxes)
function InlineMultiselect({ content }: { content: InlineContent }) {
  const data = content.content_data as MultiselectData;
  const [selected, setSelected] = useState<string[]>(data.default_values || []);
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const requestAuth = useContext(AuthGateContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!api.getToken()) return;
    api.getMyFormResponse(content.id).then(r => {
      if (r?.response_data?.value) { setSelected(r.response_data.value); }
    }).catch(() => {});
  }, [content.id]);

  const toggleOption = (id: string) => {
    if (!api.getToken()) { requestAuth(); return; }
    const newSelected = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(newSelected);
    if (newSelected.length > 0) markComplete(itemKey, 'form'); else markIncomplete(itemKey);
    api.submitFormResponse(content.id, { value: newSelected }).catch(() => {});
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2 mx-1 py-1 px-2 bg-violet-50 border border-violet-200 rounded">
      {data.options?.map((opt) => (
        <label key={opt.id} className="inline-flex items-center gap-1 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={selected.includes(opt.id)}
            onChange={() => toggleOption(opt.id)}
            className="w-3.5 h-3.5 rounded border-violet-400 text-violet-600 focus:ring-violet-500"
          />
          <span className="text-theme">{opt.text}</span>
        </label>
      ))}
      {progressEnabled && completions.has(itemKey) && <Check className="h-3 w-3 text-green-500 shrink-0 ml-1" />}
    </span>
  );
}

const FIELD_WIDTH_STYLE: Record<string, React.CSSProperties> = {
  xs:   { width: 80 },
  sm:   { width: 120 },
  md:   { width: 200 },
  lg:   { width: 320 },
};

// Inline Textbox (single line)
function InlineTextbox({ content }: { content: InlineContent }) {
  const data = content.content_data as TextboxData;
  const [value, setValue] = useState(data.default_value || '');
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const requestAuth = useContext(AuthGateContext);
  const itemKey = `ic:${content.id}`;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!api.getToken()) return;
    api.getMyFormResponse(content.id).then(r => {
      const val = r?.response_data?.value ?? '';
      setValue(val);
    }).catch(() => {});
  }, [content.id]);

  const handleChange = (newValue: string) => {
    if (!api.getToken()) { requestAuth(); return; }
    setValue(newValue);
    if (newValue.trim()) markComplete(itemKey, 'form'); else markIncomplete(itemKey);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.submitFormResponse(content.id, { value: newValue }).catch(() => {});
    }, 600);
  };

  const isFull = (data.width ?? 'md') === 'full';
  const isDone = progressEnabled && completions.has(itemKey);

  if (isFull) {
    return (
      <span className="block my-2">
        <span className="flex items-center gap-1">
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={data.placeholder || 'Type here...'}
            maxLength={data.max_length}
            className="block w-full px-3 py-1.5 text-sm border border-theme rounded bg-surface focus:ring-1 focus:ring-gray-500 focus:outline-none"
          />
          {isDone && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
        </span>
        {data.required && <span className="text-red-500 text-xs mt-0.5 block">Required</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 mx-1">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={data.placeholder || 'Type here...'}
        maxLength={data.max_length}
        className="px-2 py-0.5 text-sm border border-theme rounded bg-surface focus:ring-1 focus:ring-gray-500 focus:outline-none"
        style={FIELD_WIDTH_STYLE[data.width ?? 'md']}
      />
      {data.required && <span className="text-red-500 text-xs">*</span>}
      {isDone && <Check className="h-3 w-3 text-green-500 shrink-0" />}
    </span>
  );
}

// Inline Textarea (multi-line, but compact)
function InlineTextarea({ content }: { content: InlineContent }) {
  const data = content.content_data as TextareaData;
  const [value, setValue] = useState(data.default_value || '');
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const requestAuth = useContext(AuthGateContext);
  const itemKey = `ic:${content.id}`;
  const isFull = (data.width ?? 'full') === 'full';
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!api.getToken()) return;
    api.getMyFormResponse(content.id).then(r => {
      const val = r?.response_data?.value ?? '';
      setValue(val);
    }).catch(() => {});
  }, [content.id]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!api.getToken()) { requestAuth(); return; }
    const newValue = e.target.value;
    setValue(newValue);
    if (data.auto_expand && e.target) {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }
    if (newValue.trim()) markComplete(itemKey, 'form'); else markIncomplete(itemKey);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.submitFormResponse(content.id, { value: newValue }).catch(() => {});
    }, 600);
  }, [data.auto_expand, content.id, itemKey, markComplete, markIncomplete, requestAuth]);

  // Set initial height when auto_expand is on
  useEffect(() => {
    if (data.auto_expand && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [data.auto_expand]);

  const isDone = progressEnabled && completions.has(itemKey);

  if (isFull) {
    return (
      <span className="block my-2">
        <span className="flex items-start gap-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            placeholder={data.placeholder || 'Enter your response...'}
            rows={data.rows || 2}
            maxLength={data.max_length}
            className="block w-full px-3 py-1.5 text-sm border border-theme rounded bg-surface focus:ring-1 focus:ring-gray-500 focus:outline-none resize-none"
            style={data.auto_expand ? { overflow: 'hidden' } : undefined}
          />
          {isDone && <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-1" />}
        </span>
        {data.max_length && <span className="text-xs text-muted">{value.length}/{data.max_length}</span>}
      </span>
    );
  }

  return (
    <span className="inline-block mx-1 align-middle" style={FIELD_WIDTH_STYLE[data.width ?? 'lg']}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={data.placeholder || 'Enter your response...'}
        rows={data.rows || 2}
        maxLength={data.max_length}
        className="block w-full px-2 py-1 text-sm border border-theme rounded bg-surface focus:ring-1 focus:ring-gray-500 focus:outline-none resize-none"
        style={data.auto_expand ? { overflow: 'hidden' } : undefined}
      />
      {data.max_length && <span className="text-xs text-muted">{value.length}/{data.max_length}</span>}
      {isDone && <Check className="h-3 w-3 text-green-500 shrink-0" />}
    </span>
  );
}

// Inline Radio buttons
function InlineRadio({ content }: { content: InlineContent }) {
  const data = content.content_data as RadioData;
  const [selected, setSelected] = useState(data.default_value || '');
  const { completions, markComplete, enabled: progressEnabled } = useContext(ProgressContext);
  const requestAuth = useContext(AuthGateContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!api.getToken()) return;
    api.getMyFormResponse(content.id).then(r => {
      if (r?.response_data?.value) { setSelected(r.response_data.value); }
    }).catch(() => {});
  }, [content.id]);

  const handleChange = (optId: string) => {
    if (!api.getToken()) { requestAuth(); return; }
    setSelected(optId);
    markComplete(itemKey, 'form');
    api.submitFormResponse(content.id, { value: optId }).catch(() => {});
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-3 mx-1 py-1 px-2 bg-orange-50 border border-orange-200 rounded">
      {data.options?.map((opt) => (
        <label key={opt.id} className="inline-flex items-center gap-1 cursor-pointer text-sm">
          <input
            type="radio"
            name={`inline-radio-${content.id}`}
            checked={selected === opt.id}
            onChange={() => handleChange(opt.id)}
            className="w-3.5 h-3.5 border-orange-400 text-orange-600 focus:ring-orange-500"
          />
          <span className="text-theme">{opt.text}</span>
        </label>
      ))}
      {progressEnabled && completions.has(itemKey) && <Check className="h-3 w-3 text-green-500 shrink-0 ml-1" />}
    </span>
  );
}

// Inline Checkbox options
function InlineCheckbox({ content }: { content: InlineContent }) {
  const data = content.content_data as CheckboxData;
  const [selected, setSelected] = useState<string[]>(data.default_values || []);
  const { completions, markComplete, markIncomplete, enabled: progressEnabled } = useContext(ProgressContext);
  const requestAuth = useContext(AuthGateContext);
  const itemKey = `ic:${content.id}`;

  useEffect(() => {
    if (!api.getToken()) return;
    api.getMyFormResponse(content.id).then(r => {
      if (r?.response_data?.value) { setSelected(r.response_data.value); }
    }).catch(() => {});
  }, [content.id]);

  const toggleOption = (id: string) => {
    if (!api.getToken()) { requestAuth(); return; }
    const newSelected = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(newSelected);
    if (newSelected.length > 0) markComplete(itemKey, 'form'); else markIncomplete(itemKey);
    api.submitFormResponse(content.id, { value: newSelected }).catch(() => {});
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2 mx-1 py-1 px-2 bg-teal-50 border border-teal-200 rounded">
      {data.options?.map((opt) => (
        <label key={opt.id} className="inline-flex items-center gap-1 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={selected.includes(opt.id)}
            onChange={() => toggleOption(opt.id)}
            className="w-3.5 h-3.5 rounded border-teal-400 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-theme">{opt.text}</span>
        </label>
      ))}
      {progressEnabled && completions.has(itemKey) && <Check className="h-3 w-3 text-green-500 shrink-0 ml-1" />}
    </span>
  );
}

// Inline Code Block
function InlineCodeBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as CodeBlockData;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="inline-block mx-1 align-top my-2">
      <span className="block bg-slate-900 rounded-lg overflow-hidden border border-slate-700" style={{ maxWidth: '500px' }}>
        <span className="flex items-center justify-between px-3 py-1 bg-slate-800 border-b border-slate-700">
          <span className="flex items-center gap-2">
            <Code className="h-3.5 w-3.5 text-slate-400" />
            {data.language && (
              <span className="text-xs text-slate-400 font-mono">{data.language}</span>
            )}
          </span>
          <button
            onClick={handleCopy}
            className="text-xs px-2 py-0.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </span>
        <pre className="p-3 overflow-x-auto text-slate-100">
          <code className="text-xs font-mono whitespace-pre">{data.code}</code>
        </pre>
      </span>
    </span>
  );
}

// Inline Scripture Block
function InlineScripture({ content }: { content: InlineContent }) {
  const data = content.content_data as ScriptureBlockData;

  return (
    <span className="inline-block mx-1 my-2 align-top">
      <span className="block bg-amber-50 border-l-3 border-amber-500 rounded-r px-3 py-2" style={{ maxWidth: '450px', borderLeftWidth: '3px' }}>
        <span className="flex items-center gap-2 mb-1">
          <BookOpen className="h-3.5 w-3.5 text-amber-700" />
          <span className="text-sm font-semibold text-amber-800">{data.reference}</span>
          {data.version && (
            <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
              {data.version}
            </span>
          )}
        </span>
        <span className="block text-theme italic text-sm leading-relaxed">
          "{data.text}"
        </span>
        {data.notes && (
          <span className="block mt-2 text-xs text-muted border-t border-amber-200 pt-2">
            {data.notes}
          </span>
        )}
      </span>
    </span>
  );
}

function InlineContentPanel({
  content,
  onClose,
  isAuthor,
  userId,
}: {
  content: InlineContent;
  onClose: () => void;
  isAuthor?: boolean;
  userId?: string;
}) {
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-surface border-l border-theme shadow-lg z-30 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-theme">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold capitalize">{content.content_type}</h3>
          {/* Author/Reader Badge */}
          {content.is_author_content ? (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
              <Crown className="h-3 w-3" />
              Author
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
              <User className="h-3 w-3" />
              Reader
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-muted hover:text-theme">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <InlineContentBlock content={content} isAuthor={isAuthor} userId={userId} />
      </div>
    </div>
  );
}

// Horizontal component-type icon strip for the header bar
function HeaderComponentIcons({
  inlineContent,
  filterType,
  onFilterChange,
  onContentSelect,
  completions,
  showComponentPanel,
}: {
  inlineContent: InlineContent[];
  filterType: string | null;
  onFilterChange: (type: string | null) => void;
  onContentSelect: (content: InlineContent) => void;
  completions: Set<string>;
  showComponentPanel: boolean;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    const allTypes = [
      'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
      'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
      'code_block', 'scripture_block'
    ];
    allTypes.forEach(t => c[t] = 0);
    inlineContent.forEach(item => { if (c[item.content_type] !== undefined) c[item.content_type]++; });
    return c;
  }, [inlineContent]);

  const filteredItems = filterType ? inlineContent.filter(item => item.content_type === filterType) : [];

  const toolbarItems = [
    { type: 'question',       icon: HelpCircle,    label: 'Questions',    color: 'text-blue-600',   bgColor: 'bg-blue-100',   hoverBg: 'hover:bg-blue-50' },
    { type: 'poll',           icon: BarChart2,     label: 'Polls',        color: 'text-green-600',  bgColor: 'bg-green-100',  hoverBg: 'hover:bg-green-50' },
    { type: 'highlight',      icon: Highlighter,   label: 'Highlights',   color: 'text-yellow-600', bgColor: 'bg-yellow-100', hoverBg: 'hover:bg-yellow-50' },
    { type: 'note',           icon: StickyNote,    label: 'Notes',        color: 'text-purple-600', bgColor: 'bg-purple-100', hoverBg: 'hover:bg-purple-50' },
    { type: 'link',           icon: Link2,         label: 'Links',        color: 'text-cyan-600',   bgColor: 'bg-cyan-100',   hoverBg: 'hover:bg-cyan-50' },
    { type: 'audio',          icon: Play,          label: 'Audio',        color: 'text-orange-600', bgColor: 'bg-orange-100', hoverBg: 'hover:bg-orange-50' },
    { type: 'video',          icon: Video,         label: 'Video',        color: 'text-red-600',    bgColor: 'bg-red-100',    hoverBg: 'hover:bg-red-50' },
    { type: 'select',         icon: ChevronRight,  label: 'Dropdowns',    color: 'text-accent',     bgColor: 'bg-indigo-100', hoverBg: 'hover:bg-indigo-50' },
    { type: 'multiselect',    icon: List,          label: 'Multi-Select', color: 'text-violet-600', bgColor: 'bg-violet-100', hoverBg: 'hover:bg-violet-50' },
    { type: 'textbox',        icon: Type,          label: 'Text Inputs',  color: 'text-muted',      bgColor: 'bg-surface-hover', hoverBg: 'hover:bg-surface-hover' },
    { type: 'textarea',       icon: AlignLeft,     label: 'Text Areas',   color: 'text-muted',      bgColor: 'bg-surface-hover', hoverBg: 'hover:bg-surface-hover' },
    { type: 'radio',          icon: Circle,        label: 'Radio',        color: 'text-orange-600', bgColor: 'bg-orange-100', hoverBg: 'hover:bg-orange-50' },
    { type: 'checkbox',       icon: CheckSquare,   label: 'Checkboxes',   color: 'text-teal-600',   bgColor: 'bg-teal-100',   hoverBg: 'hover:bg-teal-50' },
    { type: 'code_block',     icon: Code,          label: 'Code Blocks',  color: 'text-slate-600',  bgColor: 'bg-slate-100',  hoverBg: 'hover:bg-slate-50' },
    { type: 'scripture_block',icon: BookOpen,      label: 'Scripture',    color: 'text-amber-700',  bgColor: 'bg-amber-100',  hoverBg: 'hover:bg-amber-50' },
  ];

  // Only show icon types that have at least 1 item
  const visibleItems = toolbarItems.filter(({ type }) => counts[type] > 0);
  if (visibleItems.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        {visibleItems.map(({ type, icon: Icon, label, color, bgColor, hoverBg }) => {
          const count = counts[type];
          const isActive = filterType === type;
          const itemsOfType = inlineContent.filter(i => i.content_type === type);
          const allDone = itemsOfType.length > 0 && itemsOfType.every(i => completions.has(`ic:${i.id}`));

          function handleIconClick() {
            // If only one item: skip popup, scroll directly to it
            if (count === 1) {
              const item = itemsOfType[0];
              if (showComponentPanel) onContentSelect(item);
              const pos = item.position_in_chapter;
              if (pos === 'start_of_chapter' || pos === 'end_of_chapter') {
                const block = document.getElementById(`reader-block-${item.id}`);
                if (block) { block.scrollIntoView({ behavior: 'smooth', block: 'center' }); pulseElement(block); }
              } else {
                scrollToInline(item.id);
              }
              return;
            }
            // Multiple items: toggle the popup
            onFilterChange(isActive ? null : type);
          }

          return (
            <button
              key={type}
              onClick={handleIconClick}
              className={`relative flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-all border ${
                allDone
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : isActive
                  ? `border-transparent ${bgColor} ${color}`
                  : `border-transparent text-muted ${hoverBg} hover:${color}`
              }`}
              title={`${label} (${count})`}
            >
              <Icon className="h-3.5 w-3.5" />
              {count > 1 && <span>{count}</span>}
            </button>
          );
        })}
        {filterType && (
          <button
            onClick={() => onFilterChange(null)}
            className="ml-1 text-muted hover:text-theme"
            title="Clear filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Expanded item list — drops down below the header */}
      {filterType && filteredItems.length > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 top-[88px] z-20 w-80 max-h-[50vh] bg-surface rounded-lg shadow-xl border-theme border overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-theme bg-surface-hover">
            <h4 className="font-semibold capitalize text-sm">{filterType}s ({filteredItems.length})</h4>
            <button onClick={() => onFilterChange(null)} className="text-muted hover:text-theme">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[calc(50vh-48px)]">
            {filteredItems.map((item, index) => {
              const done = completions.has(`ic:${item.id}`);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (showComponentPanel) onContentSelect(item);
                    onFilterChange(null);
                    const pos = item.position_in_chapter;
                    if (pos === 'start_of_chapter' || pos === 'end_of_chapter') {
                      const block = document.getElementById(`reader-block-${item.id}`);
                      if (block) { block.scrollIntoView({ behavior: 'smooth', block: 'center' }); pulseElement(block); }
                    } else {
                      scrollToInline(item.id);
                    }
                  }}
                  className="w-full text-left p-3 hover:bg-surface-hover border-b border-theme last:border-b-0 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {/* Completion checkbox */}
                    {done
                      ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      : <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                    }
                    <p className={`text-sm line-clamp-2 flex-1 ${done ? 'text-muted line-through' : 'text-theme'}`}>
                      {item.anchor_text || `${filterType} ${index + 1}`}
                    </p>
                    {item.is_author_content ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                        <Crown className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        <User className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  {item.content_data && (
                    <p className="text-xs text-muted mt-1 line-clamp-1 pl-6">
                      {(item.content_data as any).question || (item.content_data as any).note || (item.content_data as any).url || ''}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}


// Reader Selection Toolbar - appears when reader selects text
function ReaderSelectionToolbar({
  position,
  canAddHighlight,
  canAddNote,
  canAddQuestion,
  canAddPoll,
  canAddLink,
  canAddAudio,
  canAddVideo,
  onSelect,
  onClose
}: {
  position: { x: number; y: number };
  canAddHighlight: boolean;
  canAddNote: boolean;
  canAddQuestion: boolean;
  canAddPoll: boolean;
  canAddLink: boolean;
  canAddAudio: boolean;
  canAddVideo: boolean;
  onSelect: (type: InlineContentType) => void;
  onClose: () => void;
}) {
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);

  // Adjust position to stay within viewport
  React.useEffect(() => {
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      let x = position.x - rect.width / 2;
      let y = position.y - rect.height;

      // Keep within horizontal bounds
      if (x < 10) x = 10;
      if (x + rect.width > window.innerWidth - 10) {
        x = window.innerWidth - rect.width - 10;
      }

      // Keep above selection, or below if no room
      if (y < 10) y = position.y + 30;

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('click', handleClickOutside), 100);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const buttons = [
    { type: 'highlight' as const, icon: Highlighter, label: 'Highlight', enabled: canAddHighlight, color: 'text-yellow-600 hover:bg-yellow-50' },
    { type: 'note' as const, icon: StickyNote, label: 'Note', enabled: canAddNote, color: 'text-purple-600 hover:bg-purple-50' },
    { type: 'question' as const, icon: HelpCircle,    label: 'Question', enabled: canAddQuestion, color: 'text-blue-600 hover:bg-blue-50' },
    { type: 'poll' as const, icon: BarChart2, label: 'Poll', enabled: canAddPoll, color: 'text-green-600 hover:bg-green-50' },
    { type: 'link' as const, icon: Link2, label: 'Link', enabled: canAddLink, color: 'text-cyan-600 hover:bg-cyan-50' },
    { type: 'audio' as const, icon: Play, label: 'Audio', enabled: canAddAudio, color: 'text-orange-600 hover:bg-orange-50' },
    { type: 'video' as const, icon: Video, label: 'Video', enabled: canAddVideo, color: 'text-red-600 hover:bg-red-50' },
  ].filter(b => b.enabled);

  if (buttons.length === 0) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 bg-surface rounded-lg shadow-xl border-theme border px-2 py-1.5"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      <span className="text-xs text-muted mr-1">Add:</span>
      {buttons.map(({ type, icon: Icon, label, color }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className={`p-1.5 rounded transition-colors ${color}`}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
      <button
        onClick={onClose}
        className="p-1 ml-1 text-muted hover:text-theme"
        title="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

