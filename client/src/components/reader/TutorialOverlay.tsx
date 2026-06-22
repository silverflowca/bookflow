import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, GraduationCap, CheckCircle, PlayCircle, BookOpen } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TutorialStep {
  /** CSS selector to spotlight. null = centre-screen modal (no spotlight). */
  target: string | null;
  title: string;
  description: React.ReactNode;
  /** Where to place the tooltip relative to the target. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** If set, user must perform this action before they can advance. */
  action?: {
    type: 'click' | 'input' | 'scroll' | 'none';
    /** Human-readable instruction shown under the description. */
    instruction: string;
  };
  /** chapter index (0-based) this step belongs to */
  chapter: number;
  /** Optional URL to navigate to before this step renders */
  navigateTo?: string;
}

export interface TutorialChapter {
  title: string;
  /** One-line description shown on the welcome screen chapter list */
  description?: string;
  steps: TutorialStep[];
}

interface Props {
  chapters: TutorialChapter[];
  bookId: string;
  /** Called when user closes the overlay */
  onClose: () => void;
  /** If provided, jump to this chapter+step on open */
  initialChapter?: number;
  initialStep?: number;
  /** Called before each step renders — lets the host prepare the UI (e.g. open sidebar) */
  onBeforeStep?: (step: TutorialStep) => void;
}

// ── Storage key ───────────────────────────────────────────────────────────────

function storageKey(bookId: string) {
  return `bf_tutorial_progress_${bookId}`;
}

