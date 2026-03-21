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

  switch (node.type) {
    case 'doc':
      return (node.content || []).map(renderNode).join('');

    case 'paragraph':
      return `<p>${inner()}</p>\n`;

    case 'heading': {
      const level = node.attrs?.level || 1;
      return `<h${level}>${inner()}</h${level}>\n`;
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
