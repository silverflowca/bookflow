/**
 * TipTap JSON → HTML converter (server-side, no DOM required)
 * Handles all standard TipTap StarterKit nodes + marks used in BookFlow.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeColor(value) {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color)
  ) {
    return color;
  }
  return null;
}

function sanitizeFontSize(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(px|pt|em|rem)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 8 || amount > 96) return null;
  return `${amount}${match[2].toLowerCase()}`;
}

function sanitizeFontFamily(value) {
  if (typeof value !== 'string') return null;
  const firstFamily = value
    .split(',')
    .map(part => part.trim().replace(/^["']|["']$/g, ''))
    .find(Boolean);
  const allowed = ['Arial', 'Calibri', 'Cambria', 'Georgia', 'Helvetica', 'Times New Roman', 'Verdana']
    .find(font => font.toLowerCase() === String(firstFamily).toLowerCase());
  return allowed || null;
}

function sanitizeTextAlign(value) {
  if (typeof value !== 'string') return null;
  const align = value.trim().toLowerCase();
  return ['left', 'center', 'right', 'justify'].includes(align) ? align : null;
}

function sanitizeIndentLevel(value) {
  const level = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(level)) return null;
  return Math.max(0, Math.min(8, Math.round(level)));
}

function styleAttr(styles) {
  const css = Object.entries(styles)
    .filter(([, value]) => Boolean(value))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  return css ? ` style="${escapeHtml(css)}"` : '';
}

function renderMarks(text, marks = []) {
  let result = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':       result = `<strong>${result}</strong>`; break;
      case 'italic':     result = `<em>${result}</em>`; break;
      case 'underline':  result = `<u>${result}</u>`; break;
      case 'strike':     result = `<s>${result}</s>`; break;
      case 'code':       result = `<code>${result}</code>`; break;
      case 'highlight': {
        const color = mark.attrs?.color || 'yellow';
        result = `<mark style="background:${color}">${result}</mark>`;
        break;
      }
      case 'link': {
        const href = escapeHtml(mark.attrs?.href || '#');
        result = `<a href="${href}">${result}</a>`;
        break;
      }
      case 'textStyle': {
        const attrs = mark.attrs || {};
        const styles = {
          color: sanitizeColor(attrs.color),
          'font-size': sanitizeFontSize(attrs.fontSize),
          'font-family': sanitizeFontFamily(attrs.fontFamily),
        };
        const style = styleAttr(styles);
        if (style) result = `<span${style}>${result}</span>`;
        break;
      }
    }
  }
  return result;
}

function renderInlineNode(node) {
  if (node.type === 'text') return renderMarks(node.text || '', node.marks);
  if (node.type === 'hardBreak') return '<br>';
  // inline_content mark — just render children
  if (node.type === 'inlineContent' && node.content) {
    return node.content.map(renderInlineNode).join('');
  }
  return '';
}

function renderNode(node) {
  if (!node) return '';

  const inner = () => (node.content || []).map(renderInlineNode).join('');
  const block = (tag, attrs = '') => `<${tag}${attrs}>${inner()}</${tag}>\n`;
  const indentLevel = sanitizeIndentLevel(node.attrs?.indentLevel) || 0;
  const alignStyle = styleAttr({
    'text-align': sanitizeTextAlign(node.attrs?.textAlign),
    'margin-left': indentLevel > 0 ? `${indentLevel * 2}rem` : null,
  });

  switch (node.type) {
    case 'doc':
      return (node.content || []).map(renderNode).join('');

    case 'paragraph':
      return `<p${alignStyle}>${inner()}</p>\n`;

    case 'heading': {
      const level = node.attrs?.level || 1;
      return `<h${level}${alignStyle}>${inner()}</h${level}>\n`;
    }

    case 'bulletList':
      return `<ul>\n${(node.content || []).map(renderNode).join('')}</ul>\n`;

    case 'orderedList':
      return `<ol>\n${(node.content || []).map(renderNode).join('')}</ol>\n`;

    case 'listItem':
      return `<li>${(node.content || []).map(renderNode).join('')}</li>\n`;

    case 'blockquote':
      return `<blockquote>\n${(node.content || []).map(renderNode).join('')}</blockquote>\n`;

    case 'codeBlock': {
      const lang = node.attrs?.language || '';
      return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(
        (node.content || []).map(n => n.text || '').join('')
      )}</code></pre>\n`;
    }

    case 'table':
      return `<div class="table-scroll"><table>\n<tbody>\n${(node.content || []).map(renderNode).join('')}</tbody>\n</table></div>\n`;

    case 'tableRow':
      return `<tr>${(node.content || []).map(renderNode).join('')}</tr>\n`;

    case 'tableHeader':
      return `<th>${(node.content || []).map(renderNode).join('')}</th>\n`;

    case 'tableCell':
      return `<td>${(node.content || []).map(renderNode).join('')}</td>\n`;

    case 'horizontalRule':
      return '<hr>\n';

    case 'hardBreak':
      return '<br>\n';

    case 'columnLayout':
      // Render columns as a flex row
      return `<div style="display:flex;gap:1.5rem;margin:1rem 0">\n${(node.content || []).map(col =>
        `<div style="flex:1">${(col.content || []).map(renderNode).join('')}</div>`
      ).join('\n')}\n</div>\n`;

    case 'inlineFormWidget': {
      // Emit a placeholder that will be replaced with the actual inline content HTML
      const widgetId = node.attrs?.id || node.attrs?.contentId || '';
      if (widgetId) return `<!-- INLINE_WIDGET:${widgetId} -->\n`;
      return '';
    }

    default:
      // Unknown node — try to render children
      if (node.content) return (node.content || []).map(renderNode).join('');
      return '';
  }
}

/**
 * Convert a TipTap document JSON to an HTML string.
 * @param {object} doc  TipTap { type: 'doc', content: [...] }
 * @returns {string}    HTML
 */
