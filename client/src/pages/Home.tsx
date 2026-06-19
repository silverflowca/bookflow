import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Star, PlusCircle, PenLine, FileText, MessageCircle, Highlighter, BookMarked, GraduationCap, Crown, Share2, Flame, Users, Sparkles, Mic, Video, BarChart2, CheckSquare, ListChecks, AlignLeft, Image, X, Play } from 'lucide-react';
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
      <section
        className="overflow-hidden relative pb-16"
        style={{ background: 'linear-gradient(160deg, #faf9ff 0%, #f3f0ff 40%, #eff6ff 70%, #fdf2f8 100%)' }}
      >
        {/* Subtle diagonal gradient wash — no blobs or circles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(99,102,241,0.04) 40%, rgba(236,72,153,0.04) 100%)',
          }} />
        </div>

        {/* Wavy bottom edge — matches the bg-surface section below */}
        <div className="pointer-events-none absolute bottom-0 inset-x-0" style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 72 }}>
            {/* Fill */}
            <path
              d="M0,50 C180,70 360,30 540,50 C720,70 900,30 1080,50 C1260,70 1380,40 1440,50 L1440,80 L0,80 Z"
              fill="var(--color-surface)"
            />
            {/* Stroke line following the wave */}
            <path
              d="M0,50 C180,70 360,30 540,50 C720,70 900,30 1080,50 C1260,70 1380,40 1440,50"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        {/* Text block — sits above carousel, never overlapped */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-0 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
            The Interactive Book Platform
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 sm:mb-5 leading-tight tracking-tight text-gray-900">
            Interactive Books,<br className="hidden sm:block" />{' '}
            <span style={{ background: 'linear-gradient(90deg, #7c3aed, #4f46e5, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Engaged Readers
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-500 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
            {tagline}
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-3 rounded-xl font-medium text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 24px rgba(124,58,237,0.30)' }}
            >
              Start Writing
            </Link>
            <a
              href="#books"
              className="px-8 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            >
              Browse Books
            </a>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium self-center text-gray-400 transition-colors duration-200 hover:text-gray-600"
            >
              Feature List ↓
            </button>
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
          <h2 className="text-sm text-center mb-3 text-muted uppercase tracking-widest">Who Is This For?</h2>
          <p className="text-center font-bold text-2xl mb-3 max-w-3xl mx-auto">
            BookFlow is for Authors, Writers, Readers, Teachers, Students, Group Leaders, Bible Study Groups, Recovery Teams and more.
          </p>
          <p className="text-center text-muted mb-14 max-w-2xl mx-auto">
            Whether you write, read, lead, or teach — there's a place for you here.
          </p>

          <div className="space-y-0 mb-8">

            {/* Row 1: Authors card (left) | Authors photo (right) */}
            <div className="grid md:grid-cols-2 gap-12 items-stretch px-4">
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
              <ExpandableImage
                src="/authorcreatebooks.png"
                alt="Author creating a book"
                caption="Authors: Write · Create · Audio · Video · Track · Progress · Questions · Answers · Share · Collaborate"
              />
            </div>

            {/* Divider 1 */}
            <div className="flex items-center gap-4 py-10 px-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
              <svg viewBox="0 0 60 20" className="w-16 h-5 text-purple-400/50 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 10 Q15 0 30 10 Q45 20 60 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
            </div>

            {/* Row 2: Readers photo (left) | Readers card (right) */}
            <div className="grid md:grid-cols-2 gap-12 items-stretch px-4">
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <img src="/scan_to_watch.png" alt="Readers" className="w-full h-full object-cover" />
              </div>
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
            </div>

            {/* Divider 2 */}
            <div className="flex items-center gap-4 py-10 px-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
              <svg viewBox="0 0 60 20" className="w-16 h-5 text-emerald-400/50 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 10 Q15 20 30 10 Q45 0 60 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
            </div>

            {/* Row 3: Book Studies card (left) | Students photo (right) */}
            <div className="grid md:grid-cols-2 gap-12 items-stretch px-4">
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
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <img src="/studentsstudy.png" alt="Students studying" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Divider 3 */}
            <div className="flex items-center gap-4 py-10 px-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
              <svg viewBox="0 0 60 20" className="w-16 h-5 text-amber-400/50 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 10 Q15 0 30 10 Q45 20 60 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-rose-400/40 to-transparent" />
            </div>

            {/* Row 4: Church photo (left) | Book Club Leaders card (right) */}
            <div className="grid md:grid-cols-2 gap-12 items-stretch px-4">
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <img src="/ChurchGroupBookRead.png" alt="Book club group" className="w-full h-full object-cover" />
              </div>
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
            <div className="grid grid-cols-2 gap-8">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Editor Features Section */}
      <EditorFeaturesSection />

      {/* QR Code Section */}
      <QrCodeSection />
    </div>
  );
}

