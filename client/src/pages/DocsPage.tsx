import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, ChevronDown, ChevronRight, Search, X,
  BookMarked, Users, BarChart2, Share2,
  Settings, Shield, HelpCircle,
  Eye, Radio, Layers, Bell,
  Zap,
  UserPlus, Lightbulb, MessageSquare, PenLine,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string;
  a: string | JSX.Element;
  tags?: string[];
}

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  bg: string;
  intro: string;
  faqs: FaqItem[];
}

interface NavigationResult {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  tags?: string[];
  adminOnly?: boolean;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    icon: <Zap className="h-5 w-5" />,
    title: 'Getting Started',
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200',
    intro: 'Everything you need to know to create your first book and share it with readers.',
    faqs: [
      {
        q: 'What is BookFlow?',
        a: 'BookFlow is an interactive digital book platform. Authors can write books with rich text, embed questions, polls, and forms directly into chapters — and readers can respond, track their progress, and discuss the content in study groups or clubs.',
        tags: ['overview'],
      },
      {
        q: 'How do I create my first book?',
        a: (
          <ol className="list-decimal ml-4 space-y-1.5 text-sm">
            <li>Sign in and go to your <strong>Dashboard</strong>.</li>
            <li>Click <strong>"New Book"</strong> (top-right).</li>
            <li>Enter a title — you can add a subtitle and description later.</li>
            <li>You'll land on the <strong>Book Editor</strong> where you can add chapters immediately.</li>
            <li>Click <strong>"Add Chapter"</strong>, give it a title, then click the chapter title to open the chapter editor.</li>
          </ol>
        ),
        tags: ['create', 'book', 'chapter'],
      },
      {
        q: 'Do I need an account to read a book?',
        a: 'No — public books are accessible to anyone via a share link or QR code without logging in. However, creating an account lets you save your reading progress, submit responses to questions and polls, join study groups, and track your completions.',
        tags: ['read', 'guest', 'account'],
      },
      {
        q: 'How do I find books to read?',
        a: 'From the Dashboard, click the "Discover Books" tab to browse all public books. You can also receive a direct share link or scan a QR code to open a specific book instantly.',
        tags: ['discover', 'browse'],
      },
      {
        q: 'What is the difference between an Author and a Reader?',
        a: 'An Author creates and manages books, adds interactive content, and reviews reader responses. A Reader reads books, answers questions, votes on polls, tracks progress, and joins clubs. The same account can be both — toggle Author status in Settings → Profile.',
        tags: ['author', 'reader', 'role'],
      },
    ],
  },
  {
    id: 'books-chapters',
    icon: <BookMarked className="h-5 w-5" />,
    title: 'Books & Chapters',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    intro: 'Manage your books, chapters, metadata, covers, and publishing workflow.',
    faqs: [
      {
        q: 'How do I add or reorder chapters?',
        a: 'Open the Book Editor (the chapter list page). Click "Add Chapter" to create a new one. To reorder, drag the grip handle (⠿) on the left of any chapter row up or down — the order saves automatically.',
        tags: ['chapter', 'reorder', 'drag'],
      },
      {
        q: 'How do I upload a cover image?',
        a: 'In the Book Editor, click the cover placeholder or the camera icon to upload an image. Supported formats: JPG, PNG, WebP. Maximum size: 5 MB.',
        tags: ['cover', 'image', 'upload'],
      },
      {
        q: 'What is the difference between Draft, Published, and Archived?',
        a: (
          <ul className="space-y-1.5 text-sm">
            <li><strong>Draft</strong> — only visible to you and your collaborators.</li>
            <li><strong>Published</strong> — visible to everyone (public books) or your readers (private books).</li>
            <li><strong>Archived</strong> — hidden from listings; accessible only via direct link. Use this instead of deleting.</li>
          </ul>
        ),
        tags: ['status', 'publish', 'draft', 'archive'],
      },
      {
        q: 'How do I publish a book?',
        a: 'From the Book Editor, click "Publish" in the top actions bar. This sets the book to Published and, if it is a public book, makes it discoverable in Browse. You can also submit for review first if you want another collaborator to approve the content.',
        tags: ['publish', 'visibility'],
      },
      {
        q: 'How do I set a custom URL slug for my book?',
        a: 'Click the Share icon in the Book Editor toolbar, then click the pencil icon next to the current slug. Type your desired URL-safe slug (letters, numbers, hyphens) and save. The book will then be accessible at /bl/your-slug and /read/your-slug.',
        tags: ['slug', 'url', 'share'],
      },
      {
        q: 'Can I export my book?',
        a: 'Yes. From the Book Editor toolbar, use the Download icon to export as PDF, EPUB, DOCX, or a BookFlow JSON archive. JSON exports can be re-imported to create a new copy.',
        tags: ['export', 'pdf', 'epub', 'docx', 'download'],
      },
      {
        q: 'How do I save a version snapshot?',
        a: 'Go to Book Editor → Versions tab (clock icon). Click "Save Version" and optionally add a label. Snapshots capture all chapter content at that moment. You can restore any previous version at any time — restoring creates a new version of the current state before overwriting.',
        tags: ['version', 'snapshot', 'restore', 'history'],
      },
      {
        q: 'How do I see all recent changes to a book?',
        a: 'Open the Book Editor and click the Activity tab (clock/list icon). The timeline shows every version save, comment, inline content change, and collaborator action — who did it and when.',
        tags: ['activity', 'history', 'changelog'],
      },
      {
        q: 'How do I undo or redo changes in the chapter editor?',
        a: (
          <ul className="space-y-1.5 text-sm">
            <li>Click the <strong>↩ Undo</strong> or <strong>↪ Redo</strong> buttons at the far left of the editor toolbar.</li>
            <li>Or use keyboard shortcuts: <strong>Ctrl+Z</strong> (Undo) and <strong>Ctrl+Shift+Z</strong> (Redo) on Windows; <strong>⌘Z</strong> / <strong>⌘⇧Z</strong> on Mac.</li>
            <li>Undo history is cleared when you first load a chapter — you cannot undo back past the initial load.</li>
            <li>The auto-save (2 seconds after you stop typing) only fires for changes you make, not for undo/redo actions that restore prior content.</li>
          </ul>
        ),
        tags: ['undo', 'redo', 'editor', 'history', 'keyboard'],
      },
    ],
  },
  {
    id: 'interactive-content',
    icon: <Layers className="h-5 w-5" />,
    title: 'Interactive Content',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    intro: 'Add questions, polls, forms, media, and more directly inside your chapter text.',
    faqs: [
      {
        q: 'What types of interactive components can I add?',
        a: (
          <div className="space-y-2 text-sm">
            <p>There are 3 main categories:</p>
            <p><strong>Questions & Polls</strong></p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><strong>Question</strong> — open-ended, multiple choice, or quiz (with correct answer + explanation)</li>
              <li><strong>Poll</strong> — single or multi-select vote; show results before or after voting</li>
            </ul>
            <p><strong>Form Fields</strong></p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><strong>Text Box</strong> — single-line text input</li>
              <li><strong>Text Area</strong> — multi-line text response</li>
              <li><strong>Radio</strong> — pick one from a list</li>
              <li><strong>Checkbox</strong> — pick one or many from a list</li>
              <li><strong>Select</strong> — single-item dropdown</li>
              <li><strong>Multi-select</strong> — multi-item dropdown</li>
            </ul>
            <p><strong>Media & Annotations</strong></p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><strong>Highlight</strong> — colored span with optional note</li>
              <li><strong>Note</strong> — annotation, definition, or reference block</li>
              <li><strong>Image, Audio, Video</strong> — embedded media</li>
              <li><strong>Link</strong> — external URL with title and description</li>
              <li><strong>Drawing</strong> — freehand canvas sketch</li>
              <li><strong>Scripture</strong> — Bible verse reference block</li>
              <li><strong>Code Block</strong> — syntax-highlighted code snippet</li>
              <li><strong>Signature</strong> — e-signature block (draw, type, or checkbox agreement)</li>
            </ul>
          </div>
        ),
        tags: ['components', 'question', 'poll', 'form', 'media'],
      },
      {
        q: 'How do I add a component to a chapter?',
        a: 'Open the Chapter Editor. Click anywhere in the text to position your cursor, then click the "+" button in the editor toolbar or select text and choose an option from the floating toolbar. Choose a component type and configure it in the popup.',
        tags: ['add', 'component', 'editor'],
      },
      {
        q: 'What is display mode? (Inline / Start of Chapter / End of Chapter)',
        a: (
          <ul className="space-y-1.5 text-sm">
            <li><strong>Inline</strong> — the component appears exactly where you placed it within the text flow.</li>
            <li><strong>Start of Chapter</strong> — shown before all text when the chapter loads.</li>
            <li><strong>End of Chapter</strong> — shown after all text at the bottom of the chapter.</li>
          </ul>
        ),
        tags: ['display mode', 'inline', 'position'],
      },
      {
        q: 'How do I create a quiz question with a correct answer?',
        a: 'Add a Question component and set the type to "Quiz". Enter your question text and add answer options. Click the star or check mark next to the correct option(s) to mark them. Optionally add an explanation that appears after the reader submits their answer.',
        tags: ['quiz', 'correct answer', 'question'],
      },
      {
        q: "Can I control who sees a component's responses?",
        a: (
          <ul className="space-y-1.5 text-sm">
            <li><strong>Private</strong> — only the reader who submitted can see their own answer.</li>
            <li><strong>Members Only</strong> — visible to club/study group members on shared reads.</li>
            <li><strong>All Readers</strong> — any reader of the book can see all responses.</li>
          </ul>
        ),
        tags: ['visibility', 'privacy', 'responses'],
      },
      {
        q: 'What is the difference between Live and Minimal editor preview?',
        a: 'In Book Settings → Editor Preview Mode you can choose: "Live" renders components exactly as readers see them (useful for final review); "Minimal" shows them as a compact badge/pill so they don\'t disrupt your writing flow. Change this any time without affecting how readers see the content.',
        tags: ['editor', 'preview', 'settings'],
      },
      {
        q: 'How do E-Signatures work?',
        a: (
          <div className="space-y-2 text-sm">
            <p>The <strong>Signature</strong> component lets you collect signed agreements from readers directly inside a chapter. To set one up:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>In the Chapter Editor, click the <strong>Signature</strong> button in the toolbar (pen icon).</li>
              <li>Give the block a label (e.g. "I agree to the terms") and optionally a description.</li>
              <li>Choose which capture modes to allow: <strong>Draw</strong> (freehand canvas), <strong>Type</strong> (typed name rendered in cursive), or <strong>Agree</strong> (checkbox acknowledgement).</li>
              <li>Save — the block appears inline in the chapter.</li>
            </ol>
            <p>Readers see a tabbed interface and can sign using any allowed method. Their signature is stored with a timestamp.</p>
            <p>As an author, view all signatures in <strong>Book Settings → E-Signatures</strong>. Each block shows a count and an expandable list of signers with their name, method, and date.</p>
          </div>
        ),
        tags: ['signature', 'e-signature', 'sign', 'agreement'],
      },
    ],
  },
  {
    id: 'reading-progress',
    icon: <Eye className="h-5 w-5" />,
    title: 'Reading & Progress',
    color: 'text-teal-700',
    bg: 'bg-teal-50 border-teal-200',
    intro: 'How readers navigate chapters, track completions, and use Text-to-Speech.',
    faqs: [
      {
        q: 'How is reading progress tracked?',
        a: 'Progress is tracked at two levels: (1) Scroll position — how far you have scrolled through a chapter is saved automatically. (2) Item completions — submitting a question answer, poll vote, or form response marks that item as complete. Your overall % progress is calculated from completed items.',
        tags: ['progress', 'tracking', 'completions'],
      },
      {
        q: 'What does Focus Mode do?',
        a: 'Press Ctrl+Shift+M (or ⌘+Shift+M on Mac) while reading to enter Focus Mode. This hides the sidebar, filter bar, and component panel — leaving only the book text for distraction-free reading. Press the same shortcut again to exit.',
        tags: ['focus mode', 'reading', 'keyboard'],
      },
      {
        q: 'How does Text-to-Speech (TTS) work?',
        a: 'While reading a chapter, click the Headphones / TTS icon in the top bar. Select a voice and click Play. The text is sent to the speech engine and an audio player appears. The currently spoken sentence is highlighted as it plays. You can pause, skip, or stop at any time.',
        tags: ['tts', 'text-to-speech', 'audio', 'reading'],
      },
      {
        q: 'Can I change the TTS voice?',
        a: 'Yes — click the voice selector dropdown in the TTS player to choose from multiple available voices (different languages and accents are listed by name).',
        tags: ['tts', 'voice'],
      },
      {
        q: 'How do I navigate between chapters?',
        a: 'Use the Previous / Next buttons at the bottom of each chapter. You can also click any chapter title in the left sidebar Table of Contents to jump directly to it.',
        tags: ['navigation', 'chapter', 'TOC'],
      },
      {
        q: 'I am not logged in — can I still answer questions?',
        a: 'When you try to answer a question or submit a form response without being logged in, a sign-in / register pop-up will appear. Sign in or create a free account to save your response. You will stay on the same chapter and page after signing in.',
        tags: ['guest', 'login', 'auth gate'],
      },
    ],
  },
  {
    id: 'responses-dashboard',
    icon: <BarChart2 className="h-5 w-5" />,
    title: 'Responses & Analytics',
    color: 'text-violet-700',
    bg: 'bg-violet-50 border-violet-200',
    intro: 'Review reader responses, track quiz results, and analyse engagement across your book.',
    faqs: [
      {
        q: 'Where do I see all reader responses?',
        a: 'Go to Book Editor → Dashboard (bar chart icon) → Responses tab. You will see every interactive component grouped by chapter, with each reader\'s answer, poll vote, or form submission listed beneath the original question.',
        tags: ['responses', 'dashboard', 'review'],
      },
      {
        q: 'How do I filter responses by chapter?',
        a: 'In the Responses tab, use the chapter sidebar on the left (desktop) or the Filter button at the top to select a specific chapter. You can also click the bar chart icon on any chapter row in the Book Editor to jump straight to that chapter\'s responses.',
        tags: ['filter', 'chapter', 'responses'],
      },
      {
        q: 'Can I search for a specific response?',
        a: 'Yes — the search box at the top of the Responses tab searches across question text, chapter titles, reader names, and the actual response values. Type any keyword and the list filters instantly.',
        tags: ['search', 'responses', 'filter'],
      },
      {
        q: 'What do the Overview stats show?',
        a: (
          <ul className="space-y-1.5 text-sm">
            <li><strong>Total Readers</strong> — unique accounts that have opened the book.</li>
            <li><strong>Active (30 days)</strong> — readers who interacted in the last 30 days.</li>
            <li><strong>Completions</strong> — readers who marked or reached 100% progress.</li>
            <li><strong>Avg. Progress</strong> — mean completion % across all readers.</li>
            <li><strong>Word count / Read time</strong> — total across all published chapters.</li>
            <li><strong>Form Responses</strong> — total submitted responses across all interactive components.</li>
            <li><strong>Component breakdown</strong> — counts per type (questions, polls, textboxes, etc.).</li>
          </ul>
        ),
        tags: ['analytics', 'stats', 'overview'],
      },
      {
        q: 'How do I see if a reader answered a quiz question correctly?',
        a: 'In the Responses tab, open the card for a Quiz-type question. Each reader\'s row shows a green "Correct" or red "Incorrect" badge next to their name. The correct answer option is highlighted in green under the Options list.',
        tags: ['quiz', 'correct', 'responses', 'review'],
      },
      {
        q: 'Can I export or download response data?',
        a: 'Currently responses are viewable in the dashboard. A CSV/export feature is on the roadmap. For now, you can use the browser print function on the Responses page.',
        tags: ['export', 'responses', 'csv'],
      },
    ],
  },
  {
    id: 'clubs-study-groups',
    icon: <Users className="h-5 w-5" />,
    title: 'Clubs & Study Groups',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    intro: 'Create communities around your books for group reading, discussion, and progress tracking.',
    faqs: [
      {
        q: 'What is the difference between a Club and a Study Group?',
        a: (
          <ul className="space-y-1.5 text-sm">
            <li><strong>Club</strong> — a casual reading community. Members read the same book at their own pace and can chat, share highlights, and discuss.</li>
            <li><strong>Study Group</strong> — a more structured program. The admin can assign a book, track each member\'s completion per chapter, and review their submitted answers.</li>
          </ul>
        ),
        tags: ['club', 'study group', 'difference'],
      },
      {
        q: 'How do I create a Club or Study Group?',
        a: (
          <ol className="list-decimal ml-4 space-y-1 text-sm">
            <li>Go to the <strong>Clubs</strong> tab on your Dashboard.</li>
            <li>Click <strong>"Create Club"</strong>.</li>
            <li>Choose a name, description, and type (Club or Study Group).</li>
            <li>Set visibility: <strong>Public</strong> (anyone can join) or <strong>Private</strong> (invite-only / approval required).</li>
            <li>Optionally set a maximum member count.</li>
            <li>Click Create, then add a book from your library as the current reading.</li>
          </ol>
        ),
        tags: ['create', 'club', 'study group'],
      },
      {
        q: 'How do I invite members to a Club?',
        a: 'Open the Club detail page → Members tab → click "Invite". Enter the member\'s email address. They will receive an email with an invitation link. For public clubs, you can also share the club URL directly.',
        tags: ['invite', 'members', 'club'],
      },
      {
        q: 'How do I track member progress in a Study Group?',
        a: 'Open the Club detail page → Progress tab. You will see each member\'s chapter-by-chapter completion percentage and the number of items completed vs total. Click any member\'s name to see their individual answers and submissions.',
        tags: ['progress', 'members', 'study group', 'tracking'],
      },
      {
        q: 'Can I add multiple books to a Club?',
        a: 'Yes. A club has a library of books and one "current" book that members are actively reading. Go to the Club detail → Books tab → Add Book to expand the library. Set any book as the current read.',
        tags: ['books', 'club', 'library'],
      },
      {
        q: 'How does Club Chat work?',
        a: 'Each club has a built-in chat channel. Open the Club detail → Chat tab. Send text messages, scroll history, and receive notifications when new messages arrive. You can set your notification mode (all messages, mentions only, or none) per club.',
        tags: ['chat', 'club', 'messages'],
      },
    ],
  },
  {
    id: 'book-chat',
    icon: <MessageSquare className="h-5 w-5" />,
    title: 'Book Chat',
    color: 'text-sky-700',
    bg: 'bg-sky-50 border-sky-200',
    intro: 'A dedicated chat room attached to every book — all readers in one conversation.',
    faqs: [
      {
        q: 'What is Book Chat?',
        a: 'Book Chat is a real-time chat room shared by all readers of a book. Unlike Club Chat (which is per-club), Book Chat is per-book — every reader who has opened the book can join the same conversation. Access it from the chat bubble icon next to the book title in the reader, or navigate to /book/:id/chat.',
        tags: ['book chat', 'chat', 'realtime'],
      },
      {
        q: 'Who can see Book Chat messages?',
        a: 'All readers who have started reading the book can see and send messages. The author and any collaborators can also see all messages. Public books allow any logged-in user who has opened the book to participate.',
        tags: ['book chat', 'visibility', 'readers'],
      },
      {
        q: 'How are readers identified in Book Chat?',
        a: 'Each participant gets a unique colour assigned to their name, avatar initial, and message bubble — making it easy to tell who said what at a glance. Your own messages appear on the right side in the accent colour.',
        tags: ['book chat', 'colour', 'avatar'],
      },
      {
        q: 'What are system status messages in Book Chat?',
        a: 'When a reader completes a chapter or finishes the book, a small status update appears in the chat (e.g. "Alex completed Chapter 3"). This is controlled by the "Share my progress" setting. You can turn it off in your Profile → Privacy Settings or via the toggle at the top of any Book Chat.',
        tags: ['book chat', 'progress', 'system message', 'status'],
      },
      {
        q: 'How do I turn off progress sharing in Book Chat?',
        a: (
          <ul className="space-y-1.5 text-sm">
            <li>Toggle <strong>"Share my progress in this chat"</strong> at the top of the Book Chat page — this controls sharing for that specific chat session.</li>
            <li>Or go to <strong>Profile → Edit Profile → Privacy Settings</strong> and toggle off <strong>"Share my reading progress in book chats"</strong> to disable it globally across all books.</li>
          </ul>
        ),
        tags: ['book chat', 'progress', 'privacy', 'share'],
      },
      {
        q: 'Can the author disable Book Chat for their book?',
        a: 'Yes. Go to Book Settings and toggle off "Enable Book Chat". This hides the chat icon from readers and prevents new messages.',
        tags: ['book chat', 'disable', 'settings', 'author'],
      },
      {
        q: 'Does Book Chat show who is currently reading?',
        a: 'Yes. The readers panel on the left side of Book Chat shows all readers who have opened the book, their current chapter, and their overall completion percentage.',
        tags: ['book chat', 'readers', 'progress', 'sidebar'],
      },
    ],
  },
  {
    id: 'esignatures',
    icon: <PenLine className="h-5 w-5" />,
    title: 'E-Signatures',
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200',
    intro: 'Collect signed agreements, acknowledgements, and sign-offs directly inside your chapters.',
    faqs: [
      {
        q: 'How do I add an e-signature block to a chapter?',
        a: (
          <ol className="list-decimal ml-4 space-y-1 text-sm">
            <li>Open the Chapter Editor and click the <strong>Signature</strong> (pen) button in the toolbar.</li>
            <li>Enter a label (e.g. "I have read and agree to the above") and an optional description.</li>
            <li>Choose which signing methods to allow: Draw, Type, or Agree (checkbox).</li>
            <li>Click Save — the block appears inline in the chapter at your cursor position.</li>
          </ol>
        ),
        tags: ['signature', 'add', 'editor'],
      },
      {
        q: 'What signing methods are available?',
        a: (
          <ul className="space-y-1.5 text-sm">
            <li><strong>Draw</strong> — reader draws their signature on a freehand canvas with mouse or touch.</li>
            <li><strong>Type</strong> — reader types their name, displayed in a cursive script font.</li>
            <li><strong>Agree</strong> — reader checks a checkbox to acknowledge agreement (no handwriting needed).</li>
          </ul>
        ),
        tags: ['signature', 'draw', 'type', 'checkbox', 'methods'],
      },
      {
        q: 'Where do I see who has signed?',
        a: 'Go to Book Settings → E-Signatures. Each signature block in the book is listed with a signed count badge. Click any block to expand it and see each signer\'s name, the method they used (drawn/typed/agreed), and the date and time they signed.',
        tags: ['signature', 'status', 'settings', 'who signed'],
      },
      {
        q: 'Can a reader withdraw their signature?',
        a: 'Yes. A reader who has already signed will see a "Retract signature" button on the block. Clicking it removes their record. They can sign again at any time.',
        tags: ['signature', 'retract', 'withdraw', 'delete'],
      },
      {
        q: 'Is the signature legally binding?',
        a: 'BookFlow e-signatures record the signer\'s user identity, timestamp, IP address, and chosen acknowledgement method — which may satisfy requirements for many informal agreements. For legally binding contracts requiring compliance with specific e-signature laws (e.g. eIDAS, ESIGN Act), consult a legal professional.',
        tags: ['signature', 'legal', 'binding'],
      },
    ],
  },
  {
    id: 'collaboration',
    icon: <UserPlus className="h-5 w-5" />,
    title: 'Collaboration',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50 border-cyan-200',
    intro: 'Work with co-authors, editors, and reviewers on the same book.',
    faqs: [
      {
        q: 'What collaborator roles are available?',
        a: (
          <ul className="space-y-1.5 text-sm">
            <li><strong>Owner</strong> — full control: edit, publish, delete, manage collaborators.</li>
            <li><strong>Author</strong> — write and edit chapters, add interactive components.</li>
            <li><strong>Editor</strong> — edit chapter text and components but cannot publish or delete.</li>
            <li><strong>Reviewer</strong> — read-only access plus comments; approve or reject review submissions.</li>
          </ul>
        ),
        tags: ['roles', 'collaborators', 'permissions'],
      },
      {
        q: 'How do I invite a collaborator?',
        a: 'In the Book Editor, click the Collaborators tab (people icon). Enter the collaborator\'s email address and select their role. They\'ll receive an invitation email with a link to accept. You can also copy the invite link to share directly.',
        tags: ['invite', 'collaborator', 'email'],
      },
      {
        q: 'How do collaborator comments work?',
        a: 'Any collaborator with Editor or higher role can add comments to chapters. Select text in the chapter editor and click Comment, or use the Comments panel. Comments can be replied to, resolved, or rejected. Open comments appear in the Activity feed.',
        tags: ['comments', 'review', 'collaborator'],
      },
      {
        q: 'What is the Review Submission workflow?',
        a: 'Authors can submit a book for review when it is ready to publish. Go to Book Editor → Submit for Review tab. Write a note to the reviewer. A Reviewer-role collaborator will see the pending review and can approve or reject it with notes. Approved books can then be published.',
        tags: ['review', 'submit', 'approve', 'publish'],
      },
    ],
  },
  {
    id: 'sharing',
    icon: <Share2 className="h-5 w-5" />,
    title: 'Sharing & QR Codes',
    color: 'text-pink-700',
    bg: 'bg-pink-50 border-pink-200',
    intro: 'Share your books via links, QR codes, email, and platform integrations.',
    faqs: [
      {
        q: 'How do I share my book with readers?',
        a: 'Click the Share icon in the Book Editor toolbar. You have several options: copy the direct link, copy the QR code image, use the native share sheet (mobile), or send invitations by email to a list of addresses.',
        tags: ['share', 'link', 'invite'],
      },
      {
        q: 'What is the QR code for?',
        a: 'Each book gets a unique QR code that links to its landing page (/bl/your-slug). Readers scan it with any phone camera to open the book instantly — no app download required. Download the QR code as a PNG to include in physical materials, slides, or promotional graphics.',
        tags: ['QR code', 'share', 'scan'],
      },
      {
        q: 'What does the Book Landing Page look like?',
        a: 'The landing page (/bl/your-slug) shows the book cover, title, author, description, and chapter list. It includes a prominent "Start Reading" button. No login is required to view it. This is the page the QR code points to.',
        tags: ['landing page', 'QR', 'public'],
      },
      {
        q: 'Can I make a book private but still share it?',
        a: 'Yes. Set the book visibility to Private in Book Settings. Then use the Share Token link — anyone with that unique URL can access the book without the book appearing in public listings.',
        tags: ['private', 'share token', 'visibility'],
      },
    ],
  },
  {
    id: 'comments-notifications',
    icon: <Bell className="h-5 w-5" />,
    title: 'Comments & Notifications',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    intro: 'Stay on top of comments, replies, reviews, and activity across your books.',
    faqs: [
      {
        q: 'Where do I find my notifications?',
        a: 'Click the bell icon in the top navigation bar to open your Inbox. Notifications include: new comments, replies to your comments, @mentions, review approvals/rejections, and club invitations.',
        tags: ['notifications', 'inbox', 'bell'],
      },
      {
        q: 'What notification types exist?',
        a: (
          <ul className="space-y-0.5 text-sm columns-2">
            <li>• New comment on your book</li>
            <li>• Reply to your comment</li>
            <li>• @mention in a comment</li>
            <li>• Review submitted (for authors)</li>
            <li>• Review approved / rejected</li>
            <li>• Club invitation received</li>
            <li>• Collaborator invitation</li>
            <li>• Feedback reply</li>
          </ul>
        ),
        tags: ['notifications', 'types'],
      },
      {
        q: 'How do I resolve a comment?',
        a: 'In the chapter comments panel (speech bubble icon), find the comment and click the ✓ checkmark to mark it Resolved, or ✗ to reject it. Resolved comments are hidden from the active list but remain in the activity log.',
        tags: ['comments', 'resolve', 'reject'],
      },
    ],
  },
  {
    id: 'settings-permissions',
    icon: <Settings className="h-5 w-5" />,
    title: 'Book Settings & Permissions',
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-200',
    intro: 'Fine-tune what readers can do in your book and how the editor behaves.',
    faqs: [
      {
        q: 'Where are Book Settings?',
        a: 'In the Book Editor, click the Settings (gear) icon in the top toolbar. Settings are divided into sections: Metadata, Publishing, Reader Permissions, Media, and Editor Preferences.',
        tags: ['settings', 'where'],
      },
      {
        q: 'Can I prevent readers from adding their own highlights or notes?',
        a: 'Yes. In Book Settings → Reader Permissions, toggle off "Allow reader highlights" and/or "Allow reader notes". Readers will only be able to see author-placed highlights and notes.',
        tags: ['highlights', 'notes', 'reader permissions'],
      },
      {
        q: 'How do I control media permissions?',
        a: (
          <ul className="space-y-1.5 text-sm">
            <li><strong>Allow author audio/video</strong> — lets you embed audio and video in chapters.</li>
            <li><strong>Allow reader audio/video</strong> — lets readers attach recordings to form responses.</li>
            <li><strong>Max media duration</strong> — set a cap (in seconds) on any media file.</li>
            <li><strong>Allow public TTS</strong> — enables Text-to-Speech for non-logged-in visitors.</li>
          </ul>
        ),
        tags: ['media', 'audio', 'video', 'permissions'],
      },
      {
        q: 'What does "Enable Progress Tracking" do?',
        a: 'When enabled (default), BookFlow records each reader\'s scroll position, completed items, and chapter completions. Disable it for books where tracking feels intrusive or is not needed.',
        tags: ['progress', 'tracking', 'settings'],
      },
    ],
  },
  {
    id: 'live-streaming',
    icon: <Radio className="h-5 w-5" />,
    title: 'Live Streaming',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    intro: 'Host live readings, Bible studies, or discussions with the built-in broadcast tools.',
    faqs: [
      {
        q: 'What is the Live section?',
        a: 'Live is a broadcast tool for hosting live readings or lessons tied to your books. You create Shows (recurring programmes) and Episodes (individual broadcasts). During a live episode you can display Bible verses, send text to overlays, manage a queue of content, and monitor viewer chat.',
        tags: ['live', 'streaming', 'broadcast'],
      },
      {
        q: 'How do I go live on multiple platforms at once?',
        a: 'BookFlow integrates with Restream. Connect your Restream account in Settings. Once connected, clicking "Go Live" in an episode will simultaneously broadcast to all enabled channels (YouTube, Facebook, Twitch, etc.) via your Restream connection.',
        tags: ['restream', 'live', 'platforms', 'multistream'],
      },
      {
        q: 'What is the Queue?',
        a: 'The Queue is a list of content items (Bible verses, text passages, custom messages) you prepare before a broadcast. During the live stream you can click "Send" on any item to push it to your overlay, a lower-third graphic, or chat. Organise items into named groups for easy access.',
        tags: ['queue', 'live', 'overlay', 'broadcast'],
      },
      {
        q: 'How does the Bible integration work in Live?',
        a: 'Go to Live → Bible. Search by keyword or browse by Book → Chapter → Verse. Add any verse or passage to your episode\'s queue. During the stream, send it as a lower-third, overlay caption, or chat message with one click.',
        tags: ['bible', 'live', 'verse', 'queue'],
      },
    ],
  },
  {
    id: 'profile-account',
    icon: <Shield className="h-5 w-5" />,
    title: 'Profile & Account',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50 border-indigo-200',
    intro: 'Manage your profile, privacy settings, and account preferences.',
    faqs: [
      {
        q: 'How do I edit my profile?',
        a: 'Click your avatar or name in the top navigation → Profile. On your own profile page click "Edit Profile". You can update your display name, bio, website URL, location, and avatar image.',
        tags: ['profile', 'edit', 'avatar'],
      },
      {
        q: 'How do I control what others can see on my profile?',
        a: (
          <div className="space-y-2 text-sm">
            <p>Go to <strong>Profile → Edit Profile → Privacy Settings</strong>. Click any toggle row (anywhere on the row, including the label) to switch it on or off:</p>
            <ul className="space-y-1.5 ml-2">
              <li><strong>Public Profile</strong> — toggle on/off whether your profile is visible at all.</li>
              <li><strong>Show Reading Progress</strong> — hide your reading stats from public view.</li>
              <li><strong>Show Clubs</strong> — hide your club memberships.</li>
              <li><strong>Show Books Authored</strong> — hide your authored books list.</li>
              <li><strong>Share my reading progress in book chats</strong> — when on, chapter completions and book finishes are posted as status updates in Book Chat. Turn this off to read silently.</li>
              <li><strong>Author account</strong> — mark yourself as an author to unlock book creation tools.</li>
            </ul>
            <p>Click <strong>Save</strong> after making changes.</p>
          </div>
        ),
        tags: ['privacy', 'profile', 'settings', 'share', 'progress', 'book chat'],
      },
      {
        q: 'How do I become an Author?',
        a: 'Go to Settings → Profile and toggle on "Author Status". This grants access to book creation tools and the author dashboard.',
        tags: ['author', 'status', 'settings'],
      },
      {
        q: 'How do I manage API keys?',
        a: 'Go to Settings → API Keys (for admin users). Create a named key, copy it once (it is only shown once), and use it to authenticate against the BookFlow API. Revoke keys at any time.',
        tags: ['api', 'keys', 'admin', 'developer'],
      },
    ],
  },
  {
    id: 'troubleshooting',
    icon: <HelpCircle className="h-5 w-5" />,
    title: 'Troubleshooting',
    color: 'text-rose-700',
    bg: 'bg-rose-50 border-rose-200',
    intro: 'Common issues and how to resolve them.',
    faqs: [
      {
        q: 'I created a Study Group but get an error about "club_type column".',
        a: 'This is a database migration that needs to be applied to the production database. Contact your administrator and ask them to run migration 034_club_type.sql in the Supabase SQL Editor. This adds the club_type column required for the Study Group feature.',
        tags: ['error', 'study group', 'migration', 'club_type'],
      },
      {
        q: 'My responses are not saving — what should I check?',
        a: (
          <ol className="list-decimal ml-4 space-y-1 text-sm">
            <li>Ensure you are logged in (responses require an account).</li>
            <li>Check your internet connection.</li>
            <li>For forms with "Required" fields, make sure all required fields are filled before submitting.</li>
            <li>If the issue persists, try refreshing the page — your in-progress text is not lost in most cases.</li>
          </ol>
        ),
        tags: ['responses', 'save', 'error'],
      },
      {
        q: 'My book cover is not showing up.',
        a: 'Cover images must be JPG, PNG, or WebP and under 5 MB. If upload succeeds but the image does not appear, try a hard refresh (Ctrl+Shift+R). If the issue persists, re-upload the image.',
        tags: ['cover', 'image', 'upload'],
      },
      {
        q: 'The QR code is not working.',
        a: 'Make sure the book has a published slug set. Go to Book Settings → Share → edit the slug. The QR code is generated from the slug, so if the slug is blank the QR code will not point to a valid URL.',
        tags: ['QR code', 'slug', 'share'],
      },
      {
        q: 'I cannot hear TTS audio.',
        a: (
          <ol className="list-decimal ml-4 space-y-1 text-sm">
            <li>Check that your device is not muted and browser audio is allowed.</li>
            <li>Some browsers block autoplay — click Play manually after the TTS generates.</li>
            <li>If you are not logged in, TTS requires the book owner to have enabled "Allow public TTS" in Book Settings.</li>
          </ol>
        ),
        tags: ['TTS', 'audio', 'playback'],
      },
      {
        q: 'A collaborator cannot see the book in their dashboard.',
        a: 'The collaborator must accept the invitation first. Ask them to check their email for the invitation link, or go to Book Editor → Collaborators → copy the invite link and send it again. Once they accept, the book will appear under "Collaborating" on their dashboard.',
        tags: ['collaborator', 'invite', 'not visible'],
      },
    ],
  },
];

