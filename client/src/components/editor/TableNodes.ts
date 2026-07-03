import { Node, mergeAttributes } from '@tiptap/core';

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
