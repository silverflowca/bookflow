import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { InlineFormNode } from '../InlineFormNode';
import { InlineFormNodeView } from '../InlineFormNodeView';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEditor(content = '') {
  return new Editor({
    extensions: [StarterKit, InlineFormNode],
    content,
  });
}

function makeNodeViewProps(overrides: Partial<{
  contentId: string;
  contentType: string;
  anchorText: string;
  contentData: unknown;
  selected: boolean;
}> = {}) {
  const attrs = {
    contentId: overrides.contentId ?? 'test-id',
    contentType: overrides.contentType ?? 'textbox',
    anchorText: overrides.anchorText ?? 'anchor',
    contentData: overrides.contentData ?? null,
  };
  return {
    node: { attrs, type: { name: 'inlineFormWidget' } } as any,
    selected: overrides.selected ?? false,
    editor: {} as any,
    getPos: () => 0,
    decorations: [],
    innerDecorations: [],
    extension: {} as any,
    HTMLAttributes: {},
    updateAttributes: vi.fn(),
    deleteNode: vi.fn(),
  };
}

// ─── InlineFormNode Extension Tests ──────────────────────────────────────────

describe('InlineFormNode extension', () => {
  it('test 1: registers with name "inlineFormWidget"', () => {
    const editor = makeEditor();
    expect(editor.schema.nodes.inlineFormWidget).toBeDefined();
    editor.destroy();
  });

  it('test 2: is inline (group includes inline)', () => {
    const editor = makeEditor();
    const nodeType = editor.schema.nodes.inlineFormWidget;
    expect(nodeType.spec.group).toContain('inline');
    editor.destroy();
  });

  it('test 3: is atom (no editable children)', () => {
    const editor = makeEditor();
    const nodeType = editor.schema.nodes.inlineFormWidget;
    expect(nodeType.spec.atom).toBe(true);
    editor.destroy();
  });

  it('test 4: has contentId, contentType, anchorText attributes', () => {
    const editor = makeEditor();
    const nodeType = editor.schema.nodes.inlineFormWidget;
    const attrs = nodeType.spec.attrs as Record<string, unknown>;
    expect(attrs).toHaveProperty('contentId');
    expect(attrs).toHaveProperty('contentType');
    expect(attrs).toHaveProperty('anchorText');
    editor.destroy();
  });

  it('test 5: insertInlineFormNode command inserts a node into the document', () => {
    const editor = makeEditor('<p>Hello world</p>');
    editor.commands.setTextSelection(6); // place cursor inside paragraph
    editor.commands.insertInlineFormNode({
      contentId: 'abc-123',
      contentType: 'textbox',
      anchorText: 'world',
    });
    let found = false;
    editor.state.doc.descendants(node => {
      if (node.type.name === 'inlineFormWidget') found = true;
    });
    expect(found).toBe(true);
    editor.destroy();
  });

  it('test 6: inserted node carries correct attrs', () => {
    const editor = makeEditor('<p>Test</p>');
    editor.commands.setTextSelection(2);
    editor.commands.insertInlineFormNode({
      contentId: 'cid-1',
      contentType: 'select',
      anchorText: 'Te',
    });
    let foundAttrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants(node => {
      if (node.type.name === 'inlineFormWidget') foundAttrs = node.attrs as Record<string, unknown>;
    });
    expect(foundAttrs).not.toBeNull();
    expect(foundAttrs!.contentId).toBe('cid-1');
    expect(foundAttrs!.contentType).toBe('select');
    expect(foundAttrs!.anchorText).toBe('Te');
    editor.destroy();
  });

  it('test 7: parseHTML matches span[data-inline-form-widget]', () => {
    const editor = makeEditor();
    const nodeType = editor.schema.nodes.inlineFormWidget;
    const parseRules = nodeType.spec.parseDOM as { tag: string }[];
    expect(parseRules.some(r => r.tag === 'span[data-inline-form-widget]')).toBe(true);
    editor.destroy();
  });

  it('test 8: renderHTML outputs span with data-inline-form-widget attribute', () => {
    const editor = makeEditor('<p>X</p>');
    editor.commands.setTextSelection(2);
    editor.commands.insertInlineFormNode({ contentId: 'r1', contentType: 'radio', anchorText: 'X' });
    const html = editor.getHTML();
    expect(html).toContain('data-inline-form-widget');
    editor.destroy();
  });
});

