import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Star, PlusCircle, PenLine, FileText, MessageCircle, Highlighter, BookMarked, GraduationCap, Crown, Share2, Flame, Users, Sparkles } from 'lucide-react';
import { HelpCircle } from 'lucide-react';
import api from '../lib/api';
import type { Book } from '../types';

// ─── Carousel config (written by AdminPage, read here) ───────────────────────
export const CAROUSEL_SETTINGS_KEY = 'bookflow_carousel_settings';
export interface CarouselSettings {
  secondsPerRev: number; // 4–30
  maxBooks: number;      // 4–20
}
export const CAROUSEL_DEFAULTS: CarouselSettings = { secondsPerRev: 10, maxBooks: 12 };

export function loadCarouselSettings(): CarouselSettings {
  try {
    const raw = localStorage.getItem(CAROUSEL_SETTINGS_KEY);
    if (!raw) return CAROUSEL_DEFAULTS;
    return { ...CAROUSEL_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return CAROUSEL_DEFAULTS;
  }
}

const DEFAULT_TAGLINE = 'Authors, readers, book clubs, write: Read, Write, Publish, Chat, Audio, Video, Interactive books, Online Forms, questions and answers.';

export default function Home() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselSettings] = useState<CarouselSettings>(loadCarouselSettings);
  const [tagline, setTagline] = useState(DEFAULT_TAGLINE);
  const [, setSavedCount] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    loadBooks();
    api.getPublicSettings().then(s => { if (s.home_tagline) setTagline(s.home_tagline); }).catch(() => {});
    if (user) api.getSavedBooksCount().then(r => setSavedCount(r.count)).catch(() => {});
  }, [user]);

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleSaveBook(book: Book) {
    if (!user) { showToast('Sign in to save books', 'err'); return; }
    try {
      await api.saveBook(book.id);
      setSavedCount(c => c + 1);
      window.dispatchEvent(new CustomEvent('bf-book-saved'));
      showToast(`"${book.title}" added to My Books`);
    } catch {
      showToast('Already in My Books', 'err');
    }
  }

  async function loadBooks() {
    try {
      const response = await api.getBooks({ visibility: 'public', status: 'published' });
      // Only keep books that have a cover image (carousel only shows covers)
      setBooks((response.data || []).filter((b: Book) => !!b.cover_image_url));
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="text-white overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(147,51,234,0.55) 0%, rgba(107,33,168,0.70) 100%)' }}>
        {/* Text block — sits above carousel, never overlapped */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-8 pb-0 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-2 sm:mb-4">
            Interactive Books, Engaged Readers
          </h1>
          <p className="text-base sm:text-xl text-primary-100 mb-3 sm:mb-5 max-w-2xl mx-auto">
            {tagline}
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-accent hover:bg-primary-50 px-6 py-3 rounded-lg font-semibold"
            >
              Start Writing
            </Link>
            <a
              href="#books"
              className="border-2 border-white text-white hover:bg-white/10 px-6 py-3 rounded-lg font-semibold"
            >
              Browse Books
            </a>
          </div>
        </div>

        {/* Carousel block — below text, never overlaps it */}
        {!loading && books.length > 0 && (
          <SpiralCarousel books={books} settings={carouselSettings} onSaveBook={handleSaveBook} />
        )}

        {/* Toast notification */}
        {toast && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white transition-all duration-300 ${toast.type === 'ok' ? 'bg-emerald-600' : 'bg-red-500'}`}>
            {toast.msg}
          </div>
        )}
      </section>

      {/* Role Promo Section */}
      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-4">Who Is This For?</h2>
          <p className="text-center text-muted mb-14 max-w-2xl mx-auto">
            Whether you write, read, lead, or teach — there's a place for you here.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-8">

            {/* Authors */}
            <RoleCard
              accent="from-purple-500 to-indigo-600"
              icon={<PenLine className="h-7 w-7 text-white" />}
              title="Authors"
              tagline="Create books that breathe."
              bullets={[
                { icon: <BookOpen className="h-4 w-4" />, text: 'Write multi-chapter books with a rich editor' },
                { icon: <HelpCircle className="h-4 w-4" />, text: 'Embed questions, polls, audio & video inline' },
                { icon: <FileText className="h-4 w-4" />, text: 'Publish as interactive books or export to PDF' },
                { icon: <Share2 className="h-4 w-4" />, text: 'Share publicly or with select readers & clubs' },
                { icon: <Sparkles className="h-4 w-4" />, text: 'Self-publish and reach your audience directly' },
              ]}
              cta={{ label: 'Start Writing', to: '/dashboard' }}
              loggedIn={!!user}
            />

            {/* Readers */}
            <RoleCard
              accent="from-emerald-500 to-teal-600"
              icon={<BookMarked className="h-7 w-7 text-white" />}
              title="Readers"
              tagline="Read. React. Connect."
              bullets={[
                { icon: <Highlighter className="h-4 w-4" />, text: 'Highlight passages and add personal notes' },
                { icon: <MessageCircle className="h-4 w-4" />, text: 'Chat with fellow readers and spark discussions' },
                { icon: <HelpCircle className="h-4 w-4" />, text: 'Answer embedded questions as you read' },
                { icon: <Users className="h-4 w-4" />, text: 'Join book clubs and read together' },
                { icon: <PenLine className="h-4 w-4" />, text: 'Dialogue directly with the author' },
              ]}
              cta={{ label: 'Browse Books', to: '/#books' }}
              loggedIn={!!user}
            />

            {/* Book Studies */}
            <RoleCard
              accent="from-amber-500 to-orange-600"
              icon={<GraduationCap className="h-7 w-7 text-white" />}
              title="Book Studies"
              tagline="Learn together, grow together."
              bullets={[
                { icon: <BookOpen className="h-4 w-4" />, text: 'Study books chapter by chapter as a group' },
                { icon: <Share2 className="h-4 w-4" />, text: 'Share your reading progress with others' },
                { icon: <HelpCircle className="h-4 w-4" />, text: 'Work through study questions together' },
                { icon: <MessageCircle className="h-4 w-4" />, text: 'Discuss insights and reflections in real time' },
                { icon: <GraduationCap className="h-4 w-4" />, text: 'Track comprehension with built-in quizzes' },
              ]}
              cta={{ label: 'Join a Study', to: '/clubs' }}
              loggedIn={!!user}
            />

            {/* Book Club Leaders */}
            <RoleCard
              accent="from-rose-500 to-pink-600"
              icon={<Crown className="h-7 w-7 text-white" />}
              title="Book Club Leaders"
              tagline="Lead your community."
              bullets={[
                { icon: <Users className="h-4 w-4" />, text: 'Create and manage your own book clubs' },
                { icon: <BookMarked className="h-4 w-4" />, text: 'Assign books and set reading schedules' },
                { icon: <MessageCircle className="h-4 w-4" />, text: 'Facilitate group discussions and polls' },
                { icon: <HelpCircle className="h-4 w-4" />, text: 'Post study questions for your members' },
                { icon: <Share2 className="h-4 w-4" />, text: 'Invite members with a shareable club link' },
              ]}
              cta={{ label: 'Start a Club', to: '/clubs' }}
              loggedIn={!!user}
            />
          </div>

          {/* Bring Old Books Alive banner */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-800 to-slate-900 p-8 md:p-12 flex flex-col md:flex-row items-center gap-6 mt-4">
            <div className="flex-shrink-0 p-4 rounded-full bg-white/10">
              <Flame className="h-10 w-10 text-amber-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-white mb-2">Bring Old Books Alive</h3>
              <p className="text-slate-300 max-w-xl">
                Take any classic text, public domain book, or legacy manuscript and transform it into a living, interactive experience — with embedded questions, audio narration, polls, and reader discussion built right in.
              </p>
            </div>
            <Link
              to="/register"
              className="flex-shrink-0 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* Published Books Section */}
      <section id="books" className="py-20 bg-surface-hover">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            Explore Published Books
          </h2>

          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center text-muted">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No published books yet. Be the first to create one!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Spiral Carousel ─────────────────────────────────────────────────────────
//
// Books orbit an ellipse centred in the hero section.
// Auto-rotates at 1 full revolution per 10 s; drag/swipe scrubs the angle.
// Books closer to the viewer (bottom of ellipse) are larger and rendered last (on top).

// Book size scales with screen — computed dynamically in getEllipse
// Base: 10% of container width, clamped 60px–130px; height = width * 4/3
function getBookSize(containerWidth: number, bookCount: number) {
  // Arc length per book = circumference / count; book width = ~60% of that gap
  const approxCircumference = 2 * Math.PI * containerWidth * 0.42;
  const gapPerBook = approxCircumference / bookCount;
  const w = Math.min(Math.max(gapPerBook * 0.55, 55), 125);
  return { w: Math.round(w), h: Math.round(w * (4 / 3)) };
}

function SpiralCarousel({ books, settings, onSaveBook }: { books: Book[]; settings: CarouselSettings; onSaveBook: (book: Book) => void }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const maxBooks = settings.maxBooks;

  // Pad to at least 6 items so the orbit looks full
  const items = books.length < 6
    ? Array.from({ length: Math.ceil(6 / books.length) }, () => books).flat().slice(0, maxBooks)
    : books.slice(0, maxBooks);

  const count = items.length;

  // Shared mutable state (not React state — updated every rAF)
  const angleRef = useRef(0);
  const velRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const hoveredIndexRef = useRef<number | null>(null); // which book is hovered

  // Book button refs for imperative DOM updates
  const bookRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Inner div refs — scale is applied here via CSS transition so it animates smoothly
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);

  // React state only for the title display + hovered index (cheap — only changes on hover)
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // "Nearest to front-center" book — updated every rAF tick, drives always-on title display
  const [featuredBook, setFeaturedBook] = useState<{ title: string; author: string } | null>(null);
  const featuredIndexRef = useRef<number>(-1);
  const bookSizeRef = useRef<{ w: number; h: number }>({ w: 100, h: 133 });
  const [bookSize, setBookSize] = useState<{ w: number; h: number }>({ w: 100, h: 133 });

  // Track drag distance to distinguish click vs drag
  const dragDistRef = useRef(0);
  const wasClickRef = useRef(true); // true if pointer-up had small drag distance

  const getEllipse = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { rx: 400, ry: 90, cx: 0, cy: 0, bw: 100, bh: 133 };
    const rect = el.getBoundingClientRect();
    const { w: bw, h: bh } = getBookSize(rect.width, count);
    return {
      rx: rect.width * 0.42,
      ry: rect.height * 0.20,
      cx: rect.width / 2,
      cy: rect.height * 0.33,
      bw,
      bh,
    };
  }, [count]);

  // rAF loop
  useEffect(() => {
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      // Pause auto-rotation only while hovering
      const paused = hoveredIndexRef.current !== null;
      if (!draggingRef.current && !paused) {
        const autoSpeed = (Math.PI * 2) / settingsRef.current.secondsPerRev;
        angleRef.current += autoSpeed * dt + velRef.current;
      }
      velRef.current *= 0.88;

      const { rx, ry, cx, cy, bw, bh } = getEllipse();
      // Sync book size to state only when it changes (triggers JSX re-render for button dimensions)
      if (bw !== bookSizeRef.current.w || bh !== bookSizeRef.current.h) {
        bookSizeRef.current = { w: bw, h: bh };
        setBookSize({ w: bw, h: bh });
      }

      // Sort by depth for correct stacking
      const order = items
        .map((_, i) => {
          const theta = angleRef.current + (i / count) * Math.PI * 2;
          return { i, z: Math.sin(theta) };
        })
        .sort((a, b) => a.z - b.z);

      // Find the book nearest to the front-center (sin θ closest to +1, i.e. θ ≈ π/2)
      let bestScore = -Infinity;
      let bestIdx = 0;
      order.forEach(({ i, z }) => {
        const theta = angleRef.current + (i / count) * Math.PI * 2;
        // Score: highest sin (frontmost) + small bonus for being near horizontal center
        const score = z - Math.abs(Math.cos(theta)) * 0.3;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      });
      if (bestIdx !== featuredIndexRef.current) {
        featuredIndexRef.current = bestIdx;
        const fb = items[bestIdx];
        setFeaturedBook({ title: fb.title, author: fb.author?.display_name || 'Unknown Author' });
      }

      order.forEach(({ i, z }) => {
        const btn = bookRefs.current[i];
        const inner = innerRefs.current[i];
        if (!btn || !inner) return;
        const theta = angleRef.current + (i / count) * Math.PI * 2;
        const x = cx + rx * Math.cos(theta) - bw / 2;
        const y = cy + ry * Math.sin(theta) - bh / 2;
        const isHovered = hoveredIndexRef.current === i;
        const isFeatured = i === featuredIndexRef.current && hoveredIndexRef.current === null;

        // Depth scale applied on button (position layer) — no transition so orbit is smooth
        const depthScale = 0.5 + 0.5 * ((z + 1) / 2);
        const tilt = isHovered ? 0 : Math.cos(theta) * 8;

        // Front books that pass through the title zone get a transparency cap
        const isFront = z > 0.5;
        const baseOpacity = isHovered ? 1 : (0.3 + 0.7 * ((z + 1) / 2));
        const opacity = (!isHovered && isFront) ? Math.min(baseOpacity, 0.75) : baseOpacity;
        const zIndex = isHovered ? 150 : Math.round((z + 1) * 50);

        // Position + depth on the outer button (no transition — runs every rAF)
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${depthScale.toFixed(3)}) rotateY(${tilt.toFixed(1)}deg)`;
        btn.style.opacity = isFeatured ? '1' : opacity.toFixed(3);
        btn.style.zIndex = isHovered ? '150' : String(zIndex);
        btn.style.transition = 'none';

        // Scale multiplier on inner div — CSS transition handles smooth grow/shrink
        const innerScale = isHovered ? 1.4 : isFeatured ? 1.18 : 1.0;
        inner.style.transform = `scale(${innerScale})`;
        inner.style.transition = isHovered
          ? 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'   // ease-out, smooth
          : 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';   // same ease-out for featured

        // Glow + outline on button (CSS transition handles fade)
        btn.style.filter = isHovered
          ? 'drop-shadow(0 0 14px rgba(255,255,255,0.5))'
          : isFeatured
            ? 'drop-shadow(0 0 6px rgba(255,255,255,0.5))'
            : '';
        btn.style.outline = isFeatured ? '3px solid rgba(255,255,255,0.9)' : '3px solid rgba(255,255,255,0)';
        btn.style.outlineOffset = '3px';
        btn.style.borderRadius = '0.75rem';
        // Allow outline/filter to animate — but not transform (that's the rAF position)
        btn.style.transition = 'outline-color 0.4s ease, filter 0.4s ease, opacity 0.35s ease';
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [items, count, getEllipse]);

  // Pointer events for drag scrubbing
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    dragDistRef.current = 0;
    wasClickRef.current = true;
    lastXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    velRef.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    dragDistRef.current += Math.abs(dx);
    const { rx } = getEllipse();
    const dAngle = (dx / (rx * 2)) * Math.PI * 2;
    angleRef.current += dAngle;
    const now = performance.now();
    const dt = (now - lastTimeRef.current) / 1000;
    if (dt > 0) velRef.current = dAngle / dt;
    lastXRef.current = e.clientX;
    lastTimeRef.current = now;
  }, [getEllipse]);

  const onPointerUp = useCallback(() => {
    wasClickRef.current = dragDistRef.current < 8;
    draggingRef.current = false;
  }, []);

  return (
    <div className="w-full">
      {/* Orbit stage — title overlay is inside so nothing adds space below */}
      <div
        ref={containerRef}
        className="relative w-full select-none"
        style={{ height: 'clamp(300px, 56vw, 440px)', cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {items.map((book, i) => (
          <button
            key={`${book.id}-${i}`}
            ref={el => { bookRefs.current[i] = el; }}
            className="absolute top-0 left-0 focus:outline-none"
            style={{
              width: bookSize.w,
              height: bookSize.h,
              willChange: 'transform, opacity',
              transformOrigin: 'center center',
            }}
            onMouseEnter={() => {
              hoveredIndexRef.current = i;
              setHoveredTitle(book.title);
              setHoveredIndex(i);
            }}
            onMouseLeave={() => {
              hoveredIndexRef.current = null;
              setHoveredTitle(null);
              setHoveredIndex(null);
            }}
            onClick={() => {
              if (wasClickRef.current) onSaveBook(book);
            }}
          >
            <div
              ref={el => { innerRefs.current[i] = el; }}
              className="w-full h-full rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/20 relative"
              style={{ transformOrigin: 'center center' }}
            >
              <img
                src={book.cover_image_url!}
                alt={book.title}
                className="w-full h-full object-cover"
                draggable={false}
              />
              {/* Read overlay — navigates to book */}
              {hoveredIndex === i && (
                <button
                  type="button"
                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1 px-1 w-full"
                  style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(2px)' }}
                  onPointerDown={e => { e.preventDefault(); e.stopPropagation(); }}
                  onPointerUp={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); navigate(`/book/${book.id}`); }}
                >
                  <PlusCircle className="h-3.5 w-3.5 text-white shrink-0" />
                  <span className="text-white text-xs font-bold leading-tight">Read</span>
                </button>
              )}
            </div>
          </button>
        ))}

        {/* Book title/author — absolute overlay at bottom of orbit stage */}
        <div className="absolute bottom-6 inset-x-0 flex flex-col items-center pointer-events-none">
          <p className="text-white font-bold text-2xl text-center px-8 drop-shadow-lg transition-all duration-300">
            {hoveredTitle ?? featuredBook?.title ?? '\u00A0'}
          </p>
          <p className="text-primary-200 text-sm text-center px-8 drop-shadow transition-all duration-300 mt-0.5"
            style={{ opacity: (hoveredTitle || featuredBook) ? 0.85 : 0 }}>
            {hoveredIndex !== null
              ? (items[hoveredIndex]?.author?.display_name ?? 'Unknown Author')
              : (featuredBook?.author ?? '\u00A0')}
          </p>
        </div>
      </div>
    </div>
  );
}


