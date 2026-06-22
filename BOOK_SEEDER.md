# BookFlow Book Seeder

A CLI tool to create books with full interactive content directly in the database — no server needed, no manual clicking.

---

## Quick Start

```bash
# From the bookflow/ folder:
node book-seeder.mjs seed-student-book.mjs --author=you@example.com
```

That's it. The book appears immediately in BookFlow.

---

## How It Works

`book-seeder.mjs` is the framework. It connects to Supabase using the service-role key (bypasses all auth) and exposes helper functions for building books.

Seed files (e.g. `seed-student-book.mjs`) import from the framework and define the book content.

---

## Prerequisites

1. **Server must have a `.env` file** at `bookflow/server/.env` with:
   ```
   SUPABASE_URL=https://mladgojbfyofgauiylxw.supabase.co
   SUPABASE_SERVICE_KEY=eyJ...
   SUPABASE_ANON_KEY=eyJ...
   ```

2. **The author must already exist** in Supabase Auth (registered in the app).

3. **Node 18+** (for top-level `await` and native fetch).

---

## Commands

```bash
# List available seed scripts
node book-seeder.mjs

# Run a seed
node book-seeder.mjs seed-student-book.mjs --author=pastor@church.com

# Or set author via env var
SEED_AUTHOR_EMAIL=pastor@church.com node book-seeder.mjs seed-student-book.mjs
```

---

## Creating a New Book Seed

Create a new file: `seed-my-book.mjs`

```js
import {
  resolveAuthor, createBook, createChapter, addInlineContent,
  doc, p, h, text, bold, italic, ul, ol, blockquote, widget, marked,
} from './book-seeder.mjs';

// 1. Resolve author
const author = await resolveAuthor();

// 2. Create the book
const book = await createBook({
  authorId:     author.id,
  title:        'My Book Title',
  subtitle:     'Optional subtitle',
  description:  'A short description shown on the landing page.',
  visibility:   'public',          // 'public' or 'private'
  slug:         'my-book-slug',   // /bl/my-book-slug
  coverImageUrl: 'https://...',   // Unsplash or hosted image
});

// 3. Create a chapter
const ch1 = await createChapter({
  bookId:     book.id,
  title:      'Chapter 1: Getting Started',
  content:    doc(p('placeholder')),  // temp — replaced below
  contentText: '',
  status:     'published',
  orderIndex: 0,
  slug:       'getting-started',
});

// 4. Add interactive content
const poll = await addInlineContent({
  chapterId:   ch1.id,
  authorId:    author.id,
  contentType: 'poll',
  anchorText:  'Opening poll',
  position:    'inline',
  contentData: {
    question:               'What is your experience level?',
    allow_multiple:         false,
    show_results_before_vote: true,
    options: [
      { id: 'o1', text: 'Complete beginner' },
      { id: 'o2', text: 'Some experience' },
      { id: 'o3', text: 'I know what I am doing' },
    ],
  },
});

const question = await addInlineContent({
  chapterId:   ch1.id,
  authorId:    author.id,
  contentType: 'question',
  anchorText:  'Your goal',
  position:    'inline',
  contentData: {
    question: 'What do you hope to get out of this book?',
    type:     'open',
  },
});

// 5. Build TipTap content
const ch1Content = doc(
  h(1, 'Chapter 1: Getting Started'),
  p('Welcome to this book. Let\'s start with a quick question:'),
  widget(poll),
  p('And one more:'),
  widget(question),
);

// 6. Patch chapter with real content
import { db } from './book-seeder.mjs';
await db.from('chapters').update({
  content:      ch1Content,
  content_text: 'Chapter 1 Getting Started Welcome poll question',
}).eq('id', ch1.id);

console.log(`\n✅ Done! View at http://localhost:5177/edit/book/${book.id}`);
```

Run it:
```bash
node book-seeder.mjs seed-my-book.mjs --author=you@example.com
```

---

## Interactive Content Types

| Type | Description | Required fields in `content_data` |
|------|-------------|-----------------------------------|
| `poll` | Multiple-choice vote with live results | `question`, `options[]`, `allow_multiple`, `show_results_before_vote` |
| `question` | Open-ended or multiple-choice reflection | `question`, `type` (`'open'`/`'multiple_choice'`/`'quiz'`), `options[]` |
| `highlight` | Coloured text highlight with optional note | `color` (hex), `note?` |
| `note` | Sidebar annotation or definition | `text`, `type` (`'annotation'`/`'definition'`/`'reference'`) |
| `video` | YouTube/Vimeo embed | `url`, `title?`, `size?` (25/50/75/100) |
| `image` | Image with caption | `url`, `alt?`, `caption?`, `width?` |
| `link` | Linked text with description | `url`, `title?`, `description?` |
| `radio` | Single-select form | `label`, `options[]`, `layout?` |
| `checkbox` | Multi-select form | `label`, `options[]`, `min_selections?`, `max_selections?` |
| `select` | Dropdown form | `label`, `options[]`, `placeholder?` |
| `multiselect` | Multi-select dropdown | `label`, `options[]`, `max_selections?` |
| `textbox` | Single-line text input | `label`, `placeholder?`, `max_length?` |
| `textarea` | Multi-line text input | `label`, `placeholder?`, `rows?`, `auto_expand?` |

### Position values
| Value | Where it appears |
|-------|-----------------|
| `'inline'` | Embedded in chapter text (requires a `widget()` or `marked()` call in the doc) |
| `'end_of_chapter'` | Shown automatically after chapter text |
| `'start_of_chapter'` | Shown automatically before chapter text |

---

## TipTap Doc Builders

```js
doc(...blocks)          // Wraps everything in a TipTap doc
h(level, 'text')        // Heading (level 1, 2, or 3)
p('text', node, ...)    // Paragraph (mix strings and text nodes)
text('str', ...marks)   // Text node with optional marks
bold                    // Bold mark object
italic                  // Italic mark object
ul('item1', 'item2')    // Bullet list
ol('item1', 'item2')    // Numbered list
blockquote('text')      // Blockquote block
widget(inlineRecord)    // Embed a form widget (radio, checkbox, textbox, etc.)
marked('text', record)  // Text with an inlineContentMark (poll, question, highlight, etc.)
```

---

## The Book Seed as a Prompt

When you want to create a new book, describe it like this:

```
Book title: [TITLE]
Subtitle:   [SUBTITLE]
Description: [1-2 sentences]
Visibility: public / private
Cover image: [Unsplash search term or URL]
Slug: [url-friendly-slug]

Chapter 1: [TITLE]
  Content: [paragraph descriptions]
  - poll: [question] / options: [list]
  - question: [open text prompt]
  - video: [YouTube URL or topic]
  - image: [description or URL]
  - radio: [question] / options: [list]
  - checkbox: [question] / options: [list]

Chapter 2: ...
Chapter 3: ...
```

Then ask Claude to generate a `seed-my-book.mjs` file following the patterns in `seed-student-book.mjs`.

---

## Existing Seeds

| File | Book |
|------|------|
| `seed-student-book.mjs` | Students: What I Think About School |

---

## Troubleshooting

**"No user with email found"** — The author email must be registered in the BookFlow app first. Sign up at `/register`.

**"SUPABASE_SERVICE_KEY not set"** — Check `bookflow/server/.env` exists and has the key.

**Chapter content looks blank in editor** — The `content` must be valid TipTap JSON and the `id` references in widgets must match real `inline_content` records. Check the console output for any `⚠` warnings.

**Running against local Supabase** — Set `SUPABASE_URL=http://localhost:55321` in `.env`. The seeder defaults to this.
