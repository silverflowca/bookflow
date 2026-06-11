/**
 * BookFlow Demo Seed — Forms Showcase Book
 * ─────────────────────────────────────────
 * Creates "Discipleship in Practice" — a 3-chapter interactive workbook
 * that demonstrates every form component type:
 *
 *   Chapter 1 — Knowing Yourself Before God
 *     • textbox (inline + block)
 *     • textarea (block, end-of-chapter)
 *     • radio (inline)
 *     • poll
 *     • open question
 *
 *   Chapter 2 — Rhythms That Sustain the Soul
 *     • select (inline + block)
 *     • multiselect (block)
 *     • checkbox (inline)
 *     • poll
 *     • open question
 *
 *   Chapter 3 — Living Sent: Faith in Everyday Contexts
 *     • textbox (block, multiple)
 *     • radio (block)
 *     • multiselect (block)
 *     • poll
 *     • open question
 *
 * Usage:  node seed-forms-demo.mjs
 * Safe:   All inserts use upsert / conflict-ignore so it can be re-run.
 */

import { createClient } from '@supabase/supabase-js';

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

// ─── User helper ──────────────────────────────────────────────────────────────
async function upsertUser(email, password, displayName, role = 'reader') {
  const { data: existing } = await db.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing) { log(`User exists: ${email}`); return existing.id; }

  const { data, error } = await dbAnon.auth.signUp({ email, password });
  if (error && !error.message.includes('already registered')) throw new Error(`SignUp ${email}: ${error.message}`);
  let userId = data?.user?.id;
  if (!userId) {
    const { data: si } = await dbAnon.auth.signInWithPassword({ email, password });
    userId = si?.user?.id;
    if (!userId) throw new Error(`Could not resolve user for ${email}`);
    await dbAnon.auth.signOut();
  }

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const dockerPath = '/c/Program Files/Rancher Desktop/resources/resources/win32/bin/docker';
  await execAsync(`"${dockerPath}" exec supabase_db_silverflow psql -U postgres -d postgres -c "UPDATE auth.users SET email_confirmed_at = NOW(), confirmation_token = '' WHERE id = '${userId}';"`).catch(e => warn(`Email confirm: ${e.message}`));

  await db.from('profiles').upsert({
    id: userId, email, display_name: displayName,
    is_author: role === 'author', profile_public: true,
    show_reading_progress: true, show_clubs: true, show_books_authored: true,
  }, { onConflict: 'id' });

  log(`Created user: ${displayName}`);
  return userId;
}

// ─── TipTap helpers ───────────────────────────────────────────────────────────
function p(text) { return { type: 'paragraph', content: [{ type: 'text', text }] }; }
function h2(text) { return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] }; }
function doc(...nodes) { return { type: 'doc', content: nodes }; }

