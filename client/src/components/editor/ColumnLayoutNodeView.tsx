import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';
import type { NodeViewProps } from '@tiptap/react';

const COL_OPTIONS = [2, 3, 4, 5] as const;

export function ColumnLayoutNodeView({ node, editor, getPos }: NodeViewProps) {
  const columns: number = node.attrs.columns ?? 2;
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSetColumns(n: number) {
    setOpen(false);
    editor.commands.setColumnCount(n);
  }

  function handleDelete() {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
  }

  return (
    <NodeViewWrapper
      className="column-layout-wrapper my-4 relative group"
      data-columns={columns}
    >
      {/* Toolbar — shown on hover in editor */}
      <div className="absolute -top-7 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto">
        {/* Column picker */}
        <div className="relative" ref={menuRef}>
          <button
            contentEditable={false}
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-surface border border-theme rounded shadow-sm hover:bg-surface-hover text-theme"
            title="Change column count"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
              {Array.from({ length: columns }).map((_, i) => (
                <rect key={i} x={i * (12 / columns) + 0.5} y="0.5" width={12 / columns - 1} height="11" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
              ))}
            </svg>
            {columns} cols
          </button>
          {open && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-theme rounded shadow-lg z-50 py-1 min-w-[80px]">
              {COL_OPTIONS.map(n => (
                <button
                  key={n}
                  contentEditable={false}
                  onClick={() => handleSetColumns(n)}
                  className={`w-full text-left px-3 py-1 text-xs hover:bg-surface-hover transition-colors ${n === columns ? 'text-accent font-semibold' : 'text-theme'}`}
                >
                  {n} columns
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete layout */}
        <button
          contentEditable={false}
          onClick={handleDelete}
          className="px-2 py-0.5 text-xs bg-red-50 border border-red-200 text-red-600 rounded shadow-sm hover:bg-red-100"
          title="Remove column layout"
        >
          ✕
        </button>
      </div>

      {/* NodeViewContent IS the grid — styled via CSS targeting [data-node-view-content] */}
      <NodeViewContent
        as="div"
        className="border border-dashed border-theme rounded-lg p-1 bg-surface/50"
      />
    </NodeViewWrapper>
  );
}