// ─── Editor Features Section ──────────────────────────────────────────────────
const EDITOR_FEATURES = [
  {
    id: 'rich-text',
    icon: <AlignLeft className="h-5 w-5" />,
    color: 'from-violet-500 to-purple-600',
    badge: 'Editor',
    badgeColor: 'bg-violet-100 text-violet-700',
    title: 'Rich Text Editor',
    short: 'Bold, headings, lists, quotes — a full writing studio in your browser.',
    description: 'Write with the same power as a desktop word processor. Headings, bold, italic, bullet lists, numbered lists, block quotes, and more — all at your fingertips. Your work auto-saves every few seconds so you never lose a word.',
    demoLabel: 'See it in action',
  },
  {
    id: 'inline-questions',
    icon: <HelpCircle className="h-5 w-5" />,
    color: 'from-blue-500 to-cyan-500',
    badge: 'Interactive',
    badgeColor: 'bg-blue-100 text-blue-700',
    title: 'Reflection Questions',
    short: 'Drop a thought-provoking question anywhere in your chapter.',
    description: "Highlight any sentence and embed a free-response or multiple-choice question right beside it. Readers answer inline — no forms, no tabs — turning passive reading into active learning. You'll see every response in your author dashboard.",
    demoLabel: 'See it in action',
  },
  {
    id: 'polls',
    icon: <BarChart2 className="h-5 w-5" />,
    color: 'from-emerald-500 to-teal-500',
    badge: 'Interactive',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    title: 'Live Polls',
    short: 'Gauge your readers in real time with instant voting.',
    description: 'Insert a poll with 2–6 options anywhere in a chapter. Readers tap their answer and immediately see how other readers voted — creating a shared, live experience inside your book. Results update in real time.',
    demoLabel: 'See it in action',
  },
  {
    id: 'audio',
    icon: <Mic className="h-5 w-5" />,
    color: 'from-pink-500 to-rose-500',
    badge: 'Media',
    badgeColor: 'bg-pink-100 text-pink-700',
    title: 'Audio & Text-to-Speech',
    short: 'Let your book be heard — record or generate narration instantly.',
    description: "Embed your own audio recordings or activate AI text-to-speech and let BookFlow narrate your chapters aloud. Perfect for audiobook creators, accessibility-first publishing, and readers who learn better by listening.",
    demoLabel: 'See it in action',
  },
  {
    id: 'video',
    icon: <Video className="h-5 w-5" />,
    color: 'from-orange-500 to-amber-500',
    badge: 'Media',
    badgeColor: 'bg-orange-100 text-orange-700',
    title: 'Embedded Video',
    short: 'Bring your content to life with YouTube or Vimeo right inside the chapter.',
    description: "Paste any YouTube or Vimeo link and it embeds directly into the reading flow — no new tabs, no distractions. Use it for welcome messages, demonstrations, teaching moments, or testimonials that deepen reader engagement.",
    demoLabel: 'See it in action',
  },
  {
    id: 'images',
    icon: <Image className="h-5 w-5" />,
    color: 'from-indigo-500 to-blue-500',
    badge: 'Media',
    badgeColor: 'bg-indigo-100 text-indigo-700',
    title: 'Images & Covers',
    short: 'A picture is worth a thousand words — embed as many as you like.',
    description: 'Upload images directly into your chapters or set a stunning cover that draws readers in. Images are optimised automatically for fast loading on all screen sizes — desktop, tablet, and mobile.',
    demoLabel: 'See it in action',
  },
  {
    id: 'highlights',
    icon: <Highlighter className="h-5 w-5" />,
    color: 'from-yellow-400 to-orange-400',
    badge: 'Reader Tools',
    badgeColor: 'bg-yellow-100 text-yellow-700',
    title: 'Highlights & Notes',
    short: 'Readers mark what matters and leave notes like sticky tabs.',
    description: 'Readers select any passage to highlight it in their favourite colour and attach a personal note. All highlights are private by default, making every copy of your book uniquely theirs. Authors can choose to share their own highlights with all readers.',
    demoLabel: 'See it in action',
  },
  {
    id: 'progress',
    icon: <CheckSquare className="h-5 w-5" />,
    color: 'from-green-500 to-emerald-600',
    badge: 'Progress',
    badgeColor: 'bg-green-100 text-green-700',
    title: 'Progress Tracking',
    short: 'Watch your readers level up chapter by chapter.',
    description: "Enable progress tracking and every question answered, poll voted, and form filled advances the reader's progress bar. Authors and club leaders see completion stats across their whole audience — instant accountability.",
    demoLabel: 'See it in action',
  },
  {
    id: 'forms',
    icon: <ListChecks className="h-5 w-5" />,
    color: 'from-teal-500 to-cyan-600',
    badge: 'Interactive',
    badgeColor: 'bg-teal-100 text-teal-700',
    title: 'Inline Forms',
    short: 'Collect typed answers, checkboxes, dropdowns — all inside the book.',
    description: 'Drop text fields, text areas, dropdowns, multi-selects, radio buttons, and checkboxes right into your chapters. Use them for workbooks, study guides, sign-up flows, or reader surveys — without ever leaving the reading experience.',
    demoLabel: 'See it in action',
  },
  {
    id: 'clubs',
    icon: <Users className="h-5 w-5" />,
    color: 'from-rose-500 to-pink-600',
    badge: 'Community',
    badgeColor: 'bg-rose-100 text-rose-700',
    title: 'Book Clubs & Study Groups',
    short: 'Read together, grow together — one click to start a group.',
    description: "Create a club, add your book, and invite members with a single link. Club leaders can post study questions, track group progress, and manage membership. Perfect for churches, classrooms, recovery groups, and corporate teams.",
    demoLabel: 'See it in action',
  },
  {
    id: 'collaborate',
    icon: <Share2 className="h-5 w-5" />,
    color: 'from-purple-500 to-indigo-600',
    badge: 'Collaboration',
    badgeColor: 'bg-purple-100 text-purple-700',
    title: 'Co-Authors & Collaborators',
    short: 'Write with a team — assign roles and edit in real time.',
    description: 'Invite co-authors, editors, or reviewers to your book. Assign roles to control who can write, who can comment, and who can publish. Perfect for ministry teams, co-writing projects, and educational institutions.',
    demoLabel: 'See it in action',
  },
  {
    id: 'publish',
    icon: <FileText className="h-5 w-5" />,
    color: 'from-slate-600 to-slate-800',
    badge: 'Publishing',
    badgeColor: 'bg-slate-100 text-slate-700',
    title: 'Publish & Export',
    short: 'Go live with one click — or export to PDF anytime.',
    description: 'When your book is ready, flip it to Public and it appears in the BookFlow library immediately. Or export a clean PDF at any time for printing, emailing, or archiving. Your book, your choice.',
    demoLabel: 'See it in action',
  },
];

