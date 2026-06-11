import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Save, Eye, MessageSquare, BarChart2, Highlighter, StickyNote, Link2, Play,
  Video, GripVertical, EyeOff, Trash2, ChevronDown, ChevronUp, ExternalLink, Pencil,
  Volume2, Square, Loader2, ChevronRight, List, Type, AlignLeft, Circle, CheckSquare, Code, BookOpen,
  LayoutGrid, Image, ArrowUp, ArrowDown, Copy
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TipTapLink from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import InlineContentMark from '../components/editor/InlineContentMark';
import { InlineFormNode } from '../components/editor/InlineFormNode';
import { ColumnLayout, ColumnCell } from '../components/editor/ColumnLayoutNode';
import api from '../lib/api';
import type {
  Chapter, InlineContent, MediaData, QuestionData, PollData, NoteData, LinkData, HighlightData,
  SelectData, MultiselectData, TextboxData, TextareaData, RadioData, CheckboxData,
  CodeBlockData, ScriptureBlockData, ImageData, CollaboratorRole, BookSettings
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
  const [liveEpisode, setLiveEpisode] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [inlineContents, setInlineContents] = useState<InlineContent[]>([]);
  const inlineContentsRef = useRef<InlineContent[]>([]);
  const [showInlineModal, setShowInlineModal] = useState<{
    type: InlineContent['content_type'];
    selection?: { from: number; to: number; text: string };
    editingItem?: InlineContent;
  } | null>(null);
  const [showComments, setShowComments] = useState(() => searchParams.get('comments') === '1');
  const [commentSelection, setCommentSelection] = useState<{ from: number; to: number; text: string } | null>(null);
  const [userRole, setUserRole] = useState<CollaboratorRole>('owner');
  const [bookSettings, setBookSettings] = useState<BookSettings | null>(null);
  const [markTooltip, setMarkTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

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
      InlineFormNode,
      ColumnLayout,
      ColumnCell,
    ],
    content: '',
    editorProps: {
      transformPastedHTML(html) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        // Strip <mark> tags (TipTap Highlight) — unwrap to plain text nodes
        wrapper.querySelectorAll('mark').forEach(mark => {
          mark.replaceWith(...Array.from(mark.childNodes));
        });

        // Strip inline-content spans (question/poll/highlight markers) — unwrap
        wrapper.querySelectorAll('span[data-inline-content]').forEach(span => {
          span.replaceWith(...Array.from(span.childNodes));
        });

        // Convert stray bullet-character paragraphs (•) into proper list items
        // e.g. <p>• some item</p> → <ul><li>some item</li></ul>
        const paras = Array.from(wrapper.querySelectorAll('p'));
        let currentUl: HTMLUListElement | null = null;

        for (const p of paras) {
          const text = p.textContent || '';
          const match = text.match(/^[•\-\*]\s+(.*)$/u);
          if (match) {
            if (!currentUl) {
              currentUl = document.createElement('ul');
              p.parentNode!.insertBefore(currentUl, p);
            }
            const li = document.createElement('li');
            li.textContent = match[1];
            currentUl.appendChild(li);
            p.remove();
          } else {
            currentUl = null;
          }
        }

        return wrapper.innerHTML;
      },
    },
    onUpdate: ({ editor }) => {
      // Auto-save after 2 seconds of inactivity
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        handleSave(editor.getJSON(), editor.getText());
      }, 2000);

      // Detect inlineFormWidget nodes removed from the doc and delete orphaned items
      const presentIds = new Set<string>();
      editor.state.doc.descendants(node => {
        if (node.type.name === 'inlineFormWidget' && node.attrs.contentId) {
          presentIds.add(node.attrs.contentId);
        }
      });
      const current = inlineContentsRef.current;
      const FORM_TYPES = ['textbox', 'textarea', 'select', 'multiselect', 'radio', 'checkbox'];
      const orphaned = current.filter(
        ic => FORM_TYPES.includes(ic.content_type) &&
          (!ic.position_in_chapter || ic.position_in_chapter === 'inline') &&
          !presentIds.has(ic.id)
      );
      if (orphaned.length > 0) {
        const names = orphaned.map(ic => `"${ic.anchor_text || ic.content_type}"`).join(', ');
        if (window.confirm(`Delete ${orphaned.length} removed form item(s) from the sidebar?\n\n${names}`)) {
          orphaned.forEach(ic => {
            api.deleteInlineContent(ic.id).catch(console.error);
          });
          setInlineContents(prev => prev.filter(ic => !orphaned.some(o => o.id === ic.id)));
        }
      }
    },
    onPaste: () => {
      // Re-apply marks after paste since positions shift
      setTimeout(() => applyInlineContentMarks(inlineContents), 50);
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

  let autoSaveTimeout: ReturnType<typeof setTimeout>;

  useEffect(() => {
    if (chapterId) {
      loadChapter();
      loadInlineContent();
    }
    if (bookId) {
      api.getMyRole(bookId).then(r => setUserRole(r.role)).catch(() => {});
      api.getBook(bookId).then(b => setBookSettings(b.settings ?? null)).catch(() => {});
    }
    return () => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    };
  }, [chapterId, bookId]);

  // Poll for a live episode presenting this chapter/book
  useEffect(() => {
    if (!bookId) return;
    let interval: number;
    const check = async () => {
      try {
        const r = await api.getLiveEpisodes({ status: 'live' });
        const ep = (r.episodes ?? []).find((e: any) =>
          e.chapter_id === chapterId || e.live_shows?.book_id === bookId
        );
        setLiveEpisode(ep ?? null);
      } catch { /* silent */ }
    };
    check();
    interval = window.setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [bookId, chapterId]);

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

  // Keep ref in sync so onUpdate closure can access current inlineContents without stale capture
  useEffect(() => { inlineContentsRef.current = inlineContents; }, [inlineContents]);

  // Double-click on any inlineFormWidget node opens its config modal
  useEffect(() => {
    function handleInlineEdit(e: Event) {
      const { contentId } = (e as CustomEvent<{ contentId: string }>).detail;
      const item = inlineContentsRef.current.find(ic => ic.id === contentId);
      if (item) handleEditInlineContent(item);
    }
    const editorEl = editor?.view?.dom;
    editorEl?.addEventListener('inlineform:edit', handleInlineEdit);
    return () => editorEl?.removeEventListener('inlineform:edit', handleInlineEdit);
  }, [editor]);

  // Close column picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

    const doc = editor.state.doc;
    const tr = editor.state.tr;
    const markType = editor.schema.marks.inlineContentMark;
    if (!markType) return;

    // First remove all existing inlineContentMark marks
    doc.descendants((node, pos) => {
      if (node.isText) {
        const mark = node.marks.find(m => m.type === markType);
        if (mark) tr.removeMark(pos, pos + node.nodeSize, markType);
      }
    });

    // Re-apply each item by searching for anchor_text in the document
    contents.forEach((item) => {
      const anchor = item.anchor_text;
      if (!anchor) return;

      let found = false;
      doc.descendants((node, pos) => {
        if (found || !node.isText) return;
        const idx = node.text!.indexOf(anchor);
        if (idx === -1) return;
        const from = pos + idx;
        const to = from + anchor.length;
        const mark = markType.create({ contentType: item.content_type, contentId: item.id });
        tr.addMark(from, to, mark);
        found = true;
      });
    });

    editor.view.dispatch(tr);
    editor.commands.setTextSelection(0);
  }

  const handleSave = useCallback(async (content?: any, contentText?: string) => {
    if (!chapterId || saving) return;
    setSaving(true);
    try {
      const updateData: Partial<Chapter> = { title };
      const rawText = contentText ?? (editor?.getText() ?? '');
      if (content) {
        updateData.content = content;
        updateData.content_text = contentText;
      } else if (editor) {
        updateData.content = editor.getJSON();
        updateData.content_text = rawText;
      }
      const words = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
      updateData.word_count = words;
      updateData.estimated_read_time_minutes = Math.max(1, Math.round(words / 200));
      await api.updateChapter(chapterId, updateData);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [chapterId, title, editor, saving]);

  // Attach hover tooltip + click-to-scroll to inline content marks in the TipTap editor
  useEffect(() => {
    if (!editor) return;
    const editorEl = editor.view.dom;

    function getLabel(contentId: string) {
      const item = inlineContents.find(i => i.id === contentId);
      if (!item) return null;
      const data = item.content_data as any;
      const typeLabel = item.content_type.replace(/_/g, ' ');
      const label = data?.label || data?.question || data?.placeholder || '';
      return label ? `${typeLabel}: ${label}` : typeLabel;
    }

    function onMouseOver(e: MouseEvent) {
      const span = (e.target as Element).closest('[data-inline-content]') as HTMLElement | null;
      if (!span) return;
      const contentId = span.getAttribute('data-content-id');
      if (!contentId) return;
      const label = getLabel(contentId);
      if (!label) return;
      const rect = span.getBoundingClientRect();
      setMarkTooltip({ label, x: rect.left + rect.width / 2, y: rect.top - 8 });
    }

    function onMouseOut(e: MouseEvent) {
      const related = e.relatedTarget as Element | null;
      if (related?.closest('[data-inline-content]')) return;
      setMarkTooltip(null);
    }

    function onClick(e: MouseEvent) {
      const span = (e.target as Element).closest('[data-inline-content]') as HTMLElement | null;
      if (!span) return;
      const contentId = span.getAttribute('data-content-id');
      if (!contentId) return;
      // Always scroll to the preview item wherever it lives (top strip, inline strip, or bottom strip)
      const target = document.getElementById(`preview-${contentId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('ring-2', 'ring-accent', 'ring-offset-1', 'rounded');
        setTimeout(() => target.classList.remove('ring-2', 'ring-accent', 'ring-offset-1', 'rounded'), 1500);
      }
    }

    editorEl.addEventListener('mouseover', onMouseOver);
    editorEl.addEventListener('mouseout', onMouseOut);
    editorEl.addEventListener('click', onClick);
    return () => {
      editorEl.removeEventListener('mouseover', onMouseOver);
      editorEl.removeEventListener('mouseout', onMouseOut);
      editorEl.removeEventListener('click', onClick);
    };
  }, [editor, inlineContents]);

  function handleAddInlineContent(type: InlineContent['content_type']) {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ').trim();
    setShowInlineModal({ type, selection: { from, to, text } });
  }

  const INLINE_FORM_TYPES = ['textbox', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'poll'];
  // Types that can be inserted as an atom node at the cursor (no text selection needed)
  const CURSOR_INSERTABLE_TYPES = ['audio', 'video', 'image', 'question', 'highlight', 'note', 'link', 'code_block', 'scripture_block'];

  async function handleCreateInlineContent(data: Partial<InlineContent>) {
    if (!chapterId || !showInlineModal) return;
    try {
      const hasSelection = showInlineModal.selection && showInlineModal.selection.from !== showInlineModal.selection.to;
      const isFormType = INLINE_FORM_TYPES.includes(showInlineModal.type);
      const isCursorInsertable = CURSOR_INSERTABLE_TYPES.includes(showInlineModal.type);
      // hasCursor: user clicked a position in the editor (even without selecting text)
      const cursorPos = showInlineModal.selection?.from ?? 0;
      const hasCursor = cursorPos > 0;

      // When no text is selected, use the label from content_data as the anchor text
      const anchorText = hasSelection
        ? showInlineModal.selection!.text
        : ((data.content_data as any)?.label || (data.content_data as any)?.question || (data.content_data as any)?.title || '');

      // Determine insertion position:
      // - Has selection → inline (form/mark)
      // - Form type, no selection → inline at cursor
      // - Media/image/other with cursor → inline at cursor
      // - Media/image/other, no cursor → end_of_chapter
      const resolvedPosition: InlineContent['position_in_chapter'] =
        hasSelection || isFormType || (isCursorInsertable && hasCursor)
          ? (data.position_in_chapter ?? 'inline')
          : 'end_of_chapter';

      const created = await api.createInlineContent(chapterId, {
        ...data,
        content_type: showInlineModal.type,
        position_in_chapter: resolvedPosition,
        start_offset: cursorPos,
        end_offset: showInlineModal.selection?.to || cursorPos,
        anchor_text: anchorText || undefined,
      });

      if (editor) {
        const isInline = !created.position_in_chapter || created.position_in_chapter === 'inline';

        if (isInline) {
          if (isFormType) {
            if (hasSelection) {
              // Replace the selected anchor text with an InlineFormNode atom
              editor
                .chain()
                .focus()
                .setTextSelection({ from: showInlineModal.selection!.from, to: showInlineModal.selection!.to })
                .insertInlineFormNode({
                  contentId: created.id,
                  contentType: showInlineModal.type,
                  anchorText,
                  contentData: created.content_data ?? null,
                  position: (created.position_in_chapter as any) ?? 'inline',
                })
                .run();
            } else {
              // No selection: insert the form node at cursor
              editor
                .chain()
                .focus()
                .setTextSelection(cursorPos)
                .insertInlineFormNode({
                  contentId: created.id,
                  contentType: showInlineModal.type,
                  anchorText,
                  contentData: created.content_data ?? null,
                  position: (created.position_in_chapter as any) ?? 'inline',
                })
                .run();
            }
          } else if (hasSelection) {
            // Non-form with selection: apply a mark on the selected text
            editor
              .chain()
              .focus()
              .setTextSelection({ from: showInlineModal.selection!.from, to: showInlineModal.selection!.to })
              .setInlineContentMark({ contentType: showInlineModal.type, contentId: created.id })
              .run();
          } else if (isCursorInsertable && hasCursor) {
            // Media/image with cursor but no selection: insert atom node at cursor position
            editor
              .chain()
              .focus()
              .setTextSelection(cursorPos)
              .insertInlineFormNode({
                contentId: created.id,
                contentType: showInlineModal.type,
                anchorText,
                contentData: created.content_data ?? null,
                position: 'inline',
              })
              .run();
          }
        }
        // Non-inline → placed in panel, no editor change needed
      }

      setInlineContents(prev => [...prev, created]);
      setShowInlineModal(null);
    } catch (err) {
      console.error('Failed to create inline content:', err);
      alert('Failed to add content: ' + (err instanceof Error ? err.message : String(err)));
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
      const item = inlineContents.find(i => i.id === id);

      await api.deleteInlineContent(id);
      setInlineContents(inlineContents.filter(i => i.id !== id));

      if (editor && item) {
        const isFormType = INLINE_FORM_TYPES.includes(item.content_type);
        const isInline = !item.position_in_chapter || item.position_in_chapter === 'inline';

        if (isFormType && isInline) {
          // Find and delete the InlineFormNode atom in the document
          const { state } = editor;
          const { tr } = state;
          let found = false;
          state.doc.descendants((node, pos) => {
            if (found) return;
            if (node.type.name === 'inlineFormWidget' && node.attrs.contentId === id) {
              tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(item.anchor_text || ''));
              found = true;
            }
          });
          if (found) editor.view.dispatch(tr);
        } else {
          // Remove the Mark from anchor text range
          try {
            if (item.start_offset !== undefined && item.end_offset !== undefined) {
              editor
                .chain()
                .setTextSelection({ from: item.start_offset, to: item.end_offset })
                .unsetInlineContentMark()
                .run();
              editor.commands.setTextSelection(0);
            }
          } catch {
            // Ignore invalid positions
          }
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

      // Update the node attr in the editor so the pill reflects the new position immediately
      if (editor) {
        const { state } = editor;
        const { tr } = state;
        let found = false;
        state.doc.descendants((node, pos) => {
          if (found) return;
          if (node.type.name === 'inlineFormWidget' && node.attrs.contentId === id) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, position });
            found = true;
          }
        });
        if (found) editor.view.dispatch(tr);
      }
    } catch (err) {
      console.error('Failed to update position:', err);
    }
  }

  async function handleReorderItem(id: string, direction: 'up' | 'down') {
    const item = inlineContents.find(i => i.id === id);
    if (!item) return;
    const zone = item.position_in_chapter || 'inline';
    const zoneItems = [...inlineContents]
      .filter(i => (i.position_in_chapter || 'inline') === zone)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const idx = zoneItems.findIndex(i => i.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === zoneItems.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const swapItem = zoneItems[swapIdx];
    const newOrder = (item.order_index ?? idx);
    const swapOrder = (swapItem.order_index ?? swapIdx);
    try {
      await api.reorderInlineContent(id, swapOrder);
      await api.reorderInlineContent(swapItem.id, newOrder);
      setInlineContents(prev => prev.map(i => {
        if (i.id === id) return { ...i, order_index: swapOrder };
        if (i.id === swapItem.id) return { ...i, order_index: newOrder };
        return i;
      }));
    } catch (err) {
      console.error('Failed to reorder:', err);
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
      // Update the node attrs in the TipTap doc so the editor preview re-renders immediately
      if (editor && data.content_data) {
        const { state, view } = editor;
        const { tr } = state;
        let found = false;
        state.doc.descendants((node, pos) => {
          if (found) return false;
          if (node.type.name === 'inlineFormWidget' && node.attrs.contentId === id) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, contentData: data.content_data });
            found = true;
          }
        });
        if (found) view.dispatch(tr);
      }
      setShowInlineModal(null);
    } catch (err) {
      console.error('Failed to update inline content:', err);
    }
  }

  async function handleDuplicateInlineContent(id: string) {
    const item = inlineContents.find(i => i.id === id);
    if (!item || !chapterId) return;
    try {
      const isFormType = INLINE_FORM_TYPES.includes(item.content_type);
      const created = await api.createInlineContent(chapterId, {
        content_type: item.content_type,
        content_data: item.content_data,
        anchor_text: item.anchor_text,
        position_in_chapter: item.position_in_chapter ?? 'inline',
        visibility: item.visibility,
        response_visibility: (item as any).response_visibility,
        // place it after the original (end of list)
        start_offset: item.start_offset,
        end_offset: item.end_offset,
      });

      // Insert a new editor node for form types so it's visible in the document
      if (editor && isFormType && (!item.position_in_chapter || item.position_in_chapter === 'inline')) {
        // Find the original node and insert the duplicate right after it
        const { state } = editor;
        let insertPos: number | null = null;
        state.doc.descendants((node, pos) => {
          if (insertPos !== null) return false;
          if (node.type.name === 'inlineFormWidget' && node.attrs.contentId === id) {
            insertPos = pos + node.nodeSize;
          }
        });
        if (insertPos !== null) {
          editor
            .chain()
            .focus()
            .setTextSelection(insertPos)
            .insertInlineFormNode({
              contentId: created.id,
              contentType: created.content_type,
              anchorText: created.anchor_text || '',
              contentData: created.content_data ?? null,
              position: (created.position_in_chapter as any) ?? 'inline',
            })
            .run();
        }
      }

      setInlineContents(prev => [...prev, created]);
    } catch (err) {
      console.error('Failed to duplicate inline content:', err);
      alert('Failed to duplicate: ' + (err instanceof Error ? err.message : String(err)));
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
      {/* Live Episode Banner */}
      {liveEpisode && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="animate-pulse font-bold shrink-0">🔴 PRESENTING LIVE</span>
            <span className="font-medium truncate">{liveEpisode.title}</span>
          </div>
          <Link to={`/live/episode/${liveEpisode.id}/dashboard`} className="bg-white text-red-700 px-3 py-1 rounded text-xs font-bold hover:bg-red-50 transition-colors shrink-0">
            Control Room →
          </Link>
        </div>
      )}

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
              <span className={`text-xs text-muted hidden sm:inline transition-opacity duration-500 ${lastSaved && !saving ? 'opacity-100' : 'opacity-0'}`}>
                Saved
              </span>
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
          {/* Start of Chapter Preview */}
          {(bookSettings?.show_inline_form_preview ?? true) && (() => {
            const POSITIONED_TYPES = ['textbox', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'audio', 'video', 'code_block', 'scripture_block'];
            const startItems = inlineContents.filter(
              item => POSITIONED_TYPES.includes(item.content_type) && item.position_in_chapter === 'start_of_chapter'
            );
            if (startItems.length === 0) return null;
            return (
              <div className="mb-3 bg-surface border border-theme rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-theme bg-blue-50 flex items-center gap-2">
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Start of Chapter</span>
                  <span className="text-xs text-blue-500">({startItems.length} item{startItems.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {startItems.map(item => (
                    <InlineFormPreviewItem key={item.id} item={item} />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Toolbar */}
          <div className="bg-surface rounded-t-lg border border-b-0 border-theme p-2 flex gap-1 flex-wrap sticky top-12 z-20 shadow-sm">
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
            <ToolbarButton
              onClick={() => handleAddInlineContent('image')}
              title="Add Image"
              className="text-sky-600"
            >
              <Image className="h-4 w-4" />
            </ToolbarButton>
            <div className="w-px bg-surface-hover mx-1" />
            {/* Column Layout picker */}
            <div className="relative" ref={colPickerRef}>
              <ToolbarButton
                onClick={() => setShowColPicker(v => !v)}
                active={showColPicker || editor?.isActive('columnLayout')}
                title="Insert column layout"
                className="text-violet-600"
              >
                <LayoutGrid className="h-4 w-4" />
              </ToolbarButton>
              {showColPicker && (
                <div className="absolute top-full left-0 mt-1 bg-surface border border-theme rounded-lg shadow-lg z-50 py-1 min-w-[130px]">
                  <p className="px-3 pt-1 pb-1 text-[10px] font-semibold text-muted uppercase tracking-wider">Columns</p>
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => {
                        editor?.commands.insertColumnLayout(n);
                        setShowColPicker(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-hover transition-colors text-theme flex items-center gap-2"
                    >
                      <span className="text-violet-600 font-mono text-xs">{n}×</span>
                      {n} columns
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor Content */}
          <div className="bg-surface border border-theme rounded-b-lg">
            <EditorContent
              editor={editor}
              className="prose max-w-none p-6 min-h-[500px] focus:outline-none"
            />
          </div>

          {/* End of Chapter Preview */}
          {(bookSettings?.show_inline_form_preview ?? true) && (() => {
            const POSITIONED_TYPES = ['textbox', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'audio', 'video', 'code_block', 'scripture_block'];
            const endItems = inlineContents.filter(
              item => POSITIONED_TYPES.includes(item.content_type) && item.position_in_chapter === 'end_of_chapter'
            );
            if (endItems.length === 0) return null;
            return (
              <div className="mt-3 bg-surface border border-theme rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-theme bg-amber-50 flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">End of Chapter</span>
                  <span className="text-xs text-amber-500">({endItems.length} item{endItems.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {endItems.map(item => (
                    <InlineFormPreviewItem key={item.id} item={item} />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right Panel — tabbed: Comments / Inline Content */}
        <div className="w-80 flex-shrink-0 hidden lg:flex flex-col sticky top-20 h-[calc(100vh-6rem)]">
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
                    {[...inlineContents]
                      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                      .map((item, index, arr) => (
                      <InlineContentItem
                        key={item.id}
                        item={item}
                        index={index}
                        totalItems={arr.filter(i => (i.position_in_chapter || 'inline') === (item.position_in_chapter || 'inline')).length}
                        onToggleVisibility={handleToggleVisibility}
                        onDelete={handleDeleteInlineContent}
                        onMovePosition={handleMovePosition}
                        onReorder={handleReorderItem}
                        onEdit={handleEditInlineContent}
                        onDuplicate={handleDuplicateInlineContent}
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

      {/* Mark tooltip */}
      {markTooltip && (
        <div
          className="fixed z-50 pointer-events-none px-2 py-1 rounded bg-gray-900 text-white text-xs shadow-lg -translate-x-1/2 -translate-y-full"
          style={{ left: markTooltip.x, top: markTooltip.y }}
        >
          {markTooltip.label}
        </div>
      )}

      {/* Inline Content Modal */}
      {showInlineModal && (
        <InlineContentModal
          type={showInlineModal.type}
          selectedText={showInlineModal.selection?.text}
          hasCursor={!!(showInlineModal.selection?.from && showInlineModal.selection.from > 0)}
          bookId={bookId}
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
  onReorder,
  onEdit,
  onDuplicate,
  index,
  totalItems
}: {
  item: InlineContent;
  onToggleVisibility: (id: string, visibility: InlineContent['visibility']) => void;
  onDelete: (id: string) => void;
  onMovePosition: (id: string, position: InlineContent['position_in_chapter']) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onEdit: (item: InlineContent) => void;
  onDuplicate: (id: string) => void;
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
    image: <Image className="h-4 w-4 text-sky-600" />,
  };

  const bgColors: Record<string, string> = {
    question: 'bg-blue-50',
    poll: 'bg-green-50',
    highlight: 'bg-yellow-50',
    note: 'bg-purple-50',
    link: 'bg-cyan-50',
    audio: 'bg-orange-50',
    video: 'bg-red-50',
    image: 'bg-sky-50',
  };

  const isHidden = item.visibility === 'author_only';

  return (
    <div className={`border-b last:border-b-0 ${isHidden ? 'opacity-60' : ''}`}>
      {/* Header Row */}
      <div
        className={`p-3 flex items-center gap-2 cursor-pointer hover:bg-surface-hover ${bgColors[item.content_type]}`}
        onClick={() => {
          setExpanded(!expanded);
          const target = document.getElementById(`preview-${item.id}`);
          if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.classList.add('ring-2', 'ring-accent', 'ring-offset-1', 'rounded'); setTimeout(() => target.classList.remove('ring-2', 'ring-accent', 'ring-offset-1', 'rounded'), 1500); }
        }}
      >
        <GripVertical className="h-4 w-4 text-muted cursor-grab" />
        {icons[item.content_type]}
        <span className="text-sm font-medium capitalize flex-1">{item.anchor_text || item.content_type}</span>
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
                {item.position_in_chapter === 'end_of_chapter' ? 'End' :
                 item.position_in_chapter === 'start_of_chapter' ? 'Start' : 'Inline'}
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
                        (pos === 'inline' ? (!item.position_in_chapter || item.position_in_chapter === 'inline') : item.position_in_chapter === pos) ? 'bg-primary-50 text-accent' : ''
                      }`}
                    >
                      {pos === 'inline' ? 'Inline' :
                       pos === 'start_of_chapter' ? 'Start of Chapter' : 'End of Chapter'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reorder */}
            <button
              onClick={(e) => { e.stopPropagation(); onReorder(item.id, 'up'); }}
              disabled={index === 0}
              className="p-1 text-xs text-muted hover:text-theme disabled:opacity-30 rounded"
              title="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReorder(item.id, 'down'); }}
              disabled={index === totalItems - 1}
              className="p-1 text-xs text-muted hover:text-theme disabled:opacity-30 rounded"
              title="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>

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

            {/* Duplicate */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(item.id);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-violet-100 text-violet-600 hover:bg-violet-200 rounded"
              title="Duplicate this component — creates a new copy with a new ID, tracked separately in progress"
            >
              <Copy className="h-3 w-3" />
              Duplicate
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
      const isAudio = item.content_type === 'audio';
      return (
        <div className={`rounded-xl overflow-hidden ${isAudio ? 'bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-3' : 'bg-black'}`}>
          {m.title && <p className={`text-xs font-medium mb-2 ${isAudio ? 'text-orange-800' : 'text-slate-300 px-3 pt-2'}`}>{m.title}</p>}
          {isAudio ? (
            <audio src={m.url} controls className="w-full h-8" preload="metadata" />
          ) : (
            <video
              src={m.url}
              preload="metadata"
              className="w-full block rounded-xl"
              style={{ maxHeight: '140px', objectFit: 'contain', background: 'black' }}
              controlsList="nodownload"
              controls
            />
          )}
          {m.duration && (
            <p className={`text-xs mt-1 ${isAudio ? 'text-orange-600' : 'text-slate-400 px-3 pb-2'}`}>
              {Math.floor(m.duration / 60)}:{(m.duration % 60).toString().padStart(2, '0')}
            </p>
          )}
        </div>
      );
    }

    case 'image': {
      const img = data as ImageData;
      return (
        <div className="text-sm">
          <img src={img.url} alt={img.alt || 'Image'} className="w-full rounded object-contain max-h-36 bg-gray-50" />
          {img.caption && <p className="text-xs text-muted mt-1 italic">{img.caption}</p>}
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

// Inline form preview strip item — shows anchor text highlighted beside the actual input control
function InlineFormPreviewItem({ item }: { item: InlineContent }) {
  const data = item.content_data as any;
  const anchorText = item.anchor_text || item.content_type;

  const anchorClass: Record<string, string> = {
    textbox:     'inline-form inline-textbox',
    textarea:    'inline-form inline-textarea',
    select:      'inline-form inline-select',
    multiselect: 'inline-form inline-multiselect',
    radio:       'inline-form inline-radio',
    checkbox:    'inline-form inline-checkbox',
  };
  const cls = anchorClass[item.content_type] || 'inline-form';

  function renderInput() {
    switch (item.content_type) {
      case 'textbox':
        return (
          <input
            type="text"
            placeholder={data?.placeholder || ''}
            className="border border-theme rounded px-2 py-1 text-sm bg-surface text-theme focus:outline-none focus:ring-1 focus:ring-accent"
            readOnly
          />
        );
      case 'textarea':
        return (
          <textarea
            placeholder={data?.placeholder || ''}
            rows={2}
            className="border border-theme rounded px-2 py-1 text-sm bg-surface text-theme focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            readOnly
          />
        );
      case 'select':
        return (
          <select className="border border-theme rounded px-2 py-1 text-sm bg-surface text-theme focus:outline-none focus:ring-1 focus:ring-accent" disabled>
            <option value="">{data?.placeholder || 'Select...'}</option>
            {(data?.options || []).map((opt: any, i: number) => (
              <option key={i} value={opt.id ?? i}>{opt.text ?? opt.label ?? String(opt)}</option>
            ))}
          </select>
        );
      case 'multiselect':
        return (
          <select multiple className="border border-theme rounded px-2 py-1 text-sm bg-surface text-theme focus:outline-none focus:ring-1 focus:ring-accent" disabled>
            {(data?.options || []).map((opt: any, i: number) => (
              <option key={i} value={opt.id ?? i}>{opt.text ?? opt.label ?? String(opt)}</option>
            ))}
          </select>
        );
      case 'radio':
        return (
          <div className="flex flex-col gap-1">
            {(data?.options || []).map((opt: any, i: number) => (
              <label key={i} className="flex items-center gap-1.5 text-sm text-theme cursor-default">
                <input type="radio" disabled className="accent-accent" />
                {opt.text ?? opt.label ?? String(opt)}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div className="flex flex-col gap-1">
            {(data?.options || []).map((opt: any, i: number) => (
              <label key={i} className="flex items-center gap-1.5 text-sm text-theme cursor-default">
                <input type="checkbox" disabled className="accent-accent" />
                {opt.text ?? opt.label ?? String(opt)}
              </label>
            ))}
          </div>
        );
      case 'audio': {
        const m = data as any;
        return (
          <div className="flex flex-col gap-1 w-full">
            {m?.title && <p className="text-xs font-medium text-orange-700">{m.title}</p>}
            {m?.url
              ? <audio src={m.url} controls className="w-full h-8" preload="metadata" />
              : <p className="text-xs text-muted italic">No audio URL set</p>}
          </div>
        );
      }
      case 'video': {
        const m = data as any;
        return (
          <div className="flex flex-col gap-1 w-full">
            {m?.title && <p className="text-xs font-medium text-red-700">{m.title}</p>}
            {m?.url
              ? <video src={m.url} controls className="w-full rounded" preload="metadata" style={{ maxHeight: 140 }} />
              : <p className="text-xs text-muted italic">No video URL set</p>}
          </div>
        );
      }
      case 'code_block': {
        const cb = data as any;
        return (
          <div className="w-full rounded bg-gray-900 text-gray-100 p-2 text-xs font-mono overflow-x-auto max-h-24">
            {cb?.title && <p className="text-gray-400 mb-1">{cb.title} ({cb.language})</p>}
            <pre className="whitespace-pre-wrap">{(cb?.code || '').slice(0, 200)}{(cb?.code || '').length > 200 ? '…' : ''}</pre>
          </div>
        );
      }
      case 'scripture_block': {
        const sb = data as any;
        return (
          <div className="w-full rounded bg-amber-50 border border-amber-200 p-2 text-xs">
            <p className="font-semibold text-amber-800">{sb?.reference} {sb?.version && `(${sb.version})`}</p>
            <p className="italic text-amber-900 mt-0.5 line-clamp-2">"{sb?.text}"</p>
          </div>
        );
      }
      default:
        return null;
    }
  }

  // Audio/video/code/scripture: render full-width without the anchor mark structure
  const FULL_WIDTH_TYPES = ['audio', 'video', 'code_block', 'scripture_block'];
  if (FULL_WIDTH_TYPES.includes(item.content_type)) {
    const typeColors: Record<string, string> = {
      audio: 'text-orange-600', video: 'text-red-600',
      code_block: 'text-slate-600', scripture_block: 'text-amber-700',
    };
    return (
      <div id={`preview-${item.id}`} className="w-full scroll-mt-6">
        {anchorText !== item.content_type && (
          <p className={`text-xs font-medium mb-1 ${typeColors[item.content_type] ?? 'text-muted'}`}>
            Anchored to: <span className="italic">"{anchorText}"</span>
          </p>
        )}
        {renderInput()}
      </div>
    );
  }

  return (
    <div id={`preview-${item.id}`} className="flex items-start gap-3 flex-wrap scroll-mt-6">
      <mark className={`${cls} px-1 py-0.5 rounded text-sm font-medium self-center`}>
        {anchorText}
      </mark>
      {renderInput()}
    </div>
  );
}
