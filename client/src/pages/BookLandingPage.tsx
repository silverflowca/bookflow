import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Clock, Users, Lock, Globe, ChevronRight,
  Loader2, AlertCircle, Sparkles,
} from 'lucide-react';
import api from '../lib/api';
import type { BookLanding } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function BookLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [book, setBook] = useState<BookLanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  // ?chapter=<slug> — jump directly to that chapter when book loads
  const chapterSlugParam = new URLSearchParams(location.search).get('chapter');

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const data = await api.getBookLanding(slug);
      setBook(data);
      // If a chapter slug was requested, navigate straight to it
      if (chapterSlugParam) {
        const target = data.chapters.find((c: any) => c.slug === chapterSlugParam || c.id === chapterSlugParam);
        if (target) {
          navigate(`/book/${data.id}/chapter/${target.id}`, { replace: true });
          return;
        }
      }
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e?.status === 401) { setNeedsLogin(true); return; }
      setError('This book is not available.');
    } finally {
      setLoading(false);
    }
  }, [slug, chapterSlugParam, navigate]);

  useEffect(() => { load(); }, [load]);

  const totalWords = book?.chapters.reduce((s, c) => s + (c.word_count || 0), 0) ?? 0;
  const totalMins = book?.chapters.reduce((s, c) => s + (c.estimated_read_time_minutes || 0), 0) ?? 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0f0c29,#24243e)' }}>
      <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
    </div>
  );

  if (needsLogin) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4" style={{ background: 'linear-gradient(135deg,#0f0c29,#24243e)' }}>
      <Lock className="h-12 w-12 text-violet-400" />
      <h1 className="text-2xl font-bold text-white text-center">Sign in to access this book</h1>
      <p className="text-white/60 text-center max-w-sm">This book is private. Please sign in to continue.</p>
      <Link to="/login" className="px-8 py-3 rounded-xl font-bold text-white" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>Sign In</Link>
    </div>
  );

  if (error || !book) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ background: 'linear-gradient(135deg,#0f0c29,#24243e)' }}>
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="text-white text-lg">{error || 'Book not found'}</p>
      <Link to="/" className="text-violet-400 hover:text-violet-300 text-sm">← Back to BookFlow</Link>
    </div>
  );

  const firstChapterId = book.chapters[0]?.id;
  const readUrl = user ? `/book/${book.id}${firstChapterId ? `/chapter/${firstChapterId}` : ''}` : '/register';

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#0f0c29 0%,#1e1245 50%,#0d1b3e 100%)' }}>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12 items-start">

          {/* Cover */}
          <div className="flex-shrink-0 w-full lg:w-72">
            {book.cover_image_url ? (
              <img
                src={book.cover_image_url}
                alt={book.title}
                className="w-full lg:w-72 rounded-2xl shadow-2xl object-cover"
                style={{ aspectRatio: '2/3', boxShadow: '0 0 60px rgba(139,92,246,0.35)' }}
              />
            ) : (
              <div
                className="w-full lg:w-72 rounded-2xl flex items-center justify-center"
                style={{ aspectRatio: '2/3', background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(79,70,229,0.3))', border: '1px solid rgba(139,92,246,0.3)' }}
              >
                <BookOpen className="h-20 w-20 text-violet-400 opacity-60" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col gap-5">
            {/* Badge */}
            <div className="flex items-center gap-2">
              {book.visibility === 'public' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-300" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <Globe className="h-3 w-3" /> Public · Free to Read
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-300" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <Lock className="h-3 w-3" /> Private
                </span>
              )}
              {book.in_club && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-violet-300" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <Users className="h-3 w-3" /> Club / Group Book
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">{book.title}</h1>
            {book.subtitle && <p className="text-xl text-white/60 font-medium">{book.subtitle}</p>}

            {book.author && (
              <div className="flex items-center gap-3">
                {book.author.avatar_url ? (
                  <img src={book.author.avatar_url} alt={book.author.display_name} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                    {book.author.display_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-white/70 text-sm">by <span className="text-white font-semibold">{book.author.display_name}</span></span>
              </div>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5 text-white/50 text-sm">
                <BookOpen className="h-4 w-4" />
                {book.chapters.length} chapter{book.chapters.length !== 1 ? 's' : ''}
              </div>
              {totalWords > 0 && (
                <div className="flex items-center gap-1.5 text-white/50 text-sm">
                  <Sparkles className="h-4 w-4" />
                  {totalWords.toLocaleString()} words
                </div>
              )}
              {totalMins > 0 && (
                <div className="flex items-center gap-1.5 text-white/50 text-sm">
                  <Clock className="h-4 w-4" />
                  ~{totalMins} min read
                </div>
              )}
            </div>

            {book.description && (
              <p className="text-white/65 leading-relaxed text-base max-w-2xl">{book.description}</p>
            )}

            {/* CTA */}
            <div className="flex flex-wrap gap-3 mt-2">
              {book.visibility === 'public' ? (
                <button
                  onClick={() => navigate(readUrl)}
                  className="px-8 py-3.5 rounded-xl font-bold text-white text-base transition-all hover:scale-105 hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 4px 24px rgba(124,58,237,0.45)' }}
                >
                  {user ? 'Start Reading' : 'Read Free — No Sign Up'}
                </button>
              ) : book.in_club ? (
                <Link to="/clubs" className="px-8 py-3.5 rounded-xl font-bold text-white text-base transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                  Join a Club to Read
                </Link>
              ) : (
                <Link to="/login" className="px-8 py-3.5 rounded-xl font-bold text-white text-base transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                  Sign In to Read
                </Link>
              )}
              {!user && book.visibility === 'public' && (
                <Link to="/register" className="px-8 py-3.5 rounded-xl font-semibold text-white/80 text-base transition-all hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  Create Free Account
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Chapter list */}
        {book.chapters.length > 0 && (
          <div className="mt-16">
            <h2 className="text-white font-bold text-xl mb-5">Table of Contents</h2>
            <div className="grid gap-3">
              {book.chapters.map((ch, i) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    if (book.visibility === 'public' || user) {
                      navigate(user ? `/book/${book.id}/chapter/${ch.id}` : '/register');
                    }
                  }}
                  className="group w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.01]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.5),rgba(79,70,229,0.5))' }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 font-semibold text-white/90">{ch.title}</span>
                  {ch.estimated_read_time_minutes > 0 && (
                    <span className="text-white/40 text-xs shrink-0">{ch.estimated_read_time_minutes} min</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-violet-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-16 py-8 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <Link to="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm">
          <BookOpen className="h-4 w-4 text-violet-400" />
          Powered by BookFlow · Interactive Book Platform
        </Link>
      </div>
    </div>
  );
}
