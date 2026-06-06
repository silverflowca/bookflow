import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ColumnLayoutNodeView } from './ColumnLayoutNodeView';

// ── columnCell ────────────────────────────────────────────────────────────────
// One cell inside a column layout. Accepts any block content.
export const ColumnCell = Node.create({
  name: 'columnCell',
  group: 'columnCell',
  content: 'block+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-column-cell]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-column-cell': 'true', class: 'column-cell' }), 0];
  },
});

// ── columnLayout ──────────────────────────────────────────────────────────────
// Block node that wraps 2–5 columnCell nodes side by side.
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columnLayout: {
      insertColumnLayout: (columns: number) => ReturnType;
      setColumnCount: (columns: number) => ReturnType;
    };
  }
}

export const ColumnLayout = Node.create({
  name: 'columnLayout',
  group: 'block',
  content: 'columnCell+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: el => parseInt(el.getAttribute('data-columns') || '2', 10),
        renderHTML: attrs => ({ 'data-columns': attrs.columns }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-column-layout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-column-layout': 'true', class: 'column-layout' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnLayoutNodeView);
  },

  addCommands() {
    return {
      insertColumnLayout:
        (columns: number) =>
        ({ commands }) => {
          const cells = Array.from({ length: columns }, () => ({
            type: 'columnCell',
            content: [{ type: 'paragraph' }],
          }));
          return commands.insertContent({ type: 'columnLayout', attrs: { columns }, content: cells });
        },

      setColumnCount:
        (columns: number) =>
        ({ state, dispatch }) => {
          const { selection, tr } = state;
          let layoutPos = -1;
          let layoutNode: import('@tiptap/pm/model').Node | null = null;

          state.doc.descendants((node, pos) => {
            if (node.type.name === 'columnLayout') {
              // find the layout that contains the cursor
              if (pos <= selection.from && selection.from <= pos + node.nodeSize) {
                layoutPos = pos;
                layoutNode = node;
              }
            }
          });

          if (layoutPos === -1 || !layoutNode) return false;

          const currentCells = (layoutNode as import('@tiptap/pm/model').Node).childCount;
          const newNode = state.schema.nodes.columnLayout.create(
            { columns },
            Array.from({ length: columns }, (_, i) => {
              // preserve existing cell content where possible
              if (i < currentCells) {
                return (layoutNode as import('@tiptap/pm/model').Node).child(i);
              }
              return state.schema.nodes.columnCell.create(null, state.schema.nodes.paragraph.create());
            }),
          );

          if (dispatch) {
            tr.replaceWith(layoutPos, layoutPos + (layoutNode as import('@tiptap/pm/model').Node).nodeSize, newNode);
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
