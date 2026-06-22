#!/usr/bin/env node
/**
 * BookFlow Book Seeder — Reusable Framework
 *
 * Uses the Supabase service-role key to insert books/chapters/inline-content
 * directly into the DB (no HTTP server required, no auth token needed).
 *
 * USAGE:
 *   node book-seeder.mjs                         — list all seed scripts
 *   node book-seeder.mjs seed-student-book.mjs   — run a specific seed
 *
 * ENV:  reads from bookflow/server/.env  (same file the server uses)
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env from server ─────────────────────────────────────────────────────
const envPath = path.join(__dirname, 'server', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

// Prefer explicit cloud vars, fall back to .env (which may point to local)
const SUPABASE_URL         = process.env.SEED_SUPABASE_URL  || process.env.SUPABASE_URL || 'http://localhost:55321';
const SUPABASE_SERVICE_KEY = process.env.SEED_SERVICE_KEY   || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('\n  ERROR: SUPABASE_SERVICE_KEY not set.\n  Add it to bookflow/server/.env\n');
  process.exit(1);
}

// ── Supabase client (service role — bypasses RLS) ────────────────────────────
export const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db:   { schema: 'bookflow' },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find a user by email (to set as author).
 * Pass email via --author flag or SEED_AUTHOR_EMAIL env var.
 */
export async function resolveAuthor(emailOverride) {
  const email = emailOverride
    || process.env.SEED_AUTHOR_EMAIL
    || (() => { const a = process.argv.find(a => a.startsWith('--author=')); return a?.split('=')[1]; })();

  if (!email) {
    console.error('\n  ERROR: Author email required.\n  Pass --author=you@example.com or set SEED_AUTHOR_EMAIL\n');
    process.exit(1);
  }

  // Look up via bookflow.profiles (works without auth.admin on cloud)
  const { data, error } = await db.from('profiles').select('id, email, display_name').ilike('email', email);
  if (error) throw new Error(`Could not query profiles: ${error.message}`);
  const profile = data?.[0];
  if (!profile) {
    // List available emails to help debug
    const { data: all } = await db.from('profiles').select('email').limit(20);
    console.error(`\n  ERROR: No user with email "${email}" found.`);
    console.error(`  Available emails: ${all?.map(u => u.email).join(', ')}\n`);
    process.exit(1);
  }
  return { id: profile.id, email: profile.email };
}

/**
 * Create a book.
 * @param {object} opts
 * @param {string} opts.authorId
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} [opts.description]
 * @param {string} [opts.coverImageUrl]
 * @param {'private'|'public'} [opts.visibility]
 * @param {string} [opts.slug]           — human-readable URL slug
 */
export async function createBook({ authorId, title, subtitle, description, coverImageUrl, visibility = 'private', slug }) {
  const row = {
    author_id:       authorId,
    title,
    subtitle:        subtitle || null,
    description:     description || null,
    cover_image_url: coverImageUrl || null,
    visibility,
    status:          'draft',
    slug:            slug || null,
  };

  const { data, error } = await db.from('books').insert(row).select().single();
  if (error) throw new Error(`createBook failed: ${error.message}`);
  console.log(`  ✓ Book created: "${title}" (${data.id})`);
  return data;
}

/**
 * Create a chapter.
 * @param {object} opts
 * @param {string} opts.bookId
 * @param {string} opts.title
 * @param {object} opts.content          — TipTap JSON doc
 * @param {string} [opts.contentText]    — plain text (for word count)
 * @param {'draft'|'published'} [opts.status]
 * @param {number} [opts.orderIndex]
 * @param {string} [opts.slug]
 */
export async function createChapter({ bookId, title, content, contentText, status = 'published', orderIndex, slug }) {
  // Compute word count from content text
  const words = (contentText || '').trim().split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.round(words / 200));

  const row = {
    book_id:                   bookId,
    title,
    content,
    content_text:              contentText || null,
    status,
    order_index:               orderIndex ?? 0,
    slug:                      slug || null,
    word_count:                words,
    estimated_read_time_minutes: readTime,
  };

  const { data, error } = await db.from('chapters').insert(row).select().single();
  if (error) throw new Error(`createChapter "${title}" failed: ${error.message}`);
  console.log(`    ✓ Chapter: "${title}" (${data.id})`);
  return data;
}

/**
 * Add an inline content item to a chapter.
 * @param {object} opts
 * @param {string} opts.chapterId
 * @param {string} opts.authorId
 * @param {'question'|'poll'|'highlight'|'note'|'link'|'audio'|'video'|
 *          'select'|'multiselect'|'textbox'|'textarea'|'radio'|'checkbox'} opts.contentType
 * @param {object} opts.contentData      — type-specific data
 * @param {string} [opts.anchorText]     — label text
 * @param {'inline'|'start_of_chapter'|'end_of_chapter'} [opts.position]
 * @param {'all_readers'|'private'|'author_only'} [opts.visibility]
 * @param {'private'|'members_only'|'all_readers'} [opts.responseVisibility]
 * @param {number} [opts.startOffset]
 * @param {number} [opts.endOffset]
 */