// ─── InlineFormNodeView Component Tests ──────────────────────────────────────

describe('InlineFormNodeView component', () => {
  it('test 9: renders anchor text', () => {
    render(<InlineFormNodeView {...makeNodeViewProps({ anchorText: 'click here' })} />);
    expect(screen.getByTestId('inline-form-anchor')).toHaveTextContent('click here');
  });

  it('test 10: renders type badge', () => {
    render(<InlineFormNodeView {...makeNodeViewProps({ contentType: 'textbox' })} />);
    expect(screen.getByTestId('inline-form-badge')).toHaveTextContent('Text Input');
  });

  it('test 11: adds ring class when selected=true', () => {
    render(<InlineFormNodeView {...makeNodeViewProps({ selected: true })} />);
    expect(screen.getByTestId('inline-form-node').className).toContain('ring-2');
  });

  it('test 12: does not add ring class when selected=false', () => {
    render(<InlineFormNodeView {...makeNodeViewProps({ selected: false })} />);
    expect(screen.getByTestId('inline-form-node').className).not.toContain('ring-2');
  });

  it('test 13: renders textbox preview when contentData provided', () => {
    render(
      <InlineFormNodeView
        {...makeNodeViewProps({
          contentType: 'textbox',
          contentData: { label: 'Your name', placeholder: 'Enter name' },
        })}
      />
    );
    expect(screen.getByTestId('inline-form-preview-textbox')).toBeInTheDocument();
  });

  it('test 14: renders select preview with options', () => {
    render(
      <InlineFormNodeView
        {...makeNodeViewProps({
          contentType: 'select',
          contentData: {
            label: 'Choose one',
            options: [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Beta' }],
          },
        })}
      />
    );
    expect(screen.getByTestId('inline-form-preview-select')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('test 15: renders radio preview with first 3 options', () => {
    render(
      <InlineFormNodeView
        {...makeNodeViewProps({
          contentType: 'radio',
          contentData: {
            label: 'Pick one',
            options: [
              { id: '1', text: 'A' }, { id: '2', text: 'B' },
              { id: '3', text: 'C' }, { id: '4', text: 'D' },
            ],
          },
        })}
      />
    );
    expect(screen.getByTestId('inline-form-preview-radio')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('test 16: renders checkbox preview', () => {
    render(
      <InlineFormNodeView
        {...makeNodeViewProps({
          contentType: 'checkbox',
          contentData: {
            label: 'Select all',
            options: [{ id: 'x', text: 'Option X' }],
          },
        })}
      />
    );
    expect(screen.getByTestId('inline-form-preview-checkbox')).toBeInTheDocument();
    expect(screen.getByText('Option X')).toBeInTheDocument();
  });

  it('test 17: renders multiselect chips preview', () => {
    render(
      <InlineFormNodeView
        {...makeNodeViewProps({
          contentType: 'multiselect',
          contentData: {
            label: 'Pick many',
            options: [
              { id: '1', text: 'One' }, { id: '2', text: 'Two' },
              { id: '3', text: 'Three' }, { id: '4', text: 'Four' },
            ],
          },
        })}
      />
    );
    expect(screen.getByTestId('inline-form-preview-multiselect')).toBeInTheDocument();
    // Shows 3 chips + "+1" more chip
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('test 18: no preview rendered when contentData is null', () => {
    render(<InlineFormNodeView {...makeNodeViewProps({ contentData: null })} />);
    // No preview testid should exist when contentData is null
    expect(screen.queryByTestId('inline-form-preview-textbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inline-form-preview-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inline-form-preview-radio')).not.toBeInTheDocument();
  });
});
