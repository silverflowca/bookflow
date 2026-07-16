import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { BookOpen, ChevronRight, ChevronLeft, Loader2, Lock, User, Clock, Globe } from 'lucide-react';
import api from '../lib/api';
import { getHighlightTheme } from '../lib/highlightTheme';
import { getTextAlignCss, getTextStyleCss } from '../components/editor/PasteFormattingExtensions';
import type { Book, Chapter } from '../types';

export default function PublicBookPage() {
  const { slug, token } = useParams<{ slug?: string; token?: string }>();
  const location = useLocation();
  const [book, setBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chapterSlugParam = new URLSearchParams(location.search).get('chapter');

  useEffect(() => {
    loadBook();
  }, [slug, token, chapterSlugParam]);

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
      const targetChapter = chapterSlugParam
        ? data.chapters?.find(ch => ch.slug === chapterSlugParam || ch.id === chapterSlugParam) ?? null
        : null;
      setBook(data);
      if (targetChapter) {
        setSelectedChapter(targetChapter);
        setReading(true);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errMsg.includes('not found') ? 'This book is not available.' : errMsg);
    } finally {
      setLoading(false);
    }
  }

  function startReading(chapter?: Chapter) {
    const ch = chapter ?? book?.chapters?.[0] ?? null;
    setSelectedChapter(ch);
    setReading(true);
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

  const totalWordCount = book?.chapters?.reduce((sum, c) => sum + (c.word_count || 0), 0) ?? 0;
  const totalReadTime = book?.chapters?.reduce((sum, c) => sum + (c.estimated_read_time_minutes || 0), 0) ?? 0;

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
          <h2 className="text-xl font-semibold mb-2">Book unavailable</h2>
          <p className="text-muted mb-6">{error}</p>
          <Link to="/" className="theme-button-primary px-6 py-2 rounded-lg font-medium">Go Home</Link>
        </div>
      </div>
    );
  }

  if (!book) return null;

  // ── LANDING PAGE ─────────────────────────────────────────────────────────────
  if (!reading) {
    return (
      <div className="min-h-screen bg-theme">
        {/* Header bar */}
        <div className="border-b border-theme bg-surface">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-accent font-bold">
              <BookOpen className="h-5 w-5" />
              BookFlow
            </div>
            {token && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Lock className="h-3.5 w-3.5" /> Private link
              </span>
            )}
            {!token && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Globe className="h-3.5 w-3.5" /> Public
              </span>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-12 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — cover */}
            <div className="flex justify-center lg:justify-end">
              {book.cover_image_url ? (
                <img
                  src={book.cover_image_url}
                  alt={book.title}
                  className="w-64 sm:w-80 rounded-2xl shadow-2xl object-cover"
                />
              ) : (
                <div className="w-64 sm:w-80 aspect-[3/4] rounded-2xl shadow-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center border border-theme">
                  <BookOpen className="h-20 w-20 text-accent/40" />
                </div>
              )}
            </div>

            {/* Right — details */}
            <div className="space-y-5">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold text-theme leading-tight">{book.title}</h1>
                {book.subtitle && (
                  <p className="text-xl text-muted mt-2">{book.subtitle}</p>
                )}
              </div>

              {book.author && (
                <div className="flex items-center gap-3">
                  {book.author.avatar_url ? (
                    <img src={book.author.avatar_url} alt={book.author.display_name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-surface-hover flex items-center justify-center">
                      <User className="h-5 w-5 text-muted" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-theme">{book.author.display_name}</p>
                    {book.published_at && (
                      <p className="text-xs text-muted">Published {new Date(book.published_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    )}
                  </div>
                </div>
              )}

              {book.description && (
                <p className="text-muted leading-relaxed text-base">{book.description}</p>
              )}

              {/* Stats */}
              <div className="flex gap-5 text-sm text-muted">
                <span>{book.chapters?.length ?? 0} chapters</span>
                {totalWordCount > 0 && <span>{totalWordCount.toLocaleString()} words</span>}
                {totalReadTime > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> ~{totalReadTime} min read
                  </span>
                )}
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => startReading()}
                  className="theme-button-primary px-8 py-3 rounded-xl font-bold text-base flex items-center gap-2 justify-center"
                >
                  Start Reading <ChevronRight className="h-5 w-5" />
                </button>
                {(book.chapters?.length ?? 0) > 1 && (
                  <button
                    onClick={() => { setSidebarOpen(true); startReading(); }}
                    className="px-6 py-3 rounded-xl border border-theme text-muted hover:bg-surface-hover text-base font-medium transition-colors flex items-center gap-2 justify-center"
                  >
                    <BookOpen className="h-5 w-5" /> Table of Contents
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chapter list preview */}
          {(book.chapters?.length ?? 0) > 0 && (
            <div className="mt-16">
              <h2 className="text-xl font-bold text-theme mb-4">Chapters</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {book.chapters!.map((ch, idx) => (
                  <button
                    key={ch.id}
                    onClick={() => startReading(ch)}
                    className="text-left px-4 py-3 rounded-xl border border-theme hover:bg-surface-hover transition-colors flex items-center gap-3 group"
                  >
                    <span className="text-2xl font-bold text-muted/30 shrink-0 w-8">{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-theme truncate group-hover:text-accent transition-colors">{ch.title}</p>
                      {ch.estimated_read_time_minutes && (
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />{ch.estimated_read_time_minutes} min
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── READER VIEW ───────────────────────────────────────────────────────────────
  const chapterIdx = getChapterIndex();
  const totalChapters = book.chapters?.length || 0;

  return (
    <div className="flex h-screen overflow-hidden bg-theme">
      {/* Sidebar — Table of Contents */}
      <aside className={`flex-shrink-0 border-r-2 border-theme transition-all duration-300 overflow-hidden ${sidebarOpen ? 'w-72' : 'w-0'}`}>
        <div className="w-72 h-full flex flex-col overflow-hidden">
          {/* Book info */}
          <div className="p-4 border-b-2 border-theme">
            <button
              onClick={() => setReading(false)}
              className="text-xs text-accent hover:underline mb-3 block"
            >
              ← Back to book page
            </button>
            {book.cover_image_url && (
              <img src={book.cover_image_url} alt={book.title} className="w-full h-32 object-cover rounded-lg mb-3" />
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
              {selectedChapter && <> / <span className="text-theme">{selectedChapter.title}</span></>}
            </span>
          </div>

          {/* Chapter nav */}
          <div className="flex items-center gap-2">
            <button onClick={goToPrev} disabled={chapterIdx <= 0} className="p-2 text-muted hover:text-theme rounded-lg disabled:opacity-30 transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-muted">{chapterIdx + 1} / {totalChapters}</span>
            <button onClick={goToNext} disabled={chapterIdx >= totalChapters - 1} className="p-2 text-muted hover:text-theme rounded-lg disabled:opacity-30 transition-colors">
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
                    dangerouslySetInnerHTML={{ __html: jsonContentToHtml(selectedChapter.content, selectedChapter.inline_items) }}
                  />
                ) : (
                  <p className="text-muted italic">This chapter has no content yet.</p>
                )}

                {/* Chapter navigation */}
                <div className="flex justify-between mt-16 pt-8 border-t-2 border-theme">
                  {chapterIdx > 0 ? (
                    <button onClick={goToPrev} className="flex items-center gap-2 text-muted hover:text-theme transition-colors">
                      <ChevronLeft className="h-4 w-4" />
                      {book.chapters![chapterIdx - 1].title}
                    </button>
                  ) : (
                    <button onClick={() => setReading(false)} className="flex items-center gap-2 text-accent hover:underline text-sm">
                      ← Book overview
                    </button>
                  )}

                  {chapterIdx < totalChapters - 1 ? (
                    <button onClick={goToNext} className="flex items-center gap-2 text-muted hover:text-theme transition-colors ml-auto">
                      {book.chapters![chapterIdx + 1].title}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="ml-auto text-center">
                      <p className="text-muted text-sm">You've reached the end!</p>
                      <button onClick={() => setReading(false)} className="text-accent text-xs hover:underline mt-1 block">Back to overview</button>
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
function styleAttr(css: string): string {
  return css ? ` style="${css}"` : '';
}

type InlineItem = { id: string; content_type: string; content_data: any };

function renderInlineItem(ic: InlineItem): string {
  const data = ic.content_data || {};
  const type = ic.content_type;

  if (type === 'image') {
    const src = data.url || data.src || '';
    const alt = data.alt || '';
    const caption = data.caption || '';
    if (!src) return '';
    const img = `<img src="${src}" alt="${alt}" style="max-width:100%;border-radius:8px;margin:1rem 0;" />`;
    return caption ? `<figure style="margin:1rem 0">${img}<figcaption style="text-align:center;font-size:0.85em;color:#888;margin-top:0.25rem">${caption}</figcaption></figure>` : img;
  }

  if (type === 'video') {
    const src = data.url || data.src || '';
    if (!src) return '';
    // YouTube / Vimeo embed
    const ytMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return `<div style="position:relative;padding-bottom:56.25%;height:0;margin:1rem 0;border-radius:8px;overflow:hidden"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div>`;
    }
    const vimeoMatch = src.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `<div style="position:relative;padding-bottom:56.25%;height:0;margin:1rem 0;border-radius:8px;overflow:hidden"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div>`;
    }
    // Native video file
    return `<video controls style="max-width:100%;border-radius:8px;margin:1rem 0"><source src="${src}" /><p>Your browser does not support video playback.</p></video>`;
  }

  if (type === 'audio') {
    const src = data.url || data.src || '';
    if (!src) return '';
    return `<audio controls style="width:100%;margin:0.75rem 0"><source src="${src}" /><p>Your browser does not support audio playback.</p></audio>`;
  }

  if (type === 'drawing') {
    const src = data.url || data.imageUrl || '';
    if (!src) return '';
    return `<img src="${src}" alt="Drawing" style="max-width:100%;border-radius:8px;margin:1rem 0;" />`;
  }

  // Interactive elements (questions, polls, forms) — show as a read-only placeholder
  const labelMap: Record<string, string> = {
    question: '❓ Question',
    poll: '📊 Poll',
    textbox: '📝 Text response',
    textarea: '📝 Text response',
    select: '🔽 Selection',
    radio: '⭕ Multiple choice',
    checkbox: '☑️ Checkboxes',
    signature: '✍️ Signature',
    media_response: '🎙️ Media response',
  };
  const label = labelMap[type];
  if (label) {
    const title = data.label || data.question || '';
    return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:0.75rem 1rem;margin:1rem 0;background:#f9fafb;color:#6b7280;font-size:0.9em">${label}${title ? `: <em>${title}</em>` : ''}</div>`;
  }

  return '';
}

function jsonContentToHtml(content: unknown, inlineItems?: InlineItem[]): string {
  if (!content || typeof content !== 'object') return '';
  const inlineMap = new Map((inlineItems || []).map(ic => [ic.id, ic]));

  function render(node: unknown): string {
    if (!node || typeof node !== 'object') return '';
    const n = node as { type?: string; text?: string; content?: unknown[]; marks?: { type: string; attrs?: Record<string, unknown> }[]; attrs?: Record<string, unknown> };

    if (n.type === 'doc') {
      return (n.content || []).map(render).join('');
    }
    if (n.type === 'paragraph') {
      const inner = (n.content || []).map(render).join('');
      return `<p${styleAttr(getTextAlignCss(n.attrs))}>${inner || '<br>'}</p>`;
    }
    if (n.type === 'heading') {
      const level = (n as { attrs?: { level?: number } }).attrs?.level || 2;
      const inner = (n.content || []).map(render).join('');
      return `<h${level}${styleAttr(getTextAlignCss(n.attrs))}>${inner}</h${level}>`;
    }
    if (n.type === 'text') {
      let text = n.text || '';
      const marks = n.marks || [];
      for (const mark of marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        if (mark.type === 'italic') text = `<em>${text}</em>`;
        if (mark.type === 'underline') text = `<u>${text}</u>`;
        if (mark.type === 'strike') text = `<s>${text}</s>`;
        if (mark.type === 'code') text = `<code style="background:#f3f4f6;border-radius:3px;padding:0 3px;font-size:0.875em">${text}</code>`;
        if (mark.type === 'link') {
          const href = (mark.attrs?.href as string) || '#';
          text = `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#6366f1;text-decoration:underline">${text}</a>`;
        }
        if (mark.type === 'highlight') {
          const c = (mark as any).attrs?.color;
          const theme = getHighlightTheme(c);
          text = c ? `<mark style="background-color:${theme.bg};padding:0 2px;border-radius:2px">${text}</mark>` : `<mark>${text}</mark>`;
        }
        if (mark.type === 'textStyle') {
          const css = getTextStyleCss(mark.attrs);
          if (css) text = `<span style="${css}">${text}</span>`;
        }
      }
      return text;
    }
    if (n.type === 'inlineFormWidget') {
      const contentId = (n.attrs as any)?.contentId as string | undefined;
      if (!contentId) return '';
      const ic = inlineMap.get(contentId);
      if (!ic) return '';
      return renderInlineItem(ic);
    }
    if (n.type === 'image') {
      const src = (n.attrs as any)?.src || '';
      const alt = (n.attrs as any)?.alt || '';
      if (!src) return '';
      return `<img src="${src}" alt="${alt}" style="max-width:100%;border-radius:8px;margin:1rem 0;" />`;
    }
    if (n.type === 'bulletList') {
      return `<ul>${(n.content || []).map(render).join('')}</ul>`;
    }
    if (n.type === 'orderedList') {
      return `<ol>${(n.content || []).map(render).join('')}</ol>`;
    }
    if (n.type === 'listItem') {
      return `<li>${(n.content || []).map(render).join('')}</li>`;
    }
    if (n.type === 'blockquote') {
      return `<blockquote style="border-left:3px solid #e5e7eb;padding-left:1rem;color:#6b7280;margin:1rem 0">${(n.content || []).map(render).join('')}</blockquote>`;
    }
    if (n.type === 'codeBlock') {
      const lang = (n.attrs as any)?.language || '';
      const inner = (n.content || []).map(render).join('');
      return `<pre style="background:#1e1e2e;color:#cdd6f4;border-radius:8px;padding:1rem;overflow-x:auto;font-size:0.875em;margin:1rem 0"><code${lang ? ` class="language-${lang}"` : ''}>${inner}</code></pre>`;
    }
    if (n.type === 'horizontalRule') {
      return '<hr style="margin:2rem 0;border:none;border-top:1px solid #e5e7eb" />';
    }
    if (n.type === 'table') {
      return `<div style="overflow-x:auto;margin:1rem 0"><table style="table-layout:fixed;border-collapse:collapse;width:100%"><tbody>${(n.content || []).map(render).join('')}</tbody></table></div>`;
    }
    if (n.type === 'tableRow') {
      return `<tr>${(n.content || []).map(render).join('')}</tr>`;
    }
    if (n.type === 'tableHeader') {
      const thStyle = [n.attrs?.width ? `width:${n.attrs.width}` : '', 'font-weight:600;background:#f9fafb;padding:0.5rem;border:1px solid #e5e7eb;text-align:left'].filter(Boolean).join(';');
      return `<th style="${thStyle}">${(n.content || []).map(render).join('')}</th>`;
    }
    if (n.type === 'tableCell') {
      const tdStyle = [n.attrs?.width ? `width:${n.attrs.width}` : '', 'padding:0.5rem;border:1px solid #e5e7eb;vertical-align:top'].filter(Boolean).join(';');
      return `<td style="${tdStyle}">${(n.content || []).map(render).join('')}</td>`;
    }
    if (n.type === 'hardBreak') return '<br>';
    if (n.content) {
      return (n.content as unknown[]).map(render).join('');
    }
    return '';
  }

  return render(content);
}
