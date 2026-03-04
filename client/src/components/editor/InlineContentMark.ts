import { Mark, mergeAttributes } from '@tiptap/core';

export interface InlineContentMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineContentMark: {
      setInlineContentMark: (attributes: { contentType: string; contentId: string }) => ReturnType;
      unsetInlineContentMark: () => ReturnType;
    };
  }
}

export const InlineContentMark = Mark.create<InlineContentMarkOptions>({
  name: 'inlineContentMark',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      contentType: {
        default: null,
        parseHTML: element => element.getAttribute('data-content-type'),
        renderHTML: attributes => {
          if (!attributes.contentType) return {};
          return { 'data-content-type': attributes.contentType };
        },
      },
      contentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-content-id'),
        renderHTML: attributes => {
          if (!attributes.contentId) return {};
          return { 'data-content-id': attributes.contentId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-inline-content]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const contentType = HTMLAttributes['data-content-type'] || 'default';
    const classMap: Record<string, string> = {
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
    const className = classMap[contentType] || 'inline-default';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-inline-content': 'true',
        class: className,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setInlineContentMark:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetInlineContentMark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

export default InlineContentMark;