const NAVIGATION_RESULTS: NavigationResult[] = [
  { id: 'books', title: 'Books', description: 'Open your dashboard and manage your books.', to: '/dashboard', icon: <BookOpen className="h-4 w-4" />, tags: ['books', 'dashboard', 'my books', 'read books'] },
  { id: 'book-chat', title: 'Book Chat', description: 'Open the real-time chat for a book.', to: '/dashboard', icon: <MessageSquare className="h-4 w-4" />, tags: ['book chat', 'chat', 'readers', 'realtime', 'messages'] },
  { id: 'clubs', title: 'Clubs', description: 'Browse or manage your book clubs.', to: '/clubs', icon: <Users className="h-4 w-4" />, tags: ['clubs', 'book clubs', 'groups'] },
  { id: 'study-groups', title: 'Study Groups', description: 'Jump to the study groups view inside clubs.', to: '/clubs?tab=bookstudy', icon: <Users className="h-4 w-4" />, tags: ['study groups', 'study', 'book study'] },
  { id: 'live', title: 'Live', description: 'Open the live broadcasting and scheduling area.', to: '/live', icon: <Radio className="h-4 w-4" />, tags: ['live', 'streaming', 'broadcast'] },
  { id: 'tutorial', title: 'Tutorial', description: 'Learn how BookFlow works with guided walkthroughs.', to: '/docs', icon: <Lightbulb className="h-4 w-4" />, tags: ['tutorial', 'guide', 'walkthrough'] },
  { id: 'my-settings', title: 'Settings', description: 'Manage your profile, preferences, and account settings.', to: '/settings', icon: <Settings className="h-4 w-4" />, tags: ['settings', 'profile', 'preferences', 'account'] },
  { id: 'help', title: 'Help', description: 'Search BookFlow documentation and support articles.', to: '/docs', icon: <HelpCircle className="h-4 w-4" />, tags: ['help', 'docs', 'documentation', 'faq'] },
  { id: 'admin-users', title: 'Admin · Users', description: 'Manage users and super admin access.', to: '/admin?tab=users', icon: <Shield className="h-4 w-4" />, tags: ['admin', 'users', 'system administration', 'management'], adminOnly: true },
  { id: 'admin-books', title: 'Admin · Books', description: 'Review, archive, and manage books system-wide.', to: '/admin?tab=books', icon: <BookOpen className="h-4 w-4" />, tags: ['admin', 'books', 'archive'], adminOnly: true },
  { id: 'admin-clubs', title: 'Admin · Clubs', description: 'Inspect and manage clubs across the platform.', to: '/admin?tab=clubs', icon: <Users className="h-4 w-4" />, tags: ['admin', 'clubs', 'book clubs'], adminOnly: true },
  { id: 'admin-carousel', title: 'Admin · Carousel', description: 'Adjust the home-page carousel settings.', to: '/admin?tab=carousel', icon: <Radio className="h-4 w-4" />, tags: ['admin', 'carousel', 'home page'], adminOnly: true },
  { id: 'admin-settings', title: 'Admin · Settings', description: 'Open the admin settings area.', to: '/admin?tab=settings', icon: <Settings className="h-4 w-4" />, tags: ['admin', 'settings', 'system settings'], adminOnly: true },
  { id: 'admin-feedback', title: 'Admin · Feedback', description: 'Review feedback, bug reports, and feature requests.', to: '/admin?tab=feedback', icon: <Shield className="h-4 w-4" />, tags: ['admin', 'feedback', 'bugs', 'feature requests'], adminOnly: true },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function FaqEntry({ faq }: { faq: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${open ? 'border-gray-300 shadow-sm' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start gap-2.5">
          <HelpCircle className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
          <span className="text-sm font-semibold text-gray-900 leading-snug">{faq.q}</span>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100">
          <div className="text-sm text-gray-700 leading-relaxed pl-6">
            {typeof faq.a === 'string' ? <p>{faq.a}</p> : faq.a}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, active, onClick }: { section: Section; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${
        active
          ? `${section.bg} ${section.color} border-current/30`
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      <span className={active ? section.color : 'text-gray-400'}>{section.icon}</span>
      <span className="text-sm font-medium leading-tight">{section.title}</span>
      <span className="ml-auto text-xs text-gray-400 shrink-0">{section.faqs.length}</span>
    </button>
  );
}

function NavigationResultCard({ item }: { item: NavigationResult }) {
  return (
    <Link
      to={item.to}
      className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50"
    >
      <div className="mt-0.5 rounded-lg bg-purple-50 p-2 text-purple-600">
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            {item.adminOnly ? 'Admin' : 'Navigation'}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-600">{item.description}</p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function DocsPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isSuperAdmin = profile?.system_role === 'super_admin';

  // Scroll to section
  function scrollTo(id: string) {
    setActiveSection(id);
    setTimeout(() => {
      sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { threshold: 0.2, rootMargin: '-80px 0px 0px 0px' }
    );
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const q = search.toLowerCase().trim();

  // Filter FAQs by search
  const filteredSections = SECTIONS.map(s => ({
    ...s,
    faqs: q
      ? s.faqs.filter(f =>
          f.q.toLowerCase().includes(q) ||
          (typeof f.a === 'string' && f.a.toLowerCase().includes(q)) ||
          (f.tags || []).some(t => t.includes(q))
        )
      : s.faqs,
  })).filter(s => s.faqs.length > 0);

  const filteredNavigation = q
    ? NAVIGATION_RESULTS.filter(item => {
        if (item.adminOnly && !isSuperAdmin) return false;
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.tags || []).some(tag => tag.toLowerCase().includes(q))
        );
      })
    : [];

  const totalFaqs = SECTIONS.reduce((n, s) => n + s.faqs.length, 0);
  const totalDocResults = filteredSections.reduce((n, s) => n + s.faqs.length, 0);
  const totalSearchResults = totalDocResults + filteredNavigation.length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-purple-100 rounded-xl">
              <BookOpen className="h-7 w-7 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Search BookFlow</h1>
              <p className="text-sm text-gray-500">Documentation, FAQs, and app navigation in one search.</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-xl mt-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search BookFlow…"
              className="w-full pl-11 pr-10 py-3 text-sm border border-gray-300 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 mt-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><Layers className="h-4 w-4 text-purple-400" /> {SECTIONS.length} sections</span>
            <span className="flex items-center gap-1.5"><HelpCircle className="h-4 w-4 text-purple-400" /> {totalFaqs} questions answered</span>
            {q && (
              <span className="flex items-center gap-1.5 text-purple-600 font-medium">
                <Search className="h-4 w-4" /> {totalSearchResults} results for "{search}"
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-10 flex gap-8">

        {/* Sidebar nav — hidden during search */}
        {!q && (
          <aside className="hidden lg:flex flex-col gap-1 w-56 shrink-0 sticky top-6 self-start">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1">Sections</p>
            {SECTIONS.map(s => (
              <SectionCard
                key={s.id}
                section={s}
                active={activeSection === s.id}
                onClick={() => scrollTo(s.id)}
              />
            ))}
          </aside>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-12">

          {q && filteredNavigation.length > 0 && (
            <section className="space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-500">Navigation</p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">Go to a page</h2>
                <p className="mt-1 text-sm text-gray-500">Quick links to BookFlow areas that match your search.</p>
              </div>
              <div className="grid gap-3">
                {filteredNavigation.map(item => (
                  <NavigationResultCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {q && filteredSections.length === 0 && filteredNavigation.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-base font-semibold text-gray-600">No results found</p>
              <p className="text-sm text-gray-400 mt-1">Try different keywords</p>
              <button onClick={() => setSearch('')} className="mt-3 text-sm text-purple-600 hover:underline">Clear search</button>
            </div>
          )}

          {q && filteredSections.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-500 mb-2">Help Results</p>
              <h2 className="text-xl font-semibold text-gray-900">Documentation matches</h2>
              <p className="mt-1 text-sm text-gray-500">Answers from the BookFlow help documentation.</p>
            </div>
          )}

          {filteredSections.map(section => (
            <div
              key={section.id}
              id={section.id}
              ref={el => { sectionRefs.current[section.id] = el; }}
            >
              {/* Section header */}
              <div className={`flex items-start gap-4 p-5 rounded-2xl border mb-5 ${section.bg}`}>
                <div className={`p-2.5 rounded-xl bg-white shadow-sm ${section.color}`}>
                  {section.icon}
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${section.color}`}>{section.title}</h2>
                  <p className="text-sm text-gray-600 mt-0.5">{section.intro}</p>
                </div>
              </div>

              {/* FAQs */}
              <div className="space-y-2.5">
                {section.faqs.map((faq, i) => (
                  <FaqEntry key={i} faq={faq} />
                ))}
              </div>
            </div>
          ))}

          {/* Footer callout */}
          {!q && (
            <div className="border border-purple-200 bg-purple-50 rounded-2xl p-6 flex items-start gap-4">
              <div className="p-2.5 bg-white rounded-xl shadow-sm">
                <Lightbulb className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-purple-800 mb-1">Can't find what you're looking for?</h3>
                <p className="text-sm text-purple-700 leading-relaxed">
                  Use the search bar above to find any topic by keyword. If you're experiencing a bug or have a feature request, use the feedback button in the app to send us a report — you can attach screenshots and record a voice note to describe the issue.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