export function tiptapToHtml(doc) {
  if (!doc || doc.type !== 'doc') return '';
  return renderNode(doc);
}

// ─── Inline content block renderers ──────────────────────────────────────────

const DEFAULT_PDF_OPTIONS = {
  includePolls: true,
  includeQuestions: true,
  includeImages: true,
  includeCodeBlocks: true,
  includeScripture: true,
  includeForms: true,
  includeSignatures: true,
  includeAudio: true,
  includeNotes: true,
  includeLinks: true,
};

function box(bgColor, borderColor, borderStyle, content) {
  return `<div style="margin:0.75rem 0;padding:0.75rem 1rem;background:${bgColor};border:1.5px ${borderStyle} ${borderColor};border-radius:8px;font-size:0.9375rem;page-break-inside:avoid;break-inside:avoid">${content}</div>\n`;
}

function badge(emoji, label, bgColor, borderColor) {
  return `<div style="margin:0.75rem 0;display:inline-flex;align-items:center;gap:0.5rem;padding:0.4rem 0.75rem;background:${bgColor};border:1.5px solid ${borderColor};border-radius:6px;font-size:0.875rem;page-break-inside:avoid;break-inside:avoid">${emoji} <strong>${escapeHtml(label)}</strong></div>\n`;
}

function buildInlineContentHtml(block, options = {}) {
  const opts = { ...DEFAULT_PDF_OPTIONS, ...options };
  const data = block.content_data || {};

  switch (block.content_type) {
    case 'poll': {
      if (!opts.includePolls) return '';
      const optionsList = (data.options || [])
        .map(o => `<li style="padding:0.35rem 0;border-bottom:1px solid #bbf7d0">${escapeHtml(o.text || o)}</li>`)
        .join('');
      return box('#f0fdf4', '#86efac', 'solid',
        `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
          <span style="font-size:1.1rem">📊</span>
          <strong style="color:#166534">Poll</strong>
        </div>
        <p style="margin:0 0 0.5rem;font-weight:600;color:#14532d">${escapeHtml(data.question || '')}</p>
        <ul style="list-style:none;padding:0;margin:0;color:#166534">${optionsList}</ul>`
      );
    }

    case 'question': {
      if (!opts.includeQuestions) return '';
      const hasOptions = data.options && data.options.length > 0;
      const optionsHtml = hasOptions
        ? `<ul style="padding-left:1.25rem;margin:0.5rem 0 0;color:#1e40af">${(data.options || []).map(o =>
            `<li>${escapeHtml(typeof o === 'string' ? o : o.text || '')}</li>`).join('')}</ul>`
        : '';
      return box('#eff6ff', '#93c5fd', 'solid',
        `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
          <span style="font-size:1.1rem">❓</span>
          <strong style="color:#1e40af">Question</strong>
        </div>
        <p style="margin:0;font-weight:600;color:#1e3a8a">${escapeHtml(data.question || data.text || '')}</p>
        ${optionsHtml}`
      );
    }

    case 'note': {
      if (!opts.includeNotes) return '';
      const noteType = data.type || 'note';
      const label = noteType === 'definition' ? '📖 Definition' : noteType === 'reference' ? '🔗 Reference' : '📝 Note';
      return box('#faf5ff', '#d8b4fe', 'solid',
        `<div style="font-size:0.8rem;font-weight:700;color:#7e22ce;margin-bottom:0.35rem;text-transform:uppercase;letter-spacing:0.05em">${label}</div>
        <p style="margin:0;color:#581c87">${escapeHtml(data.text || '')}</p>`
      );
    }

    case 'link': {
      if (!opts.includeLinks) return '';
      const title = data.title || data.url || '';
      const desc = data.description || '';
      return box('#ecfeff', '#67e8f9', 'solid',
        `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem">
          <span>🔗</span>
          <strong style="color:#0e7490">${escapeHtml(title)}</strong>
        </div>
        ${desc ? `<p style="margin:0;font-size:0.875rem;color:#164e63">${escapeHtml(desc)}</p>` : ''}
        <p style="margin:0.25rem 0 0;font-size:0.8rem;color:#0891b2">${escapeHtml(data.url || '')}</p>`
      );
    }

    case 'image': {
      if (!opts.includeImages) return '';
      if (!data.url) return '';
      const caption = data.caption ? `<p style="margin:0.35rem 0 0;font-size:0.875rem;color:#6b7280;text-align:center;font-style:italic">${escapeHtml(data.caption)}</p>` : '';
      return `<div style="margin:1rem 0;text-align:center;page-break-inside:avoid;break-inside:avoid">\n<img src="${escapeHtml(data.url)}" alt="${escapeHtml(data.caption || '')}" style="max-width:100%;border-radius:6px">\n${caption}</div>\n`;
    }

    case 'audio': {
      if (!opts.includeAudio) return '';
      return badge('🎵', data.title || 'Audio', '#fff7ed', '#fed7aa');
    }

    case 'video': {
      if (!opts.includeAudio) return '';
      return badge('🎬', data.title || 'Video', '#fff1f2', '#fecdd3');
    }

    case 'code_block': {
      if (!opts.includeCodeBlocks) return '';
      const lang = data.language ? `<span style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.5rem;display:block">${escapeHtml(data.language)}</span>` : '';
      return `<div style="margin:0.75rem 0;background:#1e293b;border-radius:8px;padding:1rem;overflow:hidden">\n${lang}<pre style="margin:0;color:#e2e8f0;font-family:monospace;font-size:0.875rem;white-space:pre-wrap;word-break:break-all">${escapeHtml(data.code || '')}</pre>\n</div>\n`;
    }

    case 'scripture_block': {
      if (!opts.includeScripture) return '';
      const ref = [data.book, data.chapter, data.verse ? `:${data.verse}` : ''].filter(Boolean).join(' ');
      const version = data.version ? ` (${data.version})` : '';
      return `<div style="margin:0.75rem 0;padding:0.75rem 1rem 0.75rem 1.25rem;background:#fffbeb;border-left:4px solid #d97706;border-radius:0 6px 6px 0">\n<p style="margin:0 0 0.35rem;font-style:italic;color:#92400e">${escapeHtml(data.text || '')}</p>\n<p style="margin:0;font-size:0.875rem;font-weight:700;color:#b45309">${escapeHtml(ref)}${escapeHtml(version)}</p>\n</div>\n`;
    }

    case 'signature': {
      if (!opts.includeSignatures) return '';
      return `<div style="margin:0.75rem 0;padding:1rem;border:2px dashed #a855f7;border-radius:8px;background:#faf5ff;text-align:center">\n<p style="margin:0 0 0.25rem;font-weight:600;color:#7e22ce">${escapeHtml(data.label || 'Signature Required')}</p>\n${data.description ? `<p style="margin:0 0 0.5rem;font-size:0.875rem;color:#9333ea">${escapeHtml(data.description)}</p>` : ''}<div style="margin:0.75rem auto;width:200px;height:60px;border-bottom:2px solid #a855f7"></div>\n<p style="margin:0;font-size:0.75rem;color:#a855f7">Signature</p>\n</div>\n`;
    }

    case 'select':
    case 'multiselect':
    case 'textbox':
    case 'textarea':
    case 'radio':
    case 'checkbox': {
      if (!opts.includeForms) return '';
      const label = data.label || block.content_type;
      const optionsHtml = (data.options || []).length > 0
        ? `<div style="margin-top:0.4rem;font-size:0.875rem;color:#4c1d95">${(data.options || []).map(o =>
            `<span style="display:inline-block;margin:0.15rem 0.3rem 0.15rem 0;padding:0.15rem 0.5rem;background:#ede9fe;border-radius:4px">${escapeHtml(typeof o === 'string' ? o : o.label || o.text || '')}</span>`
          ).join('')}</div>`
        : '';
      return box('#f5f3ff', '#c4b5fd', 'solid',
        `<div style="font-size:0.8rem;font-weight:700;color:#6d28d9;margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em">${escapeHtml(block.content_type.replace('_', ' '))}</div>
        <p style="margin:0;color:#4c1d95;font-weight:500">${escapeHtml(label)}</p>
        ${optionsHtml}`
      );
    }

    case 'media_response': {
      if (!opts.includeAudio) return '';
      return box('#eff6ff', '#93c5fd', 'dashed',
        `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem">
          <span>🎙️</span><strong style="color:#1e40af">Response Prompt</strong>
        </div>
        <p style="margin:0;color:#1e3a8a">${escapeHtml(data.prompt || '')}</p>`
      );
    }

    default:
      return '';
  }
}