// ─── Book content ─────────────────────────────────────────────────────────────
const BOOK = {
  slug: 'discipleship-in-practice',
  title: 'Discipleship in Practice',
  subtitle: 'An Interactive Workbook for Personal and Community Formation',
  description: 'A hands-on spiritual formation workbook that takes you through three essential dimensions of discipleship: knowing yourself before God, establishing rhythms that sustain the soul, and living sent in everyday contexts. Each chapter combines reflective teaching with guided questions, polls, and interactive exercises designed for both individual and group use.',
  cover: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=1200&fit=crop&crop=entropy',
  chapters: [
    // ── Chapter 1 ────────────────────────────────────────────────────────────
    {
      title: 'Chapter 1 — Knowing Yourself Before God',
      content: doc(
        h2('The Examined Life'),
        p('Discipleship begins not with doing, but with seeing. Before we can grow, we must honestly assess where we are. The ancient tradition of self-examination — practised by the Desert Fathers, the Reformers, the Puritans, and the mystics — is not a form of introspection for its own sake. It is the necessary precondition of genuine transformation.'),
        p('The apostle Paul urges the church in Corinth to "examine yourselves, to see whether you are in the faith." This is not a call to anxiety but to honest realism — the kind of clear-eyed self-knowledge that is only possible when we stand before a God who already knows us completely and loves us unconditionally.'),
        h2('What Scripture Reveals About the Inner Life'),
        p('The Psalms are the most honest literature ever written. David does not manage his emotions before bringing them to God — he brings them raw, unfiltered, and sometimes theologically problematic. Yet the Psalms are Scripture. God was not embarrassed by David\'s honesty; God preserved it for every generation.'),
        p('Psalm 139 articulates the foundation of Christian self-knowledge: we are fully known by God before we are known by ourselves. "You have searched me, Lord, and you know me." This is not threat but invitation — to stop performing and to start being present. The examined life, in the Christian tradition, is not driven by self-improvement. It is a response to being known.'),
        h2('The Practice of the Daily Examen'),
        p('Ignatius of Loyola developed the Daily Examen as a structured review of the day\'s movements of the soul — moments of consolation (drawing toward God) and desolation (drawing away). This five-step practice has been adapted in countless forms over five centuries, but its core remains: at the end of each day, pause and ask: Where was God present today? Where did I resist him?'),
        p('The Examen is not a performance review. It is not about tallying successes and failures. It is about developing the spiritual sensitivity to notice God\'s presence and activity in the ordinary texture of daily life — and to respond with gratitude, repentance, and renewed intention.'),
        h2('Beginning the Journey'),
        p('This chapter invites you to take an honest first look. Before answering the reflection questions below, sit quietly for two minutes. Ask the Spirit to search you. Then respond as honestly as you can — not the answer you think you should give, but the answer that is actually true for you right now.'),
      ),
      formItems: [
        {
          content_type: 'textbox',
          position: 'end_of_chapter',
          content_data: {
            label: 'What is your first name? (so we can personalise this workbook)',
            placeholder: 'Your first name',
            width: 'md',
            required: true,
          },
          anchor_text: 'Your Name',
        },
        {
          content_type: 'radio',
          position: 'end_of_chapter',
          content_data: {
            label: 'How would you describe your current spiritual season?',
            options: [
              { id: 'r1', text: 'A season of growth and clarity' },
              { id: 'r2', text: 'A season of dryness or distance' },
              { id: 'r3', text: 'A season of transition and uncertainty' },
              { id: 'r4', text: 'A season of suffering or grief' },
              { id: 'r5', text: 'A season of consolidation and rest' },
            ],
          },
          anchor_text: 'Your Spiritual Season',
        },
        {
          content_type: 'poll',
          position: 'end_of_chapter',
          content_data: {
            question: 'Which spiritual discipline do you find most difficult to sustain consistently?',
            options: [
              { id: 'p1', text: 'Prayer' },
              { id: 'p2', text: 'Scripture reading' },
              { id: 'p3', text: 'Sabbath and rest' },
              { id: 'p4', text: 'Solitude and silence' },
              { id: 'p5', text: 'Community and accountability' },
            ],
            allow_multiple: false,
          },
          anchor_text: 'Community Poll',
        },
        {
          content_type: 'textarea',
          position: 'end_of_chapter',
          content_data: {
            label: 'Spend three minutes with Psalm 139:1–6. Then write: What does it feel like to be fully known by God? Be honest — include any discomfort, not just the "right" answer.',
            placeholder: 'Write your reflection here...',
            rows: 6,
            auto_expand: true,
            width: 'full',
          },
          anchor_text: 'Psalm 139 Reflection',
        },
        {
          content_type: 'question',
          position: 'end_of_chapter',
          content_data: {
            question: 'Describe one area of your inner life — a habit, a pattern, a recurring temptation or fear — that you have been reluctant to bring honestly before God. What has kept you from doing so?',
            type: 'open',
          },
          anchor_text: 'Honest Reflection',
        },
      ],
    },

    // ── Chapter 2 ────────────────────────────────────────────────────────────
    {
      title: 'Chapter 2 — Rhythms That Sustain the Soul',
      content: doc(
        h2('The Tyranny of the Urgent'),
        p('Contemporary life is structurally hostile to spiritual depth. The pace of modern work, the relentlessness of digital communication, and the cultural equation of busyness with significance have produced a generation of Christians who are more active and less formed than any previous era of the church.'),
        p('Dallas Willard coined the phrase "the hurried soul" to describe the spiritual condition of contemporary believers — not wicked or rebellious, but simply too distracted, too rushed, and too overstimulated to attend to the deep things of God. The cure, Willard argued, is not trying harder. It is ruthless attention to the rhythms and structures that create the conditions for transformation.'),
        h2('What Is a Spiritual Rhythm?'),
        p('A spiritual rhythm is a regular, intentional pattern of engagement with God that creates the conditions for formation to occur. It is not the same as a rule (which can be kept externally without inner transformation) or a resolution (which is short-lived and willpower-dependent). A rhythm, like breathing, becomes natural over time — a way of being rather than a thing we do.'),
        p('The rhythm of the church year — Advent, Christmas, Epiphany, Lent, Holy Week, Easter, Pentecost — is one of the oldest and most powerful formative structures in the Christian tradition. It narrates the gospel through time, shaping our imaginations and affections by what we attend to across the cycle of a year. Many contemporary Christians have lost access to this rhythm; recovering it requires intentional re-engagement.'),
        h2('The Three Movements of a Sustainable Rhythm'),
        p('Sustainable spiritual rhythms move across three axes: daily, weekly, and seasonal. The daily axis consists of brief, anchoring practices — morning prayer, an evening review, Scripture at a fixed time. The weekly axis includes Sabbath, gathered worship, and a rhythm of work and rest. The seasonal axis aligns with the church calendar or significant personal seasons of life.'),
        p('Most people who attempt to build spiritual rhythm focus exclusively on the daily axis and neglect the weekly and seasonal. The result is a devotional life that feels isolated and unintegrated with the larger story of the church and the soul. Sustainable formation requires all three axes working together.'),
        h2('Designing Your Own Rhythm'),
        p('The questions below invite you to take inventory of your current patterns and to begin designing a rhythm that is genuinely yours — not copied from someone else\'s book, but built from honest attention to how God has already been meeting you, and how you want to meet him more intentionally going forward.'),
      ),
      formItems: [
        {
          content_type: 'select',
          position: 'end_of_chapter',
          content_data: {
            label: 'What time of day do you most naturally connect with God?',
            placeholder: 'Select a time...',
            options: [
              { id: 's1', text: 'Early morning (before 7am)' },
              { id: 's2', text: 'Morning (7–9am)' },
              { id: 's3', text: 'Midday' },
              { id: 's4', text: 'Afternoon' },
              { id: 's5', text: 'Evening' },
              { id: 's6', text: 'Late night' },
              { id: 's7', text: 'No consistent time — it varies' },
            ],
          },
          anchor_text: 'Best Time',
        },
        {
          content_type: 'multiselect',
          position: 'end_of_chapter',
          content_data: {
            label: 'Which of the following practices are currently part of your spiritual life? (Select all that apply)',
            options: [
              { id: 'm1', text: 'Daily personal prayer' },
              { id: 'm2', text: 'Regular Scripture reading or lectio divina' },
              { id: 'm3', text: 'Weekly gathered worship' },
              { id: 'm4', text: 'Observed Sabbath' },
              { id: 'm5', text: 'Fasting' },
              { id: 'm6', text: 'Journaling or written reflection' },
              { id: 'm7', text: 'Spiritual direction or mentoring' },
              { id: 'm8', text: 'Regular solitude' },
              { id: 'm9', text: 'Service or acts of mercy' },
            ],
          },
          anchor_text: 'Current Practices',
        },
        {
          content_type: 'poll',
          position: 'end_of_chapter',
          content_data: {
            question: 'Which best describes your current approach to Sabbath?',
            options: [
              { id: 'p1', text: 'I observe a full day of rest each week' },
              { id: 'p2', text: 'I try but rarely succeed' },
              { id: 'p3', text: 'I take partial rest but not a full day' },
              { id: 'p4', text: 'Sabbath is not currently part of my rhythm' },
            ],
            allow_multiple: false,
          },
          anchor_text: 'Sabbath Poll',
        },
        {
          content_type: 'radio',
          position: 'end_of_chapter',
          content_data: {
            label: 'Which axis of rhythm do you most need to develop?',
            options: [
              { id: 'r1', text: 'Daily — anchoring practices for each day' },
              { id: 'r2', text: 'Weekly — Sabbath, worship, and weekly reset' },
              { id: 'r3', text: 'Seasonal — aligning with the church year or life seasons' },
              { id: 'r4', text: 'All three — I am starting from scratch' },
            ],
          },
          anchor_text: 'Rhythm Focus',
        },
        {
          content_type: 'textarea',
          position: 'end_of_chapter',
          content_data: {
            label: 'Describe your ideal daily rhythm in as much practical detail as you can. What time do you wake? When do you pray? What Scripture pattern works for your life right now? Be specific and realistic — not aspirational.',
            placeholder: 'Describe your ideal daily rhythm...',
            rows: 5,
            auto_expand: true,
            width: 'full',
          },
          anchor_text: 'My Daily Rhythm',
        },
        {
          content_type: 'question',
          position: 'end_of_chapter',
          content_data: {
            question: 'What is the single biggest structural obstacle to a sustainable spiritual rhythm in your life right now? Is it a time problem, a desire problem, a belief problem, or something else? What would need to change?',
            type: 'open',
          },
          anchor_text: 'Biggest Obstacle',
        },
      ],
    },

    // ── Chapter 3 ────────────────────────────────────────────────────────────
    {
      title: 'Chapter 3 — Living Sent: Faith in Everyday Contexts',
      content: doc(
        h2('The Sent Church'),
        p('The church does not merely go to mission — the church is a community of sent people. The missio Dei, the mission of God, is not a programme the church runs. It is the very identity of God — a God who sends, who enters, who takes on flesh and dwells among us. The church participates in this sending; it does not own or manage it.'),
        p('This distinction matters enormously for how ordinary Christians relate to the concept of mission. If mission is a programme, then it belongs to those with special training, special calling, or special courage. Most people are spectators and supporters. But if mission is participation in God\'s sending, then every disciple is a sent person — in their household, their neighbourhood, their workplace, their friendship networks.'),
        h2('The Theology of Ordinary'),
        p('The New Testament knows nothing of the sacred/secular divide that haunts Western Christianity. The word "holy" means "set apart for God" — but it applies to people and communities, not to spaces and activities. A conversation with a colleague about their marriage crisis is as holy as a Sunday sermon. A meal shared generously with neighbours is as sacramental as Communion.'),
        p('Recovering the theology of the ordinary requires a fundamental reimagination of what faithful discipleship looks like on a Tuesday afternoon. Not retreat from the world, but deep engagement with it — attentive, loving, patient, and Spirit-empowered engagement that makes the presence of God tangible in ordinary places.'),
        h2('Sent into What, Exactly?'),
        p('The contexts of the sent life are specific: a particular household with particular people and particular dynamics. A particular neighbourhood with particular needs and particular neighbours. A particular workplace with particular colleagues and particular culture. The theology of the sent life refuses abstraction — it insists on incarnation, on showing up in the actual places and among the actual people of your actual life.'),
        p('This specificity is both the challenge and the gift of missional discipleship. It cannot be done from a distance or by delegation. It requires your presence, your attention, your patience, and your willingness to be changed by the people and places you inhabit. You cannot love people you do not know. You cannot know people you do not spend time with. You cannot spend time with people whose world you find inconvenient.'),
        h2('Three Arenas of the Sent Life'),
        p('We organise the sent life around three primary arenas: the household (family, closest relationships), the neighbourhood (geographic and social community), and the workplace (vocation and economic life). Each arena has its own dynamics, its own rhythms, and its own particular invitations to partnership with God.'),
        p('The questions and exercises in this chapter invite you to take concrete stock of each arena — who is already there, what God may already be doing, and how you are being invited to show up more fully. There are no generic answers. What is true for your household is not true for anyone else\'s. Pay attention to your actual life.'),
      ),
      formItems: [
        {
          content_type: 'textbox',
          position: 'end_of_chapter',
          content_data: {
            label: 'Name one person in your household or closest circle who does not yet follow Jesus',
            placeholder: 'Their first name only',
            width: 'md',
          },
          anchor_text: 'Household',
        },
        {
          content_type: 'textbox',
          position: 'end_of_chapter',
          content_data: {
            label: 'Name one neighbour or person in your community you could intentionally invest in',
            placeholder: 'Their first name or description',
            width: 'md',
          },
          anchor_text: 'Neighbourhood',
        },
        {
          content_type: 'textbox',
          position: 'end_of_chapter',
          content_data: {
            label: 'Name one colleague, client, or person in your workplace sphere',
            placeholder: 'Their first name or role',
            width: 'md',
          },
          anchor_text: 'Workplace',
        },
        {
          content_type: 'radio',
          position: 'end_of_chapter',
          content_data: {
            label: 'In which arena of the sent life are you most naturally active right now?',
            options: [
              { id: 'r1', text: 'Household — I invest most in close relationships' },
              { id: 'r2', text: 'Neighbourhood — I am active in my local community' },
              { id: 'r3', text: 'Workplace — my primary mission field is vocational' },
              { id: 'r4', text: 'None — I am not yet consistently engaged in any' },
            ],
          },
          anchor_text: 'Primary Arena',
        },
        {
          content_type: 'multiselect',
          position: 'end_of_chapter',
          content_data: {
            label: 'What practical barriers prevent you from living more sent? (Select all that apply)',
            options: [
              { id: 'm1', text: 'I do not know my neighbours or colleagues well enough' },
              { id: 'm2', text: 'I lack confidence in sharing my faith naturally' },
              { id: 'm3', text: 'My schedule leaves no margin for relational investment' },
              { id: 'm4', text: 'I am uncertain what the Spirit is doing in these contexts' },
              { id: 'm5', text: 'Past experiences of rejection have made me cautious' },
              { id: 'm6', text: 'I tend to separate my faith life from my ordinary life' },
            ],
          },
          anchor_text: 'Barriers',
        },
        {
          content_type: 'poll',
          position: 'end_of_chapter',
          content_data: {
            question: 'Which statement best describes your relationship with the people in your immediate neighbourhood?',
            options: [
              { id: 'p1', text: 'I know most of them by name and we interact regularly' },
              { id: 'p2', text: 'I know a few but have little regular contact' },
              { id: 'p3', text: 'I know their faces but not their names' },
              { id: 'p4', text: 'We are essentially strangers' },
            ],
            allow_multiple: false,
          },
          anchor_text: 'Neighbourhood Poll',
        },
        {
          content_type: 'textarea',
          position: 'end_of_chapter',
          content_data: {
            label: 'Write a one-paragraph "sent letter" to yourself: Where is God sending you in this season? To whom? With what specific intention? Date it and keep it somewhere visible for the next 30 days.',
            placeholder: 'Write your sent letter here...',
            rows: 6,
            auto_expand: true,
            width: 'full',
          },
          anchor_text: 'My Sent Letter',
        },
        {
          content_type: 'question',
          position: 'end_of_chapter',
          content_data: {
            question: 'Describe one specific act of sent living you will commit to in the next seven days — with a named person, in a named place, doing a named thing. What would it mean to do this as worship rather than as duty?',
            type: 'open',
          },
          anchor_text: 'Seven-Day Commitment',
        },
      ],
    },
  ],
};