function EditorFeaturesSection() {
  const [active, setActive] = useState<typeof EDITOR_FEATURES[0] | null>(null);

  return (
    <section id="features" className="py-20 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <p className="text-sm text-center text-muted uppercase tracking-widest mb-3">What Can You Do?</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-3">
          Every Feature You Need to{' '}
          <span style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Publish Something Remarkable
          </span>
        </h2>
        <p className="text-center text-muted mb-12 max-w-2xl mx-auto">
          Click any feature to see a live demo of it working inside the real BookFlow editor.
        </p>

        {/* Feature grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {EDITOR_FEATURES.map((f) => (
            <button
              key={f.id}
              onClick={() => setActive(f)}
              className="group relative text-left rounded-2xl p-5 border transition-all duration-200 hover:scale-[1.03] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              style={{ background: 'var(--color-surface-hover, #f9fafb)', borderColor: 'var(--color-border, #e5e7eb)' }}
            >
              {/* Coloured icon circle */}
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} text-white mb-3 shadow-sm`}>
                {f.icon}
              </div>
              {/* Badge */}
              <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2 ${f.badgeColor}`}>
                {f.badge}
              </span>
              <h3 className="font-bold text-sm text-theme mb-1 leading-snug">{f.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{f.short}</p>
              {/* Play hint */}
              <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold bg-gradient-to-r ${f.color} bg-clip-text`}
                style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <Play className="h-3 w-3 shrink-0" style={{ color: 'currentColor', WebkitTextFillColor: 'initial' }} />
                {f.demoLabel}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal overlay */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
          onClick={() => setActive(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--color-surface, #fff)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Gradient header bar */}
            <div className={`bg-gradient-to-r ${active.color} p-6 flex items-center gap-4`}>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                {active.icon}
              </div>
              <div className="flex-1">
                <span className="text-white/70 text-xs font-bold uppercase tracking-widest">{active.badge}</span>
                <h3 className="text-white text-xl font-extrabold leading-tight">{active.title}</h3>
              </div>
              <button onClick={() => setActive(null)} className="text-white/80 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Demo placeholder */}
            <div
              className="mx-6 mt-6 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer group"
              style={{ background: 'var(--color-surface-hover, #f3f4f6)', height: 220, border: '2px dashed var(--color-border, #d1d5db)' }}
            >
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${active.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                <Play className="h-7 w-7" />
              </div>
              <p className="text-sm text-muted font-medium">Live demo coming soon</p>
              <p className="text-xs text-muted opacity-60">A video or interactive walkthrough will appear here</p>
            </div>

            {/* Description */}
            <div className="px-6 py-5">
              <p className="text-sm text-theme leading-relaxed">{active.description}</p>
              <div className="mt-4 flex gap-3">
                <Link
                  to="/register"
                  className={`flex-1 text-center py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 bg-gradient-to-r ${active.color}`}
                  onClick={() => setActive(null)}
                >
                  Try it Free
                </Link>
                <button
                  onClick={() => setActive(null)}
                  className="px-5 py-3 rounded-xl text-sm font-semibold text-muted border transition-colors hover:bg-surface-hover"
                  style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── QR Code Section ──────────────────────────────────────────────────────────
function QrExpandable() {
  const [expanded, setExpanded] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

  return (
    <div className="w-full flex flex-col items-center gap-5">
      {/* ~75% wide image, centered, click to enlarge */}
      <div
        className="cursor-zoom-in overflow-hidden rounded-2xl"
        style={{ width: '75%', boxShadow: '0 0 80px rgba(139,92,246,0.3), 0 20px 60px rgba(0,0,0,0.6)' }}
        onClick={() => setExpanded(true)}
      >
        <img
          src="/qr_code_3.png"
          alt="BookFlow QR Code — scan to access interactive content"
          className="w-full h-auto block"
        />
      </div>
      <div className="flex items-center gap-6 flex-wrap justify-center px-4">
        <p className="text-white/50 text-xs uppercase tracking-widest">Tap image to enlarge · Scan QR with your phone</p>
        <Link
          to="/register"
          className="px-7 py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-105 hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 4px 24px rgba(124,58,237,0.45)' }}
        >
          Generate Your QR Code
        </Link>
      </div>

      {/* Fullscreen overlay — portalled to body to escape any stacking context */}
      {createPortal(
        <div
          className={`fixed inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${expanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          style={{ background: 'rgba(0,0,0,0.97)', cursor: 'zoom-out', zIndex: 999999 }}
          onClick={() => setExpanded(false)}
        >
          <img
            src="/qr_code_3.png"
            alt="BookFlow QR Code"
            className={`transition-transform duration-300 ${expanded ? 'scale-100' : 'scale-95'}`}
            style={{ width: '100vw', height: '100vh', objectFit: 'contain', display: 'block' }}
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-0 right-0 text-center text-white/50 text-xs tracking-wide">
            Scan QR codes with your phone camera · tap anywhere to close
          </p>
        </div>,
        document.body
      )}
    </div>
  );
}

