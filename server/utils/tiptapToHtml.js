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
  const alignStyle = styleAttr({ 'text-align': sanitizeTextAlign(node.attrs?.textAlign) });

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

/**
 * Wrap chapter HTML into a full styled HTML document.
 */
export function buildBookHtml(book, chapters) {
  const coverImg = book.cover_image_url
    ? `<div class="cover"><img src="${escapeHtml(book.cover_image_url)}" alt="Cover"></div>`
    : '';

  const chaptersHtml = chapters
    .map(ch => `
      <section class="chapter">
        <h1 class="chapter-title">${escapeHtml(ch.title || 'Untitled Chapter')}</h1>
        ${tiptapToHtml(ch.content)}
      </section>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(book.title || 'Book')}</title>
<style>
  body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; line-height: 1.8; color: #111; }
  .cover img { width: 100%; max-height: 500px; object-fit: contain; margin-bottom: 2rem; }
  .title-page { text-align: center; padding: 4rem 0; }
  .title-page h1 { font-size: 2.5rem; margin-bottom: 1rem; }
  .title-page .author { font-size: 1.2rem; color: #555; }
  .chapter { page-break-before: always; margin-top: 3rem; }
  .chapter-title { font-size: 1.75rem; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
  h2 { font-size: 1.4rem; } h3 { font-size: 1.2rem; }
  blockquote { border-left: 4px solid #ccc; margin: 1rem 2rem; padding-left: 1rem; color: #555; }
  pre { background: #f4f4f4; padding: 1rem; overflow: auto; border-radius: 4px; }
  code { font-family: monospace; background: #f4f4f4; padding: 0 3px; }
  mark { padding: 0 2px; }
  ul, ol { padding-left: 2rem; }
  .table-scroll { overflow-x: auto; margin: 1rem 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; font-weight: 700; }
  th > p, td > p { margin: 0; }
  img { max-width: 100%; }
  @media print { .chapter { page-break-before: always; } }
</style>
</head>
<body>
  ${coverImg}
  <div class="title-page">
    <h1>${escapeHtml(book.title || 'Untitled')}</h1>
    ${book.subtitle ? `<p class="subtitle">${escapeHtml(book.subtitle)}</p>` : ''}
    <p class="author">${escapeHtml(book.author_name || '')}</p>
    ${book.description ? `<p class="description">${escapeHtml(book.description)}</p>` : ''}
  </div>
  ${chaptersHtml}
</body>
</html>`;
}
