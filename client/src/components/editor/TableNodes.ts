import { Node, mergeAttributes } from '@tiptap/core';
import { createTableResizePlugin } from './TableResizePlugin';

export const Table = Node.create({
  name: 'table',

  group: 'block',

  content: 'tableRow+',

  isolating: true,

  parseHTML() {
    return [{ tag: 'table' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(HTMLAttributes), ['tbody', 0]];
  },

  addProseMirrorPlugins() {
    return [createTableResizePlugin()];
  },
});

export const TableRow = Node.create({
  name: 'tableRow',

  content: '(tableHeader | tableCell)+',

  parseHTML() {
    return [{ tag: 'tr' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes), 0];
  },
});

const cellAttributes = {
  colspan: {
    default: 1,
    parseHTML: (element: HTMLElement) => Number(element.getAttribute('colspan')) || 1,
    renderHTML: (attributes: Record<string, unknown>) => (
      attributes.colspan && attributes.colspan !== 1 ? { colspan: attributes.colspan } : {}
    ),
  },
  rowspan: {
    default: 1,
    parseHTML: (element: HTMLElement) => Number(element.getAttribute('rowspan')) || 1,
    renderHTML: (attributes: Record<string, unknown>) => (
      attributes.rowspan && attributes.rowspan !== 1 ? { rowspan: attributes.rowspan } : {}
    ),
  },
  width: {
    default: null,
    parseHTML: (element: HTMLElement) =>
      element.style.width || element.getAttribute('width') || null,
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.width ? { style: `width:${attributes.width}` } : {},
  },
  height: {
    default: null,
    parseHTML: (element: HTMLElement) =>
      element.style.height || element.getAttribute('height') || null,
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.height ? { style: `height:${attributes.height}` } : {},
  },
};

export const TableCell = Node.create({
  name: 'tableCell',

  content: 'block+',

  isolating: true,

  addAttributes() {
    return cellAttributes;
  },

  parseHTML() {
    return [{ tag: 'td' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableHeader = Node.create({
  name: 'tableHeader',

  content: 'block+',

  isolating: true,

  addAttributes() {
    return cellAttributes;
  },

  parseHTML() {
    return [{ tag: 'th' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes), 0];
  },
});