/**
 * Build a complete styled HTML document for a book, including inline content blocks.
 *
 * @param {object} book              Book record with author_name, title, etc.
 * @param {Array}  chapters          Array of chapter records with content (TipTap JSON)
 * @param {object} inlineByChapter   Map of chapter_id → InlineContent[]
 * @param {object} options           PDF export options (see DEFAULT_PDF_OPTIONS)
 * @returns {string}                 Complete HTML document string
 */
export function buildBookHtmlWithInline(book, chapters, inlineByChapter = {}, options = {}) {
  const opts = { ...DEFAULT_PDF_OPTIONS, ...options };

  const coverImg = book.cover_image_url
    ? `<div class="cover"><img src="${escapeHtml(book.cover_image_url)}" alt="Cover"></div>`
    : '';

  const chaptersHtml = chapters.map(ch => {
    let chapterHtml = tiptapToHtml(ch.content);

    // Replace inline widget placeholders with actual styled blocks
    const inlineBlocks = inlineByChapter[ch.id] || [];
    const inlineMap = {};
    for (const block of inlineBlocks) {
      inlineMap[block.id] = block;
    }

    chapterHtml = chapterHtml.replace(/<!-- INLINE_WIDGET:([a-f0-9-]+) -->/g, (_, id) => {
      const block = inlineMap[id];
      if (!block) return '';
      return buildInlineContentHtml(block, opts);
    });

    // Also render any inline content that appears at start/end of chapter
    // (position_in_chapter = 'start_of_chapter' or 'end_of_chapter')
    const startBlocks = inlineBlocks
      .filter(b => b.position_in_chapter === 'start_of_chapter')
      .map(b => buildInlineContentHtml(b, opts))
      .join('');
    const endBlocks = inlineBlocks
      .filter(b => b.position_in_chapter === 'end_of_chapter')
      .map(b => buildInlineContentHtml(b, opts))
      .join('');

    return `
      <section class="chapter">
        <h1 class="chapter-title">${escapeHtml(ch.title || 'Untitled Chapter')}</h1>
        ${startBlocks}
        ${chapterHtml}
        ${endBlocks}
      </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(book.title || 'Book')}</title>
<style>
  /* ── Base ── */
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    max-width: 680px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    line-height: 1.8;
    color: #1f2937;
    font-size: 1.0625rem;
    background: #fff;
  }

  /* ── Title page ── */
  .cover img { width: 100%; max-height: 480px; object-fit: contain; margin-bottom: 2rem; border-radius: 8px; }
  .title-page { text-align: center; padding: 3rem 0 4rem; }
  .title-page h1 { font-size: 2.5rem; font-weight: 700; margin: 0 0 0.75rem; color: #111827; }
  .title-page .subtitle { font-size: 1.25rem; color: #6b7280; margin: 0 0 1.5rem; font-style: italic; }
  .title-page .author { font-size: 1.1rem; color: #374151; margin: 0 0 1rem; }
  .title-page .description { font-size: 0.9375rem; color: #6b7280; max-width: 500px; margin: 0 auto; line-height: 1.7; }

  /* ── Chapter ── */
  .chapter { page-break-before: always; margin-top: 1rem; }
  .chapter-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: #111827;
    border-bottom: 3px solid #e5e7eb;
    padding-bottom: 0.75rem;
    margin: 0 0 2rem;
  }

  /* ── Typography ── */
  p { margin: 0 0 1.1rem; }
  h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 0.75rem; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.35rem; }
  h3 { font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 0.5rem; color: #1f2937; }
  h4 { font-size: 1.1rem; font-weight: 700; margin: 1.25rem 0 0.4rem; color: #374151; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  s { text-decoration: line-through; }
  a { color: #7c3aed; }

  /* ── Blockquote ── */
  blockquote {
    border-left: 4px solid #a855f7;
    margin: 1.25rem 0;
    padding: 0.75rem 1.25rem;
    color: #4b5563;
    font-style: italic;
    background: #faf5ff;
    border-radius: 0 6px 6px 0;
  }
  blockquote p { margin: 0; }

  /* ── Code ── */
  code {
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.875em;
    background: #f1f5f9;
    padding: 0.1em 0.35em;
    border-radius: 3px;
    border: 1px solid #e2e8f0;
  }
  pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 1rem;
    border-radius: 8px;
    overflow: hidden;
    margin: 1rem 0;
  }
  pre code { background: none; border: none; padding: 0; color: inherit; font-size: 0.875rem; white-space: pre-wrap; word-break: break-all; }

  /* ── Lists ── */
  ul, ol { padding-left: 1.75rem; margin: 0.5rem 0 1rem; }
  li { margin-bottom: 0.35rem; }

  /* ── HR ── */
  hr { border: none; border-top: 2px solid #e5e7eb; margin: 1.5rem 0; }

  /* ── Tables ── */
  .table-scroll { overflow-x: auto; margin: 1rem 0; }
  table { border-collapse: collapse; width: 100%; min-width: 400px; }
  th, td { border: 1px solid #d1d5db; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 700; color: #111827; }
  th > p, td > p { margin: 0; }

  /* ── Images ── */
  img { max-width: 100%; height: auto; }

  /* ── Marks ── */
  mark { padding: 0.05em 0.2em; border-radius: 2px; }

  @media print {
    body { padding: 0; margin: 0; }

    /* Each chapter always starts on a new page */
    .chapter { page-break-before: always; break-before: page; }

    /* Never break inside these elements */
    blockquote,
    pre,
    table,
    figure,
    img,
    .inline-poll,
    .inline-question,
    .inline-image,
    .inline-link-card,
    .inline-widget {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Keep headings with the paragraph that follows them */
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
      break-after: avoid;
    }

    /* Keep list items together; avoid orphaned single list items */
    ul, ol {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Avoid a page break immediately after the chapter title */
    .chapter-title {
      page-break-after: avoid;
      break-after: avoid;
    }

    /* Orphan/widow control — require at least 3 lines at top/bottom of page */
    p {
      orphans: 3;
      widows: 3;
    }
  }
</style>
</head>
<body>
  ${coverImg}
  <div class="title-page">
    <h1>${escapeHtml(book.title || 'Untitled')}</h1>
    ${book.subtitle ? `<p class="subtitle">${escapeHtml(book.subtitle)}</p>` : ''}
    ${book.author_name ? `<p class="author">By ${escapeHtml(book.author_name)}</p>` : ''}
    ${book.description ? `<p class="description">${escapeHtml(book.description)}</p>` : ''}
  </div>
  ${chaptersHtml}
</body>
</html>`;
}

/**
 * Wrap chapter HTML into a full styled HTML document (legacy — kept for EPUB/submission package).
 */
export function buildBookHtml(book, chapters) {
  return buildBookHtmlWithInline(book, chapters, {}, DEFAULT_PDF_OPTIONS);
}
