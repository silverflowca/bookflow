/**
 * TableResizePlugin
 *
 * A ProseMirror plugin that enables drag-to-resize of table columns and rows.
 *
 * - Hover within 6px of a cell's right border → col-resize cursor
 * - Hover within 6px of a cell's bottom border → row-resize cursor
 * - Drag to resize; releases dispatch a ProseMirror transaction persisting
 *   the new width/height in node attrs (width / height attributes must exist
 *   on tableCell and tableHeader nodes).
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const HANDLE_SIZE = 6; // px from border edge that triggers resize
const MIN_COL_WIDTH = 40; // px
const MIN_ROW_HEIGHT = 20; // px

type DragState =
  | { kind: 'col'; startX: number; startWidth: number; colIndex: number; tableEl: HTMLTableElement }
  | { kind: 'row'; startY: number; startHeight: number; rowIndex: number; tableEl: HTMLTableElement }
  | null;

function closestCell(el: Element | null): HTMLTableCellElement | null {
  while (el) {
    if (el.tagName === 'TD' || el.tagName === 'TH') return el as HTMLTableCellElement;
    el = el.parentElement;
  }
  return null;
}

function closestTable(el: Element | null): HTMLTableElement | null {
  while (el) {
    if (el.tagName === 'TABLE') return el as HTMLTableElement;
    el = el.parentElement;
  }
  return null;
}

function getCellColIndex(cell: HTMLTableCellElement): number {
  let index = 0;
  let sib: Element | null = cell.previousElementSibling;
  while (sib) { index++; sib = sib.previousElementSibling; }
  return index;
}

function getCellRowIndex(cell: HTMLTableCellElement): number {
  const row = cell.closest('tr');
  if (!row) return 0;
  let index = 0;
  let sib: Element | null = row.previousElementSibling;
  while (sib) { index++; sib = sib.previousElementSibling; }
  return index;
}

/**
 * Find the ProseMirror position of a table DOM element in the view.
 * Returns -1 if not found.
 */
function findTablePos(view: EditorView, tableEl: HTMLTableElement): number {
  try {
    // posAtDOM returns a position inside the node; we need the node's start pos.
    // Walk ancestors until we find a node whose DOM is the table.
    const innerPos = view.posAtDOM(tableEl, 0);
    const $pos = view.state.doc.resolve(innerPos);
    for (let depth = $pos.depth; depth >= 0; depth--) {
      const node = $pos.node(depth);
      if (node.type.name === 'table') {
        return $pos.before(depth);
      }
    }
  } catch { /* ignore */ }
  return -1;
}

/**
 * Dispatch a transaction that updates the `width` attr on every cell
 * at `colIndex` across all rows of the table found at `tableEl`.
 */
function persistColumnWidth(view: EditorView, tableEl: HTMLTableElement, colIndex: number, widthPx: number) {
  const widthStr = `${widthPx}px`;
  const tablePos = findTablePos(view, tableEl);
  if (tablePos < 0) return;

  const { state } = view;
  const tableNode = state.doc.nodeAt(tablePos);
  if (!tableNode || tableNode.type.name !== 'table') return;

  const tr = state.tr;
  let changed = false;

  tableNode.forEach((rowNode, rowOff) => {
    if (rowNode.type.name !== 'tableRow') return;
    let cellIdx = 0;
    rowNode.forEach((cellNode, cellOff) => {
      if (cellIdx === colIndex) {
        const cellPos = tablePos + 1 + rowOff + 1 + cellOff;
        tr.setNodeMarkup(cellPos, undefined, { ...cellNode.attrs, width: widthStr });
        changed = true;
      }
      cellIdx++;
    });
  });

  if (changed) view.dispatch(tr);
}

/**
 * Dispatch a transaction that updates the `height` attr on every cell
 * in `rowIndex` of the table found at `tableEl`.
 */
function persistRowHeight(view: EditorView, tableEl: HTMLTableElement, rowIndex: number, heightPx: number) {
  const heightStr = `${heightPx}px`;
  const tablePos = findTablePos(view, tableEl);
  if (tablePos < 0) return;

  const { state } = view;
  const tableNode = state.doc.nodeAt(tablePos);
  if (!tableNode || tableNode.type.name !== 'table') return;

  const tr = state.tr;
  let changed = false;
  let rowIdx = 0;

  tableNode.forEach((rowNode, rowOff) => {
    if (rowNode.type.name !== 'tableRow') { rowIdx++; return; }
    if (rowIdx === rowIndex) {
      rowNode.forEach((cellNode, cellOff) => {
        const cellPos = tablePos + 1 + rowOff + 1 + cellOff;
        tr.setNodeMarkup(cellPos, undefined, { ...cellNode.attrs, height: heightStr });
        changed = true;
      });
    }
    rowIdx++;
  });

  if (changed) view.dispatch(tr);
}

export const tableResizePluginKey = new PluginKey('tableResize');

