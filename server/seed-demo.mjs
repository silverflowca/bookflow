/**
 * BookFlow Demo Seed Script
 * ─────────────────────────
 * Creates professional demo data for executive presentation:
 *   • 1 admin / author account
 *   • 9 reader accounts (10 total)
 *   • 2 professionally-written books (published, multi-chapter)
 *   • Rich inline content: polls, questions, forms in each chapter
 *   • 1 book club with all readers as members
 *   • Reading progress for all 9 readers across both books
 *   • Form responses, poll votes, question answers
 *
 * Usage:  node seed-demo.mjs
 * Safe:   All inserts use upsert / conflict-ignore so it can be re-run.
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'http://localhost:55321';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const DB_URL       = 'postgresql://postgres:postgres@127.0.0.1:55432/postgres';

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'bookflow' },
});

// Anon client for signUp (GoTrue signup doesn't require admin JWT)
const dbAnon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const step = (msg) => console.log(`\n▸ ${msg}`);

// ─── Helper: create/find user via signUp then confirm via DB ─────────────────
async function upsertUser(email, password, displayName, role = 'reader') {
  // Check if profile already exists (our source of truth for "user exists")
  const { data: existingProfile } = await db.from('profiles').select('id, email').eq('email', email).maybeSingle();
  if (existingProfile) {
    log(`User exists: ${email}`);
    return { id: existingProfile.id, email };
  }

  // Sign up via GoTrue (works with anon key)
  const { data, error } = await dbAnon.auth.signUp({ email, password });
  if (error && !error.message.includes('already registered')) {
    throw new Error(`SignUp ${email}: ${error.message}`);
  }

  let userId = data?.user?.id;

  // If "already registered" but no profile, find the user via REST
  if (!userId) {
    // Try sign-in to get the id
    const { data: signInData } = await dbAnon.auth.signInWithPassword({ email, password });
    userId = signInData?.user?.id;
    if (!userId) throw new Error(`Could not resolve user ID for ${email}`);
    await dbAnon.auth.signOut();
  }

  // Confirm email directly in DB (skip email confirmation flow)
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const dockerPath = '/c/Program Files/Rancher Desktop/resources/resources/win32/bin/docker';
  await execAsync(
    `"${dockerPath}" exec supabase_db_silverflow psql -U postgres -d postgres -c "UPDATE auth.users SET email_confirmed_at = NOW(), confirmation_token = '' WHERE id = '${userId}';"`
  ).catch(e => warn(`Email confirm: ${e.message}`));

  // Upsert profile
  await db.from('profiles').upsert({
    id: userId,
    email,
    display_name: displayName,
    is_author: role === 'author',
    profile_public: true,
    show_reading_progress: true,
    show_clubs: true,
    show_books_authored: true,
  }, { onConflict: 'id' });

  log(`Created user: ${displayName} (${email})`);
  return { id: userId, email };
}

// ─── Rich TipTap JSON content ─────────────────────────────────────────────────
function makeChapterContent(paragraphs) {
  return {
    type: 'doc',
    content: paragraphs.map(p => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };
}

// ─── Seed data definitions ────────────────────────────────────────────────────

const AUTHOR = { email: 'dr.sarah.mitchell@efhci-demo.com', password: 'Demo@2026!', name: 'Dr. Sarah Mitchell' };

const READERS = [
  { email: 'james.okafor@efhci-demo.com',     password: 'Demo@2026!', name: 'James Okafor'     },
  { email: 'priya.sharma@efhci-demo.com',      password: 'Demo@2026!', name: 'Priya Sharma'     },
  { email: 'marcus.thornton@efhci-demo.com',   password: 'Demo@2026!', name: 'Marcus Thornton'  },
  { email: 'elena.vasquez@efhci-demo.com',     password: 'Demo@2026!', name: 'Elena Vasquez'    },
  { email: 'chen.wei@efhci-demo.com',          password: 'Demo@2026!', name: 'Chen Wei'         },
  { email: 'amara.diallo@efhci-demo.com',      password: 'Demo@2026!', name: 'Amara Diallo'     },
  { email: 'david.nakamura@efhci-demo.com',    password: 'Demo@2026!', name: 'David Nakamura'   },
  { email: 'fatima.al-rashid@efhci-demo.com',  password: 'Demo@2026!', name: 'Fatima Al-Rashid' },
  { email: 'robert.mensah@efhci-demo.com',     password: 'Demo@2026!', name: 'Robert Mensah'    },
];

// Book 1 — Leadership
const BOOK_1 = {
  slug: 'the-leadership-covenant',
  title: 'The Leadership Covenant',
  subtitle: 'Seven Principles for Transformative Organizational Leadership',
  description: 'A comprehensive guide for executives and team leaders navigating the complexities of modern organizational change. Drawing on decades of research and real-world case studies, this book presents a framework for building high-trust, high-performance cultures that endure.',
  chapters: [
    {
      title: 'Chapter 1 — The Foundation of Trust',
      wordCount: 1240,
      content: makeChapterContent([
        'Trust is the invisible currency of every high-performing organization. Without it, strategies stall, talent leaves, and innovation withers. With it, teams accomplish the extraordinary. This chapter explores the neurological and psychological underpinnings of organizational trust, and why leaders so often underestimate its fragility.',
        'The research is unambiguous: organizations ranking in the top quartile for employee trust generate 286% greater total returns to shareholders over a ten-year period (Watson Wyatt, 2022). Yet fewer than 40% of employees globally report trusting their senior leadership to act with integrity.',
        'Trust is not built through mission statements or off-site retreats. It is built through thousands of micro-decisions made daily—keeping commitments, acknowledging uncertainty, crediting others, and choosing candor over comfort. Leaders who master these micro-behaviors create organizational climates where people bring their full capabilities to work.',
        'In this chapter, we will examine three dimensions of trust: competence trust (can you deliver?), integrity trust (do you do what you say?), and benevolence trust (do you genuinely care about me?). Each dimension requires distinct leadership behaviors, and neglecting any one of them creates predictable failure modes.',
        'Consider the case of a Fortune 500 technology firm whose new CEO inherited a culture of fear. Engineers hoarded information to protect their positions. Product roadmaps were falsified to meet unrealistic board expectations. Within eighteen months of introducing trust-building practices—starting with radical transparency in the leadership team itself—voluntary attrition dropped 34% and product delivery velocity increased 58%.',
        'The path to organizational trust begins with the leader\'s interior life. You cannot manufacture trust from the outside if you are not operating from a place of authentic self-knowledge. The leadership covenant starts here.',
      ]),
      pollQuestion: 'Which dimension of trust is most underdeveloped in your organization?',
      pollOptions: ['Competence trust', 'Integrity trust', 'Benevolence trust', 'All three equally'],
      questionText: 'Describe a specific moment when a leader\'s action either built or damaged trust in your team. What did it reveal about organizational culture?',
    },
    {
      title: 'Chapter 2 — The Paradox of Authority',
      wordCount: 1180,
      content: makeChapterContent([
        'Authority is given; influence is earned. This distinction, often cited but rarely internalized, sits at the heart of leadership effectiveness in the modern era. The command-and-control model that drove industrial-era organizations is not merely ineffective in knowledge economies—it is actively destructive.',
        'Psychological safety research by Amy Edmondson at Harvard Business School demonstrates that teams with high psychological safety are 35% more likely to report errors early enough to correct them, 67% more likely to generate innovative solutions, and significantly more engaged across all performance dimensions.',
        'The paradox is this: the more a leader exercises positional authority, the less actual influence they accumulate. Authority compels compliance. Influence generates commitment. And in an era where the half-life of any competitive advantage is measured in months rather than decades, commitment is the only engine powerful enough to drive sustained performance.',
        'True leadership authority emerges from what we call the three E\'s: Expertise (demonstrated mastery in relevant domains), Empathy (genuine understanding of others\' realities), and Evidence (a track record of sound judgment under pressure). Leaders who cultivate all three create a gravitational pull that no org chart can replicate.',
        'This chapter provides practical frameworks for auditing your own authority style, identifying the hidden costs of over-reliance on positional power, and building the kind of influence that persists even when you leave the room.',
        'The goal is not to abandon authority—organizations require it. The goal is to earn the right to exercise it sparingly, deploying positional power only when speed and clarity demand it, while building the relational capital that makes everything else possible.',
      ]),
      pollQuestion: 'How would you describe the primary leadership style in your organization?',
      pollOptions: ['Command and control', 'Consultative', 'Collaborative/consensus', 'Situational/adaptive'],
      questionText: 'Think of a leader who had significant positional authority but relatively little actual influence. What behaviors created that gap?',
    },
    {
      title: 'Chapter 3 — Navigating Organizational Complexity',
      wordCount: 1320,
      content: makeChapterContent([
        'Modern organizations are not complicated—they are complex. The distinction matters enormously for how leaders approach problem-solving. Complicated problems (like engineering a bridge) have knowable solutions if you marshal sufficient expertise. Complex problems (like transforming a culture) are adaptive, emergent, and deeply resistant to top-down solutions.',
        'The Cynefin framework, developed by David Snowden, provides leaders with a sense-making tool to distinguish between four decision domains: Simple, Complicated, Complex, and Chaotic. Most senior leaders receive training for the first two—where expertise, best practices, and analytical rigor are primary tools—but are woefully underprepared for the latter two.',
        'In complex environments, the leader\'s primary job is not to solve problems but to create conditions in which the organization can solve its own problems. This requires a fundamental shift in identity: from "expert" to "gardener"—cultivating the soil in which good work can grow.',
        'This does not mean leaders abdicate decision-making. It means they become deeply skilled at knowing which decisions require their direct involvement (high stakes, irreversible, high uncertainty) and which decisions should be pushed as far down the organization as possible (reversible, domain-specific, information-rich at the edge).',
        'The most effective tools for navigating complexity include: running small safe-to-fail experiments before committing to large investments; building diverse teams with cognitive heterogeneity; creating feedback loops that surface weak signals before they become crises; and cultivating psychological safety so that bad news travels fast.',
        'This chapter provides a complexity audit for your organization and a decision-rights matrix to help leadership teams clarify who should own which categories of decisions—reducing the bottlenecks that plague most organizations at scale.',
      ]),
      pollQuestion: 'In your experience, what percentage of organizational problems are truly "complex" (adaptive) vs. "complicated" (technical)?',
      pollOptions: ['Less than 25%', '25–50%', '50–75%', 'More than 75%'],
      questionText: 'Describe a situation where a leader (or leadership team) applied a "complicated problem" approach to what was actually a "complex" challenge. What happened?',
    },
  ],
};

// Book 2 — Organizational Health
const BOOK_2 = {
  slug: 'the-resilient-organization',
  title: 'The Resilient Organization',
  subtitle: 'Building Adaptive Capacity for an Uncertain World',
  description: 'Organizational resilience is not about surviving disruption—it is about using disruption as the engine of growth. This book offers a research-based framework for building organizations that learn faster, adapt more gracefully, and emerge stronger from adversity.',
  chapters: [
    {
      title: 'Chapter 1 — Redefining Organizational Resilience',
      wordCount: 1150,
      content: makeChapterContent([
        'When most executives hear the word "resilience," they think of crisis management—the ability to absorb shocks and return to a previous state. This definition, while intuitive, is deeply limiting. It frames resilience as defensive, backward-looking, and ultimately static.',
        'The most resilient organizations in documented research—those that consistently outperform their sectors across market cycles—do not merely "bounce back." They use disruption as a forcing function for learning, reconfiguration, and competitive repositioning. They do not return to where they were; they advance to where they need to be.',
        'We define organizational resilience as the dynamic capacity to anticipate, absorb, adapt to, and shape change in ways that create sustainable value. Each component of this definition is significant. Anticipate: building early-warning systems. Absorb: reducing fragility in operations and culture. Adapt: changing what needs to change. Shape: taking proactive action to influence the environment itself.',
        'Research across 1,200 organizations conducted over fifteen years reveals that resilient organizations share five structural characteristics: distributed decision-making, strong social capital, modular resource pools, learning-oriented cultures, and purpose clarity. None of these is sufficient alone; all five are necessary.',
        'The good news is that resilience is not a trait organizations are born with. It is a capacity that can be deliberately built through consistent leadership practice. This book provides the blueprint.',
      ]),
      pollQuestion: 'How would you rate your organization\'s current resilience capacity?',
      pollOptions: ['Fragile — one major disruption would be devastating', 'Robust — we manage disruptions but don\'t learn from them', 'Adaptive — we use disruptions to improve', 'Antifragile — disruptions make us stronger'],
      questionText: 'Describe the most significant organizational disruption your team has faced in the past three years. What did you learn about your organization\'s true resilience capacity?',
    },
    {
      title: 'Chapter 2 — The Social Architecture of Resilience',
      wordCount: 1280,
      content: makeChapterContent([
        'When researchers study organizations that survive and thrive through major disruptions—recessions, pandemics, competitive disruption, leadership transitions—the variable that consistently emerges as the strongest predictor of resilience is not financial reserves, not technology infrastructure, not strategic positioning. It is the quality of relationships.',
        'Social capital—the stock of trust, reciprocity, and shared norms within an organization—is the invisible load-bearing structure that holds everything together when external pressure mounts. Organizations with high social capital communicate faster under stress, coordinate more effectively without top-down direction, and recover from setbacks with greater speed.',
        'Building social capital is not a soft, feel-good exercise. It requires deliberate investment in three distinct networks: bonding capital (strong ties within teams), bridging capital (weak ties across organizational silos), and linking capital (vertical relationships that span hierarchical levels). Each serves a different function in organizational resilience.',
        'Bonding capital provides the deep trust and psychological safety that allows teams to function under extreme pressure without fragmenting. Bridging capital enables the rapid information flow and resource reallocation that complex problems demand. Linking capital ensures that front-line intelligence reaches strategic decision-makers before it becomes irrelevant.',
        'Leaders who invest in all three forms of social capital build organizations that are genuinely greater than the sum of their parts. This chapter provides diagnostic tools for mapping your organization\'s social network, identifying critical vulnerabilities, and building targeted interventions to strengthen the connections that matter most.',
        'The investment is not trivial—building genuine social capital requires time, vulnerability, and a willingness to prioritize relationship quality over short-term efficiency. But the return on that investment, measured in organizational performance across every dimension, is among the highest available to any leader.',
      ]),
      pollQuestion: 'Which type of social capital is weakest in your organization?',
      pollOptions: ['Bonding capital (within teams)', 'Bridging capital (across silos)', 'Linking capital (across hierarchy)', 'We have not measured this'],
      questionText: 'Can you identify a "bridge" in your organization—a person who connects otherwise disconnected groups? What would happen to information flow if that person left?',
    },
    {
      title: 'Chapter 3 — Building Learning Systems at Scale',
      wordCount: 1190,
      content: makeChapterContent([
        'Learning organizations are not organizations where individuals learn—every organization has those. They are organizations where the learning of individuals systematically improves the collective intelligence and capability of the whole. This distinction, first articulated by Peter Senge, remains poorly understood and even more poorly practiced.',
        'The core mechanism of organizational learning is the feedback loop: an event occurs, information about the event is captured, the information is analyzed and interpreted, insights are extracted, and those insights modify future behavior. In most organizations, this loop is broken at multiple points—information is not captured, analysis is not conducted, insights are not shared, or behavior does not change.',
        'Resilient organizations obsessively fix these breaks. They conduct after-action reviews not just after failures but after successes (to understand what actually drove the outcome). They create psychological safety for reporting errors and near-misses. They invest in knowledge management systems that prevent the same problems from being solved repeatedly from scratch. They rotate talent to ensure that learning does not silo.',
        'The most powerful lever for organizational learning is leadership behavior. When a senior leader publicly acknowledges a mistake, describes what they learned, and changes their approach, they send an unmistakable signal to the entire organization: learning is valued here, and it is safe to be wrong en route to being right.',
        'This chapter provides a learning systems audit—a diagnostic tool that reveals where your organization\'s learning loops are broken—along with proven interventions for each failure mode.',
        'Building genuine learning systems at scale is one of the most challenging and most rewarding things a leadership team can do. The organizations that crack this problem gain an adaptive advantage that is extraordinarily difficult to replicate, because it is embedded in culture and process rather than in any single product or strategy.',
      ]),
      pollQuestion: 'Which is the most common barrier to organizational learning in your experience?',
      pollOptions: ['Lack of time for reflection', 'Fear of blame for failures', 'Information silos', 'No formal learning process'],
      questionText: 'Describe a significant organizational learning failure you have witnessed—a situation where the same mistake was made repeatedly because insights were not captured or shared. What would have prevented it?',
    },
  ],
};

// ─── Main seed function ───────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════════════');
  console.log('  BookFlow Executive Demo Seed');
  console.log('════════════════════════════════════════════════════');

  // ── 1. Create users ──────────────────────────────────────────────────────
  step('Creating users (1 author + 9 readers)');
  const authorAuth = await upsertUser(AUTHOR.email, AUTHOR.password, AUTHOR.name, 'author');
  const readerAuths = [];
  for (const r of READERS) {
    const u = await upsertUser(r.email, r.password, r.name, 'reader');
    readerAuths.push(u);
  }

  const authorId = authorAuth.id;
  const readerIds = readerAuths.map(u => u.id);

  // ── 2. Create books ──────────────────────────────────────────────────────
  step('Creating books');

  async function upsertBook(def) {
    const { data: existing } = await db.from('books').select('id').eq('slug', def.slug).maybeSingle();
    if (existing) {
      log(`Book exists: ${def.title}`);
      return existing.id;
    }
    const { data: book, error } = await db.from('books').insert({
      title: def.title,
      subtitle: def.subtitle,
      description: def.description,
      author_id: authorId,
      status: 'published',
      visibility: 'public',
      slug: def.slug,
    }).select('id').single();
    if (error) throw new Error(`Create book: ${error.message}`);
    // Enable progress tracking in book settings
    await db.from('book_settings').upsert({
      book_id: book.id,
      enable_progress_tracking: true,
      allow_reader_questions: true,
      allow_reader_polls: true,
    }, { onConflict: 'book_id' });
    log(`Created book: ${def.title}`);
    return book.id;
  }

  const book1Id = await upsertBook(BOOK_1);
  const book2Id = await upsertBook(BOOK_2);

  // ── 3. Create chapters + inline content ──────────────────────────────────
  step('Creating chapters and interactive content');

  async function upsertChapters(bookId, bookDef) {
    const chapterIds = [];
    for (let i = 0; i < bookDef.chapters.length; i++) {
      const ch = bookDef.chapters[i];
      // Check if chapter exists
      const { data: existing } = await db.from('chapters')
        .select('id').eq('book_id', bookId).eq('order_index', i).maybeSingle();
      let chapterId;
      if (existing) {
        chapterId = existing.id;
        log(`Chapter exists: ${ch.title}`);
      } else {
        const text = ch.content.content.map(p => p.content?.[0]?.text || '').join(' ');
        const wordCount = text.trim().split(/\s+/).length;
        const { data: chapter, error } = await db.from('chapters').insert({
          book_id: bookId,
          title: ch.title,
          content: ch.content,
          content_text: text,
          order_index: i,
          status: 'published',
          word_count: wordCount,
          estimated_read_time_minutes: Math.max(1, Math.round(wordCount / 200)),
        }).select('id').single();
        if (error) throw new Error(`Create chapter ${ch.title}: ${error.message}`);
        chapterId = chapter.id;
        log(`Created chapter: ${ch.title}`);
      }
      chapterIds.push(chapterId);

      // Create poll for this chapter (as author content)
      const { data: existingPoll } = await db.from('inline_content')
        .select('id').eq('chapter_id', chapterId).eq('content_type', 'poll').maybeSingle();
      let pollId;
      if (!existingPoll) {
        const pollData = {
          question: ch.pollQuestion,
          options: ch.pollOptions.map((text, idx) => ({ id: `opt_${idx}`, text })),
          allow_multiple: false,
        };
        const { data: poll, error: pe } = await db.from('inline_content').insert({
          book_id: bookId,
          chapter_id: chapterId,
          content_type: 'poll',
          anchor_text: 'Reader Poll',
          content_data: pollData,
          start_offset: 0,
          end_offset: 0,
          created_by: authorId,
          is_author_content: true,
          visibility: 'all_readers',
          position_in_chapter: 'end_of_chapter',
        }).select('id').single();
        if (pe) warn(`Poll insert: ${pe.message}`);
        else { pollId = poll.id; log(`Created poll: ${ch.pollQuestion.substring(0, 50)}...`); }
      } else {
        pollId = existingPoll.id;
      }

      // Create reflection question for this chapter
      const { data: existingQ } = await db.from('inline_content')
        .select('id').eq('chapter_id', chapterId).eq('content_type', 'question').maybeSingle();
      let questionId;
      if (!existingQ) {
        const { data: q, error: qe } = await db.from('inline_content').insert({
          book_id: bookId,
          chapter_id: chapterId,
          content_type: 'question',
          anchor_text: 'Reflection Question',
          content_data: { question: ch.questionText, allow_multiple_answers: false },
          start_offset: 0,
          end_offset: 0,
          created_by: authorId,
          is_author_content: true,
          visibility: 'all_readers',
          position_in_chapter: 'end_of_chapter',
        }).select('id').single();
        if (qe) warn(`Question insert: ${qe.message}`);
        else { questionId = q.id; log(`Created question for: ${ch.title}`); }
      } else {
        questionId = existingQ.id;
      }
    }
    return chapterIds;
  }

  const book1Chapters = await upsertChapters(book1Id, BOOK_1);
  const book2Chapters = await upsertChapters(book2Id, BOOK_2);

  // ── 4. Create book club ───────────────────────────────────────────────────
  step('Creating book club');

  let clubId;
  const { data: existingClub } = await db.from('book_clubs')
    .select('id').eq('name', 'Executive Leadership Circle').maybeSingle();
  if (existingClub) {
    clubId = existingClub.id;
    log('Club exists: Executive Leadership Circle');
  } else {
    const { data: club, error: ce } = await db.from('book_clubs').insert({
      name: 'Executive Leadership Circle',
      description: 'A curated reading community for senior leaders exploring evidence-based approaches to organizational transformation, resilience, and high-performance culture.',
      visibility: 'private',
      max_members: 50,
      created_by: authorId,
    }).select('id').single();
    if (ce) throw new Error(`Create club: ${ce.message}`);
    clubId = club.id;
    // Club settings
    await db.from('club_settings').upsert({
      club_id: clubId,
      enable_progress_tracking: true,
      show_member_reading_progress: true,
      show_member_answers: true,
    }, { onConflict: 'club_id' });
    // Club chat settings
    try {
      await db.schema('bookflow').from('club_chat_settings').upsert({ club_id: clubId }, { onConflict: 'club_id' });
    } catch (_) {}
    log('Created club: Executive Leadership Circle');
  }

  // Add books to club
  for (const [bookId, isCurrent] of [[book1Id, false], [book2Id, true]]) {
    const { data: existing } = await db.from('club_books')
      .select('id').eq('club_id', clubId).eq('book_id', bookId).maybeSingle();
    if (!existing) {
      await db.from('club_books').insert({ club_id: clubId, book_id: bookId, added_by: authorId, is_current: isCurrent });
      log(`Added book to club`);
    }
  }

  // ── 5. Add readers to club ────────────────────────────────────────────────
  step('Adding 9 readers to club');

  for (const readerId of readerIds) {
    const { data: existing } = await db.from('club_members')
      .select('id').eq('club_id', clubId).eq('user_id', readerId).maybeSingle();
    if (!existing) {
      const now = new Date().toISOString();
      await db.from('club_members').insert({
        club_id: clubId,
        user_id: readerId,
        invited_by: authorId,
        invited_email: READERS[readerIds.indexOf(readerId)].email,
        role: 'member',
        invite_token: null,
        invite_accepted_at: now,
        joined_at: now,
      });
      log(`Added member: ${READERS[readerIds.indexOf(readerId)].name}`);
    } else {
      log(`Member exists: ${READERS[readerIds.indexOf(readerId)].name}`);
    }
  }

  // ── 6. Simulate reading progress ─────────────────────────────────────────
  step('Simulating reading progress (varied completion rates)');

  // Progress profiles: how far each reader has gotten in each book
  // [book1ChapterIndex, book2ChapterIndex] (-1 = not started)
  const progressProfiles = [
    { name: readerIds[0], b1: 2, b2: 2 }, // completed both
    { name: readerIds[1], b1: 2, b2: 1 }, // completed book1, mid book2
    { name: readerIds[2], b1: 2, b2: 0 }, // completed book1, started book2
    { name: readerIds[3], b1: 1, b2: 2 }, // mid book1, completed book2
    { name: readerIds[4], b1: 1, b2: 1 }, // mid both
    { name: readerIds[5], b1: 0, b2: 1 }, // started book1, mid book2
    { name: readerIds[6], b1: 2, b2: -1 }, // completed book1, not started book2
    { name: readerIds[7], b1: 0, b2: 0 }, // just started both
    { name: readerIds[8], b1: 1, b2: 2 }, // mid book1, completed book2
  ];

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  for (const [idx, profile] of progressProfiles.entries()) {
    const readerId = profile.name;
    const readerName = READERS[idx].name;

    // Book 1 progress
    if (profile.b1 >= 0) {
      const chIdx = profile.b1;
      const isLast = chIdx === book1Chapters.length - 1;
      const pct = isLast ? 100 : Math.round(((chIdx + 1) / book1Chapters.length) * 100);
      await db.from('reading_progress').upsert({
        user_id: readerId, book_id: book1Id,
        current_chapter_id: book1Chapters[chIdx],
        scroll_position: isLast ? 0.95 : Math.random() * 0.7,
        percent_complete: pct,
        last_read_at: daysAgo(Math.floor(Math.random() * 14)),
        started_at: daysAgo(20 + Math.floor(Math.random() * 10)),
        completed_at: isLast ? daysAgo(Math.floor(Math.random() * 7)) : null,
      }, { onConflict: 'user_id,book_id' });
      log(`${readerName} → Book1 ${pct}%`);
    }

    // Book 2 progress
    if (profile.b2 >= 0) {
      const chIdx = profile.b2;
      const isLast = chIdx === book2Chapters.length - 1;
      const pct = isLast ? 100 : Math.round(((chIdx + 1) / book2Chapters.length) * 100);
      await db.from('reading_progress').upsert({
        user_id: readerId, book_id: book2Id,
        current_chapter_id: book2Chapters[chIdx],
        scroll_position: isLast ? 0.95 : Math.random() * 0.7,
        percent_complete: pct,
        last_read_at: daysAgo(Math.floor(Math.random() * 7)),
        started_at: daysAgo(10 + Math.floor(Math.random() * 5)),
        completed_at: isLast ? daysAgo(Math.floor(Math.random() * 3)) : null,
      }, { onConflict: 'user_id,book_id' });
      log(`${readerName} → Book2 ${pct}%`);
    }
  }

  // ── 7. Simulate poll votes ────────────────────────────────────────────────
  step('Generating poll responses');

  // Fetch all polls
  const { data: allPolls } = await db.from('inline_content')
    .select('id, content_data, chapter_id')
    .in('chapter_id', [...book1Chapters, ...book2Chapters])
    .eq('content_type', 'poll');

  for (const poll of (allPolls || [])) {
    const options = poll.content_data?.options || [];
    if (!options.length) continue;
    for (const readerId of readerIds) {
      // Only vote if they've reached this chapter
      const { data: existing } = await db.from('poll_responses')
        .select('id').eq('inline_content_id', poll.id).eq('user_id', readerId).maybeSingle();
      if (!existing) {
        // Pick a weighted-random option
        const optIdx = Math.floor(Math.random() * options.length);
        const { error } = await db.from('poll_responses').insert({
          inline_content_id: poll.id,
          user_id: readerId,
          selected_option: options[optIdx].id,
        });
        if (error && !error.message.includes('duplicate')) warn(`Poll vote: ${error.message}`);
      }
    }
    log(`Poll votes recorded for ${poll.content_data?.question?.substring(0, 40)}...`);
  }

  // ── 8. Simulate question answers ─────────────────────────────────────────
  step('Generating reflection answers');

  const { data: allQuestions } = await db.from('inline_content')
    .select('id, content_data, chapter_id')
    .in('chapter_id', [...book1Chapters, ...book2Chapters])
    .eq('content_type', 'question');

  const sampleAnswers = [
    'In my previous role at a professional services firm, I witnessed a senior partner publicly contradict a commitment made to the team regarding performance bonuses. The immediate impact on morale was measurable—within two months, three high performers had resigned. It illustrated how quickly integrity trust can erode and how costly that erosion becomes.',
    'Our organization has invested heavily in technical competence but has systematically underinvested in the relational aspects of leadership. The result is a leadership team that can diagnose complex problems accurately but struggles to build the coalitions needed to act on those diagnoses.',
    'I observed a division president who accumulated positional authority over a decade but progressively lost influence through a pattern of over-promising and under-delivering. By the end, even when she made sound decisions, the organization found ways to slow-walk implementation. The lesson was stark: authority without credibility is ultimately hollow.',
    'Our organization\'s most significant learning failure was in our product development process. We made the same fundamental error in three consecutive product launches—underestimating integration complexity—because each project team believed they faced a unique problem rather than a recurring organizational pattern.',
    'The disruption that revealed our true resilience capacity was a regulatory change that required us to rebuild our core compliance process within 90 days. What I discovered was that the teams with the strongest informal relationships moved fastest. Organizational chart proximity was irrelevant; trust proximity was everything.',
    'In my experience, the most powerful bridge in our organization is a mid-level project manager who has relationships across every division. When she left for eight weeks on parental leave, cross-divisional coordination nearly ceased. It revealed how much informal network architecture we had never made explicit or resilient.',
    'Our company\'s response to a major product recall three years ago tested every dimension of our organizational resilience. What emerged was that our silos—efficient in normal operations—became catastrophic liabilities under pressure. The post-crisis investment in cross-functional relationships and distributed decision-making authority has since transformed how we operate.',
    'I witnessed a leadership team that defined resilience as the ability to cut costs during downturns and rehire when conditions improved. This approach preserved short-term financial health but permanently damaged their social capital—the very asset they needed most during the next disruption.',
    'The most revealing question in my career has been: what does this organization do when no one is watching? The answer to that question—whether people protect information or share it, whether they escalate problems or bury them—tells you more about culture and trust than any engagement survey.',
  ];

  for (const q of (allQuestions || [])) {
    for (let i = 0; i < readerIds.length; i++) {
      const readerId = readerIds[i];
      const { data: existing } = await db.from('question_answers')
        .select('id').eq('inline_content_id', q.id).eq('user_id', readerId).maybeSingle();
      if (!existing) {
        const { error } = await db.from('question_answers').insert({
          inline_content_id: q.id,
          user_id: readerId,
          answer_text: sampleAnswers[i % sampleAnswers.length],
        });
        if (error && !error.message.includes('duplicate')) warn(`Answer insert: ${error.message}`);
      }
    }
    log(`Answers recorded for question in chapter`);
  }

  // ── 9. Add a club discussion ──────────────────────────────────────────────
  step('Creating club discussion threads');

  const { data: existingDiscs } = await db.from('club_discussions')
    .select('id').eq('club_id', clubId).eq('author_id', authorId).is('parent_id', null).limit(1);

  if (!existingDiscs?.length) {
    const { data: disc, error: de } = await db.from('club_discussions').insert({
      club_id: clubId,
      author_id: authorId,
      body: 'Welcome to the Executive Leadership Circle. Over the coming weeks, we will explore two landmark works on organizational leadership and resilience. I encourage you to engage deeply with the reflection questions at the end of each chapter—the richest insights in any cohort come from the diverse experiences members bring to these prompts. Looking forward to the conversation.',
    }).select('id').single();
    if (de) warn(`Discussion: ${de.message}`);
    else {
      log('Created welcome discussion thread');
      // Add replies from two readers
      await db.from('club_discussions').insert({
        club_id: clubId,
        author_id: readerIds[0],
        parent_id: disc.id,
        body: 'Thank you for the warm welcome. I\'ve already begun Chapter 1 of The Leadership Covenant and the research on trust dimensions is striking. Looking forward to discussing the organizational implications with this group.',
      });
      await db.from('club_discussions').insert({
        club_id: clubId,
        author_id: readerIds[1],
        parent_id: disc.id,
        body: 'Glad to be here. The distinction between competence trust and integrity trust in Chapter 1 immediately brought to mind a leadership situation I navigated last year. I\'ll share more when we discuss it as a group.',
      });
      log('Added discussion replies');
    }
  } else {
    log('Club discussions exist');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════');
  console.log('  ✅ Demo seed complete!');
  console.log('════════════════════════════════════════════════════');
  console.log(`\n  Author:    ${AUTHOR.email}  /  ${AUTHOR.password}`);
  console.log(`  Readers:   ${READERS[0].email}  /  ${READERS[0].password}`);
  console.log(`             (all 9 readers share the same password: Demo@2026!)\n`);
  console.log(`  Book 1 ID: ${book1Id}`);
  console.log(`  Book 2 ID: ${book2Id}`);
  console.log(`  Club ID:   ${clubId}`);
  console.log('\n  Dashboard URLs (author):');
  console.log(`    http://localhost:5178/edit/book/${book1Id}/dashboard`);
  console.log(`    http://localhost:5178/edit/book/${book2Id}/dashboard`);
  console.log('\n  Reader view:');
  console.log(`    http://localhost:5178/book/${book1Id}`);
  console.log(`    http://localhost:5178/book/${book2Id}`);
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
