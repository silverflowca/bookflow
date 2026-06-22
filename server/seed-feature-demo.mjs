/**
 * BookFlow Feature Demo Seed Script
 * ───────────────────────────────────
 * Creates one public demo book with 12 chapters — one per feature.
 * Each chapter has the feature embedded and ready to interact with.
 *
 * Usage (local):  node server/seed-feature-demo.mjs --author=you@example.com
 * Usage (cloud):  SEED_SUPABASE_URL=https://... SEED_SERVICE_KEY=eyJ... \
 *                   node server/seed-feature-demo.mjs --author=you@example.com
 *
 * Output: Prints the demo book ID + chapter IDs — paste into client/src/config/demoBook.ts
 *         and then select the book in Admin → Settings → Feature Demo Settings.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const SUPABASE_URL = process.env.SEED_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:55321';
const SERVICE_KEY  = process.env.SEED_SERVICE_KEY  || process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('\n  ERROR: SUPABASE_SERVICE_KEY not set.\n  Add it to bookflow/server/.env or pass SEED_SERVICE_KEY=...\n');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db:   { schema: 'bookflow' },
});

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const step = (msg) => console.log(`\n▸ ${msg}`);

// ── Resolve author ─────────────────────────────────────────────────────────────
async function resolveAuthor() {
  const arg   = process.argv.find(a => a.startsWith('--author='));
  const email = arg?.split('=')[1] || process.env.SEED_AUTHOR_EMAIL;

  if (!email) {
    console.error('\n  ERROR: Author email required.\n  Pass --author=you@example.com or set SEED_AUTHOR_EMAIL\n');
    process.exit(1);
  }

  const { data, error } = await db.from('profiles').select('id, email').ilike('email', email);
  if (error) throw new Error(`Could not query profiles: ${error.message}`);
  const profile = data?.[0];
  if (!profile) {
    const { data: all } = await db.from('profiles').select('email').limit(20);
    console.error(`\n  ERROR: No user with email "${email}" found.`);
    console.error(`  Available: ${all?.map(u => u.email).join(', ')}\n`);
    process.exit(1);
  }
  log(`Author: ${profile.email} (${profile.id})`);
  return profile.id;
}

// ── TipTap helpers ─────────────────────────────────────────────────────────────
function doc(...nodes) { return { type: 'doc', content: nodes }; }
function h2(text)      { return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] }; }
function p(text)       { return { type: 'paragraph', content: [{ type: 'text', text }] }; }
function bold(text)    { return { type: 'text', text, marks: [{ type: 'bold' }] }; }
function para(...parts){ return { type: 'paragraph', content: parts.map(x => typeof x === 'string' ? { type: 'text', text: x } : x) }; }
function bq(text)      { return { type: 'blockquote', content: [p(text)] }; }

function extractText(docNode) {
  return (docNode.content || []).flatMap(node =>
    (node.content || []).map(n => n.text || '').concat(
      (node.content || []).flatMap(n => (n.content || []).map(x => x.text || ''))
    )
  ).join(' ').replace(/\s+/g, ' ').trim();
}

// ── Chapter definitions ────────────────────────────────────────────────────────
const CHAPTERS = [
  {
    featureId: 'rich-text',
    title: '✍️ Rich Text Editor',
    content: doc(
      h2('Write with a full creative studio'),
      p('BookFlow\'s rich text editor gives you everything you need to write professional, beautifully formatted books — right in your browser.'),
      para('Try ', bold('bold'), ', ', { type: 'text', text: 'headings', marks: [{ type: 'italic' }] }, ', bullet lists, block quotes, and more. Your work auto-saves every few seconds so you never lose a word.'),
      p('This entire chapter was written using the same editor your readers will use. What you see here is exactly what readers experience.'),
      bq('Great writing deserves great tools. BookFlow gives you both.'),
      p('Try selecting any text in this chapter — you\'ll see the inline toolbar appear with formatting options, highlight tools, and the ability to add notes.'),
    ),
    inlineContent: [],
  },
  {
    featureId: 'inline-questions',
    title: '💬 Reflection Questions',
    content: doc(
      h2('Engage your readers with inline questions'),
      p('Reflection questions transform passive reading into active learning. Embed them directly inside your chapters — no forms, no pop-ups.'),
      p('Readers type their answer right beside the text, without ever leaving the page. As the author, you see every response in your dashboard.'),
      p('Try answering the question below. Your response is private to you unless you choose to share it.'),
    ),
    inlineContent: [
      {
        content_type: 'question',
        position_in_chapter: 'end_of_chapter',
        visibility: 'all_readers',
        content_data: {
          question: 'What is one area in your life where you could benefit most from this kind of interactive reflection?',
          allow_multiple_answers: false,
        },
      },
      {
        content_type: 'question',
        position_in_chapter: 'end_of_chapter',
        visibility: 'all_readers',
        content_data: {
          question: 'How do you currently capture insights when reading a book? What do you wish was different?',
          allow_multiple_answers: false,
        },
      },
    ],
  },
  {
    featureId: 'polls',
    title: '📊 Live Polls',
    content: doc(
      h2('See what your readers think — in real time'),
      p('Live polls make your book a two-way conversation. Insert a poll anywhere in a chapter and readers tap to vote. Results update live as people respond.'),
      p('Polls are perfect for gauging reader sentiment, running surveys, or creating a shared experience across your entire audience.'),
      p('Cast your vote below and watch the results update instantly:'),
    ),
    inlineContent: [
      {
        content_type: 'poll',
        position_in_chapter: 'end_of_chapter',
        visibility: 'all_readers',
        content_data: {
          question: 'How do you prefer to read books?',
          options: [
            { id: 'opt_0', text: '📱 Digital / e-reader' },
            { id: 'opt_1', text: '📖 Physical print' },
            { id: 'opt_2', text: '🎧 Audiobook' },
            { id: 'opt_3', text: 'Depends on the book!' },
          ],
          allow_multiple: false,
        },
      },
      {
        content_type: 'poll',
        position_in_chapter: 'end_of_chapter',
        visibility: 'all_readers',
        content_data: {
          question: 'What would make you more likely to finish a book?',
          options: [
            { id: 'opt_0', text: 'Reflection questions' },
            { id: 'opt_1', text: 'Progress tracking' },
            { id: 'opt_2', text: 'A reading community' },
            { id: 'opt_3', text: 'Shorter chapters' },
          ],
          allow_multiple: false,
        },
      },
    ],
  },
  {
    featureId: 'audio',
    title: '🎵 Audio & Text-to-Speech',
    content: doc(
      h2('Read, listen, or both'),
      p('BookFlow supports two audio modes: upload your own recorded audio per chapter, or activate AI text-to-speech and let BookFlow narrate your book automatically.'),
      p('Text-to-speech is perfect for accessibility — readers who prefer listening can hear every chapter in a natural AI voice without any extra work from you as the author.'),
      p('Look for the audio controls in the chapter header above. Press play to hear this chapter narrated — then try reading along as the text is highlighted.'),
      p('For custom audio uploads, authors simply record their chapter, upload the MP3, and readers get a professional audio player embedded directly in the reading experience.'),
    ),
    inlineContent: [],
  },
  {
    featureId: 'video',
    title: '🎬 Embedded Video',
    content: doc(
      h2('Bring your content to life with video'),
      p('Paste any YouTube or Vimeo link and it embeds directly into the reading flow — no new tabs, no distractions.'),
      p('Use video for welcome messages from the author, demonstrations, teaching moments, or testimonials that deepen reader engagement.'),
      p('Below is a sample embedded video. Readers watch it without ever leaving the book:'),
      p('▶ Video demo: https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      p('Authors paste the link while writing and BookFlow automatically converts it to a full embedded player. Works with YouTube, Vimeo, and most major video platforms.'),
    ),
    inlineContent: [],
  },
  {
    featureId: 'images',
    title: '🖼️ Images & Covers',
    content: doc(
      h2('A picture is worth a thousand words'),
      p('Upload images directly into any chapter with a single drag-and-drop or file picker. Images are automatically optimized for all screen sizes — desktop, tablet, and mobile.'),
      p('Set a book cover to make your book stand out in the library and on social shares. Covers display in the public book grid, carousels, and QR code landing pages.'),
      p('In the editor, use the image toolbar button to insert a photo anywhere in your chapter. Add a caption to give context, and readers see a beautiful, responsive image inline with your text.'),
      bq('Visual content increases engagement by up to 80%. BookFlow makes it effortless.'),
    ),
    inlineContent: [],
  },
  {
    featureId: 'highlights',
    title: '✨ Highlights & Notes',
    content: doc(
      h2('Make the book your own'),
      p('Readers can select any passage and highlight it in one of five colours. Add a personal note to capture your thoughts in the moment.'),
      p('All highlights and notes are private by default — visible only to you. No one else sees your personal annotations.'),
      p('Try it now: select any sentence in this chapter, and the formatting toolbar will appear with highlight colour options and a note button.'),
      para(bold('Yellow'), ' — key ideas. ', bold('Blue'), ' — questions. ', bold('Green'), ' — action items. ', bold('Pink'), ' — inspiration. ', bold('Purple'), ' — scripture or quotes.'),
      p('Your highlights are saved automatically and persist every time you return to the book. Find them all in the highlights panel on the right side of the reader.'),
    ),
    inlineContent: [],
  },
  {
    featureId: 'progress',
    title: '📈 Progress Tracking',
    content: doc(
      h2('Know exactly where you are — and where your readers are'),
      p('BookFlow tracks reader progress automatically. Every chapter you open, every question you answer, every poll you vote in, every form you fill — all of it advances your progress bar.'),
      p('As an author, you see completion statistics in your book dashboard: how many readers started, how many finished each chapter, which questions got the most responses.'),
      p('For book clubs and study groups, leaders can see individual member progress at a glance — who is keeping up, who needs encouragement, who has finished ahead of the group.'),
      para(bold('For readers: '), 'your progress bar is shown at the top of each chapter. It updates in real time as you engage with the content.'),
      para(bold('For authors: '), 'visit your Book Dashboard to see aggregate analytics across all readers.'),
    ),
    inlineContent: [
      {
        content_type: 'question',
        position_in_chapter: 'end_of_chapter',
        visibility: 'all_readers',
        content_data: {
          question: 'What percentage of books you start do you actually finish? What gets in the way?',
          allow_multiple_answers: false,
        },
      },
    ],
  },
  {
    featureId: 'forms',
    title: '📝 Inline Forms',
    content: doc(
      h2('Collect exactly what you need, right inside the chapter'),
      p('Drop text fields, text areas, dropdowns, radio buttons, checkboxes, and multi-selects anywhere in a chapter. Readers fill them in without leaving the reading experience.'),
      p('Use forms for sign-ups, reflections, surveys, commitments, contact info — anything you would normally send a reader to a separate form for.'),
      p('Try filling in the form below. Your responses are saved instantly and you can access them in your book dashboard:'),
    ),
    inlineContent: [
      {
        content_type: 'textbox',
        position_in_chapter: 'end_of_chapter',
        visibility: 'all_readers',
        content_data: {
          label: 'What is your name?',
          placeholder: 'Enter your name',
          width: 'md',
          required: false,
        },
      },
      {
        content_type: 'select',
        position_in_chapter: 'end_of_chapter',
        visibility: 'all_readers',
        content_data: {
          label: 'What brings you to BookFlow?',
          placeholder: 'Choose one...',
          options: [
            { id: 's1', text: 'Writing a book' },
            { id: 's2', text: 'Reading & learning' },
            { id: 's3', text: 'Leading a book club' },
            { id: 's4', text: 'Teaching or training' },
            { id: 's5', text: 'Just exploring' },
          ],
        },
      },
      {
        content_type: 'textarea',
        position_in_chapter: 'end_of_chapter',
        visibility: 'all_readers',
        content_data: {
          label: 'Share a quick thought about interactive reading:',
          placeholder: 'Type your thoughts here...',
          rows: 4,
          auto_expand: true,
          width: 'full',
        },
      },
    ],
  },
  {
    featureId: 'clubs',
    title: '👥 Book Clubs & Study Groups',
    content: doc(
      h2('Read together, grow together'),
      p('Book clubs on BookFlow are private reading communities tied to a specific book. Leaders create a club, add a book, and invite members with one shareable link.'),
      p('Inside the club, members read together at their own pace, discuss chapters in the built-in group chat, answer the author\'s embedded questions, and track each other\'s progress.'),
      p('Leaders can post their own study questions at the chapter level, see who has finished each section, and nudge members who are falling behind.'),
      bq('Bible study groups, recovery programs, corporate training, university courses — any group that reads together thrives with BookFlow clubs.'),
      p('Click "Join a Study" in the navigation to see the clubs section. You can create your own club in under 60 seconds.'),
    ),
    inlineContent: [
      {
        content_type: 'poll',
        position_in_chapter: 'end_of_chapter',
        visibility: 'all_readers',
        content_data: {
          question: 'Have you ever been part of a book club or study group?',
          options: [
            { id: 'opt_0', text: 'Yes — and it was great!' },
            { id: 'opt_1', text: 'Yes — but it fizzled out' },
            { id: 'opt_2', text: 'No — but I\'d like to try' },
            { id: 'opt_3', text: 'No — prefer reading solo' },
          ],
          allow_multiple: false,
        },
      },
    ],
  },
  {
    featureId: 'collaborate',
    title: '🤝 Co-Authors & Collaborators',
    content: doc(
      h2('Write with a team'),
      p('Invite co-authors, editors, and reviewers to your book with role-based permissions. Each role controls what they can see and do:'),
      para(bold('Author'), ' — full read/write access to all chapters'),
      para(bold('Editor'), ' — can edit chapter content but not publish'),
      para(bold('Reviewer'), ' — can leave comments but not edit'),
      para(bold('Commenter'), ' — can annotate and respond'),
      p('Collaborators appear as badge avatars on the book cover. Each person sees the book in their own dashboard and works on their assigned sections.'),
      p('For co-authored books, both authors\' names appear on the cover and in the public library — full credit for everyone who contributed.'),
    ),
    inlineContent: [],
  },
  {
    featureId: 'publish',
    title: '🚀 Publish & Export',
    content: doc(
      h2('Share your book with the world'),
      p('When your book is ready, publishing takes one click. Choose public (anyone can find it in the BookFlow library) or private (only people you share the link with).'),
      p('Every published book gets a shareable URL and QR code automatically. Print the QR code in bulletins, flyers, or physical books — readers scan and land directly on your book page.'),
      para(bold('Custom slug: '), 'give your book a memorable URL like bookflow.app/bl/your-book-name instead of a UUID.'),
      para(bold('PDF export: '), 'export any book to a clean, print-ready PDF for physical distribution or archiving.'),
      para(bold('Chapter QR codes: '), 'each chapter also gets its own QR code — perfect for small group leaders who want members to jump directly to this week\'s chapter.'),
      p('Go to Book Settings → Publishing to try it on this demo book right now.'),
    ),
    inlineContent: [],
  },
];

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  step('Resolving author...');
  const authorId = await resolveAuthor();

  step('Cleaning up any previous demo books...');
  const { data: existing } = await db.from('books')
    .select('id, title')
    .eq('title', 'BookFlow Feature Demo')
    .eq('author_id', authorId);
  for (const b of existing || []) {
    await db.from('books').delete().eq('id', b.id);
    log(`Deleted old demo book: ${b.id}`);
  }

  step('Creating feature demo book...');
  const bookRow = {
    author_id:   authorId,
    title:       'BookFlow Feature Demo',
    subtitle:    'Interactive tour of every feature',
    description: 'This demo book showcases all 12 BookFlow features. Each chapter demonstrates one feature with live interactive content you can try right now.',
    visibility:  'public',
    status:      'published',
    slug:        null,
  };
  const { data: book, error: bookErr } = await db.from('books').insert(bookRow).select().single();
  if (bookErr) throw new Error(`createBook failed: ${bookErr.message}`);
  log(`Book created: ${book.id}`);

  step('Creating 12 feature chapters...');
  const chapterMap = {};

  for (let i = 0; i < CHAPTERS.length; i++) {
    const ch = CHAPTERS[i];
    const contentText = extractText(ch.content);
    const words   = contentText.trim().split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.round(words / 200));

    const chRow = {
      book_id:                     book.id,
      title:                       ch.title,
      content:                     ch.content,
      content_text:                contentText,
      status:                      'published',
      order_index:                 i,
      slug:                        null,
      word_count:                  words,
      estimated_read_time_minutes: readTime,
    };
    const { data: chapter, error: chErr } = await db.from('chapters').insert(chRow).select().single();
    if (chErr) throw new Error(`createChapter "${ch.title}" failed: ${chErr.message}`);
    chapterMap[ch.featureId] = chapter.id;
    log(`Chapter ${i + 1}: ${ch.title} → ${chapter.id}`);

    // Add inline content
    for (const ic of ch.inlineContent) {
      const icRow = {
        book_id:             book.id,
        chapter_id:          chapter.id,
        created_by:          authorId,
        content_type:        ic.content_type,
        content_data:        ic.content_data,
        anchor_text:         '',
        position_in_chapter: ic.position_in_chapter || 'end_of_chapter',
        visibility:          ic.visibility || 'all_readers',
        response_visibility: 'private',
        start_offset:        0,
        end_offset:          0,
        is_author_content:   true,
      };
      const { error: icErr } = await db.from('inline_content').insert(icRow);
      if (icErr) throw new Error(`addInlineContent "${ic.content_type}" failed: ${icErr.message}`);
      log(`  + ${ic.content_type}`);
    }
  }

  step('Done! ✅');
  console.log('\n' + '─'.repeat(60));
  console.log('Paste this into  client/src/config/demoBook.ts :');
  console.log('─'.repeat(60));
  console.log(`export const DEMO_BOOK_ID = '${book.id}';`);
  console.log('');
  console.log('export const DEMO_CHAPTER_IDS: Record<string, string> = {');
  for (const [featureId, chapterId] of Object.entries(chapterMap)) {
    console.log(`  '${featureId}':${''.padEnd(Math.max(0, 18 - featureId.length))} '${chapterId}',`);
  }
  console.log('};');
  console.log('─'.repeat(60));
  console.log('\nThen in Admin → Settings → Feature Demo Settings, select "BookFlow Feature Demo".\n');
}

main().catch(e => { console.error('\n✗ Error:', e.message); process.exit(1); });