function QrCodeSection() {
  const pillars = [
    {
      icon: <Video className="h-6 w-6" />,
      gradient: 'from-violet-600 to-indigo-600',
      glow: 'rgba(124,58,237,0.35)',
      label: 'Multimedia',
      title: 'Audio. Video. Images.',
      body: 'Embed narration, walkthroughs, and visuals directly into your chapters. Turn every page into a rich, immersive experience that readers can hear, watch, and feel.',
    },
    {
      icon: <BarChart2 className="h-6 w-6" />,
      gradient: 'from-emerald-500 to-teal-600',
      glow: 'rgba(16,185,129,0.32)',
      label: 'Engagement',
      title: 'Polls. Surveys. Questionnaires.',
      body: 'Collect real responses right inside the reading experience. Know exactly what your audience thinks — chapter by chapter — with live polls, custom forms, and reflection questions.',
    },
    {
      icon: <Users className="h-6 w-6" />,
      gradient: 'from-rose-500 to-pink-600',
      glow: 'rgba(244,63,94,0.30)',
      label: 'Community',
      title: 'Build an Online Community.',
      body: 'Create reading clubs, study groups, and recovery teams. Members read together, answer together, and grow together — all inside BookFlow. One link. One community. Unlimited potential.',
    },
  ];

  return (
    <section
      className="relative overflow-hidden py-24"
      style={{ background: 'linear-gradient(160deg, #0f0c29 0%, #1e1245 40%, #0d1b3e 100%)' }}
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '80vw', height: '60vw', maxWidth: 900, maxHeight: 600, background: 'radial-gradient(ellipse, rgba(139,92,246,0.18) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      {/* ── Headline ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-400 mb-4">Scan. Read. Engage.</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-5">
            Update Your Books with{' '}
            <span style={{ background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              QR Codes
            </span>{' '}
            &amp; Interactive Content
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
            Print a QR code in any physical book, flyer, or church bulletin and readers land straight inside your interactive BookFlow edition — no app download required.
          </p>
        </div>
      </div>

      {/* ── Full-viewport-width QR image ── */}
      <div className="relative z-10 w-full">
        <QrExpandable />
      </div>

      {/* ── Pillar cards + stat bar ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
          {pillars.map((p, i) => (
            <div
              key={i}
              className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                boxShadow: `0 4px 30px ${p.glow}`,
              }}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${p.gradient} shadow-lg`}>
                {p.icon}
              </div>
              <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full w-fit bg-gradient-to-r ${p.gradient} text-white`}>
                {p.label}
              </span>
              <h3 className="text-white font-extrabold text-xl leading-snug">{p.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        {/* ── Bottom stat bar ── */}
        <div
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {[
            { value: '1 Click', label: 'QR code generated' },
            { value: 'No App', label: 'readers need to install' },
            { value: 'Live', label: 'updates, instantly' },
            { value: '∞', label: 'scans, forever free' },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center py-6 px-4 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-3xl font-extrabold text-white mb-1">{s.value}</span>
              <span className="text-white/50 text-xs uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
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

        // All books fully opaque — depth shown via scale only
        const baseOpacity = isHovered ? 1 : (0.55 + 0.45 * ((z + 1) / 2));
        const opacity = baseOpacity;
        const zIndex = isHovered ? 150 : Math.round((z + 1) * 50);

        // Position + depth on the outer button (no transition — runs every rAF)
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${depthScale.toFixed(3)}) rotateY(${tilt.toFixed(1)}deg)`;
        btn.style.opacity = isFeatured ? '1' : opacity.toFixed(3);
        btn.style.zIndex = isHovered ? '150' : String(zIndex);
        btn.style.transition = 'none';

        // Scale multiplier on inner div — CSS transition handles smooth grow/shrink
        const innerScale = isHovered ? 1.75 : isFeatured ? 1.75 : 1.0;
        inner.style.transform = `scale(${innerScale})`;
        inner.style.transition = isHovered
          ? 'transform 0.7s cubic-bezier(0.08, 0.9, 0.15, 1)'   // immediate surge, long tail
          : 'transform 0.75s cubic-bezier(0.08, 0.9, 0.15, 1)'; // immediate surge, long tail

        // Glow + outline on button (CSS transition handles fade)
        btn.style.filter = isHovered
          ? 'drop-shadow(0 8px 20px rgba(124,58,237,0.35))'
          : isFeatured
            ? 'drop-shadow(0 4px 12px rgba(124,58,237,0.22))'
            : '';
        btn.style.outline = 'none';
        btn.style.borderRadius = '0.75rem';
        // Allow filter to animate — but not transform (that's the rAF position)
        btn.style.transition = 'filter 0.4s ease, opacity 0.35s ease';
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
              transformOrigin: 'center bottom',
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
              className="w-full h-full rounded-xl overflow-hidden shadow-xl ring-1 ring-black/10 relative"
              style={{ transformOrigin: 'center bottom' }}
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
          <p className="text-gray-800 font-bold text-2xl text-center px-8 transition-all duration-300">
            {hoveredTitle ?? featuredBook?.title ?? '\u00A0'}
          </p>
          <p className="text-gray-500 text-sm text-center px-8 transition-all duration-300 mt-0.5"
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


// ─── Expandable Image ─────────────────────────────────────────────────────────
function ExpandableImage({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3">
        <div
          className="rounded-2xl overflow-hidden shadow-sm flex-1 cursor-zoom-in"
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          onClick={() => setExpanded(v => !v)}
        >
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        </div>
        <p className="text-center text-sm font-semibold text-muted tracking-wide">{caption}</p>
      </div>

      {/* Lightbox overlay */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${expanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.82)' }}
        onMouseLeave={() => setExpanded(false)}
        onClick={() => setExpanded(false)}
      >
        <img
          src={src}
          alt={alt}
          className={`rounded-2xl shadow-2xl object-contain transition-all duration-300 ${expanded ? 'scale-100' : 'scale-75'}`}
          style={{ maxWidth: '90vw', maxHeight: '90vh' }}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </>
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
      <div className={`bg-gradient-to-r ${accent} px-6 py-7 flex items-center gap-4`}>
        <div className="p-3 rounded-xl bg-white/20">{icon}</div>
        <div>
          <h3 className="text-4xl font-bold text-white">{title}</h3>
          <p className="text-white/80 text-sm mt-1">{tagline}</p>
        </div>
      </div>
      {/* Bullets */}
      <ul className="flex-1 px-6 py-5 space-y-3">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-base text-theme">
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
