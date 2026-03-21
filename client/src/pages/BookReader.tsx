import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Menu, X, BookOpen, MessageSquare, BarChart2,
  Highlighter, StickyNote, Link2, Play, Video, Volume2, Square, Loader2,
  User, Crown, List, Type, AlignLeft, Circle, CheckSquare, Code
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import InlineContentModal from '../components/editor/InlineContentModal';
import type {
  Book, Chapter, InlineContent, InlineContentType, QuestionData, PollData, MediaData, LinkData, NoteData, HighlightData,
  SelectData, MultiselectData, TextboxData, TextareaData, RadioData, CheckboxData, CodeBlockData, ScriptureBlockData
} from '../types';

export default function BookReader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [inlineContent, setInlineContent] = useState<InlineContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToc, setShowToc] = useState(false);
  const [activeContent, setActiveContent] = useState<InlineContent | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Reader inline content state
  const [selectedText, setSelectedText] = useState<{ text: string; range: Range | null } | null>(null);
  const [showReaderToolbar, setShowReaderToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showReaderModal, setShowReaderModal] = useState<{ type: InlineContentType } | null>(null);
  const [contentFilter, setContentFilter] = useState<'all' | 'author' | 'mine'>('all');

  // TTS State
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);

  // Check if current user is the author
  const isAuthor = book?.author_id === user?.id;

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

  // Listen for mouseup events to detect text selection
  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [handleTextSelection]);

  // Filter inline content based on selected filter
  const filteredInlineContent = useMemo(() => {
    return inlineContent.filter(ic => {
      // Always show all to author
      if (isAuthor) {
        if (contentFilter === 'author') return ic.is_author_content;
        if (contentFilter === 'mine') return ic.created_by === user?.id;
        return true;
      }

      // For readers: only show visible content
      if (ic.visibility === 'author_only' && !isAuthor) return false;
      if (ic.visibility === 'private' && ic.created_by !== user?.id) return false;

      // Apply filter
      if (contentFilter === 'author') return ic.is_author_content;
      if (contentFilter === 'mine') return ic.created_by === user?.id;
      return true;
    });
  }, [inlineContent, contentFilter, isAuthor, user?.id]);

  useEffect(() => {
    if (bookId) {
      loadBook();
    }
  }, [bookId]);

  useEffect(() => {
    if (chapterId) {
      loadChapter();
      // Stop TTS when chapter changes
      if (ttsAudio) {
        ttsAudio.pause();
        ttsAudio.currentTime = 0;
        setTtsPlaying(false);
      }
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
    try {
      const [chapterData, contentData] = await Promise.all([
        api.getChapter(chapterId!),
        api.getInlineContent(chapterId!),
      ]);
      setChapter(chapterData);
      setInlineContent(contentData);
    } catch (err) {
      console.error('Failed to load chapter:', err);
    }
  }

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

      audio.onended = () => {
        setTtsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setTtsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        alert('Failed to play audio');
      };

      setTtsAudio(audio);
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

  return (
    <div className="min-h-screen bg-surface-hover flex">
      {/* Table of Contents Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-surface border-r border-theme transform transition-transform z-20 ${
        showToc ? 'translate-x-0' : '-translate-x-full'
      } lg:relative lg:translate-x-0`}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-theme flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-accent">
              <BookOpen className="h-6 w-6" />
              <span className="font-semibold">BookFlow</span>
            </Link>
            <button
              onClick={() => setShowToc(false)}
              className="lg:hidden text-muted hover:text-theme"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4">
            <h2 className="font-bold text-lg">{book.title}</h2>
            {book.subtitle && <p className="text-sm text-muted">{book.subtitle}</p>}
            <p className="text-sm text-muted mt-1">by {book.author?.display_name}</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            <nav className="px-2">
              {book.chapters?.map((ch, index) => (
                <Link
                  key={ch.id}
                  to={`/book/${bookId}/chapter/${ch.id}`}
                  onClick={() => setShowToc(false)}
                  className={`block px-3 py-2 rounded text-sm ${
                    ch.id === chapterId
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'text-theme hover:bg-surface-hover'
                  }`}
                >
                  {index + 1}. {ch.title}
                </Link>
              ))}
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
      <main className="flex-1 min-w-0 relative">
        {/* Header */}
        <header className="sticky top-0 bg-surface border-b border-theme z-10">
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
            {/* TTS Button */}
            <button
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
          </div>
        </header>

        {/* Right Side Icons Toolbar */}
        <RightSideToolbar
          inlineContent={inlineContent}
          filterType={filterType}
          onFilterChange={setFilterType}
          onContentSelect={setActiveContent}
        />

        {/* Chapter Content */}
        {chapter ? (
          <article className="max-w-3xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">{chapter.title}</h1>

            {/* Start of Chapter Content */}
            <StartOfChapterContent items={inlineContent} />

            <div className="reader-content text-lg text-theme leading-relaxed">
              <ChapterContent
                content={chapter.content}
                contentText={chapter.content_text}
                inlineContent={filteredInlineContent}
                onContentClick={setActiveContent}
              />
            </div>

            {/* End of Chapter Questions */}
            <EndOfChapterContent items={inlineContent} />

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
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 text-center text-muted">
            Select a chapter to start reading
          </div>
        )}
      </main>

      {/* Inline Content Panel */}
      {activeContent && (
        <InlineContentPanel
          content={activeContent}
          onClose={() => setActiveContent(null)}
        />
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

      {/* Content Filter (for author or readers with content) */}
      {(isAuthor || inlineContent.some(ic => ic.created_by === user?.id)) && (
        <ContentFilterBar
          filter={contentFilter}
          onFilterChange={setContentFilter}
          isAuthor={isAuthor}
        />
      )}
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
    return (
      <div className="prose prose-lg max-w-none">
        {parsedContent.content.map((node: any, index: number) => (
          <TipTapNode
            key={index}
            node={node}
            inlineContent={inlineContent}
            onContentClick={onContentClick}
          />
        ))}
      </div>
    );
  }

  // Fallback to plain text rendering with inline content markers
  const text = contentText || '';
  const markers = inlineContent
    .filter(i => i.position_in_chapter === 'inline')
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
    }[marker.content_type];

    elements.push(
      <span
        key={`marker-${marker.id}`}
        className={markerClass}
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
      return <MessageSquare className={`${iconClass} text-blue-600`} />;
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
        case 'highlight':
          content = <mark className="bg-yellow-200 px-0.5">{content}</mark>;
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
  onContentClick
}: {
  node: any;
  inlineContent: InlineContent[];
  onContentClick: (content: InlineContent) => void;
}) {
  if (!node) return null;

  switch (node.type) {
    case 'paragraph':
      if (!node.content || node.content.length === 0) {
        return <p className="min-h-[1.5em]">&nbsp;</p>;
      }
      return (
        <p className="mb-4">
          {node.content.map((child: any, index: number) => (
            <TipTapNode
              key={index}
              node={child}
              inlineContent={inlineContent}
              onContentClick={onContentClick}
            />
          ))}
        </p>
      );

    case 'heading':
      const HeadingTag = `h${node.attrs?.level || 2}` as keyof JSX.IntrinsicElements;
      const headingClasses: Record<number, string> = {
        1: 'text-3xl font-bold mb-4 mt-6',
        2: 'text-2xl font-bold mb-3 mt-5',
        3: 'text-xl font-semibold mb-2 mt-4',
        4: 'text-lg font-semibold mb-2 mt-3',
      };
      return (
        <HeadingTag className={headingClasses[node.attrs?.level] || headingClasses[2]}>
          {node.content?.map((child: any, index: number) => (
            <TipTapNode
              key={index}
              node={child}
              inlineContent={inlineContent}
              onContentClick={onContentClick}
            />
          ))}
        </HeadingTag>
      );

    case 'bulletList':
      return (
        <ul className="list-disc list-inside mb-4 space-y-1">
          {node.content?.map((child: any, index: number) => (
            <TipTapNode
              key={index}
              node={child}
              inlineContent={inlineContent}
              onContentClick={onContentClick}
            />
          ))}
        </ul>
      );

    case 'orderedList':
      return (
        <ol className="list-decimal list-inside mb-4 space-y-1">
          {node.content?.map((child: any, index: number) => (
            <TipTapNode
              key={index}
              node={child}
              inlineContent={inlineContent}
              onContentClick={onContentClick}
            />
          ))}
        </ol>
      );

    case 'listItem':
      return (
        <li>
          {node.content?.map((child: any, index: number) => (
            <TipTapNode
              key={index}
              node={child}
              inlineContent={inlineContent}
              onContentClick={onContentClick}
            />
          ))}
        </li>
      );

    case 'blockquote':
      return (
        <blockquote className="border-l-4 border-strong pl-4 italic text-muted mb-4">
          {node.content?.map((child: any, index: number) => (
            <TipTapNode
              key={index}
              node={child}
              inlineContent={inlineContent}
              onContentClick={onContentClick}
            />
          ))}
        </blockquote>
      );

    case 'codeBlock':
      return (
        <pre className="bg-surface-hover rounded-lg p-4 mb-4 overflow-x-auto">
          <code className="text-sm font-mono">
            {node.content?.map((child: any, index: number) => (
              <TipTapNode
                key={index}
                node={child}
                inlineContent={inlineContent}
                onContentClick={onContentClick}
              />
            ))}
          </code>
        </pre>
      );

    case 'horizontalRule':
      return <hr className="my-6 border-theme" />;

    case 'text':
      const nodeText = node.text || '';

      // Find inline content that matches this text (by anchor_text)
      const matchingContent = inlineContent.filter(
        ic => ic.anchor_text && nodeText.includes(ic.anchor_text)
      );

      // If there are matching inline contents, render with highlights
      if (matchingContent.length > 0) {
        // Sort by position in text and length (longer matches first to avoid partial overlaps)
        const sortedMatches = matchingContent
          .map(ic => ({
            content: ic,
            index: nodeText.indexOf(ic.anchor_text!),
            length: ic.anchor_text!.length
          }))
          .filter(m => m.index !== -1)
          .sort((a, b) => a.index - b.index || b.length - a.length);

        // Build segments with highlights
        const segments: React.ReactNode[] = [];
        let lastIndex = 0;
        const usedRanges: { start: number; end: number }[] = [];

        sortedMatches.forEach((match, idx) => {
          const start = match.index;
          const end = start + match.length;

          // Skip if this range overlaps with already used range
          if (usedRanges.some(r => start < r.end && end > r.start)) {
            return;
          }
          usedRanges.push({ start, end });

          // Add text before this match
          if (start > lastIndex) {
            segments.push(
              <TextWithMarks key={`pre-${idx}`} text={nodeText.slice(lastIndex, start)} marks={node.marks} />
            );
          }

          // Check if this is an interactive form type
          const formTypes = ['select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox', 'code_block', 'scripture_block'];
          const isFormType = formTypes.includes(match.content.content_type);
          const displayMode = match.content.display_mode || 'inline';

          // If display mode is inline and it's a form type, render the form element directly
          if (isFormType && displayMode === 'inline') {
            // Render the interactive form element inline
            segments.push(
              <InlineFormElement key={`form-${match.content.id}`} content={match.content} />
            );
          } else if (isFormType && (displayMode === 'start_of_chapter' || displayMode === 'end_of_chapter')) {
            // For start/end of chapter display, just show highlighted text with indicator
            const markerClass = getInlineContentClass(match.content.content_type);
            const icon = getInlineContentIcon(match.content.content_type);
            segments.push(
              <span
                key={`match-${match.content.id}`}
                className={`${markerClass} relative group cursor-default`}
                title={`Form displayed at ${displayMode === 'start_of_chapter' ? 'start' : 'end'} of chapter`}
              >
                <TextWithMarks text={nodeText.slice(start, end)} marks={node.marks} />
                <span className="inline-flex items-center ml-0.5 opacity-60 group-hover:opacity-100 gap-0.5">
                  {icon}
                </span>
              </span>
            );
          } else {
            // Sidebar mode or non-form types: show highlighted text that opens panel on click
            const markerClass = getInlineContentClass(match.content.content_type);
            const icon = getInlineContentIcon(match.content.content_type);
            const isAuthorContent = match.content.is_author_content;

            segments.push(
              <span
                key={`match-${match.content.id}`}
                className={`${markerClass} relative group`}
                onClick={() => onContentClick(match.content)}
                title={`Click to view ${match.content.content_type} (${isAuthorContent ? 'Author' : 'Reader'})`}
              >
                <TextWithMarks text={nodeText.slice(start, end)} marks={node.marks} />
                <span className="inline-flex items-center ml-0.5 opacity-60 group-hover:opacity-100 gap-0.5">
                  {icon}
                  {/* Author/Reader indicator */}
                  {isAuthorContent ? (
                    <Crown className="h-2.5 w-2.5 text-amber-500" />
                  ) : (
                    <User className="h-2.5 w-2.5 text-blue-500" />
                  )}
                </span>
              </span>
            );
          }

          lastIndex = end;
        });

        // Add remaining text after all matches
        if (lastIndex < nodeText.length) {
          segments.push(
            <TextWithMarks key="post" text={nodeText.slice(lastIndex)} marks={node.marks} />
          );
        }

        return <>{segments}</>;
      }

      // No matching inline content - render text with marks normally
      return <TextWithMarks text={nodeText} marks={node.marks} />;

    case 'hardBreak':
      return <br />;

    default:
      // For unknown node types, try to render content if available
      if (node.content) {
        return (
          <>
            {node.content.map((child: any, index: number) => (
              <TipTapNode
                key={index}
                node={child}
                inlineContent={inlineContent}
                onContentClick={onContentClick}
              />
            ))}
          </>
        );
      }
      return null;
  }
}

function StartOfChapterContent({ items }: { items: InlineContent[] }) {
  const startItems = items.filter(item => item.position_in_chapter === 'start_of_chapter');
  if (startItems.length === 0) return null;

  return (
    <div className="mb-8 pb-6 border-b space-y-4">
      <h3 className="text-lg font-semibold text-theme">Before You Begin</h3>
      {startItems.map((item) => (
        <InlineContentBlock key={item.id} content={item} />
      ))}
    </div>
  );
}

function EndOfChapterContent({ items }: { items: InlineContent[] }) {
  const endItems = items.filter(item => item.position_in_chapter === 'end_of_chapter');
  if (endItems.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t space-y-6">
      <h2 className="text-xl font-bold">Chapter Review</h2>
      {endItems.map((item) => (
        <InlineContentBlock key={item.id} content={item} />
      ))}
    </div>
  );
}

function InlineContentBlock({ content }: { content: InlineContent }) {
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
    return <SelectBlock content={content} />;
  }
  if (content.content_type === 'multiselect') {
    return <MultiselectBlock content={content} />;
  }
  if (content.content_type === 'textbox') {
    return <TextboxBlock content={content} />;
  }
  if (content.content_type === 'textarea') {
    return <TextareaBlock content={content} />;
  }
  if (content.content_type === 'radio') {
    return <RadioBlock content={content} />;
  }
  if (content.content_type === 'checkbox') {
    return <CheckboxBlock content={content} />;
  }
  if (content.content_type === 'code_block') {
    return <CodeBlockDisplay content={content} />;
  }
  if (content.content_type === 'scripture_block') {
    return <ScriptureBlockDisplay content={content} />;
  }
  return null;
}

function QuestionBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as QuestionData;
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    try {
      await api.answerQuestion(content.id, { answer_text: answer });
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit answer:', err);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-5 w-5 text-blue-600" />
        <span className="font-medium text-blue-800">Question</span>
      </div>
      <p className="text-theme mb-4">{data.question}</p>

      {data.type === 'open' && !submitted && (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full p-3 theme-input rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Type your answer..."
          />
          <button
            onClick={handleSubmit}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Submit Answer
          </button>
        </>
      )}

      {submitted && (
        <p className="text-green-600 font-medium">Thanks for your answer!</p>
      )}
    </div>
  );
}

function MediaBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as MediaData;
  const isAudio = data.type === 'audio';

  // Determine if URL is embeddable (YouTube, Vimeo, etc.)
  const getEmbedUrl = (url: string): string | null => {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return null;
  };

  const embedUrl = getEmbedUrl(data.url);

  return (
    <div className={`${isAudio ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-3">
        {isAudio ? (
          <Play className="h-5 w-5 text-orange-600" />
        ) : (
          <Video className="h-5 w-5 text-red-600" />
        )}
        <span className={`font-medium ${isAudio ? 'text-orange-800' : 'text-red-800'}`}>
          {data.title || (isAudio ? 'Audio Clip' : 'Video Clip')}
        </span>
        {data.duration && (
          <span className="text-xs text-muted">
            ({Math.floor(data.duration / 60)}:{(data.duration % 60).toString().padStart(2, '0')})
          </span>
        )}
      </div>

      {/* Media Player */}
      <div className="mt-2">
        {isAudio ? (
          <audio
            src={data.url}
            controls
            className="w-full"
            preload="metadata"
          >
            Your browser does not support the audio element.
          </audio>
        ) : embedUrl ? (
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <video
            src={data.url}
            controls
            className="w-full rounded-lg"
            preload="metadata"
          >
            Your browser does not support the video element.
          </video>
        )}
      </div>
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

function PollBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as PollData;
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, number>>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [voted, setVoted] = useState(false);

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
    try {
      const res = await api.votePoll(content.id, selected);
      setResults(res.results);
      setTotalVotes(res.total_votes);
      setVoted(true);
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="h-5 w-5 text-green-600" />
        <span className="font-medium text-green-800">Poll</span>
      </div>
      <p className="text-theme mb-4">{data.question}</p>

      <div className="space-y-2">
        {data.options.map((opt) => {
          const count = results[opt.id] || results[opt.text] || 0;
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

          return (
            <div
              key={opt.id}
              onClick={() => !voted && setSelected(opt.id)}
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

// Select dropdown block
function SelectBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as SelectData;
  const [value, setValue] = useState(data.default_value || '');

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <ChevronRight className="h-5 w-5 text-accent" />
        <span className="font-medium text-indigo-800">Select</span>
        {data.required && <span className="text-red-500 text-sm">*</span>}
      </div>
      <label className="block text-theme mb-2">{data.label}</label>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full p-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-surface"
      >
        <option value="">{data.placeholder || 'Select an option...'}</option>
        {data.options?.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.text}</option>
        ))}
      </select>
    </div>
  );
}

// Multiselect block
function MultiselectBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as MultiselectData;
  const [selected, setSelected] = useState<string[]>(data.default_values || []);

  const toggleOption = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <List className="h-5 w-5 text-violet-600" />
        <span className="font-medium text-violet-800">Multi-Select</span>
        {data.required && <span className="text-red-500 text-sm">*</span>}
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
              onChange={() => toggleOption(opt.id)}
              className="rounded border-violet-400 text-violet-600 focus:ring-violet-500"
            />
            <span>{opt.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Text input block
function TextboxBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as TextboxData;
  const [value, setValue] = useState(data.default_value || '');

  return (
    <div className="bg-surface-hover border border-theme rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Type className="h-5 w-5 text-muted" />
        <span className="font-medium text-theme">Text Input</span>
        {data.required && <span className="text-red-500 text-sm">*</span>}
      </div>
      <label className="block text-theme mb-2">{data.label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={data.placeholder || ''}
        maxLength={data.max_length}
        className="w-full p-2 theme-input rounded-lg focus:ring-2 focus:ring-gray-500"
      />
      {data.max_length && (
        <p className="text-xs text-muted mt-1">{value.length}/{data.max_length} characters</p>
      )}
    </div>
  );
}

// Textarea block
function TextareaBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as TextareaData;
  const [value, setValue] = useState(data.default_value || '');

  return (
    <div className="bg-surface-hover border border-theme rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlignLeft className="h-5 w-5 text-muted" />
        <span className="font-medium text-theme">Text Area</span>
        {data.required && <span className="text-red-500 text-sm">*</span>}
      </div>
      <label className="block text-theme mb-2">{data.label}</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={data.placeholder || ''}
        rows={data.rows || 4}
        maxLength={data.max_length}
        className="w-full p-2 theme-input rounded-lg focus:ring-2 focus:ring-gray-500 resize-none"
      />
      {data.max_length && (
        <p className="text-xs text-muted mt-1">{value.length}/{data.max_length} characters</p>
      )}
    </div>
  );
}

// Radio button block
function RadioBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as RadioData;
  const [selected, setSelected] = useState(data.default_value || '');

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Circle className="h-5 w-5 text-orange-600" />
        <span className="font-medium text-orange-800">Choose One</span>
        {data.required && <span className="text-red-500 text-sm">*</span>}
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
              onChange={() => setSelected(opt.id)}
              className="border-orange-400 text-orange-600 focus:ring-orange-500"
            />
            <span>{opt.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Checkbox block
function CheckboxBlock({ content }: { content: InlineContent }) {
  const data = content.content_data as CheckboxData;
  const [selected, setSelected] = useState<string[]>(data.default_values || []);

  const toggleOption = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckSquare className="h-5 w-5 text-teal-600" />
        <span className="font-medium text-teal-800">Select All That Apply</span>
        {data.required && <span className="text-red-500 text-sm">*</span>}
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
              onChange={() => toggleOption(opt.id)}
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
    default:
      return null;
  }
}

// Inline Select dropdown
function InlineSelect({ content }: { content: InlineContent }) {
  const data = content.content_data as SelectData;
  const [value, setValue] = useState(data.default_value || '');

  return (
    <span className="inline-flex items-center gap-1 mx-1">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="inline-block px-2 py-0.5 text-sm border border-indigo-300 rounded bg-indigo-50 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
        style={{ minWidth: '120px' }}
      >
        <option value="">{data.placeholder || 'Select...'}</option>
        {data.options?.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.text}</option>
        ))}
      </select>
      {data.required && <span className="text-red-500 text-xs">*</span>}
    </span>
  );
}

// Inline Multiselect (shown as compact checkboxes)
function InlineMultiselect({ content }: { content: InlineContent }) {
  const data = content.content_data as MultiselectData;
  const [selected, setSelected] = useState<string[]>(data.default_values || []);

  const toggleOption = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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
    </span>
  );
}

// Inline Textbox (single line)
function InlineTextbox({ content }: { content: InlineContent }) {
  const data = content.content_data as TextboxData;
  const [value, setValue] = useState(data.default_value || '');

  return (
    <span className="inline-flex items-center gap-1 mx-1">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={data.placeholder || 'Type here...'}
        maxLength={data.max_length}
        className="inline-block px-2 py-0.5 text-sm border border-theme rounded bg-surface focus:ring-1 focus:ring-gray-500 focus:outline-none"
        style={{ minWidth: '150px', maxWidth: '250px' }}
      />
      {data.required && <span className="text-red-500 text-xs">*</span>}
    </span>
  );
}

// Inline Textarea (multi-line, but compact)
function InlineTextarea({ content }: { content: InlineContent }) {
  const data = content.content_data as TextareaData;
  const [value, setValue] = useState(data.default_value || '');

  return (
    <span className="inline-block mx-1 align-middle">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={data.placeholder || 'Enter your response...'}
        rows={data.rows || 2}
        maxLength={data.max_length}
        className="block w-64 px-2 py-1 text-sm border border-theme rounded bg-surface focus:ring-1 focus:ring-gray-500 focus:outline-none resize-none"
      />
      {data.max_length && (
        <span className="text-xs text-muted">{value.length}/{data.max_length}</span>
      )}
    </span>
  );
}

// Inline Radio buttons
function InlineRadio({ content }: { content: InlineContent }) {
  const data = content.content_data as RadioData;
  const [selected, setSelected] = useState(data.default_value || '');

  return (
    <span className="inline-flex flex-wrap items-center gap-3 mx-1 py-1 px-2 bg-orange-50 border border-orange-200 rounded">
      {data.options?.map((opt) => (
        <label key={opt.id} className="inline-flex items-center gap-1 cursor-pointer text-sm">
          <input
            type="radio"
            name={`inline-radio-${content.id}`}
            checked={selected === opt.id}
            onChange={() => setSelected(opt.id)}
            className="w-3.5 h-3.5 border-orange-400 text-orange-600 focus:ring-orange-500"
          />
          <span className="text-theme">{opt.text}</span>
        </label>
      ))}
    </span>
  );
}

// Inline Checkbox options
function InlineCheckbox({ content }: { content: InlineContent }) {
  const data = content.content_data as CheckboxData;
  const [selected, setSelected] = useState<string[]>(data.default_values || []);

  const toggleOption = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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
  onClose
}: {
  content: InlineContent;
  onClose: () => void;
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
        <InlineContentBlock content={content} />
      </div>
    </div>
  );
}

// Right Side Toolbar with content type icons
function RightSideToolbar({
  inlineContent,
  filterType,
  onFilterChange,
  onContentSelect
}: {
  inlineContent: InlineContent[];
  filterType: string | null;
  onFilterChange: (type: string | null) => void;
  onContentSelect: (content: InlineContent) => void;
}) {
  // Count items by type
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    // Initialize all types with 0
    const allTypes = [
      'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
      'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
      'code_block', 'scripture_block'
    ];
    allTypes.forEach(t => c[t] = 0);
    inlineContent.forEach(item => {
      if (c[item.content_type] !== undefined) {
        c[item.content_type]++;
      }
    });
    return c;
  }, [inlineContent]);

  // Get items for expanded list
  const filteredItems = filterType
    ? inlineContent.filter(item => item.content_type === filterType)
    : [];

  const toolbarItems = [
    { type: 'question', icon: MessageSquare, label: 'Questions', color: 'text-blue-600', bgColor: 'bg-blue-100', hoverBg: 'hover:bg-blue-50' },
    { type: 'poll', icon: BarChart2, label: 'Polls', color: 'text-green-600', bgColor: 'bg-green-100', hoverBg: 'hover:bg-green-50' },
    { type: 'highlight', icon: Highlighter, label: 'Highlights', color: 'text-yellow-600', bgColor: 'bg-yellow-100', hoverBg: 'hover:bg-yellow-50' },
    { type: 'note', icon: StickyNote, label: 'Notes', color: 'text-purple-600', bgColor: 'bg-purple-100', hoverBg: 'hover:bg-purple-50' },
    { type: 'link', icon: Link2, label: 'Links', color: 'text-cyan-600', bgColor: 'bg-cyan-100', hoverBg: 'hover:bg-cyan-50' },
    { type: 'audio', icon: Play, label: 'Audio', color: 'text-orange-600', bgColor: 'bg-orange-100', hoverBg: 'hover:bg-orange-50' },
    { type: 'video', icon: Video, label: 'Video', color: 'text-red-600', bgColor: 'bg-red-100', hoverBg: 'hover:bg-red-50' },
    { type: 'select', icon: ChevronRight, label: 'Dropdowns', color: 'text-accent', bgColor: 'bg-indigo-100', hoverBg: 'hover:bg-indigo-50' },
    { type: 'multiselect', icon: List, label: 'Multi-Selects', color: 'text-violet-600', bgColor: 'bg-violet-100', hoverBg: 'hover:bg-violet-50' },
    { type: 'textbox', icon: Type, label: 'Text Inputs', color: 'text-muted', bgColor: 'bg-surface-hover', hoverBg: 'hover:bg-surface-hover' },
    { type: 'textarea', icon: AlignLeft, label: 'Text Areas', color: 'text-muted', bgColor: 'bg-surface-hover', hoverBg: 'hover:bg-surface-hover' },
    { type: 'radio', icon: Circle, label: 'Radio Options', color: 'text-orange-600', bgColor: 'bg-orange-100', hoverBg: 'hover:bg-orange-50' },
    { type: 'checkbox', icon: CheckSquare, label: 'Checkboxes', color: 'text-teal-600', bgColor: 'bg-teal-100', hoverBg: 'hover:bg-teal-50' },
    { type: 'code_block', icon: Code, label: 'Code Blocks', color: 'text-slate-600', bgColor: 'bg-slate-100', hoverBg: 'hover:bg-slate-50' },
    { type: 'scripture_block', icon: BookOpen, label: 'Scripture', color: 'text-amber-700', bgColor: 'bg-amber-100', hoverBg: 'hover:bg-amber-50' },
  ];

  return (
    <>
      {/* Icon Toolbar - Fixed to right */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 bg-surface rounded-lg shadow-lg p-2 border-theme border">
        {toolbarItems.map(({ type, icon: Icon, label, color, bgColor, hoverBg }) => {
          const count = counts[type];
          const isActive = filterType === type;

          return (
            <button
              key={type}
              onClick={() => onFilterChange(isActive ? null : type)}
              className={`relative p-3 rounded-lg transition-all group ${
                isActive ? bgColor : hoverBg
              } ${count === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              disabled={count === 0}
              title={`${label} (${count})`}
            >
              <Icon className={`h-5 w-5 ${isActive ? color : 'text-muted group-hover:' + color}`} />

              {/* Count badge */}
              {count > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold rounded-full ${bgColor} ${color}`}>
                  {count}
                </span>
              )}

              {/* Tooltip */}
              <span className="absolute right-full mr-2 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded List Panel */}
      {filterType && filteredItems.length > 0 && (
        <div className="fixed right-20 top-1/2 -translate-y-1/2 z-20 w-72 max-h-[60vh] bg-surface rounded-lg shadow-xl border-theme border overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-theme bg-surface-hover">
            <h4 className="font-semibold capitalize text-sm">{filterType}s ({filteredItems.length})</h4>
            <button
              onClick={() => onFilterChange(null)}
              className="text-muted hover:text-theme"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[calc(60vh-48px)]">
            {filteredItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => onContentSelect(item)}
                className="w-full text-left p-3 hover:bg-surface-hover border-b border-theme last:border-b-0 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm text-theme line-clamp-2 flex-1">
                    {item.anchor_text || `${filterType} ${index + 1}`}
                  </p>
                  {/* Author/Reader Badge */}
                  {item.is_author_content ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full" title="Author content">
                      <Crown className="h-3 w-3" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full" title="Reader content">
                      <User className="h-3 w-3" />
                    </span>
                  )}
                </div>
                {item.content_data && (
                  <p className="text-xs text-muted mt-1 line-clamp-1">
                    {(item.content_data as any).question || (item.content_data as any).note || (item.content_data as any).url || ''}
                  </p>
                )}
              </button>
            ))}
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
    { type: 'question' as const, icon: MessageSquare, label: 'Question', enabled: canAddQuestion, color: 'text-blue-600 hover:bg-blue-50' },
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

// Content Filter Bar - allows filtering by author/reader content
function ContentFilterBar({
  filter,
  onFilterChange,
  isAuthor
}: {
  filter: 'all' | 'author' | 'mine';
  onFilterChange: (filter: 'all' | 'author' | 'mine') => void;
  isAuthor: boolean;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-surface rounded-full shadow-lg border-theme border px-3 py-2">
      <span className="text-xs text-muted">Show:</span>
      <button
        onClick={() => onFilterChange('all')}
        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
          filter === 'all'
            ? 'bg-primary-600 text-white'
            : 'text-muted hover:bg-surface-hover'
        }`}
      >
        All
      </button>
      <button
        onClick={() => onFilterChange('author')}
        className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
          filter === 'author'
            ? 'bg-amber-500 text-white'
            : 'text-muted hover:bg-surface-hover'
        }`}
      >
        <Crown className="h-3 w-3" />
        Author
      </button>
      <button
        onClick={() => onFilterChange('mine')}
        className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
          filter === 'mine'
            ? 'bg-blue-500 text-white'
            : 'text-muted hover:bg-surface-hover'
        }`}
      >
        <User className="h-3 w-3" />
        {isAuthor ? 'Mine' : 'My Notes'}
      </button>
    </div>
  );
}
