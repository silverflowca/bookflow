import { Node, mergeAttributes } from '@tiptap/core';
import type { NodeView } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

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

// Vanilla JS NodeView — gives us full control over dom + contentDOM
// so we can make contentDOM a CSS grid container directly.
class ColumnLayoutView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private toolbar: HTMLElement;
  private grid: HTMLElement;
  private pmNode: PmNode;
  private editorView: EditorView;
  private getPos: () => number | undefined;
  private menuOpen = false;
  private boundHandleClickOutside: (e: MouseEvent) => void;
  private _updatePickerBtn: ((cols: number) => void) | null = null;

  constructor(node: PmNode, view: EditorView, getPos: () => number | undefined) {
    this.pmNode = node;
    this.editorView = view;
    this.getPos = getPos;

    // Outer wrapper (NodeViewWrapper equivalent)
    this.dom = document.createElement('div');
    this.dom.className = 'column-layout-wrapper my-4 relative group';
    this.dom.setAttribute('data-columns', String(node.attrs.columns ?? 2));

    // Toolbar
    this.toolbar = this.buildToolbar();
    this.dom.appendChild(this.toolbar);

    // Grid border container
    const border = document.createElement('div');
    border.className = 'border border-dashed border-[var(--color-border)] rounded-lg p-1';
    border.style.background = 'var(--color-surface)';
    this.dom.appendChild(border);

    // contentDOM = the actual CSS grid — ProseMirror renders children here
    this.grid = document.createElement('div');
    this.applyGridStyle(node.attrs.columns ?? 2);
    border.appendChild(this.grid);
    this.contentDOM = this.grid;

    this.boundHandleClickOutside = this.handleClickOutside.bind(this);
    document.addEventListener('mousedown', this.boundHandleClickOutside);
  }

  private applyGridStyle(columns: number) {
    this.grid.style.display = 'grid';
    this.grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    this.grid.style.gap = '12px';
  }

  private buildToolbar(): HTMLElement {
    const bar = document.createElement('div');
    bar.contentEditable = 'false';
    bar.style.position = 'absolute';
    bar.style.top = '-28px';
    bar.style.left = '0';
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.gap = '4px';
    bar.style.opacity = '0';
    bar.style.pointerEvents = 'none';
    bar.style.zIndex = '10';
    bar.style.transition = 'opacity 0.15s';

    // Show on hover
    this.dom.addEventListener('mouseenter', () => {
      bar.style.opacity = '1';
      bar.style.pointerEvents = 'auto';
    });
    this.dom.addEventListener('mouseleave', () => {
      if (!this.menuOpen) {
        bar.style.opacity = '0';
        bar.style.pointerEvents = 'none';
      }
    });

    // Column picker button
    const pickerWrap = document.createElement('div');
    pickerWrap.style.position = 'relative';

    const pickerBtn = document.createElement('button');
    pickerBtn.className = 'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded shadow-sm';
    pickerBtn.style.background = 'var(--color-surface)';
    pickerBtn.style.border = '1px solid var(--color-border)';
    pickerBtn.style.color = 'var(--color-text)';
    pickerBtn.style.cursor = 'pointer';
    pickerBtn.title = 'Change column count';

    const updatePickerBtn = (cols: number) => {
      pickerBtn.innerHTML = this.colIcon(cols) + ` ${cols} cols`;
    };
    updatePickerBtn(this.pmNode.attrs.columns ?? 2);

    const dropdown = document.createElement('div');
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.marginTop = '4px';
    dropdown.style.background = 'var(--color-surface)';
    dropdown.style.border = '1px solid var(--color-border)';
    dropdown.style.borderRadius = '6px';
    dropdown.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
    dropdown.style.zIndex = '50';
    dropdown.style.padding = '4px 0';
    dropdown.style.minWidth = '80px';

    [2, 3, 4, 5].forEach(n => {
      const opt = document.createElement('button');
      opt.textContent = `${n} columns`;
      opt.style.cssText = 'width:100%;text-align:left;padding:4px 12px;font-size:12px;cursor:pointer;background:none;border:none;color:var(--color-text)';
      opt.addEventListener('mouseenter', () => { opt.style.background = 'var(--color-surface-hover)'; });
      opt.addEventListener('mouseleave', () => { opt.style.background = 'none'; });
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.menuOpen = false;
        dropdown.style.display = 'none';
        updatePickerBtn(n);
        // Update via TipTap command
        const view = this.editorView;
        const pos = this.getPos();
        if (pos == null) return;
        const { state, dispatch } = view;
        const { tr } = state;
        const node = state.doc.nodeAt(pos);
        if (!node) return;
        const currentCells = node.childCount;
        const newNode = state.schema.nodes.columnLayout.create(
          { columns: n },
          Array.from({ length: n }, (_, i) => {
            if (i < currentCells) return node.child(i);
            return state.schema.nodes.columnCell.create(null, state.schema.nodes.paragraph.create());
          }),
        );
        tr.replaceWith(pos, pos + node.nodeSize, newNode);
        dispatch(tr);
        view.focus();
      });
      dropdown.appendChild(opt);
    });

    pickerBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.menuOpen = !this.menuOpen;
      dropdown.style.display = this.menuOpen ? 'block' : 'none';
    });

    pickerWrap.appendChild(pickerBtn);
    pickerWrap.appendChild(dropdown);
    bar.appendChild(pickerWrap);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.style.cssText = 'padding:1px 8px;font-size:12px;cursor:pointer;border-radius:4px;border:1px solid #fca5a5;background:#fff1f2;color:#dc2626';
    delBtn.title = 'Remove column layout';
    delBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const pos = this.getPos();
      if (pos == null) return;
      const { state, dispatch } = this.editorView;
      const node = state.doc.nodeAt(pos);
      if (!node) return;
      dispatch(state.tr.deleteRange(pos, pos + node.nodeSize));
      this.editorView.focus();
    });
    bar.appendChild(delBtn);

    this._updatePickerBtn = updatePickerBtn;
    return bar;
  }

  private handleClickOutside(e: MouseEvent) {
    const target = e.target as globalThis.Node;
    if (this.menuOpen && !this.toolbar.contains(target)) {
      this.menuOpen = false;
      const dropdown = this.toolbar.querySelector('div') as HTMLElement | null;
      if (dropdown) dropdown.style.display = 'none';
      if (!this.dom.contains(target)) {
        this.toolbar.style.opacity = '0';
        this.toolbar.style.pointerEvents = 'none';
      }
    }
  }

  private colIcon(cols: number): string {
    const w = 12 / cols;
    const rects = Array.from({ length: cols }, (_, i) =>
      `<rect x="${i * w + 0.5}" y="0.5" width="${w - 1}" height="11" rx="1" stroke="currentColor" stroke-width="1" fill="none"/>`
    ).join('');
    return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="display:inline;vertical-align:middle;margin-right:2px">${rects}</svg>`;
  }

  update(node: PmNode) {
    if (node.type !== this.pmNode.type) return false;
    this.pmNode = node;
    const cols = node.attrs.columns ?? 2;
    this.dom.setAttribute('data-columns', String(cols));
    this.applyGridStyle(cols);
    if (this._updatePickerBtn) this._updatePickerBtn(cols);
    return true;
  }

  destroy() {
    document.removeEventListener('mousedown', this.boundHandleClickOutside);
  }

  ignoreMutation() {
    return false;
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
    return ({ node, view, getPos }: { node: PmNode; view: EditorView; getPos: (() => number | undefined) | boolean }) =>
      new ColumnLayoutView(node, view, typeof getPos === 'function' ? getPos : () => undefined);
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
