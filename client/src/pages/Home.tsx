import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Users, Sparkles, Star } from 'lucide-react';
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
      setBooks(response.data || []);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 to-primary-800 text-white overflow-hidden min-h-[520px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Interactive Books, Engaged Readers
            </h1>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Create multi-chapter books with embedded questions, polls, highlights, notes, and media.
              Let your readers engage deeply with your content.
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
        </div>

        {/* Spiral book carousel */}
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

  // React state only for the title display (cheap — only changes on hover)
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null);

  // Track drag distance to distinguish click vs drag
  const dragDistRef = useRef(0);

  const getEllipse = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { rx: 400, ry: 110, cx: 0, cy: 0 };
    const rect = el.getBoundingClientRect();
    return {
      rx: rect.width * 0.42,
      ry: rect.height * 0.28,
      cx: rect.width / 2,
      cy: rect.height * 0.48,
    };
  }, []);

  // rAF loop
  useEffect(() => {
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      // Pause auto-rotation while hovering; dampen drag residual
      const paused = hoveredIndexRef.current !== null;
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

      order.forEach(({ i, z }) => {
        const btn = bookRefs.current[i];
        if (!btn) return;
        const theta = angleRef.current + (i / count) * Math.PI * 2;
        const x = cx + rx * Math.cos(theta) - BOOK_W / 2;
        const y = cy + ry * Math.sin(theta) - BOOK_H / 2;
        const isHovered = hoveredIndexRef.current === i;
        // Depth scale: far=0.5, near=1.0; hovered gets a pop-up bonus
        const depthScale = 0.5 + 0.5 * ((z + 1) / 2);
        const scale = isHovered ? depthScale * 1.35 : depthScale;
        const opacity = isHovered ? 1 : (0.3 + 0.7 * ((z + 1) / 2));
        const zIndex = isHovered ? 150 : Math.round((z + 1) * 50);
        const tilt = isHovered ? 0 : Math.cos(theta) * 8;

        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)}) rotateY(${tilt.toFixed(1)}deg)`;
        btn.style.opacity = opacity.toFixed(3);
        btn.style.zIndex = String(zIndex);
        btn.style.filter = isHovered ? 'drop-shadow(0 0 18px rgba(255,255,255,0.5))' : '';
        btn.style.transition = isHovered
          ? 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s, filter 0.2s'
          : 'none';
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
    draggingRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none"
      style={{ cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Left/right fade masks */}
      <div className="absolute inset-y-0 left-0 w-24 z-[200] pointer-events-none"
        style={{ background: 'linear-gradient(to right, rgba(30,58,138,0.92), transparent)' }} />
      <div className="absolute inset-y-0 right-0 w-24 z-[200] pointer-events-none"
        style={{ background: 'linear-gradient(to left, rgba(30,58,138,0.92), transparent)' }} />

      {/* Hovered book title — centred below the orbit */}
      <div className="absolute bottom-8 left-0 right-0 z-[202] pointer-events-none flex flex-col items-center gap-1">
        <p
          className="text-white font-semibold text-xl text-center px-8 drop-shadow-lg transition-opacity duration-200"
          style={{ opacity: hoveredTitle ? 1 : 0, minHeight: '1.75rem' }}
        >
          {hoveredTitle ?? ''}
        </p>
        <p
          className="text-white/50 text-xs tracking-widest uppercase transition-opacity duration-200"
          style={{ opacity: hoveredTitle ? 0 : 1 }}
        >
          drag to spin · click to read
        </p>
      </div>

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
          }}
          onMouseLeave={() => {
            hoveredIndexRef.current = null;
            setHoveredTitle(null);
          }}
          onClick={() => {
            if (dragDistRef.current < 8) navigate(`/book/${book.id}`);
          }}
        >
          <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/20">
            {book.cover_image_url ? (
              <img
                src={book.cover_image_url}
                alt={book.title}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-300 to-primary-500
                flex items-center justify-center p-3">
                <span className="text-white text-xs font-semibold text-center leading-tight line-clamp-4">
                  {book.title}
                </span>
              </div>
            )}
          </div>
        </button>
      ))}
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
