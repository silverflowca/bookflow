import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Users, Sparkles, Star, PlusCircle } from 'lucide-react';
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

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselSettings] = useState<CarouselSettings>(loadCarouselSettings);

  useEffect(() => {
    loadBooks();
  }, []);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-16 pb-4 sm:pb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-3 sm:mb-6">
            Interactive Books, Engaged Readers
          </h1>
          <p className="text-base sm:text-xl text-primary-100 mb-4 sm:mb-8 max-w-2xl mx-auto">
            Authors, readers, book clubs, write: Read, Write, Publish, Chat, forms, Interactive books, audio, video, questions and answers.
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
          <SpiralCarousel books={books} settings={carouselSettings} />
        )}
      </section>

      {/* Features Section */}
      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to Create Interactive Books
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<HelpCircle className="h-8 w-8" />}
              title="Inline Questions"
              description="Embed questions and quizzes directly in your text at any position."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8" />}
              title="Polls & Discussions"
              description="Create polls to engage readers and spark discussions."
            />
            <FeatureCard
              icon={<Sparkles className="h-8 w-8" />}
              title="Rich Annotations"
              description="Add highlights, notes, and external links throughout your book."
            />
            <FeatureCard
              icon={<BookOpen className="h-8 w-8" />}
              title="Audio & Video"
              description="Link audio and video clips to specific paragraphs."
            />
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

const BOOK_W = 120;  // px width of each book card
const BOOK_H = 160;  // px height (3:4 ratio)

function SpiralCarousel({ books, settings }: { books: Book[]; settings: CarouselSettings }) {
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

  // Track drag distance to distinguish click vs drag
  const dragDistRef = useRef(0);
  const wasClickRef = useRef(true); // true if pointer-up had small drag distance
  const clickPausedRef = useRef(false); // true after a click, cleared by drag

  const getEllipse = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { rx: 400, ry: 90, cx: 0, cy: 0 };
    const rect = el.getBoundingClientRect();
    return {
      rx: rect.width * 0.42,
      ry: rect.height * 0.30,
      cx: rect.width / 2,
      cy: rect.height * 0.32,
    };
  }, []);

  // rAF loop
  useEffect(() => {
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      // Pause auto-rotation while hovering or after a click (until next drag)
      const paused = hoveredIndexRef.current !== null || clickPausedRef.current;
      if (!draggingRef.current && !paused) {
        const autoSpeed = (Math.PI * 2) / settingsRef.current.secondsPerRev;
        angleRef.current += autoSpeed * dt + velRef.current;
      }
      velRef.current *= 0.88;

      const { rx, ry, cx, cy } = getEllipse();

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
        const x = cx + rx * Math.cos(theta) - BOOK_W / 2;
        const y = cy + ry * Math.sin(theta) - BOOK_H / 2;
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
    // Drag resumes auto-rotation
    clickPausedRef.current = false;
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
    const isClick = dragDistRef.current < 8;
    wasClickRef.current = isClick;
    if (isClick) clickPausedRef.current = true; // click freezes scroll until next drag
    draggingRef.current = false;
  }, []);

  return (
    <div className="w-full pb-4 sm:pb-8">
      {/* Orbit stage — shorter on mobile so carousel + title fit on screen */}
      <div
        ref={containerRef}
        className="relative w-full select-none"
        style={{ height: 'clamp(220px, 45vw, 340px)', cursor: 'grab' }}
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
              width: BOOK_W,
              height: BOOK_H,
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
              if (wasClickRef.current) navigate(`/book/${book.id}`);
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
              {/* Add to My Books overlay — shown on hover */}
              {hoveredIndex === i && (
                <div
                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-2 px-1"
                  style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(2px)' }}
                  onClick={e => {
                    e.stopPropagation();
                    navigate(`/book/${book.id}`);
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5 text-white shrink-0" />
                  <span className="text-white text-[10px] font-semibold leading-tight whitespace-nowrap">
                    Add to My Books
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Book info display — always shows nearest-to-center book; hover overrides */}
      <div className="w-full flex flex-col items-center justify-center" style={{ minHeight: '3rem' }}>
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
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center p-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-accent mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted">{description}</p>
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