// ─── Role Card ────────────────────────────────────────────────────────────────

function RoleCard({
  accent, icon, title, tagline, bullets, cta, loggedIn,
}: {
  accent: string;
  icon: React.ReactNode;
  title: string;
  tagline: string;
  bullets: { icon: React.ReactNode; text: string }[];
  cta: { label: string; to: string };
  loggedIn: boolean;
}) {
  return (
    <div className="bg-surface rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Header strip */}
      <div className={`bg-gradient-to-r ${accent} px-6 py-5 flex items-center gap-4`}>
        <div className="p-2.5 rounded-xl bg-white/20">{icon}</div>
        <div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <p className="text-white/80 text-sm">{tagline}</p>
        </div>
      </div>
      {/* Bullets */}
      <ul className="flex-1 px-6 py-5 space-y-3">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-theme">
            <span className="mt-0.5 text-muted shrink-0">{b.icon}</span>
            {b.text}
          </li>
        ))}
      </ul>
      {/* CTA */}
      <div className="px-6 pb-6">
        <Link
          to={loggedIn ? cta.to : '/login'}
          className={`block text-center py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${accent} hover:opacity-90 transition-opacity`}
        >
          {cta.label}
        </Link>
      </div>
    </div>
  );
}

// ─── Book Card (grid) ─────────────────────────────────────────────────────────

function BookCard({ book }: { book: Book }) {
  return (
    <Link to={`/book/${book.id}`} className="block bg-surface rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-200 rounded-t-lg flex items-center justify-center">
        {book.cover_image_url ? (
          <img
            src={book.cover_image_url}
            alt={book.title}
            className="w-full h-full object-cover rounded-t-lg"
          />
        ) : (
          <BookOpen className="h-16 w-16 text-primary-400" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{book.title}</h3>
        {book.subtitle && (
          <p className="text-sm text-muted mb-2 line-clamp-1">{book.subtitle}</p>
        )}
        <p className="text-sm text-muted">
          by {book.author?.display_name || 'Unknown Author'}
        </p>
        {book.settings?.show_ratings !== false && book.rating_count! > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3, 4, 5].map(s => (
              <Star
                key={s}
                className={`h-3.5 w-3.5 ${s <= Math.round(book.rating_average!) ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-muted'}`}
              />
            ))}
            <span className="text-xs text-muted ml-0.5">
              {book.rating_average?.toFixed(1)} ({book.rating_count})
            </span>
          </div>
        )}
        {book.chapters && (
          <p className="text-xs text-muted mt-1">
            {book.chapters.length} chapters
          </p>
        )}
      </div>
    </Link>
  );
}