export function createTableResizePlugin(): Plugin {
  let drag: DragState = null;

  function setCursor(cursor: string) {
    document.body.style.cursor = cursor;
  }
  function clearCursor() {
    document.body.style.cursor = '';
  }

  function onMouseMove(_view: EditorView, event: MouseEvent) {
    if (drag) {
      if (drag.kind === 'col') {
        const colDrag = drag; // narrow type
        const delta = event.clientX - colDrag.startX;
        const newWidth = Math.max(MIN_COL_WIDTH, colDrag.startWidth + delta);
        // Live-preview: update all cells in this column via DOM
        const rows = colDrag.tableEl.querySelectorAll('tr');
        rows.forEach(row => {
          const cell = row.children[colDrag.colIndex] as HTMLElement;
          if (cell) cell.style.width = `${newWidth}px`;
        });
        setCursor('col-resize');
      } else if (drag.kind === 'row') {
        const delta = event.clientY - drag.startY;
        const newHeight = Math.max(MIN_ROW_HEIGHT, drag.startHeight + delta);
        const rows = drag.tableEl.querySelectorAll('tr');
        const row = rows[drag.rowIndex] as HTMLElement;
        if (row) {
          Array.from(row.children).forEach(cell => {
            (cell as HTMLElement).style.height = `${newHeight}px`;
          });
        }
        setCursor('row-resize');
      }
      return;
    }

    // Not dragging — set cursor based on proximity to borders
    const target = event.target as Element;
    const cell = closestCell(target);
    if (!cell) { clearCursor(); return; }

    const rect = cell.getBoundingClientRect();
    const nearRight = event.clientX >= rect.right - HANDLE_SIZE && event.clientX <= rect.right + HANDLE_SIZE;
    const nearBottom = event.clientY >= rect.bottom - HANDLE_SIZE && event.clientY <= rect.bottom + HANDLE_SIZE;

    if (nearRight) setCursor('col-resize');
    else if (nearBottom) setCursor('row-resize');
    else clearCursor();
  }

  function onMouseDown(__view: EditorView, event: MouseEvent) {
    const target = event.target as Element;
    const cell = closestCell(target);
    if (!cell) return false;

    const tableEl = closestTable(cell);
    if (!tableEl) return false;

    const rect = cell.getBoundingClientRect();
    const nearRight = event.clientX >= rect.right - HANDLE_SIZE && event.clientX <= rect.right + HANDLE_SIZE;
    const nearBottom = event.clientY >= rect.bottom - HANDLE_SIZE && event.clientY <= rect.bottom + HANDLE_SIZE;

    if (nearRight) {
      event.preventDefault();
      drag = {
        kind: 'col',
        startX: event.clientX,
        startWidth: cell.offsetWidth,
        colIndex: getCellColIndex(cell),
        tableEl,
      };
      setCursor('col-resize');
      return true;
    }

    if (nearBottom) {
      event.preventDefault();
      drag = {
        kind: 'row',
        startY: event.clientY,
        startHeight: cell.offsetHeight,
        rowIndex: getCellRowIndex(cell),
        tableEl,
      };
      setCursor('row-resize');
      return true;
    }

    return false;
  }

  function onMouseUp(view: EditorView, event: MouseEvent) {
    if (!drag) return;

    if (drag.kind === 'col') {
      const delta = event.clientX - drag.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, drag.startWidth + delta);
      persistColumnWidth(view, drag.tableEl, drag.colIndex, newWidth);
    } else if (drag.kind === 'row') {
      const delta = event.clientY - drag.startY;
      const newHeight = Math.max(MIN_ROW_HEIGHT, drag.startHeight + delta);
      persistRowHeight(view, drag.tableEl, drag.rowIndex, newHeight);
    }

    drag = null;
    clearCursor();
  }

  // Stored so we can remove them on destroy
  let docMouseMove: ((e: MouseEvent) => void) | null = null;
  let docMouseUp: ((e: MouseEvent) => void) | null = null;

  function attachDocListeners(view: EditorView) {
    docMouseMove = (e: MouseEvent) => onMouseMove(view, e);
    docMouseUp   = (e: MouseEvent) => { onMouseUp(view, e); detachDocListeners(); };
    document.addEventListener('mousemove', docMouseMove);
    document.addEventListener('mouseup',   docMouseUp);
  }

  function detachDocListeners() {
    if (docMouseMove) document.removeEventListener('mousemove', docMouseMove);
    if (docMouseUp)   document.removeEventListener('mouseup',   docMouseUp);
    docMouseMove = null;
    docMouseUp   = null;
  }

  return new Plugin({
    key: tableResizePluginKey,
    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          // Only handle hover cursor when not dragging (drag is handled at document level)
          if (!drag) onMouseMove(view, event as MouseEvent);
          return false;
        },
        mousedown(view, event) {
          const started = onMouseDown(view, event as MouseEvent);
          if (started) attachDocListeners(view);
          return started;
        },
      },
    },
    destroy() {
      detachDocListeners();
    },
  });
}