export async function addInlineContent({
  chapterId,
  bookId,
  authorId,
  contentType,
  contentData,
  anchorText = '',
  position = 'end_of_chapter',
  visibility = 'all_readers',
  responseVisibility = 'private',
  startOffset = 0,
  endOffset = 0,
}) {
  // Resolve bookId from chapter if not provided
  let resolvedBookId = bookId;
  if (!resolvedBookId) {
    const { data } = await db.from('chapters').select('book_id').eq('id', chapterId).single();
    resolvedBookId = data?.book_id;
  }

  const row = {
    book_id:             resolvedBookId,
    chapter_id:          chapterId,
    created_by:          authorId,
    content_type:        contentType,
    content_data:        contentData,
    anchor_text:         anchorText,
    position_in_chapter: position,
    visibility,
    response_visibility: responseVisibility,
    start_offset:        startOffset,
    end_offset:          endOffset,
    is_author_content:   true,
  };

  const { data, error } = await db.from('inline_content').insert(row).select().single();
  if (error) throw new Error(`addInlineContent "${contentType}" failed: ${error.message}`);
  console.log(`      + ${contentType}: "${anchorText || contentData?.question || contentData?.label || ''}"`);
  return data;
}

// ── TipTap doc builders ───────────────────────────────────────────────────────

/** Wrap blocks in a TipTap doc */
export function doc(...blocks) {
  return { type: 'doc', content: blocks.flat() };
}

/** Paragraph node */
export function p(...inlineNodes) {
  const content = inlineNodes.map(n => typeof n === 'string' ? text(n) : n);
  return { type: 'paragraph', content };
}

/** Heading node (level 1–3) */
export function h(level, str) {
  return { type: 'heading', attrs: { level }, content: [text(str)] };
}

/** Plain text node */
export function text(str, ...marks) {
  const node = { type: 'text', text: str };
  if (marks.length) node.marks = marks;
  return node;
}

/** Bold mark */
export const bold   = { type: 'bold' };
/** Italic mark */
export const italic = { type: 'italic' };

/** Bullet list */
export function ul(...items) {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [typeof item === 'string' ? text(item) : item] }],
    })),
  };
}

/** Ordered list */
export function ol(...items) {
  return {
    type: 'orderedList',
    content: items.map(item => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [typeof item === 'string' ? text(item) : item] }],
    })),
  };
}

/** Blockquote */
export function blockquote(str) {
  return { type: 'blockquote', content: [p(str)] };
}

/**
 * Inline content widget (form elements: textbox, textarea, radio, checkbox, select, multiselect).
 * Pass the inline_content record returned by addInlineContent().
 */
export function widget(inlineContentRecord) {
  return {
    type: 'inlineFormWidget',
    attrs: {
      contentId:   inlineContentRecord.id,
      contentType: inlineContentRecord.content_type,
      anchorText:  inlineContentRecord.anchor_text || '',
      position:    inlineContentRecord.position_in_chapter || 'end_of_chapter',
      contentData: inlineContentRecord.content_data,
    },
  };
}

/**
 * Text with an inlineContentMark (question, poll, highlight, note, link, audio, video).
 */
export function marked(str, inlineContentRecord) {
  return text(str, {
    type: 'inlineContentMark',
    attrs: {
      contentType: inlineContentRecord.content_type,
      contentId:   inlineContentRecord.id,
    },
  });
}

// ── CLI entry point ───────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const seeds = fs.readdirSync(__dirname).filter(f => f.startsWith('seed-') && f.endsWith('.mjs'));
  const target = process.argv[2];

  if (!target || target === '--list') {
    console.log('\nAvailable seed scripts:\n');
    seeds.forEach(s => console.log(`  node book-seeder.mjs ${s}`));
    console.log('\nOptions:');
    console.log('  --author=email@example.com   Set the book author');
    console.log('  --dry-run                    Preview without writing to DB\n');
    process.exit(0);
  }

  const seedPath = path.resolve(__dirname, target);
  if (!fs.existsSync(seedPath)) {
    console.error(`\n  ERROR: Seed file not found: ${target}\n`);
    process.exit(1);
  }

  console.log(`\nRunning seed: ${target}\n`);
  import(seedPath).catch(err => {
    console.error('\nSeed failed:', err.message);
    process.exit(1);
  });
}
