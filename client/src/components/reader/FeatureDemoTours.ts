/**
 * Feature Demo Tours
 * ──────────────────
 * One TutorialChapter per feature. Each chapter has 2-4 steps that spotlight
 * real elements inside the BookReader using existing CSS selectors / IDs.
 *
 * Steps navigate to the demo book chapter via `navigateTo`, then spotlight
 * elements already present in BookReader (header, sidebar, content area, etc.)
 */

import type { TutorialChapter } from './TutorialOverlay';
import { DEMO_CHAPTER_IDS, FEATURE_ORDER } from '../../config/demoBook';

function chapterUrl(bookId: string, featureId: string, liveIds?: string[]): string {
  // Use live IDs (sorted by order_index) when available; fall back to static map
  const chId = liveIds ? liveIds[FEATURE_ORDER[featureId]] : DEMO_CHAPTER_IDS[featureId];
  if (!bookId || !chId) return '';
  return `/book/${bookId}/chapter/${chId}`;
}

export function buildFeatureTours(bookId: string, liveChapterIds?: string[]): TutorialChapter[] {
  return [
    // ── 1. Rich Text Editor ──────────────────────────────────────────────────
    {
      title: '✍️ Rich Text Editor',
      description: 'See the powerful writing studio in action',
      steps: [
        {
          chapter: 0,
          target: null,
          placement: 'center',
          title: 'Welcome to the Rich Text Editor',
          description: 'BookFlow gives every author a professional writing studio — no downloads, no installs. Let\'s take a quick look at how it works.',
          navigateTo: chapterUrl(bookId, 'rich-text', liveChapterIds),
        },
        {
          chapter: 0,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Rich Chapter Content',
          description: 'This is a chapter rendered in the BookFlow reader. It supports bold, italic, headings, block quotes, bullet lists — all the tools you need to write beautifully formatted content.',
        },
        {
          chapter: 0,
          target: '#bf-tts-btn',
          placement: 'bottom',
          title: 'AI Text-to-Speech',
          description: 'Every chapter can be narrated instantly using AI text-to-speech. Click this button to hear the chapter read aloud — perfect for accessibility and audio learners.',
        },
        {
          chapter: 0,
          target: '#bf-reader-header',
          placement: 'bottom',
          title: 'Reader Controls',
          description: 'The header lets readers navigate chapters, toggle the table of contents, and access text-to-speech. Authors also see an Edit button to jump directly into the editor.',
        },
      ],
    },

    // ── 2. Reflection Questions ──────────────────────────────────────────────
    {
      title: '💬 Reflection Questions',
      description: 'Embed questions readers answer inline',
      steps: [
        {
          chapter: 1,
          target: null,
          placement: 'center',
          title: 'Inline Reflection Questions',
          description: 'Questions are embedded directly inside chapters. Readers answer without leaving the page — no forms, no pop-ups. You see every response in your dashboard.',
          navigateTo: chapterUrl(bookId, 'inline-questions', liveChapterIds),
        },
        {
          chapter: 1,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Questions Appear in the Text',
          description: 'Scroll down to the bottom of this chapter — you\'ll see live reflection questions embedded inline. They look like a natural part of the reading experience.',
          action: { type: 'scroll', instruction: 'Scroll down to see the reflection questions' },
        },
        {
          chapter: 1,
          target: null,
          placement: 'center',
          title: 'Try Answering One',
          description: 'Click into a question\'s text box and type your answer. Your response is saved automatically and is private to you — authors see aggregate stats, not individual names.',
        },
      ],
    },

    // ── 3. Live Polls ────────────────────────────────────────────────────────
    {
      title: '📊 Live Polls',
      description: 'Real-time voting embedded in chapters',
      steps: [
        {
          chapter: 2,
          target: null,
          placement: 'center',
          title: 'Live Polls — Instant Reader Engagement',
          description: 'Polls turn reading into a two-way conversation. Insert a poll anywhere in a chapter and readers tap to vote. Results update in real time as people respond.',
          navigateTo: chapterUrl(bookId, 'polls', liveChapterIds),
        },
        {
          chapter: 2,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Live Polls Below',
          description: 'Scroll to the bottom of this chapter to find live polls. Cast your vote and watch the results update instantly — you\'ll see the exact same experience your readers get.',
          action: { type: 'scroll', instruction: 'Scroll down to the polls and vote' },
        },
        {
          chapter: 2,
          target: null,
          placement: 'center',
          title: 'Results Are Shared',
          description: 'Poll results are visible to all readers — creating a sense of shared community around your book. Authors can see the full breakdown in their book dashboard.',
        },
      ],
    },

    // ── 4. Audio & TTS ───────────────────────────────────────────────────────
    {
      title: '🎵 Audio & Text-to-Speech',
      description: 'AI narration and custom audio per chapter',
      steps: [
        {
          chapter: 3,
          target: null,
          placement: 'center',
          title: 'Audio in Two Ways',
          description: 'BookFlow supports two audio modes: upload your own recorded MP3 per chapter, or activate AI text-to-speech to auto-narrate your book. Both are embedded directly in the reader.',
          navigateTo: chapterUrl(bookId, 'audio', liveChapterIds),
        },
        {
          chapter: 3,
          target: '#bf-tts-btn',
          placement: 'bottom',
          title: 'Text-to-Speech Button',
          description: 'Click this button and BookFlow will narrate the entire chapter in a natural AI voice — no recording needed. Words are highlighted in the text as they are read.',
        },
        {
          chapter: 3,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Words Highlighted as You Listen',
          description: 'While TTS is playing, the current word is highlighted in the text so readers can follow along. They can pause, resume, or stop at any time.',
        },
      ],
    },

    // ── 5. Embedded Video ────────────────────────────────────────────────────
    {
      title: '🎬 Embedded Video',
      description: 'YouTube & Vimeo inside the reading flow',
      steps: [
        {
          chapter: 4,
          target: null,
          placement: 'center',
          title: 'Video Without Leaving the Book',
          description: 'Authors paste a YouTube or Vimeo link while writing and BookFlow automatically converts it to a full embedded player. Readers watch without opening a new tab.',
          navigateTo: chapterUrl(bookId, 'video', liveChapterIds),
        },
        {
          chapter: 4,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Video Embeds Inline',
          description: 'Video players appear naturally inside the chapter content, between paragraphs — just like they would in a high-quality online course or editorial article.',
        },
        {
          chapter: 4,
          target: null,
          placement: 'center',
          title: 'Use Cases',
          description: 'Authors use video for welcome messages, demonstrations, teaching moments, author interviews, or supplementary content that enriches the reading experience without interrupting it.',
        },
      ],
    },

    // ── 6. Images & Covers ───────────────────────────────────────────────────
    {
      title: '🖼️ Images & Covers',
      description: 'Upload images and set a stunning book cover',
      steps: [
        {
          chapter: 5,
          target: null,
          placement: 'center',
          title: 'Images Inside Chapters',
          description: 'Drop images anywhere in a chapter with a single upload. BookFlow optimises them automatically for all screen sizes — desktop, tablet, and mobile.',
          navigateTo: chapterUrl(bookId, 'images', liveChapterIds),
        },
        {
          chapter: 5,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Responsive and Beautiful',
          description: 'Images render full-width inside the reading column with optional captions. They scale perfectly on any device so readers always see your visuals at their best.',
        },
        {
          chapter: 5,
          target: null,
          placement: 'center',
          title: 'Book Covers Drive Discovery',
          description: 'Set a book cover from the Book Settings page. Covers appear in the public library carousel, sharing previews, QR code landing pages, and the home page book grid.',
        },
      ],
    },

    // ── 7. Highlights & Notes ────────────────────────────────────────────────
    {
      title: '✨ Highlights & Notes',
      description: 'Readers annotate passages in 5 colours',
      steps: [
        {
          chapter: 6,
          target: null,
          placement: 'center',
          title: 'Make the Book Your Own',
          description: 'Readers can highlight any passage in one of five colours and attach a personal note. All annotations are private by default — only visible to the reader who made them.',
          navigateTo: chapterUrl(bookId, 'highlights', liveChapterIds),
        },
        {
          chapter: 6,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Select Text to Highlight',
          description: 'Select any sentence in this chapter right now. A colour toolbar will appear — choose a colour to highlight, or tap the note icon to add a private annotation.',
        },
        {
          chapter: 6,
          target: null,
          placement: 'center',
          title: 'Highlights Persist Forever',
          description: 'Your highlights and notes are saved to your account and appear every time you return to the book. You\'ll always find your personal annotations exactly where you left them.',
        },
      ],
    },

    // ── 8. Progress Tracking ─────────────────────────────────────────────────
    {
      title: '📈 Progress Tracking',
      description: 'Track reader and group completion',
      steps: [
        {
          chapter: 7,
          target: null,
          placement: 'center',
          title: 'Know Exactly Where Everyone Is',
          description: 'BookFlow tracks reader progress automatically. Every chapter opened, question answered, poll voted, and form submitted advances the reader\'s progress bar.',
          navigateTo: chapterUrl(bookId, 'progress', liveChapterIds),
        },
        {
          chapter: 7,
          target: '#bf-reader-header',
          placement: 'bottom',
          title: 'Reader Header & Navigation',
          description: 'The header shows which chapter you\'re on and gives quick access to TTS. Progress updates in real time as readers engage with questions, polls, and forms.',
        },
        {
          chapter: 7,
          target: '#bf-progress-btn',
          placement: 'right',
          title: 'Progress Button',
          description: 'Click the Progress button in the sidebar to see per-chapter completion bars. It turns green when all interactive items in a chapter are complete.',
        },
        {
          chapter: 7,
          target: '#bf-chapter-list',
          placement: 'right',
          title: 'Chapter List & Completion',
          description: 'The chapter list in the sidebar shows completion indicators for every chapter. Leaders of book clubs can see individual member progress from the club dashboard.',
        },
      ],
    },

    // ── 9. Inline Forms ──────────────────────────────────────────────────────
    {
      title: '📝 Inline Forms',
      description: 'Collect responses right inside the chapter',
      steps: [
        {
          chapter: 8,
          target: null,
          placement: 'center',
          title: 'Forms Without Leaving the Book',
          description: 'Drop text fields, dropdowns, radio buttons, checkboxes, and text areas anywhere in a chapter. Readers fill them in without ever navigating away from the reading experience.',
          navigateTo: chapterUrl(bookId, 'forms', liveChapterIds),
        },
        {
          chapter: 8,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Live Form Fields Below',
          description: 'Scroll to the bottom of this chapter to see a text field, a dropdown, and a text area — all embedded inline. Fill them in to see how the experience feels.',
          action: { type: 'scroll', instruction: 'Scroll down and fill in the form fields' },
        },
        {
          chapter: 8,
          target: null,
          placement: 'center',
          title: 'Responses Go to Your Dashboard',
          description: 'Every form response is saved to your book dashboard. Use forms for contact info, sign-ups, commitments, surveys — anything you\'d normally send readers to a separate page for.',
        },
      ],
    },

    // ── 10. Book Clubs ───────────────────────────────────────────────────────
    {
      title: '👥 Book Clubs & Study Groups',
      description: 'Private reading communities around any book',
      steps: [
        {
          chapter: 9,
          target: null,
          placement: 'center',
          title: 'Read Together, Grow Together',
          description: 'Book clubs are private reading communities tied to a specific book. Create a club, add a book, and invite members with one shareable link — done in under 60 seconds.',
          navigateTo: chapterUrl(bookId, 'clubs', liveChapterIds),
        },
        {
          chapter: 9,
          target: '#bf-toc-sidebar',
          placement: 'right',
          title: 'Shared Reading Experience',
          description: 'When you\'re in a club, you read the same book as your group. Leaders can post chapter-level questions, see who has finished each section, and chat in the built-in group channel.',
        },
        {
          chapter: 9,
          target: null,
          placement: 'center',
          title: 'Perfect for Any Group',
          description: 'Bible study groups, corporate training, university courses, recovery programs — any group that reads together benefits from the shared progress, discussion, and accountability that clubs provide.',
        },
      ],
    },

    // ── 11. Collaborate ──────────────────────────────────────────────────────
    {
      title: '🤝 Co-Authors & Collaborators',
      description: 'Write with a team using role-based access',
      steps: [
        {
          chapter: 10,
          target: null,
          placement: 'center',
          title: 'Team Writing Made Simple',
          description: 'Invite co-authors, editors, and reviewers with role-based permissions. Each collaborator sees the book in their own dashboard and works on their assigned sections.',
          navigateTo: chapterUrl(bookId, 'collaborate', liveChapterIds),
        },
        {
          chapter: 10,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Four Roles, Full Flexibility',
          description: 'Author, Editor, Reviewer, and Commenter roles let you control exactly what each collaborator can see and do — from full write access down to read-only annotation.',
        },
        {
          chapter: 10,
          target: null,
          placement: 'center',
          title: 'Full Credit for Everyone',
          description: 'Co-authored books display all authors\' names on the cover and in the public library. Invite your collaborators from Book Settings → Collaborators.',
        },
      ],
    },

    // ── 12. Publish & Export ─────────────────────────────────────────────────
    {
      title: '🚀 Publish & Export',
      description: 'Go live with one click or export to PDF',
      steps: [
        {
          chapter: 11,
          target: null,
          placement: 'center',
          title: 'Share Your Book with the World',
          description: 'Publishing is one click. Choose public (anyone finds it in the BookFlow library) or private (only people you share the link with). A QR code is generated automatically.',
          navigateTo: chapterUrl(bookId, 'publish', liveChapterIds),
        },
        {
          chapter: 11,
          target: '.reader-content',
          placement: 'bottom',
          title: 'Custom Slugs & QR Codes',
          description: 'Give your book a memorable URL like /bl/your-book-name. Every book and chapter also gets its own QR code — print it on flyers, bulletins, or physical copies.',
        },
        {
          chapter: 11,
          target: '#bf-reader-header',
          placement: 'bottom',
          title: 'PDF Export for Print',
          description: 'Export any published book to a clean, print-ready PDF. Perfect for archiving, printing physical copies, or distributing to readers who prefer offline reading.',
        },
      ],
    },
  ];
}
