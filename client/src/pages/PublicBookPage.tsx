import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, ChevronRight, ChevronLeft, Loader2, Lock, User, Clock } from 'lucide-react';
import api from '../lib/api';
import type { Book, Chapter } from '../types';

export default function PublicBookPage() {
  const { slug, token } = useParams<{ slug?: string; token?: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadBook();
  }, [slug, token]);

  async function loadBook() {
    try {
      let data: Book;
      if (slug) {
        data = await api.getPublicBook(slug);
      } else if (token) {
        data = await api.getSharedBook(token);
      } else {
        setError('No book identifier provided.');
        return;
      }
      setBook(data);
      // Auto-select first chapter
      if (data.chapters?.length) {
        setSelectedChapter(data.chapters[0]);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errMsg.includes('not found') ? 'This book is not available.' : errMsg);
    } finally {
      setLoading(false);
    }
  }

  function getChapterIndex() {
    if (!book?.chapters || !selectedChapter) return -1;
    return book.chapters.findIndex(c => c.id === selectedChapter.id);
  }

  function goToPrev() {
    const idx = getChapterIndex();
    if (idx > 0 && book?.chapters) setSelectedChapter(book.chapters[idx - 1]);
  }

  function goToNext() {
    const idx = getChapterIndex();
    if (book?.chapters && idx < book.chapters.length - 1) setSelectedChapter(book.chapters[idx + 1]);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Lock className="h-12 w-12 text-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-theme mb-2">Book unavailable</h2>
          <p className="text-muted mb-6">{error}</p>
          <Link to="/" className="theme-button-primary px-6 py-2 rounded-lg font-medium">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!book) return null;

  const chapterIdx = getChapterIndex();
  const totalChapters = book.chapters?.length || 0;

  return (
    <div className="flex h-screen overflow-hidden bg-theme">
      {/* Sidebar — Table of Contents */}
      <aside
        className={`flex-shrink-0 border-r-2 border-theme transition-all duration-300 overflow-hidden ${
          sidebarOpen ? 'w-72' : 'w-0'
        }`}
      >
        <div className="w-72 h-full flex flex-col overflow-hidden">
          {/* Book info */}
          <div className="p-4 border-b-2 border-theme">
            {book.cover_image_url && (
              <img
                src={book.cover_image_url}
                alt={book.title}
                className="w-full h-32 object-cover rounded-lg mb-3"
              />
            )}
            <h2 className="font-bold text-theme leading-tight">{book.title}</h2>
            {book.subtitle && <p className="text-sm text-muted mt-0.5">{book.subtitle}</p>}
            {book.author && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-muted">
                <User className="h-3.5 w-3.5" />
                {book.author.display_name}
              </div>
            )}
          </div>

          {/* Chapter list */}
          <div className="flex-1 overflow-y-auto p-2">
            {book.chapters?.map((ch, idx) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChapter(ch)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1 ${
                  selectedChapter?.id === ch.id
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-muted hover:text-theme hover:bg-surface-hover'
                }`}
              >
                <span className="text-xs opacity-60 mr-2">{idx + 1}.</span>
                {ch.title}
                {ch.estimated_read_time_minutes && (
                  <span className="flex items-center gap-1 text-xs text-muted mt-0.5 ml-5">
                    <Clock className="h-3 w-3" />
                    {ch.estimated_read_time_minutes} min
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main reading area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-theme bg-surface flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-muted hover:text-theme rounded-lg hover:bg-surface-hover transition-colors"
              title={sidebarOpen ? 'Hide contents' : 'Show contents'}
            >
              <BookOpen className="h-5 w-5" />
            </button>
            <span className="text-sm text-muted hidden sm:block">
              {book.title}
              {selectedChapter && (
                <> / <span className="text-theme">{selectedChapter.title}</span></>
              )}
            </span>
          </div>

          {/* Chapter nav */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrev}
              disabled={chapterIdx <= 0}
              className="p-2 text-muted hover:text-theme rounded-lg disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-muted">
              {chapterIdx + 1} / {totalChapters}
            </span>
            <button
              onClick={goToNext}
              disabled={chapterIdx >= totalChapters - 1}
              className="p-2 text-muted hover:text-theme rounded-lg disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Chapter content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-8 py-10">
            {selectedChapter ? (
              <>
                <h1 className="text-3xl font-bold text-theme mb-8">{selectedChapter.title}</h1>
                {selectedChapter.content ? (
                  <div
                    className="prose prose-lg max-w-none text-theme"
                    dangerouslySetInnerHTML={{
                      __html: jsonContentToHtml(selectedChapter.content),
                    }}
                  />
                ) : (
                  <p className="text-muted italic">This chapter has no content yet.</p>
                )}

                {/* Chapter navigation */}
                <div className="flex justify-between mt-16 pt-8 border-t-2 border-theme">
                  {chapterIdx > 0 ? (
                    <button
                      onClick={goToPrev}
                      className="flex items-center gap-2 text-muted hover:text-theme transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {book.chapters![chapterIdx - 1].title}
                    </button>
                  ) : <div />}

                  {chapterIdx < totalChapters - 1 ? (
                    <button
                      onClick={goToNext}
                      className="flex items-center gap-2 text-muted hover:text-theme transition-colors ml-auto"
                    >
                      {book.chapters![chapterIdx + 1].title}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="ml-auto text-center">
                      <p className="text-muted text-sm">You've reached the end!</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-muted">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p>Select a chapter from the table of contents.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple TipTap JSON → HTML converter for reading view
function jsonContentToHtml(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const node = content as { type?: string; text?: string; content?: unknown[]; marks?: { type: string }[] };

  if (node.type === 'doc') {
    return (node.content || []).map(n => jsonContentToHtml(n)).join('');
  }

  if (node.type === 'paragraph') {
    const inner = (node.content || []).map(n => jsonContentToHtml(n)).join('');
    return `<p>${inner || '<br>'}</p>`;
  }

  if (node.type === 'heading') {
    const level = (node as { attrs?: { level?: number } }).attrs?.level || 2;
    const inner = (node.content || []).map(n => jsonContentToHtml(n)).join('');
    return `<h${level}>${inner}</h${level}>`;
  }

  if (node.type === 'text') {
    let text = node.text || '';
    const marks = node.marks || [];
    for (const mark of marks) {
      if (mark.type === 'bold') text = `<strong>${text}</strong>`;
      if (mark.type === 'italic') text = `<em>${text}</em>`;
      if (mark.type === 'underline') text = `<u>${text}</u>`;
      if (mark.type === 'highlight') text = `<mark>${text}</mark>`;
    }
    return text;
  }

  if (node.type === 'bulletList') {
    const items = (node.content || []).map(n => jsonContentToHtml(n)).join('');
    return `<ul>${items}</ul>`;
  }

  if (node.type === 'orderedList') {
    const items = (node.content || []).map(n => jsonContentToHtml(n)).join('');
    return `<ol>${items}</ol>`;
  }

  if (node.type === 'listItem') {
    const inner = (node.content || []).map(n => jsonContentToHtml(n)).join('');
    return `<li>${inner}</li>`;
  }

  if (node.type === 'blockquote') {
    const inner = (node.content || []).map(n => jsonContentToHtml(n)).join('');
    return `<blockquote>${inner}</blockquote>`;
  }

  if (node.type === 'hardBreak') return '<br>';

  // For any other node types, recurse into children
  if (node.content) {
    return (node.content as unknown[]).map(n => jsonContentToHtml(n)).join('');
  }

  return '';
}
