import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Save, Eye, MessageSquare, BarChart2, Highlighter, StickyNote, Link2, Play,
  Video, GripVertical, EyeOff, Trash2, ChevronDown, ChevronUp, ExternalLink, Pencil,
  Volume2, Square, Loader2, ChevronRight, List, Type, AlignLeft, Circle, CheckSquare, Code, BookOpen
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TipTapLink from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import InlineContentMark from '../components/editor/InlineContentMark';
import api from '../lib/api';
import type {
  Chapter, InlineContent, MediaData, QuestionData, PollData, NoteData, LinkData, HighlightData,
  SelectData, MultiselectData, TextboxData, TextareaData, RadioData, CheckboxData,
  CodeBlockData, ScriptureBlockData, CollaboratorRole
} from '../types';
import InlineContentModal from '../components/editor/InlineContentModal';
import CommentsSidebar from '../components/comments/CommentsSidebar';
import { useAuth } from '../contexts/AuthContext';

export default function ChapterEditor() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [, setChapter] = useState<Chapter | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [inlineContents, setInlineContents] = useState<InlineContent[]>([]);
  const [showInlineModal, setShowInlineModal] = useState<{
    type: InlineContent['content_type'];
    selection?: { from: number; to: number; text: string };
    editingItem?: InlineContent;
  } | null>(null);
  const [showComments, setShowComments] = useState(() => searchParams.get('comments') === '1');
  const [commentSelection, setCommentSelection] = useState<{ from: number; to: number; text: string } | null>(null);
  const [userRole, setUserRole] = useState<CollaboratorRole>('owner');

  // TTS State
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      TipTapLink.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({
        placeholder: 'Start writing your chapter...',
      }),
      InlineContentMark,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Auto-save after 2 seconds of inactivity
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        handleSave(editor.getJSON(), editor.getText());
      }, 2000);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ').trim();
        if (text) {
          setCommentSelection({ from, to, text });
        }
      } else {
        setCommentSelection(null);
      }
    },
  });

  let autoSaveTimeout: NodeJS.Timeout;

  useEffect(() => {
    if (chapterId) {
      loadChapter();
      loadInlineContent();
    }
    if (bookId) {
      api.getMyRole(bookId).then(r => setUserRole(r.role)).catch(() => {});
    }
    return () => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    };
  }, [chapterId, bookId]);

  async function loadChapter() {
    try {
      const data = await api.getChapter(chapterId!);
      setChapter(data);
      setTitle(data.title);
      if (editor && data.content) {
        // Parse content if it's a string
        let contentToSet = data.content;
        if (typeof contentToSet === 'string') {
          try {
            contentToSet = JSON.parse(contentToSet);
          } catch {
            // If parsing fails, it might be plain text
            contentToSet = data.content;
          }
        }
        // Unwrap double-encoded content
        if (contentToSet?.type === 'doc' &&
            contentToSet?.content?.length === 1 &&
            contentToSet?.content[0]?.type === 'paragraph' &&
            contentToSet?.content[0]?.content?.length === 1 &&
            contentToSet?.content[0]?.content[0]?.type === 'text') {
          const innerText = contentToSet.content[0].content[0].text;
          if (innerText && innerText.trim().startsWith('{')) {
            try {
              const innerParsed = JSON.parse(innerText);
              if (innerParsed?.type === 'doc') {
                contentToSet = innerParsed;
              }
            } catch {
              // Use original
            }
          }
        }
        editor.commands.setContent(contentToSet);
      }
    } catch (err) {
      console.error('Failed to load chapter:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadInlineContent() {
    try {
      const data = await api.getInlineContent(chapterId!);
      setInlineContents(data);

      // Apply marks for existing inline content after a short delay to ensure editor is ready
      setTimeout(() => {
        if (editor) {
          applyInlineContentMarks(data);
        }
      }, 100);
    } catch (err) {
      console.error('Failed to load inline content:', err);
    }
  }

  // Apply visual marks for all inline content items
  function applyInlineContentMarks(contents: InlineContent[]) {
    if (!editor) return;

    contents.forEach((item) => {
      if (item.start_offset !== undefined && item.end_offset !== undefined && item.start_offset !== item.end_offset) {
        try {
          editor
            .chain()
            .setTextSelection({ from: item.start_offset, to: item.end_offset })
            .setInlineContentMark({ contentType: item.content_type, contentId: item.id })
            .run();
        } catch (err) {
          // Position might be out of range if content changed
          console.debug('Could not apply mark for item:', item.id, err);
        }
      }
    });

    // Reset selection to start
    editor.commands.setTextSelection(0);
  }

  const handleSave = useCallback(async (content?: any, contentText?: string) => {
    if (!chapterId || saving) return;
    setSaving(true);
    try {
      const updateData: Partial<Chapter> = { title };
      if (content) {
        updateData.content = content;
        updateData.content_text = contentText;
      } else if (editor) {
        updateData.content = editor.getJSON();
        updateData.content_text = editor.getText();
      }
      await api.updateChapter(chapterId, updateData);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [chapterId, title, editor, saving]);

  function handleAddInlineContent(type: InlineContent['content_type']) {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    setShowInlineModal({ type, selection: { from, to, text } });
  }

  async function handleCreateInlineContent(data: Partial<InlineContent>) {
    if (!chapterId || !showInlineModal) return;
    try {
      const created = await api.createInlineContent(chapterId, {
        ...data,
        content_type: showInlineModal.type,
        start_offset: showInlineModal.selection?.from || 0,
        end_offset: showInlineModal.selection?.to || 0,
        anchor_text: showInlineModal.selection?.text,
      });

      // Apply visual mark to the selected text in the editor
      if (editor && showInlineModal.selection && showInlineModal.selection.from !== showInlineModal.selection.to) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: showInlineModal.selection.from, to: showInlineModal.selection.to })
          .setInlineContentMark({ contentType: showInlineModal.type, contentId: created.id })
          .run();
      }

      setInlineContents([...inlineContents, created]);
      setShowInlineModal(null);
    } catch (err) {
      console.error('Failed to create inline content:', err);
    }
  }

  async function handleToggleVisibility(id: string, visibility: InlineContent['visibility']) {
    try {
      await api.updateInlineContent(id, { visibility });
      setInlineContents(inlineContents.map(item =>
        item.id === id ? { ...item, visibility } : item
      ));
    } catch (err) {
      console.error('Failed to update visibility:', err);
    }
  }

  async function handleDeleteInlineContent(id: string) {
    try {
      // Find the item to get its position before deleting
      const item = inlineContents.find(i => i.id === id);

      await api.deleteInlineContent(id);
      setInlineContents(inlineContents.filter(item => item.id !== id));

      // Remove the visual mark from the editor
      if (editor && item && item.start_offset !== undefined && item.end_offset !== undefined) {
        try {
          editor
            .chain()
            .setTextSelection({ from: item.start_offset, to: item.end_offset })
            .unsetInlineContentMark()
            .run();
          editor.commands.setTextSelection(0);
        } catch {
          // Ignore if position is invalid
        }
      }
    } catch (err) {
      console.error('Failed to delete inline content:', err);
    }
  }

  async function handleMovePosition(id: string, position: InlineContent['position_in_chapter']) {
    try {
      await api.updateInlineContent(id, { position_in_chapter: position });
      setInlineContents(inlineContents.map(item =>
        item.id === id ? { ...item, position_in_chapter: position } : item
      ));
    } catch (err) {
      console.error('Failed to update position:', err);
    }
  }

  function handleEditInlineContent(item: InlineContent) {
    setShowInlineModal({
      type: item.content_type,
      editingItem: item
    });
  }

  async function handleUpdateInlineContent(id: string, data: Partial<InlineContent>) {
    try {
      await api.updateInlineContent(id, { content_data: data.content_data });
      setInlineContents(inlineContents.map(item =>
        item.id === id ? { ...item, content_data: data.content_data! } : item
      ));
      setShowInlineModal(null);
    } catch (err) {
      console.error('Failed to update inline content:', err);
    }
  }

  async function handlePlayTTS() {
    if (ttsPlaying && ttsAudio) {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
      setTtsPlaying(false);
      return;
    }

    // Get plain text from TipTap editor - getText() returns just the text content
    let text = editor?.getText() || '';

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

  return (
    <div className="min-h-screen bg-surface-hover">
      {/* Header */}
      <header className="bg-surface border-b border-theme sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link to={`/edit/book/${bookId}`} className="text-muted hover:text-theme flex-shrink-0">
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => handleSave()}
                className="text-base sm:text-xl font-semibold border-0 focus:outline-none focus:ring-0 bg-transparent min-w-0 truncate"
                placeholder="Chapter Title"
              />
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {lastSaved && (
                <span className="text-xs text-muted hidden sm:inline">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 theme-button-primary rounded disabled:opacity-50 text-sm"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
              </button>
              {commentSelection && (
                <button
                  onClick={() => setShowComments(true)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors text-sm font-medium"
                  title="Comment on selected text"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Comment</span>
                </button>
              )}
              <button
                onClick={() => setShowComments(!showComments)}
                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded transition-colors text-sm ${
                  showComments ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-surface-hover'
                }`}
                title="Comments"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Comments</span>
              </button>
              <Link
                to={`/book/${bookId}/chapter/${chapterId}`}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-muted hover:bg-surface-hover rounded text-sm"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Preview</span>
              </Link>
              <button
                onClick={handlePlayTTS}
                disabled={ttsLoading}
                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded text-sm ${
                  ttsPlaying
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'text-muted hover:bg-surface-hover'
                }`}
                title={ttsPlaying ? 'Stop audio' : 'Listen to chapter'}
              >
                {ttsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : ttsPlaying ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {ttsLoading ? 'Loading...' : ttsPlaying ? 'Stop' : 'Listen'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex max-w-[1600px] mx-auto px-4 py-6 gap-6 min-w-0">
        {/* Editor */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="bg-surface rounded-t-lg border border-b-0 border-theme p-2 flex gap-1 flex-wrap">
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive('bold')}
              title="Bold"
            >
              B
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive('italic')}
              title="Italic"
            >
              <i>I</i>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              active={editor?.isActive('underline')}
              title="Underline"
            >
              <u>U</u>
            </ToolbarButton>
            <div className="w-px bg-surface-hover mx-1" />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor?.isActive('heading', { level: 2 })}
              title="Heading"
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive('bulletList')}
              title="Bullet List"
            >
              •
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive('orderedList')}
              title="Numbered List"
            >
              1.
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              active={editor?.isActive('blockquote')}
              title="Quote"
            >
              "
            </ToolbarButton>
            <div className="w-px bg-surface-hover mx-1" />
            <ToolbarButton
              onClick={() => handleAddInlineContent('question')}
              title="Add Question"
              className="text-blue-600"
            >
              <MessageSquare className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('poll')}
              title="Add Poll"
              className="text-green-600"
            >
              <BarChart2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('highlight')}
              title="Add Highlight"
              className="text-yellow-600"
            >
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('note')}
              title="Add Note"
              className="text-purple-600"
            >
              <StickyNote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('link')}
              title="Add Link"
              className="text-blue-600"
            >
              <Link2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('audio')}
              title="Add Audio"
              className="text-red-600"
            >
              <Play className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('video')}
              title="Add Video"
              className="text-pink-600"
            >
              <Video className="h-4 w-4" />
            </ToolbarButton>
            <div className="w-px bg-surface-hover mx-1" />
            <ToolbarButton
              onClick={() => handleAddInlineContent('select')}
              title="Add Select Dropdown"
              className="text-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('multiselect')}
              title="Add Multi-Select"
              className="text-accent"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('textbox')}
              title="Add Text Input"
              className="text-muted"
            >
              <Type className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('textarea')}
              title="Add Text Area"
              className="text-muted"
            >
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('radio')}
              title="Add Radio Options"
              className="text-orange-600"
            >
              <Circle className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('checkbox')}
              title="Add Checkboxes"
              className="text-teal-600"
            >
              <CheckSquare className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('code_block')}
              title="Add Code Block"
              className="text-slate-600"
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleAddInlineContent('scripture_block')}
              title="Add Scripture"
              className="text-amber-700"
            >
              <BookOpen className="h-4 w-4" />
            </ToolbarButton>
          </div>

          {/* Editor Content */}
          <div className="bg-surface border border-theme rounded-b-lg">
            <EditorContent
              editor={editor}
              className="prose max-w-none p-6 min-h-[500px] focus:outline-none"
            />
          </div>
        </div>

        {/* Right Panel — tabbed: Comments / Inline Content */}
        <div className="w-80 flex-shrink-0 hidden lg:flex flex-col sticky top-20 self-start max-h-[calc(100vh-6rem)]">
          {/* Tab bar */}
          <div className="flex border-2 border-theme rounded-t-lg overflow-hidden bg-surface flex-shrink-0">
            <button
              onClick={() => setShowComments(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                showComments ? 'bg-accent/10 text-accent' : 'text-muted hover:text-theme hover:bg-surface-hover'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Comments
            </button>
            <div className="w-px bg-theme" />
            <button
              onClick={() => setShowComments(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                !showComments ? 'bg-accent/10 text-accent' : 'text-muted hover:text-theme hover:bg-surface-hover'
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" />
              Inline
            </button>
          </div>

          {/* Panel content */}
          {showComments && chapterId && bookId ? (
            <div className="flex-1 border-2 border-t-0 border-theme rounded-b-lg overflow-hidden flex flex-col">
              <CommentsSidebar
                chapterId={chapterId}
                bookId={bookId}
                canResolve={['owner', 'author', 'editor'].includes(userRole)}
                currentUserId={user?.id}
                onClose={() => { setShowComments(false); setCommentSelection(null); }}
                pendingSelection={commentSelection}
                onSelectionUsed={() => setCommentSelection(null)}
              />
            </div>
          ) : (
            <div className="theme-card rounded-t-none border-t-0 flex-1 overflow-hidden flex flex-col">
              <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
                <p className="text-xs text-muted">{inlineContents.length} items</p>
                <div className="flex gap-1">
                  <button onClick={() => handleAddInlineContent('audio')} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Add Audio">
                    <Play className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleAddInlineContent('video')} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Add Video">
                    <Video className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {inlineContents.length === 0 ? (
                  <div className="p-4 text-sm text-muted text-center">
                    No inline content yet. Select text and add questions, polls, or notes.
                  </div>
                ) : (
                  <div>
                    {inlineContents.map((item, index) => (
                      <InlineContentItem
                        key={item.id}
                        item={item}
                        index={index}
                        totalItems={inlineContents.length}
                        onToggleVisibility={handleToggleVisibility}
                        onDelete={handleDeleteInlineContent}
                        onMovePosition={handleMovePosition}
                        onEdit={handleEditInlineContent}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile overlay — comments only (inline content hidden on mobile) */}
      {showComments && chapterId && bookId && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 bg-black/30 z-20"
            onClick={() => { setShowComments(false); setCommentSelection(null); }}
          />
          <div className="fixed right-0 top-0 h-full z-30 w-80 border-l-2 border-theme">
            <CommentsSidebar
              chapterId={chapterId}
              bookId={bookId}
              canResolve={['owner', 'author', 'editor'].includes(userRole)}
              currentUserId={user?.id}
              onClose={() => { setShowComments(false); setCommentSelection(null); }}
              pendingSelection={commentSelection}
              onSelectionUsed={() => setCommentSelection(null)}
            />
          </div>
        </div>
      )}

      {/* Inline Content Modal */}
      {showInlineModal && (
        <InlineContentModal
          type={showInlineModal.type}
          selectedText={showInlineModal.selection?.text}
          onClose={() => setShowInlineModal(null)}
          onCreate={handleCreateInlineContent}
          editingItem={showInlineModal.editingItem}
          onUpdate={handleUpdateInlineContent}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  title,
  className = '',
  children
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium ${
        active ? 'bg-surface-hover text-theme' : 'text-muted hover:bg-surface-hover'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function InlineContentItem({
  item,
  onToggleVisibility,
  onDelete,
  onMovePosition,
  onEdit,
  index: _index,
  totalItems: _totalItems
}: {
  item: InlineContent;
  onToggleVisibility: (id: string, visibility: InlineContent['visibility']) => void;
  onDelete: (id: string) => void;
  onMovePosition: (id: string, position: InlineContent['position_in_chapter']) => void;
  onEdit: (item: InlineContent) => void;
  index: number;
  totalItems: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPositionMenu, setShowPositionMenu] = useState(false);

  const icons: Record<string, React.ReactNode> = {
    question: <MessageSquare className="h-4 w-4 text-blue-600" />,
    poll: <BarChart2 className="h-4 w-4 text-green-600" />,
    highlight: <Highlighter className="h-4 w-4 text-yellow-600" />,
    note: <StickyNote className="h-4 w-4 text-purple-600" />,
    link: <Link2 className="h-4 w-4 text-cyan-600" />,
    audio: <Play className="h-4 w-4 text-orange-600" />,
    video: <Video className="h-4 w-4 text-red-600" />,
  };

  const bgColors: Record<string, string> = {
    question: 'bg-blue-50',
    poll: 'bg-green-50',
    highlight: 'bg-yellow-50',
    note: 'bg-purple-50',
    link: 'bg-cyan-50',
    audio: 'bg-orange-50',
    video: 'bg-red-50',
  };

  const isHidden = item.visibility === 'author_only';

  return (
    <div className={`border-b last:border-b-0 ${isHidden ? 'opacity-60' : ''}`}>
      {/* Header Row */}
      <div
        className={`p-3 flex items-center gap-2 cursor-pointer hover:bg-surface-hover ${bgColors[item.content_type]}`}
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="h-4 w-4 text-muted cursor-grab" />
        {icons[item.content_type]}
        <span className="text-sm font-medium capitalize flex-1">{item.content_type}</span>
        {isHidden && <EyeOff className="h-3 w-3 text-muted" />}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted" />
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-3 bg-surface border-t border-theme">
          {/* Anchor Text */}
          {item.anchor_text && (
            <p className="text-xs text-muted mb-2 italic">"{item.anchor_text}"</p>
          )}

          {/* Content Preview */}
          <div className="mb-3">
            <ContentPreview item={item} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            {/* Visibility Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(item.id, isHidden ? 'all_readers' : 'author_only');
              }}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                isHidden
                  ? 'bg-surface-hover text-muted hover:bg-surface-hover'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
              title={isHidden ? 'Hidden from readers' : 'Visible to readers'}
            >
              {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {isHidden ? 'Hidden' : 'Visible'}
            </button>

            {/* Position Selector */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPositionMenu(!showPositionMenu);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-surface-hover text-muted hover:bg-surface-hover rounded"
              >
                {item.position_in_chapter === 'inline' ? 'Inline' :
                 item.position_in_chapter === 'end_of_chapter' ? 'End' : 'Start'}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showPositionMenu && (
                <div className="absolute left-0 top-full mt-1 bg-surface border-theme border rounded shadow-lg z-10 w-32">
                  {(['inline', 'start_of_chapter', 'end_of_chapter'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMovePosition(item.id, pos);
                        setShowPositionMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-hover ${
                        item.position_in_chapter === pos ? 'bg-primary-50 text-accent' : ''
                      }`}
                    >
                      {pos === 'inline' ? 'Inline' :
                       pos === 'start_of_chapter' ? 'Start of Chapter' : 'End of Chapter'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Edit */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>

            {/* Delete */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this content?')) {
                  onDelete(item.id);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded ml-auto"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Preview component for different content types
function ContentPreview({ item }: { item: InlineContent }) {
  const data = item.content_data;

  switch (item.content_type) {
    case 'question': {
      const q = data as QuestionData;
      return (
        <div className="text-sm">
          <p className="font-medium text-theme">{q.question}</p>
          <p className="text-xs text-muted mt-1">Type: {q.type}</p>
          {q.options && (
            <ul className="mt-1 text-xs text-muted list-disc list-inside">
              {q.options.slice(0, 3).map((opt, i) => (
                <li key={i}>{opt.text}</li>
              ))}
              {q.options.length > 3 && <li className="text-muted">+{q.options.length - 3} more</li>}
            </ul>
          )}
        </div>
      );
    }

    case 'poll': {
      const p = data as PollData;
      return (
        <div className="text-sm">
          <p className="font-medium text-theme">{p.question}</p>
          <ul className="mt-1 text-xs text-muted list-disc list-inside">
            {p.options.slice(0, 3).map((opt, i) => (
              <li key={i}>{opt.text}</li>
            ))}
            {p.options.length > 3 && <li className="text-muted">+{p.options.length - 3} more</li>}
          </ul>
        </div>
      );
    }

    case 'audio':
    case 'video': {
      const m = data as MediaData;
      return (
        <div className="text-sm">
          <p className="font-medium text-theme mb-2">{m.title || `${item.content_type} clip`}</p>
          {item.content_type === 'audio' ? (
            <audio src={m.url} controls className="w-full h-8" preload="metadata" />
          ) : (
            <video src={m.url} controls className="w-full rounded" preload="metadata" style={{ maxHeight: '150px' }} />
          )}
          {m.duration && (
            <p className="text-xs text-muted mt-1">
              Duration: {Math.floor(m.duration / 60)}:{(m.duration % 60).toString().padStart(2, '0')}
            </p>
          )}
        </div>
      );
    }

    case 'link': {
      const l = data as LinkData;
      return (
        <div className="text-sm">
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-600 hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {l.title || l.url}
            <ExternalLink className="h-3 w-3" />
          </a>
          {l.description && (
            <p className="text-xs text-muted mt-1">{l.description}</p>
          )}
        </div>
      );
    }

    case 'note': {
      const n = data as NoteData;
      return (
        <div className="text-sm">
          <span className="text-xs text-purple-600 font-medium uppercase">{n.type}</span>
          <p className="text-theme mt-1">{n.text}</p>
        </div>
      );
    }

    case 'highlight': {
      const h = data as HighlightData;
      const colorClass = {
        yellow: 'bg-yellow-200',
        green: 'bg-green-200',
        blue: 'bg-blue-200',
        pink: 'bg-pink-200',
      }[h.color] || 'bg-yellow-200';
      return (
        <div className="text-sm">
          <span className={`px-2 py-0.5 rounded ${colorClass}`}>
            {item.anchor_text || 'Highlighted text'}
          </span>
          {h.note && <p className="text-muted mt-1 text-xs">{h.note}</p>}
        </div>
      );
    }

    case 'select': {
      const s = data as SelectData;
      return (
        <div className="text-sm">
          <p className="font-medium text-theme">{s.label}</p>
          <p className="text-xs text-muted mt-1">Dropdown with {s.options?.length || 0} options</p>
        </div>
      );
    }

    case 'multiselect': {
      const ms = data as MultiselectData;
      return (
        <div className="text-sm">
          <p className="font-medium text-theme">{ms.label}</p>
          <p className="text-xs text-muted mt-1">Multi-select with {ms.options?.length || 0} options</p>
        </div>
      );
    }

    case 'textbox': {
      const tb = data as TextboxData;
      return (
        <div className="text-sm">
          <p className="font-medium text-theme">{tb.label}</p>
          <p className="text-xs text-muted mt-1">Text input{tb.required ? ' (required)' : ''}</p>
        </div>
      );
    }

    case 'textarea': {
      const ta = data as TextareaData;
      return (
        <div className="text-sm">
          <p className="font-medium text-theme">{ta.label}</p>
          <p className="text-xs text-muted mt-1">Multi-line text ({ta.rows || 4} rows){ta.required ? ' - required' : ''}</p>
        </div>
      );
    }

    case 'radio': {
      const r = data as RadioData;
      return (
        <div className="text-sm">
          <p className="font-medium text-theme">{r.label}</p>
          <ul className="mt-1 text-xs text-muted">
            {r.options?.slice(0, 3).map((opt, i) => (
              <li key={i} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full border border-strong"></span>
                {opt.text}
              </li>
            ))}
            {(r.options?.length || 0) > 3 && <li className="text-muted">+{(r.options?.length || 0) - 3} more</li>}
          </ul>
        </div>
      );
    }

    case 'checkbox': {
      const c = data as CheckboxData;
      return (
        <div className="text-sm">
          <p className="font-medium text-theme">{c.label}</p>
          <ul className="mt-1 text-xs text-muted">
            {c.options?.slice(0, 3).map((opt, i) => (
              <li key={i} className="flex items-center gap-1">
                <span className="w-2 h-2 border border-strong"></span>
                {opt.text}
              </li>
            ))}
            {(c.options?.length || 0) > 3 && <li className="text-muted">+{(c.options?.length || 0) - 3} more</li>}
          </ul>
        </div>
      );
    }

    case 'code_block': {
      const cb = data as CodeBlockData;
      return (
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-surface-hover px-1 rounded">{cb.language}</span>
            {cb.title && <span className="text-theme font-medium">{cb.title}</span>}
          </div>
          <pre className="mt-1 text-xs bg-surface-hover p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap">
            {cb.code?.substring(0, 100)}{(cb.code?.length || 0) > 100 ? '...' : ''}
          </pre>
        </div>
      );
    }

    case 'scripture_block': {
      const sb = data as ScriptureBlockData;
      return (
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-700">{sb.reference}</span>
            {sb.version && <span className="text-xs text-muted">({sb.version})</span>}
          </div>
          <p className="mt-1 text-theme italic text-xs line-clamp-2">"{sb.text}"</p>
        </div>
      );
    }

    default:
      return <p className="text-sm text-muted">Preview not available</p>;
  }
}