// ─── Readers ──────────────────────────────────────────────────────────────────
const READERS = [
  { email: 'anna.bergstrom@efhci-demo.com',     password: 'Demo@2026!', name: 'Anna Bergström'     },
  { email: 'thomas.okonkwo@efhci-demo.com',     password: 'Demo@2026!', name: 'Thomas Okonkwo'     },
  { email: 'rachel.davidson@efhci-demo.com',    password: 'Demo@2026!', name: 'Rachel Davidson'    },
  { email: 'miguel.santos@efhci-demo.com',      password: 'Demo@2026!', name: 'Miguel Santos'      },
  { email: 'ingrid.haugen@efhci-demo.com',      password: 'Demo@2026!', name: 'Ingrid Haugen'      },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
step('Resolving author account');
const { data: authorProfile } = await db.from('profiles').select('id').eq('email', 'admin.steen2@silverflow.ca').maybeSingle()
  || await db.from('profiles').select('id').eq('email', 'dr.sarah.mitchell@efhci-demo.com').maybeSingle();

let authorId;
if (authorProfile) {
  authorId = authorProfile.id;
  log(`Using author: ${authorId}`);
} else {
  authorId = await upsertUser('dr.sarah.mitchell@efhci-demo.com', 'Demo@2026!', 'Dr. Sarah Mitchell', 'author');
}

// Use the silverflow admin if available
const { data: adminProfile } = await db.from('profiles').select('id').eq('email', 'admin.steen2@silverflow.ca').maybeSingle();
if (adminProfile) { authorId = adminProfile.id; log(`Using silverflow admin as author`); }

step('Creating reader accounts');
const readerIds = [];
for (const r of READERS) {
  const id = await upsertUser(r.email, r.password, r.name);
  readerIds.push(id);
}

step('Creating book');
const { data: existingBook } = await db.from('books').select('id').eq('slug', BOOK.slug).maybeSingle();
let bookId;
if (existingBook) {
  bookId = existingBook.id;
  log(`Book exists: ${BOOK.title}`);
} else {
  const { data: book, error } = await db.from('books').insert({
    title: BOOK.title,
    subtitle: BOOK.subtitle,
    description: BOOK.description,
    cover_image_url: BOOK.cover,
    author_id: authorId,
    status: 'published',
    visibility: 'public',
    slug: BOOK.slug,
  }).select('id').single();
  if (error) throw new Error(`Create book: ${error.message}`);
  bookId = book.id;
  await db.from('book_settings').upsert({
    book_id: bookId,
    enable_progress_tracking: true,
    allow_reader_questions: true,
    allow_reader_polls: true,
    allow_reader_highlights: true,
    allow_reader_notes: true,
  }, { onConflict: 'book_id' });
  // Update cover
  await db.from('books').update({ cover_image_url: BOOK.cover }).eq('id', bookId);
  log(`Created book: ${BOOK.title} (${bookId})`);
}

step('Creating chapters and inline content');
const chapterIds = [];
for (let i = 0; i < BOOK.chapters.length; i++) {
  const ch = BOOK.chapters[i];

  // Chapter
  const { data: existingCh } = await db.from('chapters')
    .select('id').eq('book_id', bookId).eq('order_index', i).maybeSingle();
  let chapterId;
  if (existingCh) {
    chapterId = existingCh.id;
    log(`Chapter exists: ${ch.title}`);
  } else {
    // compute word count from doc nodes
    const allText = ch.content.content.map(node =>
      (node.content || []).map(c => c.text || '').join(' ')
    ).join(' ');
    const wordCount = allText.trim().split(/\s+/).filter(Boolean).length;
    const { data: chapter, error } = await db.from('chapters').insert({
      book_id: bookId,
      title: ch.title,
      content: ch.content,
      content_text: allText,
      order_index: i,
      status: 'published',
      word_count: wordCount,
      estimated_read_time_minutes: Math.max(1, Math.round(wordCount / 200)),
    }).select('id').single();
    if (error) throw new Error(`Create chapter: ${error.message}`);
    chapterId = chapter.id;
    log(`Created chapter: ${ch.title} (${wordCount} words)`);
  }
  chapterIds.push(chapterId);

  // Inline content items
  for (let j = 0; j < ch.formItems.length; j++) {
    const item = ch.formItems[j];
    const { data: existingItem } = await db.from('inline_content')
      .select('id')
      .eq('chapter_id', chapterId)
      .eq('content_type', item.content_type)
      .eq('anchor_text', item.anchor_text)
      .maybeSingle();
    if (existingItem) { log(`Item exists: ${item.anchor_text}`); continue; }

    const { error: ie } = await db.from('inline_content').insert({
      book_id: bookId,
      chapter_id: chapterId,
      content_type: item.content_type,
      anchor_text: item.anchor_text,
      content_data: item.content_data,
      start_offset: 0,
      end_offset: 0,
      created_by: authorId,
      is_author_content: true,
      visibility: 'all_readers',
      position_in_chapter: item.position,
      order_index: j,
    });
    if (ie) warn(`Item insert (${item.anchor_text}): ${ie.message}`);
    else log(`Created ${item.content_type}: ${item.anchor_text}`);
  }
}

step('Creating book club');
const CLUB_NAME = 'Discipleship Formation Circle';
const { data: existingClub } = await db.from('book_clubs').select('id').eq('name', CLUB_NAME).maybeSingle();
let clubId;
if (existingClub) {
  clubId = existingClub.id;
  log(`Club exists: ${CLUB_NAME}`);
} else {
  const { data: club, error: ce } = await db.from('book_clubs').insert({
    name: CLUB_NAME,
    description: 'A small group working through Discipleship in Practice together — using the interactive exercises for shared reflection and accountability.',
    visibility: 'private',
    max_members: 20,
    created_by: authorId,
  }).select('id').single();
  if (ce) throw new Error(`Create club: ${ce.message}`);
  clubId = club.id;
  await db.from('club_settings').upsert({
    club_id: clubId,
    enable_progress_tracking: true,
    show_member_reading_progress: true,
    show_member_answers: true,
  }, { onConflict: 'club_id' });
  await db.from('club_books').insert({ club_id: clubId, book_id: bookId, added_by: authorId, is_current: true });
  log(`Created club: ${CLUB_NAME}`);
}

const now = new Date().toISOString();
for (let i = 0; i < readerIds.length; i++) {
  const { data: ex } = await db.from('club_members').select('id').eq('club_id', clubId).eq('user_id', readerIds[i]).maybeSingle();
  if (!ex) {
    await db.from('club_members').insert({
      club_id: clubId, user_id: readerIds[i],
      invited_by: authorId, invited_email: READERS[i].email,
      role: 'member', invite_token: null,
      invite_accepted_at: now, joined_at: now,
    });
    log(`Added member: ${READERS[i].name}`);
  } else log(`Member exists: ${READERS[i].name}`);
}

step('Adding reading progress');
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

const progressRows = [
  { idx: 0, chIdx: 2, startDays: 14, pct: 100 },
  { idx: 1, chIdx: 2, startDays: 11, pct: 100 },
  { idx: 2, chIdx: 1, startDays:  8, pct:  67 },
  { idx: 3, chIdx: 1, startDays:  6, pct:  67 },
  { idx: 4, chIdx: 0, startDays:  3, pct:  33 },
];
for (const r of progressRows) {
  const isLast = r.chIdx === chapterIds.length - 1;
  await db.from('reading_progress').upsert({
    user_id: readerIds[r.idx],
    book_id: bookId,
    current_chapter_id: chapterIds[r.chIdx],
    scroll_position: isLast ? 0.95 : Math.random() * 0.7,
    percent_complete: r.pct,
    last_read_at: daysAgo(rand(0, 3)),
    started_at: daysAgo(r.startDays),
    completed_at: r.pct === 100 ? daysAgo(rand(0, 2)) : null,
  }, { onConflict: 'user_id,book_id' });
  log(`Progress: ${READERS[r.idx].name} → ${r.pct}%`);
}

step('Adding sample form responses (first 2 readers)');

// Fetch all inline content for this book
const { data: allItems } = await db.from('inline_content')
  .select('id, content_type, chapter_id, anchor_text')
  .eq('book_id', bookId)
  .eq('is_author_content', true);

const textboxAnswers = [
  'Anna', 'Thomas',
];
const textareaAnswers = [
  'Reading Psalm 139 this morning felt less like comfort and more like exposure. The idea that God already sees everything I try to hide is unsettling before it is reassuring. But I think that unsettled feeling is the beginning of something honest.',
  'I want to say it is comforting, but honestly my first reaction is a kind of low-grade anxiety. Being known completely means my failures are not hidden. The psalm keeps insisting this is love, not judgment. I am trying to receive it that way.',
];
const reflectionAnswers = [
  'Anger has been that area for me — the low-level irritability that surfaces with my kids at the end of a long day. I know it is there, but I haven\'t brought it to God because I am embarrassed by how petty it seems. Writing this down helps.',
  'Ambition. I want to succeed for God\'s glory, but I honestly can\'t always tell where God\'s glory ends and my own reputation begins. I have been afraid that if I bring it to God honestly, I will have to change more than I want to.',
];

for (let i = 0; i < 2; i++) {
  const uid = readerIds[i];
  for (const item of allItems) {
    if (item.content_type === 'poll') {
      const { data: ex } = await db.from('poll_responses').select('id')
        .eq('inline_content_id', item.id).eq('user_id', uid).maybeSingle();
      if (!ex) {
        // find options from the inline content
        const { data: ic } = await db.from('inline_content').select('content_data').eq('id', item.id).single();
        const opts = ic?.content_data?.options || [];
        if (opts.length) {
          await db.from('poll_responses').insert({
            inline_content_id: item.id, user_id: uid,
            selected_option: opts[rand(0, opts.length - 1)].id,
          });
          log(`Poll vote: ${READERS[i].name} → ${item.anchor_text}`);
        }
      }
    } else if (item.content_type === 'question') {
      const { data: ex } = await db.from('question_answers').select('id')
        .eq('inline_content_id', item.id).eq('user_id', uid).maybeSingle();
      if (!ex) {
        await db.from('question_answers').insert({
          inline_content_id: item.id, user_id: uid,
          answer_text: reflectionAnswers[i % reflectionAnswers.length],
        });
        log(`Question answer: ${READERS[i].name} → ${item.anchor_text}`);
      }
    } else if (item.content_type === 'textbox' && item.anchor_text === 'Your Name') {
      const { data: ex } = await db.from('form_responses').select('id')
        .eq('inline_content_id', item.id).eq('user_id', uid).maybeSingle();
      if (!ex) {
        await db.from('form_responses').insert({
          inline_content_id: item.id, user_id: uid,
          response_data: { value: textboxAnswers[i] },
        });
        log(`Form response: ${READERS[i].name} → ${item.anchor_text}`);
      }
    } else if (item.content_type === 'textarea') {
      const { data: ex } = await db.from('form_responses').select('id')
        .eq('inline_content_id', item.id).eq('user_id', uid).maybeSingle();
      if (!ex) {
        await db.from('form_responses').insert({
          inline_content_id: item.id, user_id: uid,
          response_data: { value: textareaAnswers[i % textareaAnswers.length] },
        });
        log(`Textarea response: ${READERS[i].name} → ${item.anchor_text}`);
      }
    }
  }
}

step('Verification');
const { data: finalBook } = await db.from('books').select('id, title, cover_image_url').eq('id', bookId).single();
const { data: finalChapters } = await db.from('chapters').select('id, title, status').eq('book_id', bookId).order('order_index');
const { data: finalItems } = await db.from('inline_content').select('id, content_type').eq('book_id', bookId);
const { data: finalProgress } = await db.from('reading_progress').select('user_id, percent_complete').eq('book_id', bookId);
const { data: finalResponses } = await db.from('form_responses').select('id').in('inline_content_id', finalItems.map(i => i.id));
const { data: finalPolls } = await db.from('poll_responses').select('id').in('inline_content_id', finalItems.map(i => i.id));
const { data: finalAnswers } = await db.from('question_answers').select('id').in('inline_content_id', finalItems.map(i => i.id));

console.log('\n── Results ──────────────────────────────────────────────');
console.log(`Book:        ${finalBook.title}`);
console.log(`Cover:       ${finalBook.cover_image_url}`);
console.log(`Chapters:    ${finalChapters.length} (${finalChapters.map(c => c.status).join(', ')})`);
console.log(`Form items:  ${finalItems.length} (${[...new Set(finalItems.map(i => i.content_type))].join(', ')})`);
console.log(`Readers:     ${finalProgress.length} with progress`);
console.log(`Responses:   ${finalResponses.length} form + ${finalPolls.length} poll votes + ${finalAnswers.length} answers`);
console.log('\n✅ Done');
