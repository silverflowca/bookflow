/**
 * BookFlow — Overcomers PEI Seed Script
 * ──────────────────────────────────────
 * Creates:
 *   • 1 book owner:  admin.test2@silverflow.ca
 *   • 5 reader accounts
 *   • 1 book — "Overcomers: Walking in Freedom"
 *       3 chapters, every form component type, progress tracking enabled
 *   • 1 book club — "Overcomers PEI" with all 5 readers as members
 *   • Reading progress + poll votes + form responses for all readers
 *
 * Usage:  node seed-overcomers.mjs
 * Safe:   All inserts are idempotent (upsert / conflict-ignore).
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'http://localhost:55321';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'bookflow' },
});
const dbAnon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const step = (msg) => console.log(`\n▸ ${msg}`);

// ─── Helper: create/find user ─────────────────────────────────────────────────
async function upsertUser(email, password, displayName, isAuthor = false) {
  const { data: existing } = await db.from('profiles').select('id,email').eq('email', email).maybeSingle();
  if (existing) { log(`User exists: ${email}`); return { id: existing.id, email }; }

  const { data, error } = await dbAnon.auth.signUp({ email, password });
  if (error && !error.message.includes('already registered')) throw new Error(`SignUp ${email}: ${error.message}`);

  let userId = data?.user?.id;
  if (!userId) {
    const { data: si } = await dbAnon.auth.signInWithPassword({ email, password });
    userId = si?.user?.id;
    if (!userId) throw new Error(`Cannot resolve ID for ${email}`);
    await dbAnon.auth.signOut();
  }

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const dockerPath = '/c/Program Files/Rancher Desktop/resources/resources/win32/bin/docker';
  await execAsync(
    `"${dockerPath}" exec supabase_db_silverflow psql -U postgres -d postgres -c "UPDATE auth.users SET email_confirmed_at = NOW(), confirmation_token = '' WHERE id = '${userId}';"`
  ).catch(e => warn(`Email confirm: ${e.message}`));

  await db.from('profiles').upsert({
    id: userId, email, display_name: displayName,
    is_author: isAuthor, profile_public: true,
    show_reading_progress: true, show_clubs: true, show_books_authored: isAuthor,
  }, { onConflict: 'id' });

  log(`Created: ${displayName} (${email})`);
  return { id: userId, email };
}

// ─── TipTap helpers ───────────────────────────────────────────────────────────
function para(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}
function heading(text, level = 2) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}
function doc(...nodes) {
  return { type: 'doc', content: nodes };
}

// ─── Book cover (beautiful gradient SVG as data-URL, stored as cover_image_url)
// We use a real unsplash image URL for the cover — sunrise over fields, uplifting
const COVER_URL = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80';

// ─── People ───────────────────────────────────────────────────────────────────
const OWNER = {
  email: 'admin.test2@silverflow.ca',
  password: 'Admin@2026!',
  name: 'Pastor David Lamont',
};

const READERS = [
  { email: 'grace.macleod@pei-demo.com',   password: 'Reader@2026!', name: 'Grace MacLeod'   },
  { email: 'thomas.gallant@pei-demo.com',  password: 'Reader@2026!', name: 'Thomas Gallant'  },
  { email: 'ruth.arsenault@pei-demo.com',  password: 'Reader@2026!', name: 'Ruth Arsenault'  },
  { email: 'caleb.bernard@pei-demo.com',   password: 'Reader@2026!', name: 'Caleb Bernard'   },
  { email: 'miriam.doucette@pei-demo.com', password: 'Reader@2026!', name: 'Miriam Doucette'  },
];

// ─── Chapter content + interactive components ─────────────────────────────────

const CHAPTERS = [
  {
    // ── Chapter 1 ────────────────────────────────────────────────────────────
    title: 'Lesson 1 — Who You Are Before You Begin',
    content: doc(
      heading('A Word Before We Start'),
      para('Before we can walk in freedom, we need to know where we are standing. This first lesson is not about doing anything differently — it is about seeing yourself clearly, perhaps for the first time in a long while.'),
      para('The Overcomers journey is not a programme of self-improvement. It is an invitation to discover what was always true about you in Christ, even when life obscured it. Every interactive element in this chapter is designed to help you take honest stock of where you are right now — no judgement, just truth.'),
      heading('Your Story Matters'),
      para('God does not redeem abstractions. He redeems people — people with histories, habits, and hopes. Before we talk about freedom, we want to hear from you. The questions below are not a test. There are no wrong answers. They are simply a way of saying: we see you, and your story belongs in this journey.'),
      para('Take your time with each section. Some of these questions you may not have been asked before. That is intentional.'),
    ),
    // Every form type used in this chapter
    forms: [
      // 1. TEXTBOX — short single-line
      {
        content_type: 'textbox',
        anchor_text: 'Your name as you\'d like to be known',
        position_in_chapter: 'inline',
        content_data: {
          label: 'What name would you like to go by in this group?',
          placeholder: 'e.g. Grace, Tommy, Miri...',
          required: true,
          show_label: true,
        },
      },
      // 2. TEXTAREA — longer reflection
      {
        content_type: 'textarea',
        anchor_text: 'Your story in your own words',
        position_in_chapter: 'inline',
        content_data: {
          label: 'In a few sentences, what brought you to this journey? You don\'t have to share everything — just what feels right.',
          placeholder: 'Write freely. This is your space.',
          required: false,
          show_label: true,
          rows: 5,
        },
      },
      // 3. RADIO — single choice
      {
        content_type: 'radio',
        anchor_text: 'Where you are right now',
        position_in_chapter: 'inline',
        content_data: {
          label: 'How would you describe where you are emotionally as you begin this journey?',
          options: [
            { id: 'r1', text: 'Hopeful — I\'m ready for something to change' },
            { id: 'r2', text: 'Cautious — I\'ve tried things before and I\'m not sure' },
            { id: 'r3', text: 'Tired — I\'m here because I have nowhere else to turn' },
            { id: 'r4', text: 'Curious — I\'m not sure what to expect but I\'m open' },
          ],
          required: true,
        },
      },
      // 4. CHECKBOX — multiple select (agree/acknowledge)
      {
        content_type: 'checkbox',
        anchor_text: 'Your commitment to this journey',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Before we go further, please check any of the following that reflect your intention:',
          options: [
            { id: 'c1', text: 'I will engage honestly, even when it\'s uncomfortable' },
            { id: 'c2', text: 'I give myself permission to not have all the answers' },
            { id: 'c3', text: 'I commit to completing this lesson at my own pace' },
            { id: 'c4', text: 'I am open to what God wants to show me here' },
          ],
          required: false,
        },
      },
      // 5. SELECT — dropdown
      {
        content_type: 'select',
        anchor_text: 'How you prefer to learn',
        position_in_chapter: 'inline',
        content_data: {
          label: 'How do you learn best? (This helps us support you well)',
          options: [
            { id: 's1', text: 'Reading and reflection on my own' },
            { id: 's2', text: 'Group discussion and shared stories' },
            { id: 's3', text: 'Practical exercises and journalling' },
            { id: 's4', text: 'Prayer and spiritual practices' },
            { id: 's5', text: 'A combination of all of these' },
          ],
          required: false,
          placeholder: 'Choose what resonates most...',
        },
      },
      // 6. MULTISELECT — multiple dropdown picks
      {
        content_type: 'multiselect',
        anchor_text: 'Areas you are carrying',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Which of the following areas are you carrying weight in right now? (Select all that apply)',
          options: [
            { id: 'm1', text: 'Grief or loss' },
            { id: 'm2', text: 'Relationships and conflict' },
            { id: 'm3', text: 'Identity and self-worth' },
            { id: 'm4', text: 'Anxiety or fear' },
            { id: 'm5', text: 'Spiritual dryness or doubt' },
            { id: 'm6', text: 'Addiction or compulsive patterns' },
            { id: 'm7', text: 'Anger or unforgiveness' },
            { id: 'm8', text: 'Shame or guilt' },
          ],
          min_selections: 0,
          max_selections: 8,
          required: false,
        },
      },
      // 7. POLL — community voice
      {
        content_type: 'poll',
        anchor_text: 'Community pulse',
        position_in_chapter: 'end_of_chapter',
        content_data: {
          question: 'How long have you been on a journey toward freedom and wholeness?',
          options: [
            { id: 'p1', text: 'This is my first step' },
            { id: 'p2', text: 'A few months' },
            { id: 'p3', text: 'Several years — still walking' },
            { id: 'p4', text: 'I\'m further along and here to serve others' },
          ],
          allow_multiple: false,
        },
      },
      // 8. QUESTION — open reflection
      {
        content_type: 'question',
        anchor_text: 'Closing reflection',
        position_in_chapter: 'end_of_chapter',
        content_data: {
          question: 'If the version of you that finishes this journey could send a message back to the you who is starting it today — what do you think they would say?',
          allow_multiple_answers: false,
        },
      },
    ],
  },

  {
    // ── Chapter 2 ────────────────────────────────────────────────────────────
    title: 'Lesson 2 — The Lies We Believed',
    content: doc(
      heading('Where Bondage Begins'),
      para('Every area of bondage in a person\'s life can be traced to a lie they believed — about themselves, about God, or about the world. This is not a comfortable truth, but it is a liberating one: because lies, unlike circumstances, can be replaced.'),
      para('The enemy does not need chains to keep people captive. A single deeply-held false belief is enough. "I am not worthy of love." "God is disappointed in me." "This is just who I am." "Nothing will ever change." These whispers, absorbed over years, become the architecture of an interior prison.'),
      heading('The Lie Inventory'),
      para('In this lesson, we are going to gently walk through some of the most common false beliefs that hold people back — and invite you to identify which ones have taken root in your own story.'),
      para('This is not an exercise in shame. Every person working through this material has believed lies at some point. The goal is not to condemn — it is to name them, so that the truth can do its work.'),
      heading('What Truth Does'),
      para('"And you will know the truth, and the truth will set you free." — John 8:32. This verse is not a platitude. It is a description of a mechanism. Truth, when it is encountered and received, does something to a person. It does not merely inform them — it liberates them.'),
      para('The interactive exercises below are designed to help you identify the specific lies that have shaped your thinking, and to begin the process of naming the truth that contradicts each one.'),
    ),
    forms: [
      // Radio — which category of lies resonates most
      {
        content_type: 'radio',
        anchor_text: 'The lies you\'ve heard most',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Which category of lies has had the greatest influence in your life?',
          options: [
            { id: 'r1', text: 'Lies about my identity ("I am worthless / broken / too much / not enough")' },
            { id: 'r2', text: 'Lies about God ("He is distant / angry / doesn\'t care about me")' },
            { id: 'r3', text: 'Lies about my past ("What happened to me defines me forever")' },
            { id: 'r4', text: 'Lies about my future ("Nothing will ever change for me")' },
          ],
          required: true,
        },
      },
      // Textarea — write the specific lie
      {
        content_type: 'textarea',
        anchor_text: 'Name the lie',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Take a moment to write out one specific lie you have believed about yourself. Don\'t edit it — write it the way it sounds in your own head.',
          placeholder: '"I am..." / "God thinks I am..." / "I will always..."',
          required: false,
          show_label: true,
          rows: 3,
        },
      },
      // Textbox — write the countering truth
      {
        content_type: 'textbox',
        anchor_text: 'The truth that counters it',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Now write one truth — from Scripture, from a mentor, or from your own experience — that directly contradicts that lie.',
          placeholder: 'The truth is...',
          required: false,
          show_label: true,
        },
      },
      // Multiselect — which Scripture passages have helped
      {
        content_type: 'multiselect',
        anchor_text: 'Scripture anchors',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Which of these passages have been anchors for you, or would you like to explore? (Select all that apply)',
          options: [
            { id: 'm1', text: 'Psalm 139 — "I am fearfully and wonderfully made"' },
            { id: 'm2', text: 'Romans 8:1 — "No condemnation for those in Christ"' },
            { id: 'm3', text: 'Isaiah 43:1 — "I have called you by name; you are mine"' },
            { id: 'm4', text: 'Jeremiah 29:11 — "Plans to give you hope and a future"' },
            { id: 'm5', text: '2 Corinthians 5:17 — "A new creation"' },
            { id: 'm6', text: 'Zephaniah 3:17 — "He rejoices over you with singing"' },
          ],
          min_selections: 0,
          max_selections: 6,
          required: false,
        },
      },
      // Select — how long has this lie been present
      {
        content_type: 'select',
        anchor_text: 'How long the lie has been there',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Roughly when did this false belief first take root in your life?',
          options: [
            { id: 's1', text: 'Childhood (under 12)' },
            { id: 's2', text: 'Teenage years (12–18)' },
            { id: 's3', text: 'Early adulthood (18–30)' },
            { id: 's4', text: 'Later in life (30+)' },
            { id: 's5', text: 'I\'m not sure — it\'s always felt true' },
          ],
          required: false,
          placeholder: 'Choose the closest...',
        },
      },
      // Poll — community
      {
        content_type: 'poll',
        anchor_text: 'Community pulse — breakthrough',
        position_in_chapter: 'end_of_chapter',
        content_data: {
          question: 'Have you ever experienced a moment when a deeply-held lie was replaced by truth?',
          options: [
            { id: 'p1', text: 'Yes — and it changed everything' },
            { id: 'p2', text: 'Partly — it\'s still a process' },
            { id: 'p3', text: 'Not yet — that\'s why I\'m here' },
            { id: 'p4', text: 'I\'m not sure what that would feel like' },
          ],
          allow_multiple: false,
        },
      },
      // Question — closing reflection
      {
        content_type: 'question',
        anchor_text: 'Chapter 2 reflection',
        position_in_chapter: 'end_of_chapter',
        content_data: {
          question: 'Is there someone in your life whose voice first planted one of these lies? You don\'t need to name them publicly — but is there an act of forgiveness that this truth-work might be calling you toward?',
          allow_multiple_answers: false,
        },
      },
    ],
  },

  {
    // ── Chapter 3 ────────────────────────────────────────────────────────────
    title: 'Lesson 3 — Walking It Out: Daily Practices of Freedom',
    content: doc(
      heading('Freedom Is Not an Event'),
      para('People often expect freedom to arrive all at once — in a single moment of prayer, a breakthrough service, a turning point conversation. And sometimes, God does move that swiftly. But more often, freedom is a road, not a destination. It is walked out in daily decisions, in small acts of courage, in choosing truth again and again until it becomes your native language.'),
      para('This does not diminish the reality of breakthrough moments. It protects them. Many people experience genuine deliverance and then — without daily practices to reinforce their new identity — slowly drift back into the familiar gravitational pull of old patterns.'),
      heading('The Three Daily Anchors'),
      para('Through years of walking with people through recovery and healing, three practices have emerged as the most consistent predictors of sustained freedom. They are not complicated. They are not religious performance. They are simply ways of saying, each day: I choose to live as who I really am.'),
      para('Anchor 1 — Morning Declaration: Starting each day by speaking truth aloud about your identity. Not wishful thinking — truth grounded in Scripture and in what is genuinely real about you.'),
      para('Anchor 2 — The Gratitude Interruption: When the old lies surface (and they will), the most powerful counter-practice is gratitude — not denial, but redirecting attention to what is genuinely good and true.'),
      para('Anchor 3 — Community Accountability: Freedom is not a solo project. The people who sustain it are connected to others who know their story, can ask the hard questions, and will celebrate the small wins.'),
      heading('Your Personal Freedom Plan'),
      para('The exercises below will help you build a simple, personalized plan for walking out the freedom you are stepping into. There are no right answers — only honest ones. The goal is to leave this chapter with something concrete you can return to tomorrow morning.'),
    ),
    forms: [
      // Textbox — morning declaration
      {
        content_type: 'textbox',
        anchor_text: 'Your morning declaration',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Write one truth about your identity that you could declare aloud each morning this week.',
          placeholder: '"I am..."',
          required: false,
          show_label: true,
        },
      },
      // Checkbox — which anchors they will commit to
      {
        content_type: 'checkbox',
        anchor_text: 'Your anchor commitments',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Which of the three daily anchors are you willing to try this week?',
          options: [
            { id: 'c1', text: 'Morning Declaration — I will speak truth about my identity each morning' },
            { id: 'c2', text: 'Gratitude Interruption — I will pause and list three true things when lies surface' },
            { id: 'c3', text: 'Community Accountability — I will share my progress with at least one person' },
          ],
          required: false,
        },
      },
      // Select — biggest obstacle to daily practice
      {
        content_type: 'select',
        anchor_text: 'Your biggest obstacle',
        position_in_chapter: 'inline',
        content_data: {
          label: 'What is your biggest obstacle to maintaining daily practices?',
          options: [
            { id: 's1', text: 'I forget — my mornings are chaotic' },
            { id: 's2', text: 'I feel self-conscious doing it — it feels awkward' },
            { id: 's3', text: 'I don\'t believe it will actually help' },
            { id: 's4', text: 'I have tried before and given up' },
            { id: 's5', text: 'I don\'t have people in my life to be accountable to' },
            { id: 's6', text: 'Honestly, I\'m not sure yet' },
          ],
          required: false,
          placeholder: 'Be honest...',
        },
      },
      // Multiselect — support needed
      {
        content_type: 'multiselect',
        anchor_text: 'What support would help',
        position_in_chapter: 'inline',
        content_data: {
          label: 'What kinds of support would most help you stay on track? (Choose all that apply)',
          options: [
            { id: 'm1', text: 'Weekly check-ins from someone in this group' },
            { id: 'm2', text: 'A structured daily reading plan' },
            { id: 'm3', text: 'A prayer partner' },
            { id: 'm4', text: 'Practical tools (journals, prompts, reminders)' },
            { id: 'm5', text: 'One-on-one time with a leader or pastor' },
            { id: 'm6', text: 'More group sessions like this one' },
          ],
          min_selections: 0,
          max_selections: 6,
          required: false,
        },
      },
      // Radio — confidence level
      {
        content_type: 'radio',
        anchor_text: 'Your confidence level',
        position_in_chapter: 'inline',
        content_data: {
          label: 'As you finish this lesson, how confident do you feel about sustaining your freedom in the days ahead?',
          options: [
            { id: 'r1', text: '1 — Very unsure. I need a lot of support.' },
            { id: 'r2', text: '2 — A little uncertain but willing to try' },
            { id: 'r3', text: '3 — Reasonably confident with the right practices' },
            { id: 'r4', text: '4 — Confident. I know what to do.' },
          ],
          required: true,
        },
      },
      // Textarea — letter to self
      {
        content_type: 'textarea',
        anchor_text: 'A letter to yourself',
        position_in_chapter: 'inline',
        content_data: {
          label: 'Write a short letter to yourself — to be read in 30 days. What do you hope to have done? What do you want to remind yourself of? What are you walking away from this journey knowing?',
          placeholder: 'Dear [your name]...',
          required: false,
          show_label: true,
          rows: 6,
        },
      },
      // Poll — community closing
      {
        content_type: 'poll',
        anchor_text: 'Final community pulse',
        position_in_chapter: 'end_of_chapter',
        content_data: {
          question: 'How would you describe how you feel having completed Lesson 3?',
          options: [
            { id: 'p1', text: 'Lighter — something shifted for me' },
            { id: 'p2', text: 'Hopeful — I can see the road ahead' },
            { id: 'p3', text: 'Still processing — it\'s a lot to absorb' },
            { id: 'p4', text: 'Ready — I know what I need to do next' },
          ],
          allow_multiple: false,
        },
      },
      // Question — final reflection
      {
        content_type: 'question',
        anchor_text: 'Final reflection — your one thing',
        position_in_chapter: 'end_of_chapter',
        content_data: {
          question: 'If you could only take one thing from these three lessons and put it into practice this week, what would it be? Name it specifically.',
          allow_multiple_answers: false,
        },
      },
    ],
  },
];

// ─── Sample reader responses ──────────────────────────────────────────────────
const SAMPLE_ANSWERS = [
  "I think they'd say: 'It was worth it. Every hard conversation, every time you chose truth over comfort — it was worth it. You are not who you feared you were.'",
  "That I already had everything I needed. The work wasn't to get something new — it was to stop hiding from what was already there.",
  "Be kind to yourself in the process. You will stumble. That is not failure. That is how walking works.",
  "The journey ahead is not as long as it feels right now. The first step is the hardest one, and you've already taken it.",
  "That freedom really is possible — not as a distant hope but as a daily reality. Hold on to that.",
];

const SAMPLE_LIE_REFLECTIONS = [
  "The lie is: 'I am too broken to be fully loved.' The truth that counters it: Isaiah 43:4 — 'You are precious and honoured in my sight.'",
  "Mine has been: 'God is keeping score and I'm losing.' The truth: Romans 8:1 — There is therefore now no condemnation.",
  "The lie I've carried the longest is that my past disqualifies me from the future God has for me. The truth is: 2 Corinthians 5:17.",
  "I believed I was fundamentally different from others — that freedom was for them, not for me. That lie has cost me years.",
  "My lie was simpler and crueller: 'You are invisible. No one actually sees you.' The truth — God called me by name.",
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════════════════');
  console.log('  Overcomers PEI — Seed Script');
  console.log('════════════════════════════════════════════════════');

  // ── 1. Users ───────────────────────────────────────────────────────────────
  step('Creating users');
  const owner = await upsertUser(OWNER.email, OWNER.password, OWNER.name, true);
  const readers = [];
  for (const r of READERS) {
    readers.push(await upsertUser(r.email, r.password, r.name, false));
  }
  const ownerId  = owner.id;
  const readerIds = readers.map(r => r.id);

  // ── 2. Book ────────────────────────────────────────────────────────────────
  step('Creating book: Overcomers — Walking in Freedom');

  let bookId;
  const { data: existingBook } = await db.from('books').select('id').eq('slug', 'overcomers-walking-in-freedom').maybeSingle();
  if (existingBook) {
    bookId = existingBook.id;
    log('Book exists');
  } else {
    const { data: book, error: be } = await db.from('books').insert({
      title: 'Overcomers: Walking in Freedom',
      subtitle: 'A Three-Lesson Journey Toward Wholeness',
      description: 'An interactive guided journey for anyone who has ever felt held back — by their past, by their own mind, or by lies they\'ve long believed. Written for the Overcomers PEI community, these three lessons combine honest reflection, Scripture, and practical tools to help you discover the freedom that has always been yours in Christ.',
      author_id: ownerId,
      status: 'published',
      visibility: 'public',
      slug: 'overcomers-walking-in-freedom',
      cover_image_url: COVER_URL,
    }).select('id').single();
    if (be) throw new Error(`Create book: ${be.message}`);
    bookId = book.id;

    await db.from('book_settings').upsert({
      book_id: bookId,
      enable_progress_tracking: true,
      allow_reader_questions: true,
      allow_reader_polls: true,
      allow_reader_highlights: true,
      allow_reader_notes: true,
    }, { onConflict: 'book_id' });

    log(`Created book (ID: ${bookId})`);
  }

  // ── 3. Chapters + inline content ──────────────────────────────────────────
  step('Creating chapters and all form components');

  const chapterIds = [];
  for (let i = 0; i < CHAPTERS.length; i++) {
    const ch = CHAPTERS[i];

    // Chapter
    const { data: existingCh } = await db.from('chapters')
      .select('id').eq('book_id', bookId).eq('order_index', i).maybeSingle();

    let chapterId;
    if (existingCh) {
      chapterId = existingCh.id;
      log(`Chapter exists: ${ch.title}`);
    } else {
      const text = ch.content.content
        .filter(n => n.content)
        .map(n => n.content.map(c => c.text || '').join(''))
        .join(' ');
      const wordCount = text.trim().split(/\s+/).length;
      const { data: chapter, error: che } = await db.from('chapters').insert({
        book_id: bookId,
        title: ch.title,
        content: ch.content,
        content_text: text,
        order_index: i,
        status: 'published',
        word_count: wordCount,
        estimated_read_time_minutes: Math.max(2, Math.round(wordCount / 200)),
      }).select('id').single();
      if (che) throw new Error(`Chapter ${i}: ${che.message}`);
      chapterId = chapter.id;
      log(`Created chapter: ${ch.title}`);
    }
    chapterIds.push(chapterId);

    // Form components — one per content_type+anchor_text (idempotent check)
    for (const form of ch.forms) {
      const { data: existingForm } = await db.from('inline_content')
        .select('id')
        .eq('chapter_id', chapterId)
        .eq('content_type', form.content_type)
        .eq('anchor_text', form.anchor_text)
        .maybeSingle();

      if (!existingForm) {
        const { error: fe } = await db.from('inline_content').insert({
          book_id: bookId,
          chapter_id: chapterId,
          content_type: form.content_type,
          anchor_text: form.anchor_text,
          content_data: form.content_data,
          start_offset: 0,
          end_offset: 0,
          created_by: ownerId,
          is_author_content: true,
          visibility: 'all_readers',
          position_in_chapter: form.position_in_chapter,
          response_visibility: 'private',
        });
        if (fe) warn(`Form (${form.content_type} — "${form.anchor_text}"): ${fe.message}`);
        else log(`  + ${form.content_type}: ${form.anchor_text}`);
      } else {
        log(`  ✓ exists: ${form.content_type} — ${form.anchor_text}`);
      }
    }
  }

  // ── 4. Book club ───────────────────────────────────────────────────────────
  step('Creating book club: Overcomers PEI');

  let clubId;
  const { data: existingClub } = await db.from('book_clubs').select('id').eq('name', 'Overcomers PEI').maybeSingle();
  if (existingClub) {
    clubId = existingClub.id;
    log('Club exists: Overcomers PEI');
  } else {
    const { data: club, error: ce } = await db.from('book_clubs').insert({
      name: 'Overcomers PEI',
      description: 'A safe, supportive community for anyone walking the road toward freedom and wholeness on Prince Edward Island. We read together, reflect together, and grow together.',
      visibility: 'private',
      max_members: 50,
      created_by: ownerId,
    }).select('id').single();
    if (ce) throw new Error(`Create club: ${ce.message}`);
    clubId = club.id;

    await db.from('club_settings').upsert({
      club_id: clubId,
      enable_progress_tracking: true,
      show_member_reading_progress: true,
      show_member_answers: true,
    }, { onConflict: 'club_id' });
    try {
      await db.schema('bookflow').from('club_chat_settings').upsert({ club_id: clubId }, { onConflict: 'club_id' });
    } catch (_) {}
    log(`Created club (ID: ${clubId})`);
  }

  // Attach book to club as current
  const { data: existingCb } = await db.from('club_books').select('id').eq('club_id', clubId).eq('book_id', bookId).maybeSingle();
  if (!existingCb) {
    await db.from('club_books').insert({ club_id: clubId, book_id: bookId, added_by: ownerId, is_current: true });
    log('Attached book to club');
  }

  // Owner as club member (admin)
  const { data: ownerMember } = await db.from('club_members').select('id').eq('club_id', clubId).eq('user_id', ownerId).maybeSingle();
  if (!ownerMember) {
    const now = new Date().toISOString();
    await db.from('club_members').insert({
      club_id: clubId, user_id: ownerId, invited_by: ownerId,
      invited_email: OWNER.email, role: 'admin',
      invite_token: null, invite_accepted_at: now, joined_at: now,
    });
    log(`Added owner as admin: ${OWNER.name}`);
  }

  // ── 5. Add readers to club ─────────────────────────────────────────────────
  step('Adding 5 readers to Overcomers PEI');

  for (let i = 0; i < readerIds.length; i++) {
    const readerId = readerIds[i];
    const { data: existing } = await db.from('club_members').select('id').eq('club_id', clubId).eq('user_id', readerId).maybeSingle();
    if (!existing) {
      const now = new Date().toISOString();
      await db.from('club_members').insert({
        club_id: clubId, user_id: readerId, invited_by: ownerId,
        invited_email: READERS[i].email, role: 'member',
        invite_token: null, invite_accepted_at: now, joined_at: now,
      });
      log(`Added: ${READERS[i].name}`);
    } else {
      log(`Exists: ${READERS[i].name}`);
    }
  }

  // ── 6. Reading progress ────────────────────────────────────────────────────
  step('Simulating varied reading progress');

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  // Stagger how far each reader has gotten
  const progressMap = [
    { idx: 0, chapterReached: 2, pct: 100 },  // Grace — completed all 3
    { idx: 1, chapterReached: 2, pct: 100 },  // Thomas — completed all 3
    { idx: 2, chapterReached: 1, pct: 67  },  // Ruth — through chapter 2
    { idx: 3, chapterReached: 1, pct: 67  },  // Caleb — through chapter 2
    { idx: 4, chapterReached: 0, pct: 33  },  // Miriam — chapter 1 only
  ];

  for (const p of progressMap) {
    const readerId = readerIds[p.idx];
    const readerName = READERS[p.idx].name;
    const isComplete = p.pct === 100;
    await db.from('reading_progress').upsert({
      user_id: readerId,
      book_id: bookId,
      current_chapter_id: chapterIds[p.chapterReached],
      scroll_position: isComplete ? 0.97 : 0.4 + Math.random() * 0.4,
      percent_complete: p.pct,
      last_read_at: daysAgo(Math.floor(Math.random() * 5)),
      started_at: daysAgo(10 + Math.floor(Math.random() * 4)),
      completed_at: isComplete ? daysAgo(Math.floor(Math.random() * 3)) : null,
    }, { onConflict: 'user_id,book_id' });
    log(`${readerName} → ${p.pct}% complete`);
  }

  // ── 7. Poll votes ──────────────────────────────────────────────────────────
  step('Recording poll votes');

  const { data: allPolls } = await db.from('inline_content')
    .select('id, content_data, chapter_id')
    .in('chapter_id', chapterIds)
    .eq('content_type', 'poll');

  for (const poll of (allPolls || [])) {
    const options = poll.content_data?.options || [];
    if (!options.length) continue;
    for (const readerId of readerIds) {
      const { data: existing } = await db.from('poll_responses')
        .select('id').eq('inline_content_id', poll.id).eq('user_id', readerId).maybeSingle();
      if (!existing) {
        const optIdx = Math.floor(Math.random() * options.length);
        const { error } = await db.from('poll_responses').insert({
          inline_content_id: poll.id,
          user_id: readerId,
          selected_option: options[optIdx].id,
        });
        if (error && !error.message.includes('duplicate')) warn(`Poll vote: ${error.message}`);
      }
    }
    log(`Votes recorded: "${poll.content_data?.question?.substring(0, 50)}..."`);
  }

  // ── 8. Question answers ────────────────────────────────────────────────────
  step('Recording reflection answers');

  const { data: allQuestions } = await db.from('inline_content')
    .select('id, chapter_id')
    .in('chapter_id', chapterIds)
    .eq('content_type', 'question');

  for (const q of (allQuestions || [])) {
    // Use closing-reflection answers for end-of-chapter questions, lie reflections for ch2
    const chIdx = chapterIds.indexOf(q.chapter_id);
    const answers = chIdx === 1 ? SAMPLE_LIE_REFLECTIONS : SAMPLE_ANSWERS;
    for (let i = 0; i < readerIds.length; i++) {
      const { data: existing } = await db.from('question_answers')
        .select('id').eq('inline_content_id', q.id).eq('user_id', readerIds[i]).maybeSingle();
      if (!existing) {
        const { error } = await db.from('question_answers').insert({
          inline_content_id: q.id,
          user_id: readerIds[i],
          answer_text: answers[i % answers.length],
        });
        if (error && !error.message.includes('duplicate')) warn(`Answer: ${error.message}`);
      }
    }
    log(`Answers recorded (chapter ${chIdx + 1})`);
  }

  // ── 9. Form responses (textbox/textarea) ──────────────────────────────────
  step('Recording form responses (textbox / textarea)');

  const { data: textForms } = await db.from('inline_content')
    .select('id, content_type, content_data, chapter_id')
    .in('chapter_id', chapterIds)
    .in('content_type', ['textbox', 'textarea']);

  const textboxResponses = [
    'Grace', 'Thomas', 'Ruthie', 'Caleb', 'Miri',
  ];
  const textareaResponses = [
    'I came to this journey after years of carrying shame I could not name. A friend from my church told me about Overcomers and something in me said: this is for you. I\'m here because I\'m ready to stop running.',
    'Honestly? My wife encouraged me to come. But the more I read, the more I realize this is exactly where I need to be. The section on lies we believe hit closer to home than I expected.',
    'I lost my mum two years ago and since then I\'ve felt stuck — like I can\'t move forward but I can\'t go back either. I\'m hoping this journey gives me a path.',
    'I\'ve been a Christian for twenty years but I\'ve never felt truly free. There\'s always been something underneath — something I haven\'t wanted to look at. I think it\'s time.',
    'My story is complicated. But the short version is: I survived things I thought would destroy me, and I\'m still here. I want to discover what that means.',
  ];

  for (const form of (textForms || [])) {
    for (let i = 0; i < readerIds.length; i++) {
      const { data: existing } = await db.from('form_responses')
        .select('id').eq('inline_content_id', form.id).eq('user_id', readerIds[i]).maybeSingle();
      if (!existing) {
        const isTextbox = form.content_type === 'textbox';
        const responseData = isTextbox
          ? { value: textboxResponses[i % textboxResponses.length] }
          : { value: textareaResponses[i % textareaResponses.length] };
        const { error } = await db.from('form_responses').insert({
          inline_content_id: form.id,
          user_id: readerIds[i],
          response_data: responseData,
        });
        if (error && !error.message.includes('duplicate')) warn(`Form response: ${error.message}`);
      }
    }
    log(`Form responses: ${form.content_type} — "${form.content_data?.label?.substring(0, 45)}..."`);
  }

  // ── 10. Club welcome discussion ────────────────────────────────────────────
  step('Creating club discussion');

  const { data: existingDiscs } = await db.from('club_discussions')
    .select('id').eq('club_id', clubId).eq('author_id', ownerId).is('parent_id', null).limit(1);

  if (!existingDiscs?.length) {
    const { data: disc, error: de } = await db.from('club_discussions').insert({
      club_id: clubId,
      author_id: ownerId,
      body: `Welcome to Overcomers PEI! 🌿 I'm so glad you're here. These three lessons are not a programme — they are a conversation. There are no wrong answers, no pressure to perform, and no expectation that you have it all together. The only expectation is honesty. Take your time with each chapter. The interactive sections are there to help you process, not to test you. I'm praying for each of you by name as you begin. — Pastor David`,
    }).select('id').single();
    if (de) warn(`Discussion: ${de.message}`);
    else {
      log('Created welcome post');
      await db.from('club_discussions').insert({
        club_id: clubId, author_id: readerIds[0], parent_id: disc.id,
        body: 'Thank you, Pastor David. I started Lesson 1 last night and had to stop halfway through because I was crying — in a good way. Already feeling something shift.',
      });
      await db.from('club_discussions').insert({
        club_id: clubId, author_id: readerIds[2], parent_id: disc.id,
        body: 'The multiselect question about areas I\'m carrying... I checked more boxes than I expected. But somehow just naming them felt lighter than carrying them silently.',
      });
      log('Added reader replies');
    }
  } else {
    log('Discussion exists');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════');
  console.log('  ✅ Overcomers PEI seed complete!');
  console.log('════════════════════════════════════════════════════');
  console.log(`\n  Owner:     ${OWNER.email}  /  ${OWNER.password}`);
  console.log(`  Readers:   ${READERS[0].email}  /  Reader@2026!`);
  console.log(`             (all 5 readers share: Reader@2026!)`);
  console.log(`\n  Book ID:   ${bookId}`);
  console.log(`  Club ID:   ${clubId}`);
  console.log(`  Chapters:  ${chapterIds.join(', ')}`);
  console.log('\n  Form types seeded:');
  console.log('    textbox, textarea, radio, checkbox, select, multiselect, poll, question');
  console.log('\n  Dashboard (owner):');
  console.log(`    http://localhost:5178/edit/book/${bookId}/dashboard`);
  console.log('  Reader view:');
  console.log(`    http://localhost:5178/book/${bookId}`);
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