function loadProgress(bookId: string): { chapter: number; step: number } {
  try {
    const raw = localStorage.getItem(storageKey(bookId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { chapter: 0, step: 0 };
}

function saveProgress(bookId: string, chapter: number, step: number) {
  try {
    localStorage.setItem(storageKey(bookId), JSON.stringify({ chapter, step }));
  } catch { /* ignore */ }
}

// ── Spotlight rect helper ─────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number; }

function getTargetRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Store viewport-relative coords (no scrollY offset) so the rect is always
  // immediately usable for fixed-position placement without any conversion.
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ── Tooltip position ──────────────────────────────────────────────────────────

const TOOLTIP_W = 380;
const TOOLTIP_H_EST = 300;
const PAD = 12;
const MOBILE_BREAKPOINT = 600;

function isMobileViewport() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function computeTooltipPos(rect: Rect | null, placement: TutorialStep['placement'] = 'bottom'): React.CSSProperties {
  // Mobile: always bottom sheet, ignore placement/rect
  if (isMobileViewport()) {
    return { position: 'fixed', bottom: 0, left: 0, right: 0 };
  }

  if (!rect || placement === 'center') {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // rect is already in viewport coords
  const vpTop = rect.top;
  const vpLeft = rect.left;

  let top = 0, left = 0;

  if (placement === 'bottom') {
    top = vpTop + rect.height + PAD;
    left = vpLeft + rect.width / 2 - TOOLTIP_W / 2;
  } else if (placement === 'top') {
    top = vpTop - TOOLTIP_H_EST - PAD;
    left = vpLeft + rect.width / 2 - TOOLTIP_W / 2;
  } else if (placement === 'right') {
    top = vpTop + rect.height / 2 - TOOLTIP_H_EST / 2;
    left = vpLeft + rect.width + PAD;
  } else if (placement === 'left') {
    top = vpTop + rect.height / 2 - TOOLTIP_H_EST / 2;
    left = vpLeft - TOOLTIP_W - PAD;
  }

  // Clamp to viewport
  left = Math.max(PAD, Math.min(left, vw - TOOLTIP_W - PAD));
  top  = Math.max(PAD, Math.min(top, vh - TOOLTIP_H_EST - PAD));

  return { position: 'fixed', top, left };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TutorialOverlay({ chapters, bookId, onClose, initialChapter, initialStep, onBeforeStep }: Props) {
  const saved = loadProgress(bookId);
  const [chapterIdx, setChapterIdx] = useState(initialChapter ?? saved.chapter);
  const [stepIdx, setStepIdx] = useState(initialStep ?? saved.step);
  const [actionDone, setActionDone] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [mobile, setMobile] = useState(() => isMobileViewport());
  // Show welcome screen on first open; skip it if resuming mid-tutorial or if a specific chapter was requested
  const isResuming = (initialChapter == null && initialStep == null) && (saved.chapter > 0 || saved.step > 0);
  const [showWelcome, setShowWelcome] = useState(initialChapter == null && !isResuming);
  // Drag-to-move offset (desktop only)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const elevatedElRef = useRef<{ el: Element; prevZ: string; prevPos: string } | null>(null);
  const tabsRowRef = useRef<HTMLDivElement>(null);
  const activePillRef = useRef<HTMLButtonElement>(null);

  // Track mobile breakpoint
  useEffect(() => {
    const onResize = () => setMobile(isMobileViewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const allSteps = chapters.flatMap(c => c.steps);
  const globalStep = chapters.slice(0, chapterIdx).reduce((n, c) => n + c.steps.length, 0) + stepIdx;
  const totalSteps = allSteps.length;

  const chapter = chapters[chapterIdx];
  const step = chapter?.steps[stepIdx];

  // Reset drag offset whenever the step changes so card repositions near target
  useEffect(() => { setDragOffset(null); }, [chapterIdx, stepIdx]);

  // Scroll active chapter pill to centre of the tab row on chapter change
  useEffect(() => {
    const row = tabsRowRef.current;
    const pill = activePillRef.current;
    if (!row || !pill) return;
    const pillLeft = pill.offsetLeft;
    const pillWidth = pill.offsetWidth;
    const rowWidth = row.offsetWidth;
    row.scrollTo({ left: pillLeft - rowWidth / 2 + pillWidth / 2, behavior: 'smooth' });
  }, [chapterIdx]);

  // ── Drag handlers (desktop only) ─────────────────────────────────────────────
  function onDragStart(e: React.MouseEvent | React.TouchEvent) {
    if (mobile) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const ox = dragOffset?.x ?? 0;
    const oy = dragOffset?.y ?? 0;
    dragStartRef.current = { mx: clientX, my: clientY, ox, oy };

    function onMove(ev: MouseEvent | TouchEvent) {
      if (!dragStartRef.current) return;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      setDragOffset({
        x: dragStartRef.current.ox + cx - dragStartRef.current.mx,
        y: dragStartRef.current.oy + cy - dragStartRef.current.my,
      });
    }
    function onEnd() {
      dragStartRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  // ── Measure target + scroll into view ───────────────────────────────────────
  // remeasureOnly: just read the current viewport rect without scrolling (used on scroll/resize)
  const remeasureRect = useCallback(() => {
    if (!step?.target) { setTargetRect(null); return; }
    setTargetRect(getTargetRect(step.target));
  }, [step]);

  const measureTarget = useCallback(() => {
    if (!step?.target) { setTargetRect(null); return; }
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setTargetRect(getTargetRect(step.target!)), 400);
    } else {
      setTargetRect(null);
    }
  }, [step]);

  // ── Elevate target element above overlay so it isn't dimmed ─────────────────
  useEffect(() => {
    // Restore previous element before elevating the new one
    if (elevatedElRef.current) {
      const { el, prevZ, prevPos } = elevatedElRef.current;
      (el as HTMLElement).style.zIndex = prevZ;
      (el as HTMLElement).style.position = prevPos;
      elevatedElRef.current = null;
    }
    if (!step?.target) return;
    const el = document.querySelector(step.target);
    if (!el) return;
    const s = (el as HTMLElement).style;
    elevatedElRef.current = { el, prevZ: s.zIndex, prevPos: s.position };
    s.zIndex = '10000';
    // position must be non-static for z-index to apply
    if (!s.position || s.position === 'static') s.position = 'relative';
    return () => {
      if (elevatedElRef.current) {
        const { el: e, prevZ, prevPos } = elevatedElRef.current;
        (e as HTMLElement).style.zIndex = prevZ;
        (e as HTMLElement).style.position = prevPos;
        elevatedElRef.current = null;
      }
    };
  }, [step]);

  useEffect(() => {
    setActionDone(false);
    // Fire a custom event so any page component can react (e.g. BookReader opens sidebar)
    if (step) {
      window.dispatchEvent(new CustomEvent('bf-tutorial-step', { detail: step }));
    }
    // Notify host so it can open sidebar / prepare UI before we measure
    if (step && onBeforeStep) onBeforeStep(step);
    // Navigate to a different page if the step requires it.
    // Always navigate when stepIdx===0 (first step of a chapter) so switching chapters
    // reliably loads the correct demo book chapter even if the path looks the same.
    if (step?.navigateTo && (location.pathname !== step.navigateTo || stepIdx === 0)) {
      navigate(step.navigateTo);
      // Wait longer for page transition + render
      const t1 = setTimeout(() => measureTarget(), 800);
      const t2 = setTimeout(() => measureTarget(), 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    // Initial measure — delay to let host state changes propagate to DOM
    const t1 = setTimeout(() => measureTarget(), 200);
    // Retry after sidebar/animation completes (~300ms CSS transition)
    const t2 = setTimeout(() => measureTarget(), 500);
    // Final retry for slow mobile devices
    const t3 = setTimeout(() => measureTarget(), 1000);
    window.addEventListener('resize', remeasureRect);
    window.addEventListener('scroll', remeasureRect, { passive: true });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', remeasureRect);
      window.removeEventListener('scroll', remeasureRect);
    };
  }, [step, onBeforeStep, measureTarget, remeasureRect, navigate, location.pathname]);

  // ── Action listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!step?.action || step.action.type === 'none') { setActionDone(true); return; }

    const el = step.target ? document.querySelector(step.target) : null;

    if (step.action.type === 'click' && el) {
      const handler = () => setActionDone(true);
      el.addEventListener('click', handler);
      cleanupRef.current = () => el.removeEventListener('click', handler);
    } else if (step.action.type === 'input' && el) {
      const handler = (e: Event) => {
        const val = (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value ?? '';
        if (val.trim()) setActionDone(true);
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
      cleanupRef.current = () => {
        el.removeEventListener('input', handler);
        el.removeEventListener('change', handler);
      };
    } else if (step.action.type === 'scroll') {
      const handler = () => setActionDone(true);
      window.addEventListener('scroll', handler, { once: true });
      cleanupRef.current = () => window.removeEventListener('scroll', handler);
    } else {
      // target not found or unsupported type — allow advance
      setActionDone(true);
    }

    return () => { if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; } };
  }, [step]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const canAdvance = true;
  const isLast = chapterIdx === chapters.length - 1 && stepIdx === (chapter?.steps.length ?? 1) - 1;

  function advance() {
    if (!canAdvance) return;
    const nextStep = stepIdx + 1;
    if (nextStep < chapter.steps.length) {
      setStepIdx(nextStep);
      saveProgress(bookId, chapterIdx, nextStep);
    } else {
      const nextChapter = chapterIdx + 1;
      if (nextChapter < chapters.length) {
        setChapterIdx(nextChapter);
        setStepIdx(0);
        saveProgress(bookId, nextChapter, 0);
      } else {
        // Tutorial complete
        saveProgress(bookId, 0, 0);
        onClose();
      }
    }
  }

  function back() {
    if (stepIdx > 0) {
      setStepIdx(stepIdx - 1);
      saveProgress(bookId, chapterIdx, stepIdx - 1);
    } else if (chapterIdx > 0) {
      const prevChapter = chapterIdx - 1;
      const prevStep = chapters[prevChapter].steps.length - 1;
      setChapterIdx(prevChapter);
      setStepIdx(prevStep);
      saveProgress(bookId, prevChapter, prevStep);
    }
  }

  function goToChapter(ci: number) {
    setChapterIdx(ci);
    setStepIdx(0);
    saveProgress(bookId, ci, 0);
  }

  function startFromChapter(ci: number) {
    setChapterIdx(ci);
    setStepIdx(0);
    saveProgress(bookId, ci, 0);
    setShowWelcome(false);
  }

  // ── Welcome screen ───────────────────────────────────────────────────────────
  if (showWelcome) {
    const chapterIcons = ['🧭', '🏠', '✏️', '🎨', '🚀'];
    return (
      <>
        {/* Full-screen dim */}
        <div className="fixed inset-0 z-[9998] bg-black/70" />

        {/* Welcome card */}
        <div className={`fixed z-[10002] pointer-events-auto ${
          mobile
            ? 'inset-x-0 bottom-0 rounded-t-2xl max-h-[92vh] overflow-y-auto'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-2xl'
        } bg-white dark:bg-gray-900 shadow-2xl`}>

          {/* Mobile drag handle */}
          {mobile && (
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
          )}

          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 text-center border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950 mb-4">
              <GraduationCap className="h-8 w-8 text-blue-500" />
            </div>

            <h1 className={`font-extrabold text-gray-900 dark:text-white tracking-tight ${mobile ? 'text-2xl' : 'text-3xl'}`}>
              Bookflow Tutorial
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
              This interactive tutorial walks you through everything you need to know — from reading your first book to publishing your own.
            </p>

            {/* Stats row */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{chapters.length}</p>
                <p className="text-xs text-gray-400">Chapters</p>
              </div>
              <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{chapters.reduce((n, c) => n + c.steps.length, 0)}</p>
                <p className="text-xs text-gray-400">Steps</p>
              </div>
              <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">~5</p>
                <p className="text-xs text-gray-400">Minutes</p>
              </div>
            </div>
          </div>

          {/* Chapter list — TOC to jump anywhere */}
          <div className="px-6 py-4">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
              What you'll learn
            </p>
            <div className="space-y-2">
              {chapters.map((ch, ci) => (
                <button
                  key={ci}
                  onClick={() => startFromChapter(ci)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-200 dark:hover:border-blue-800 border border-transparent transition-all group text-left"
                >
                  {/* Chapter number / icon */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-lg shadow-sm group-hover:border-blue-300 dark:group-hover:border-blue-600 transition-colors">
                    {chapterIcons[ci] ?? <BookOpen className="h-4 w-4 text-gray-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {ci + 1}. {ch.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ch.description ?? (
                        <>
                          {ch.steps.length} step{ch.steps.length !== 1 ? 's' : ''}
                          {' · '}
                          {ch.steps.map(s => s.title).slice(0, 2).join(', ')}
                          {ch.steps.length > 2 ? '…' : ''}
                        </>
                      )}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className={`flex items-center gap-3 px-6 pb-6 ${isResuming ? 'justify-between' : 'justify-end'}`}>
            {isResuming && (
              <button
                onClick={() => setShowWelcome(false)}
                className="text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
              >
                Resume where I left off →
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => startFromChapter(0)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <PlayCircle className="h-4 w-4" />
                Start Tutorial
              </button>
            </div>
          </div>

          {mobile && <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }} />}
        </div>
      </>
    );
  }

  if (!step) return null;

  const tooltipStyle = computeTooltipPos(targetRect, step.placement);
  const spotPad = 8;

  return (
    <>
      {/* ── Spotlight overlay ───────────────────────────────────────────────── */}
      {targetRect ? (() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const sx = targetRect.left - spotPad;
        const sy = targetRect.top - spotPad;
        const sw = targetRect.width + spotPad * 2;
        const sh = targetRect.height + spotPad * 2;
        const dim = 'rgba(0,0,0,0.55)';
        // On mobile the bottom sheet covers ~75vh — only show top rects above the sheet
        const dimBottom = mobile ? Math.max(0, vh * 0.25) : Math.max(0, vh - sy - sh);
        return (
          <>
            {/* 4 rects around the cutout */}
            <div className="fixed z-[9998] pointer-events-none" style={{ top: 0, left: 0, width: vw, height: Math.max(0, sy), background: dim }} />
            <div className="fixed z-[9998] pointer-events-none" style={{ top: sy, left: 0, width: Math.max(0, sx), height: sh, background: dim }} />
            <div className="fixed z-[9998] pointer-events-none" style={{ top: sy, left: sx + sw, width: Math.max(0, vw - sx - sw), height: sh, background: dim }} />
            <div className="fixed z-[9998] pointer-events-none" style={{ top: sy + sh, left: 0, width: vw, height: dimBottom, background: dim }} />
            {/* Blue highlight ring over the cutout */}
            <div className="fixed z-[10001] pointer-events-none rounded-lg" style={{ top: sy, left: sx, width: sw, height: sh, outline: '2px solid #3b82f6', outlineOffset: '0px' }} />
          </>
        );
      })() : (
        /* Full dimmed backdrop when no target */
        <div className="fixed inset-0 z-[9998] bg-black/55 pointer-events-none" />
      )}

      {/* ── Tooltip card ────────────────────────────────────────────────────── */}
      <div
        ref={tooltipRef}
        className={`fixed z-[10002] bg-white dark:bg-gray-900 shadow-2xl border border-blue-200 dark:border-blue-800 pointer-events-auto ${
          mobile
            ? 'rounded-t-2xl w-full max-h-[75vh] overflow-y-auto'
            : 'rounded-xl'
        }`}
        style={(() => {
          if (mobile) return tooltipStyle;
          if (!dragOffset) return { ...tooltipStyle, width: TOOLTIP_W };
          // Resolve percentage/string values to pixels so drag math works
          const baseTop = typeof tooltipStyle.top === 'number'
            ? tooltipStyle.top
            : window.innerHeight / 2 - TOOLTIP_H_EST / 2;
          const baseLeft = typeof tooltipStyle.left === 'number'
            ? tooltipStyle.left
            : window.innerWidth / 2 - TOOLTIP_W / 2;
          return {
            position: 'fixed' as const,
            width: TOOLTIP_W,
            top: baseTop + dragOffset.y,
            left: baseLeft + dragOffset.x,
            transform: 'none',
          };
        })()}
      >
        {/* Mobile drag handle (decorative) */}
        {mobile && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        {/* Desktop drag handle — grab bar at very top */}
        {!mobile && (
          <div
            onMouseDown={onDragStart}
            className="flex items-center justify-center h-5 cursor-grab active:cursor-grabbing rounded-t-xl bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 select-none"
            title="Drag to move"
          >
            <div className="w-8 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        {/* Top bar: Tutorial label + close */}
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-widest">Tutorial</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 -mr-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chapter title — big section heading */}
        <div className="px-4 pt-2 pb-1 border-b border-gray-100 dark:border-gray-800">
          <h2 className={`font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight ${mobile ? 'text-2xl' : 'text-xl'}`}>
            {chapter.title}
          </h2>
        </div>

        {/* Chapter tabs — horizontally scrollable single row */}
        <div ref={tabsRowRef} className="flex gap-1.5 px-4 py-2 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
          {chapters.map((ch, ci) => (
            <button
              key={ci}
              ref={ci === chapterIdx ? activePillRef : undefined}
              onClick={() => goToChapter(ci)}
              className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full transition-colors ${
                ci === chapterIdx
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {ci + 1}. {ch.title}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800 pt-3">
          <h3 className={`font-bold text-gray-900 dark:text-white mb-2 leading-snug ${mobile ? 'text-lg' : 'text-base'}`}>{step.title}</h3>
          <div className={`text-gray-600 dark:text-gray-300 leading-relaxed ${mobile ? 'text-base' : 'text-sm'}`}>{step.description}</div>

          {/* Action instruction */}
          {step.action && step.action.type !== 'none' && (
            <div className={`mt-3 flex items-start gap-2 p-2.5 rounded-lg ${mobile ? 'text-sm' : 'text-xs'} ${
              actionDone
                ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
            }`}>
              {actionDone
                ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                : <span className="shrink-0 mt-0.5">👆</span>
              }
              <span>{actionDone ? 'Done! You can continue.' : step.action.instruction}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {chapter.steps.map((_, si) => (
              <span
                key={si}
                className={`block rounded-full transition-all ${
                  si === stepIdx
                    ? 'w-5 h-2.5 bg-blue-500'
                    : si < stepIdx
                    ? 'w-2.5 h-2.5 bg-blue-300'
                    : 'w-2.5 h-2.5 bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>

          <span className="text-xs text-gray-400">{globalStep + 1} / {totalSteps}</span>

          <div className="flex items-center gap-2">
            <button
              onClick={globalStep === 0 ? () => setShowWelcome(true) : back}
              title={globalStep === 0 ? 'Back to table of contents' : 'Previous step'}
              className={`rounded-lg transition-colors ${mobile ? 'p-2' : 'p-1.5'} ${
                globalStep === 0
                  ? 'text-blue-400 hover:text-blue-600 dark:hover:text-blue-300'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              <ChevronLeft className={mobile ? 'h-5 w-5' : 'h-4 w-4'} />
            </button>
            <button
              onClick={advance}
              disabled={!canAdvance}
              className={`flex items-center gap-1.5 rounded-lg font-medium transition-colors ${mobile ? 'px-5 py-2.5 text-base' : 'px-3 py-1.5 text-sm'} ${
                canAdvance
                  ? isLast
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLast ? (
                <><CheckCircle className={mobile ? 'h-5 w-5' : 'h-3.5 w-3.5'} /> Finish</>
              ) : (
                <>Next <ChevronRight className={mobile ? 'h-5 w-5' : 'h-3.5 w-3.5'} /></>
              )}
            </button>
          </div>
        </div>

        {/* Safe area spacer for iOS home indicator */}
        {mobile && <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }} />}
      </div>
    </>
  );
}
