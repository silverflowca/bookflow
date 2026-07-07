import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { InlineFormNodeView } from './InlineFormNodeView';

export interface InlineFormNodeAttrs {
  contentId: string;
  contentType: string;
  anchorText: string;
  contentData?: unknown;
  position?: 'inline' | 'start_of_chapter' | 'end_of_chapter';
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineFormNode: {
      insertInlineFormNode: (attrs: InlineFormNodeAttrs) => ReturnType;
    };
  }
}

export const InlineFormNode = Node.create({
  name: 'inlineFormWidget',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      contentId: {
        default: null,
        parseHTML: el => el.getAttribute('data-content-id'),
        renderHTML: attrs => ({ 'data-content-id': attrs.contentId }),
      },
      contentType: {
        default: null,
        parseHTML: el => el.getAttribute('data-content-type'),
        renderHTML: attrs => ({ 'data-content-type': attrs.contentType }),
      },
      anchorText: {
        default: '',
        parseHTML: el => el.getAttribute('data-anchor-text') || '',
        renderHTML: attrs => ({ 'data-anchor-text': attrs.anchorText }),
      },
      position: {
        default: 'inline',
        parseHTML: el => el.getAttribute('data-position') || 'inline',
        renderHTML: attrs => ({ 'data-position': attrs.position }),
      },
      contentData: {
        default: null,
        parseHTML: el => {
          const raw = el.getAttribute('data-content-data');
          if (!raw) return null;
          try { return JSON.parse(raw); } catch { return null; }
        },
        renderHTML: attrs => {
          if (!attrs.contentData) return {};
          return { 'data-content-data': JSON.stringify(attrs.contentData) };
        },
      },
      _v: {
        default: 0,
        parseHTML: () => 0,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-inline-form-widget]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-inline-form-widget': 'true' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineFormNodeView, {
      stopEvent: ({ event }) => {
        // Let media control events (click, mousedown, pointerdown, input) pass through
        // so audio/video play buttons work inside the editor
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        const isMedia = !!target.closest('audio, video');
        if (isMedia) return false;
        return true;
      },
    });
  },

  addCommands() {
    return {
      insertInlineFormNode:
        (attrs: InlineFormNodeAttrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run();
        },
    };
  },
});

export default InlineFormNode;
