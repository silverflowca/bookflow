/**
 * BookFlow Demo Seed — Part 2
 * ─────────────────────────────────────────────────────────────────────────────
 * Adds two more book themes based on real partner organizations:
 *
 *   Freedom Bus PEI  — homeless outreach / emergency shelter ministry
 *   Red Rock Revival Ranch — faith-based addiction & recovery ministry
 *
 * Each book set comes with 5 dedicated readers and its own book club.
 *
 * Usage:  node seed-demo-2.mjs
 * Safe:   All inserts use upsert / conflict-ignore so it can be re-run.
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

// ─── Helper: create / find user ───────────────────────────────────────────────
async function upsertUser(email, password, displayName, role = 'reader') {
  const { data: existing } = await db.from('profiles').select('id, email').eq('email', email).maybeSingle();
  if (existing) { log(`User exists: ${email}`); return { id: existing.id, email }; }

  const { data, error } = await dbAnon.auth.signUp({ email, password });
  if (error && !error.message.includes('already registered')) {
    throw new Error(`SignUp ${email}: ${error.message}`);
  }

  let userId = data?.user?.id;
  if (!userId) {
    const { data: si } = await dbAnon.auth.signInWithPassword({ email, password });
    userId = si?.user?.id;
    if (!userId) throw new Error(`Could not resolve user ID for ${email}`);
    await dbAnon.auth.signOut();
  }

  // Confirm email via Docker → psql
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const dockerPath = '/c/Program Files/Rancher Desktop/resources/resources/win32/bin/docker';
  await execAsync(
    `"${dockerPath}" exec supabase_db_silverflow psql -U postgres -d postgres -c "UPDATE auth.users SET email_confirmed_at = NOW(), confirmation_token = '' WHERE id = '${userId}';"`
  ).catch(e => warn(`Email confirm: ${e.message}`));

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

// ─── TipTap JSON helper ────────────────────────────────────────────────────────
function makeChapterContent(paragraphs) {
  return {
    type: 'doc',
    content: paragraphs.map(p => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };
}

// ─── People ──────────────────────────────────────────────────────────────────

// Shared author from seed-demo (already exists — will be re-used)
const AUTHOR = {
  email: 'dr.sarah.mitchell@efhci-demo.com',
  password: 'Demo@2026!',
  name: 'Dr. Sarah Mitchell',
};

// 5 readers for the Freedom Bus books
const FREEDOM_READERS = [
  { email: 'pastor.linda.cross@efhci-demo.com',   password: 'Demo@2026!', name: 'Pastor Linda Cross'   },
  { email: 'tobias.grant@efhci-demo.com',          password: 'Demo@2026!', name: 'Tobias Grant'         },
  { email: 'michelle.beaumont@efhci-demo.com',     password: 'Demo@2026!', name: 'Michelle Beaumont'    },
  { email: 'samuel.osei@efhci-demo.com',           password: 'Demo@2026!', name: 'Samuel Osei'          },
  { email: 'nadia.kowalski@efhci-demo.com',        password: 'Demo@2026!', name: 'Nadia Kowalski'       },
];

// 5 readers for the Red Rock Revival books
const REDROCK_READERS = [
  { email: 'pastor.derek.hayes@efhci-demo.com',   password: 'Demo@2026!', name: 'Pastor Derek Hayes'   },
  { email: 'carla.renner@efhci-demo.com',          password: 'Demo@2026!', name: 'Carla Renner'         },
  { email: 'joseph.whitehorse@efhci-demo.com',     password: 'Demo@2026!', name: 'Joseph Whitehorse'    },
  { email: 'grace.nkemelu@efhci-demo.com',         password: 'Demo@2026!', name: 'Grace Nkemelu'        },
  { email: 'brendan.mcallister@efhci-demo.com',    password: 'Demo@2026!', name: 'Brendan McAllister'   },
];

// ─── Book 3 — Freedom Bus ─────────────────────────────────────────────────────
const BOOK_3 = {
  slug: 'mobile-mercy-freedom-bus',
  title: 'Mobile Mercy',
  subtitle: 'How a Converted Coach Bus Is Redefining Emergency Shelter Ministry in Prince Edward Island',
  description: 'An inside look at Freedom Bus PEI—a faith-driven initiative that converted a coach bus into a 12-bunk mobile shelter to serve those experiencing homelessness and crisis across Prince Edward Island. This book explores the vision, the volunteer culture, the spiritual foundation, and the practical lessons learned from frontline compassion ministry.',
  chapters: [
    {
      title: 'Chapter 1 — A Bus Full of Hope',
      content: makeChapterContent([
        'On a cold November evening in Charlottetown, a converted coach bus pulls into a quiet side street. Inside, twelve bunk beds are made up with fresh linens. A kettle boils. A volunteer arranges donated toiletry kits on a small shelf. Within an hour, every bed is occupied.',
        'This is Freedom Bus PEI—a ministry born from a simple conviction: that no one in Prince Edward Island should face the night without shelter, and that the church has both the calling and the capacity to do something about it.',
        'The idea began with a small group of believers who were troubled by the gap between the island\'s visible need and its available shelter resources. PEI\'s shelter infrastructure, while growing, had not kept pace with the increasing visibility of homelessness in urban and rural communities alike. Rather than wait for institutional solutions, the Freedom Bus team chose to act.',
        'Converting a commercial coach bus into a mobile emergency shelter is no small undertaking. The project required engineering consultants, donated labour from local tradespeople, and thousands of volunteer hours. But the most remarkable feature of Freedom Bus is not the bus itself—it is the network of relationships that makes it run.',
        'The ministry is built on three commitments: showing up (presence), meeting immediate need (provision), and offering genuine relationship (belonging). These three commitments, simple as they sound, require enormous organizational discipline and spiritual depth to sustain over time.',
        'In this chapter, we trace the origins of Freedom Bus PEI, the key decisions that shaped its first years of operation, and the theological convictions that animate every aspect of its work. We also introduce the volunteers and staff whose stories illuminate what it actually means to proclaim freedom for those in bondage through the love, mercy, and provision of Jesus Christ.',
      ]),
      pollQuestion: 'What first drew you to compassion ministry or frontline community work?',
      pollOptions: [
        'A personal experience with poverty or crisis',
        'A sermon or Scripture that convicted me',
        'Watching someone else model it',
        'A gradual sense of calling over time',
      ],
      questionText: 'Describe an encounter with someone experiencing homelessness or crisis that changed how you see this ministry. What shifted in you?',
    },
    {
      title: 'Chapter 2 — The Volunteer Culture That Makes It Work',
      content: makeChapterContent([
        'Volunteer-driven ministries face a paradox: they depend entirely on the generosity of people who are not paid, yet they must deliver services that are consistent, compassionate, and competent. Freedom Bus PEI has navigated this paradox by building one of the most intentional volunteer cultures of any faith-based organization in Atlantic Canada.',
        'At the heart of that culture is a commitment to thorough preparation. Freedom Bus volunteers do not simply show up and serve—they go through a structured orientation that covers trauma-informed care, de-escalation techniques, boundary-setting, and the theology of presence. The organization believes that good intentions without good preparation can cause harm, and it takes that responsibility seriously.',
        'The ministry operates across multiple volunteer team roles: overnight shelter hosts, transportation volunteers, intake and needs assessment, donation management, prayer and intercession, and community awareness. Each role is carefully defined and intentionally recruited. The result is a distributed leadership model in which authority is genuinely shared.',
        'The Freedom Bus volunteer culture is also shaped by a deep commitment to mutual care. The emotional weight of frontline shelter work is real. Volunteers encounter acute human suffering, complex addiction situations, and the slow heartbreak of watching individuals cycle through crisis repeatedly. Without intentional support structures—regular debriefs, spiritual care check-ins, clear boundaries—volunteer burnout is rapid.',
        'What Freedom Bus has learned about building volunteer capacity has implications far beyond the shelter sector. Any organization that asks people to give without demanding anything in return—and that sustains genuine community in the process—has cracked something fundamental about human motivation and meaning.',
        'This chapter explores the specific practices, rhythms, and leadership behaviours that have built a volunteer culture capable of showing up, night after night, in all weather, for people society has largely stopped seeing.',
      ]),
      pollQuestion: 'What is the most common reason volunteers disengage from compassion ministries over time?',
      pollOptions: [
        'Emotional exhaustion and secondary trauma',
        'Feeling underequipped for complex situations',
        'Lack of community with other volunteers',
        'Unclear role or expectations',
      ],
      questionText: 'What practices or structures in your own ministry or organization help sustain volunteers through emotionally demanding work? What is still missing?',
    },
    {
      title: 'Chapter 3 — The PEI Freedom Run and the Power of Public Witness',
      content: makeChapterContent([
        'In December 2025, Freedom Bus PEI organized the PEI Freedom Run—a multi-day awareness and fundraising initiative that traversed the entire island from Eastpoint to North Cape, passing through communities large and small along the way.',
        'The Freedom Run was not primarily a fundraiser, though it raised meaningful resources. It was an act of public witness: a declaration that homelessness is not an urban problem or an abstract statistic, but a lived reality that exists in every corner of Prince Edward Island, and that the community of faith intends to do something about it.',
        'Public witness of this kind serves several functions. It educates—many people encountered along the route were genuinely unaware of the scale of housing insecurity in their communities. It invites—dozens of new volunteers and donors were recruited through personal encounters during the run. And it models—by showing up in the public square with joy, generosity, and purpose, Freedom Bus communicates something about the nature of the God it serves.',
        'The theological underpinning of public witness in compassion ministry draws on a long tradition. The Hebrew prophets were not content to serve the poor quietly; they named injustice publicly and called communities to corporate accountability. The early church did not merely care for its own members; it was known throughout the Roman world for its radical generosity toward strangers.',
        'Freedom Bus has learned that public visibility, done well, is not self-promotion—it is invitation. When people see genuine, joyful, selfless service, something in them stirs. The Freedom Run created hundreds of such moments, and its effects continue to ripple outward.',
        'This chapter examines how Freedom Bus approaches community engagement and public awareness, the lessons learned from the Freedom Run, and the theological principles that guide their public witness. It also addresses the tensions that arise when compassion ministry becomes visible: the risk of performance, the temptation to scale beyond organizational capacity, and the discipline of remaining rooted in genuine relationship.',
      ]),
      pollQuestion: 'How does your organization currently engage the broader public with its mission?',
      pollOptions: [
        'Primarily through social media and digital content',
        'Through community events and public gatherings',
        'Mostly through word-of-mouth and personal relationships',
        'We are still developing our public engagement strategy',
      ],
      questionText: 'Describe a moment when your organization\'s public witness—being seen doing good—opened a door or changed a community relationship. What made it effective?',
    },
  ],
};

// ─── Book 4 — Red Rock Revival ────────────────────────────────────────────────
const BOOK_4 = {
  slug: 'where-hope-finds-you',
  title: 'Where Hope Finds You',
  subtitle: 'Recovery, Redemption, and Restoration at Red Rock Revival Ranch',
  description: 'Red Rock Revival Ranch is a faith-based recovery ministry in Nova Scotia operating on a simple but radical premise: that healing is possible for anyone, that families can be restored, and that communities are made stronger when broken people are given a genuine path forward. This book explores the H.O.P.E. framework—Healing, Opportunity, Purpose, Employment—that guides the ranch\'s holistic approach to addiction recovery, mental health trauma, and life crisis.',
  chapters: [
    {
      title: 'Chapter 1 — The Whole Person: Why Fragmented Care Fails',
      content: makeChapterContent([
        'The history of addiction treatment is largely a history of fragmented care. The medical model addresses the physical dimensions of substance dependence but often leaves the emotional, relational, and spiritual dimensions untouched. The counselling model addresses the psychological roots of addictive behaviour but may ignore the physical realities of withdrawal and neurological rewiring. The faith community offers spiritual support but may lack the clinical tools to address trauma, co-occurring disorders, and the complex social determinants of addiction.',
        'Red Rock Revival Ranch was built on the conviction that fragmented care produces fragmented outcomes—and that genuine transformation requires an approach that addresses the whole person: body, mind, and spirit.',
        'The H.O.P.E. framework was developed over years of working directly with individuals in recovery and learning from their experiences of what helped and what failed. Healing addresses the physical and emotional dimensions—detoxification, trauma processing, emotional regulation, and the recovery of bodily health. Opportunity creates tangible pathways forward—education, skill-building, access to resources and networks that make re-entry into community life possible. Purpose identifies the meaningful direction that sustains sobriety long after the formal treatment period ends. Employment facilitates the economic independence that makes purpose sustainable.',
        'Each pillar of H.O.P.E. is necessary; none is sufficient alone. Healing without opportunity leaves people healthy but trapped. Opportunity without purpose produces momentum without direction. Purpose without employment creates vision without means. The ranch\'s approach holds all four in dynamic relationship.',
        'Central to the Red Rock model is the integration of professional clinical care, spiritual formation, and peer community support. These three streams reinforce each other in ways that no single stream can replicate. Clinical care provides tools and expertise. Spiritual formation provides meaning and power. Peer community provides accountability and belonging.',
        'This chapter examines why fragmented approaches to recovery consistently underperform, and how the whole-person model at Red Rock Revival Ranch was developed, tested, and refined through years of frontline experience.',
      ]),
      pollQuestion: 'Which dimension of recovery do you see most neglected in the approaches you have encountered?',
      pollOptions: [
        'Physical healing and neurological restoration',
        'Emotional and trauma processing',
        'Spiritual formation and meaning-making',
        'Social reintegration and community belonging',
      ],
      questionText: 'Describe a situation where you observed fragmented care failing someone in recovery or crisis. What single change would have made the most difference?',
    },
    {
      title: 'Chapter 2 — Faith as a Recovery Framework',
      content: makeChapterContent([
        'The role of faith in addiction recovery is among the most studied and most contested questions in the recovery literature. Secular clinicians sometimes view faith-based approaches with suspicion, concerned that spiritual frameworks will substitute for clinical evidence and harm vulnerable people. Faith communities sometimes view clinical approaches with similar suspicion, concerned that neurobiological and psychological models will displace the redemptive work of God.',
        'Red Rock Revival Ranch occupies a different position: one that holds clinical excellence and robust faith in genuine partnership, convinced that each makes the other more effective.',
        'The theological foundation of Red Rock\'s approach is not generic spirituality—it is specifically Christian, rooted in the conviction that Jesus Christ heals, restores, and redeems. The Holy Spirit is not a program element; the Spirit is understood as the primary agent of transformation, working through professional care, community relationships, Scripture engagement, prayer, and worship.',
        'At the same time, Red Rock takes clinical best practice seriously. The ranch employs trained counsellors, uses evidence-based therapeutic modalities, and maintains rigorous clinical standards. Faith does not substitute for clinical care; it undergirds it, contextualises it, and extends it into dimensions that clinical care alone cannot reach.',
        'What the research actually shows is consistent with this integrated approach. Meta-analyses of faith-based recovery programs consistently find that spiritual engagement—prayer, Scripture, worship, pastoral care—is associated with better long-term recovery outcomes, particularly in the domains of relapse prevention, social reconnection, and meaning-making. The mechanisms are both psychological (sense of purpose, community accountability) and, from the perspective of the ranch\'s leadership, genuinely supernatural.',
        'This chapter examines the theological and clinical basis of Red Rock\'s integrated approach, the specific spiritual practices that form the backbone of the recovery journey at the ranch, and the evidence that supports faith as a recovery framework.',
      ]),
      pollQuestion: 'How do you understand the relationship between clinical care and spiritual formation in recovery?',
      pollOptions: [
        'Clinical care is primary; spiritual support is supplemental',
        'Spiritual formation is primary; clinical care supports it',
        'Both are essential and genuinely equal partners',
        'This depends entirely on the individual\'s background and needs',
      ],
      questionText: 'Describe a moment when you observed faith make a demonstrable difference in someone\'s recovery journey—something that clinical approaches alone could not explain or produce.',
    },
    {
      title: 'Chapter 3 — Restoring Families, Rebuilding Communities',
      content: makeChapterContent([
        'Addiction rarely destroys only the individual. Its devastation radiates outward—through families, children, workplaces, friendships, and communities. The child who grows up in an addicted household carries wounds that shape their development, relationships, and own vulnerability to substance use. The spouse who has managed the chaos of active addiction for years carries exhaustion, grief, and often their own trauma. The community that has lost productive members to addiction bears economic, social, and spiritual costs that are rarely fully tallied.',
        'Red Rock Revival Ranch takes seriously the mission embedded in its tagline: Saving Lives. Restoring Families. Improving Communities. These are not sequential goals—they are simultaneous commitments.',
        'Family restoration at Red Rock begins with honest reckoning. Families of people in recovery often require their own healing process—therapeutic support for partners, parenting skills development, and space to grieve the losses that addiction has caused, before the possibility of genuine reconciliation can be explored. The ranch facilitates this process through family counselling, family education days, and structured reconciliation processes for those relationships that are ready for them.',
        'Community restoration is a longer arc. People in recovery who return to their communities without support structures typically relapse within weeks. Red Rock invests heavily in re-entry preparation—employment readiness, life skills, housing navigation, and the cultivation of new community relationships that are not entangled with previous using environments.',
        'The partnerships Red Rock has built with local employers, housing providers, churches, and community organizations are among the ranch\'s most strategic assets. These partnerships create the network of support that makes genuine community reintegration possible. They also embody the ranch\'s theological conviction that the whole community is implicated in both the problem of addiction and its solution.',
        'This chapter examines the family and community restoration dimensions of Red Rock\'s work, the specific programmes and partnerships that support re-entry, and the stories of individuals and families whose trajectories have been transformed by the ranch\'s holistic approach.',
      ]),
      pollQuestion: 'What is the most critical factor in successful community re-entry for someone leaving a recovery program?',
      pollOptions: [
        'Stable housing and economic security',
        'A new community of supportive relationships',
        'Continued clinical support and accountability',
        'Clear sense of purpose and meaningful work',
      ],
      questionText: 'What specific role can local churches and faith communities play in supporting people returning from recovery programs? What would it take for your own community to play that role well?',
    },
  ],
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════════════');
  console.log('  BookFlow Demo Seed — Part 2');
  console.log('  Freedom Bus PEI + Red Rock Revival Ranch');
  console.log('════════════════════════════════════════════════════');

  // ── 1. Ensure author exists (from seed-demo.mjs) ─────────────────────────
  step('Resolving author account');
  const authorAuth = await upsertUser(AUTHOR.email, AUTHOR.password, AUTHOR.name, 'author');
  const authorId = authorAuth.id;

  // ── 2. Create readers ─────────────────────────────────────────────────────
  step('Creating Freedom Bus readers (5)');
  const freedomReaderAuths = [];
  for (const r of FREEDOM_READERS) {
    freedomReaderAuths.push(await upsertUser(r.email, r.password, r.name, 'reader'));
  }
  const freedomReaderIds = freedomReaderAuths.map(u => u.id);

  step('Creating Red Rock Revival readers (5)');
  const redrockReaderAuths = [];
  for (const r of REDROCK_READERS) {
    redrockReaderAuths.push(await upsertUser(r.email, r.password, r.name, 'reader'));
  }
  const redrockReaderIds = redrockReaderAuths.map(u => u.id);

  // ── 3. Create books ───────────────────────────────────────────────────────
  step('Creating books');

  async function upsertBook(def) {
    const { data: existing } = await db.from('books').select('id').eq('slug', def.slug).maybeSingle();
    if (existing) { log(`Book exists: ${def.title}`); return existing.id; }
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
    await db.from('book_settings').upsert({
      book_id: book.id,
      enable_progress_tracking: true,
      allow_reader_questions: true,
      allow_reader_polls: true,
    }, { onConflict: 'book_id' });
    log(`Created book: ${def.title}`);
    return book.id;
  }

  const book3Id = await upsertBook(BOOK_3);
  const book4Id = await upsertBook(BOOK_4);

  // ── 4. Create chapters + inline content ──────────────────────────────────
  step('Creating chapters and interactive content');

  async function upsertChapters(bookId, bookDef) {
    const chapterIds = [];
    for (let i = 0; i < bookDef.chapters.length; i++) {
      const ch = bookDef.chapters[i];
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

      // Poll
      const { data: existingPoll } = await db.from('inline_content')
        .select('id').eq('chapter_id', chapterId).eq('content_type', 'poll').maybeSingle();
      if (!existingPoll) {
        const pollData = {
          question: ch.pollQuestion,
          options: ch.pollOptions.map((text, idx) => ({ id: `opt_${idx}`, text })),
          allow_multiple: false,
        };
        const { error: pe } = await db.from('inline_content').insert({
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
        });
        if (pe) warn(`Poll insert: ${pe.message}`);
        else log(`Created poll: ${ch.pollQuestion.substring(0, 55)}...`);
      }

      // Reflection question
      const { data: existingQ } = await db.from('inline_content')
        .select('id').eq('chapter_id', chapterId).eq('content_type', 'question').maybeSingle();
      if (!existingQ) {
        const { error: qe } = await db.from('inline_content').insert({
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
        });
        if (qe) warn(`Question insert: ${qe.message}`);
        else log(`Created question for: ${ch.title}`);
      }
    }
    return chapterIds;
  }

  const book3Chapters = await upsertChapters(book3Id, BOOK_3);
  const book4Chapters = await upsertChapters(book4Id, BOOK_4);

  // ── 5. Create book clubs ──────────────────────────────────────────────────
  step('Creating book clubs');

  async function upsertClub(name, description, readerIds, bookIds) {
    let clubId;
    const { data: existingClub } = await db.from('book_clubs').select('id').eq('name', name).maybeSingle();
    if (existingClub) {
      clubId = existingClub.id;
      log(`Club exists: ${name}`);
    } else {
      const { data: club, error: ce } = await db.from('book_clubs').insert({
        name,
        description,
        visibility: 'private',
        max_members: 25,
        created_by: authorId,
      }).select('id').single();
      if (ce) throw new Error(`Create club ${name}: ${ce.message}`);
      clubId = club.id;
      await db.from('club_settings').upsert({
        club_id: clubId,
        enable_progress_tracking: true,
        show_member_reading_progress: true,
        show_member_answers: true,
      }, { onConflict: 'club_id' });
      log(`Created club: ${name}`);
    }

    // Add books to club
    for (let i = 0; i < bookIds.length; i++) {
      const { data: existing } = await db.from('club_books')
        .select('id').eq('club_id', clubId).eq('book_id', bookIds[i]).maybeSingle();
      if (!existing) {
        await db.from('club_books').insert({
          club_id: clubId,
          book_id: bookIds[i],
          added_by: authorId,
          is_current: i === bookIds.length - 1,
        });
        log(`Added book to club`);
      }
    }

    // Add members
    const now = new Date().toISOString();
    for (let i = 0; i < readerIds.length; i++) {
      const readerId = readerIds[i];
      const readerList = readerIds === freedomReaderIds ? FREEDOM_READERS : REDROCK_READERS;
      const { data: existing } = await db.from('club_members')
        .select('id').eq('club_id', clubId).eq('user_id', readerId).maybeSingle();
      if (!existing) {
        await db.from('club_members').insert({
          club_id: clubId,
          user_id: readerId,
          invited_by: authorId,
          invited_email: readerList[i].email,
          role: 'member',
          invite_token: null,
          invite_accepted_at: now,
          joined_at: now,
        });
        log(`Added member: ${readerList[i].name}`);
      } else {
        log(`Member exists: ${readerList[i].name}`);
      }
    }

    return clubId;
  }

  const freedomClubId = await upsertClub(
    'Freedom Bus Reading Community',
    'A reading group for volunteers, supporters, and partners of Freedom Bus PEI exploring faith-driven compassion ministry, homelessness, and community engagement.',
    freedomReaderIds,
    [book3Id],
  );

  const redrockClubId = await upsertClub(
    'Red Rock Recovery Circle',
    'A reading community for Red Rock Revival Ranch staff, volunteers, and supporters exploring holistic recovery, faith-based healing, and community restoration.',
    redrockReaderIds,
    [book4Id],
  );

  // ── 6. Simulate reading progress ─────────────────────────────────────────
  step('Simulating reading progress');

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  // Freedom Bus readers: varied progress through book3
  const freedomProgress = [
    { idx: 0, ch: 2 }, // completed
    { idx: 1, ch: 2 }, // completed
    { idx: 2, ch: 1 }, // mid-way
    { idx: 3, ch: 1 }, // mid-way
    { idx: 4, ch: 0 }, // just started
  ];

  for (const p of freedomProgress) {
    const readerId = freedomReaderIds[p.idx];
    const chIdx = p.ch;
    const isLast = chIdx === book3Chapters.length - 1;
    const pct = isLast ? 100 : Math.round(((chIdx + 1) / book3Chapters.length) * 100);
    await db.from('reading_progress').upsert({
      user_id: readerId, book_id: book3Id,
      current_chapter_id: book3Chapters[chIdx],
      scroll_position: isLast ? 0.95 : Math.random() * 0.6,
      percent_complete: pct,
      last_read_at: daysAgo(Math.floor(Math.random() * 10)),
      started_at: daysAgo(18 + Math.floor(Math.random() * 8)),
      completed_at: isLast ? daysAgo(Math.floor(Math.random() * 5)) : null,
    }, { onConflict: 'user_id,book_id' });
    log(`${FREEDOM_READERS[p.idx].name} → Book3 ${pct}%`);
  }

  // Red Rock readers: varied progress through book4
  const redrockProgress = [
    { idx: 0, ch: 2 }, // completed
    { idx: 1, ch: 1 }, // mid
    { idx: 2, ch: 2 }, // completed
    { idx: 3, ch: 0 }, // started
    { idx: 4, ch: 1 }, // mid
  ];

  for (const p of redrockProgress) {
    const readerId = redrockReaderIds[p.idx];
    const chIdx = p.ch;
    const isLast = chIdx === book4Chapters.length - 1;
    const pct = isLast ? 100 : Math.round(((chIdx + 1) / book4Chapters.length) * 100);
    await db.from('reading_progress').upsert({
      user_id: readerId, book_id: book4Id,
      current_chapter_id: book4Chapters[chIdx],
      scroll_position: isLast ? 0.95 : Math.random() * 0.6,
      percent_complete: pct,
      last_read_at: daysAgo(Math.floor(Math.random() * 8)),
      started_at: daysAgo(15 + Math.floor(Math.random() * 7)),
      completed_at: isLast ? daysAgo(Math.floor(Math.random() * 4)) : null,
    }, { onConflict: 'user_id,book_id' });
    log(`${REDROCK_READERS[p.idx].name} → Book4 ${pct}%`);
  }

  // ── 7. Poll votes ─────────────────────────────────────────────────────────
  step('Generating poll responses');

  const { data: allPolls } = await db.from('inline_content')
    .select('id, content_data, chapter_id')
    .in('chapter_id', [...book3Chapters, ...book4Chapters])
    .eq('content_type', 'poll');

  const allReaderIds = [...freedomReaderIds, ...redrockReaderIds];
  for (const poll of (allPolls || [])) {
    const options = poll.content_data?.options || [];
    if (!options.length) continue;
    const relevant = book3Chapters.includes(poll.chapter_id) ? freedomReaderIds : redrockReaderIds;
    for (const readerId of relevant) {
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
    log(`Poll votes: ${poll.content_data?.question?.substring(0, 45)}...`);
  }

  // ── 8. Reflection answers ─────────────────────────────────────────────────
  step('Generating reflection answers');

  const freedomAnswers = [
    'I began volunteering with a street outreach ministry in my home city after a close friend became homeless following a mental health crisis. What I thought would be a short-term act of service became a years-long commitment. The experience fundamentally reshaped my theology of incarnation — showing up is not supplemental to the gospel; it is the gospel embodied.',
    'There was a man I met through our church\'s cold-weather shelter who had been homeless for three years. What struck me was not his circumstances but his dignity and intelligence. He had been a teacher. Seeing him reminded me that homelessness is not a character flaw; it is a circumstance. That shift changed how I approach every person I serve.',
    'The moment that stays with me is sitting with a young woman who had just aged out of the foster care system with nowhere to go. She was 18, had a backpack with everything she owned, and had been told by three shelters that they were full. Watching the system fail her in real time convinced me that faith communities must stop waiting for government systems to solve what they alone cannot solve.',
    'I came to compassion ministry sideways — through fundraising, not frontline service. I thought I could help from a distance. One evening I was asked to cover a shift at our overnight shelter. That one shift changed the entire direction of my vocational life. Numbers and campaigns mean nothing without the faces behind them.',
    'I had always been uncomfortable with homelessness — I would avoid eye contact, cross the street. A pastor challenged me to sit with that discomfort and ask what it was telling me about my own fear. That honest self-examination opened a door to genuine relationship with people I had been trained by culture to ignore.',
  ];

  const redrockAnswers = [
    'I have worked in addiction counselling for eleven years. The most consistent pattern I observe in fragmented care is this: the clinical system stabilises people without giving them anywhere meaningful to go. Sobriety without purpose is extraordinarily fragile. The integration of faith at Red Rock fills exactly that gap — it provides the why that sustains the what.',
    'My sister went through a secular residential treatment program twice before finding Red Rock. The difference was not the clinical protocols — those were similar. The difference was community. At Red Rock, she found people who believed she could recover not because statistics suggested it but because they believed in a God who restores. That distinction is not small; it is everything.',
    'I have been in recovery for seven years. The thing that finally worked for me was not more willpower or better coping skills — it was encounter with God in a community that had genuinely been changed by the same encounter. I could not argue with the evidence in the lives around me. That evidence preceded my faith, not the other way around.',
    'As a pastor, I have walked with many people through addiction. The moment I realized I needed better tools was when I found myself offering spiritual counsel to someone in acute withdrawal and realizing I was out of my depth. Humility about the limits of pastoral care — and genuine partnership with clinical expertise — has made me far more effective than I ever was alone.',
    'The research on long-term recovery outcomes consistently surprises my secular colleagues: community and meaning are stronger predictors of sustained sobriety than any pharmacological intervention. What the research describes, Red Rock deliberately builds. The ranch is essentially applied neuroscience, applied theology, and applied community development — all in the same place.',
  ];

  const { data: allQuestions } = await db.from('inline_content')
    .select('id, content_data, chapter_id')
    .in('chapter_id', [...book3Chapters, ...book4Chapters])
    .eq('content_type', 'question');

  for (const q of (allQuestions || [])) {
    const inBook3 = book3Chapters.includes(q.chapter_id);
    const readerList = inBook3 ? freedomReaderIds : redrockReaderIds;
    const answers = inBook3 ? freedomAnswers : redrockAnswers;
    for (let i = 0; i < readerList.length; i++) {
      const { data: existing } = await db.from('question_answers')
        .select('id').eq('inline_content_id', q.id).eq('user_id', readerList[i]).maybeSingle();
      if (!existing) {
        const { error } = await db.from('question_answers').insert({
          inline_content_id: q.id,
          user_id: readerList[i],
          answer_text: answers[i % answers.length],
        });
        if (error && !error.message.includes('duplicate')) warn(`Answer insert: ${error.message}`);
      }
    }
    log(`Answers recorded`);
  }

  // ── 9. Club discussion threads ────────────────────────────────────────────
  step('Creating club discussion threads');

  // Freedom Bus club
  const { data: existingFD } = await db.from('club_discussions')
    .select('id').eq('club_id', freedomClubId).eq('author_id', authorId).is('parent_id', null).limit(1);

  if (!existingFD?.length) {
    const { data: disc, error: de } = await db.from('club_discussions').insert({
      club_id: freedomClubId,
      author_id: authorId,
      body: 'Welcome to the Freedom Bus Reading Community. "Mobile Mercy" is not just a story about a bus — it is a study in what happens when a faith community decides that love must be concrete, practical, and present. I hope that as you read, you find not just inspiration but tools: ways of seeing, approaches to volunteer culture, and a theology of presence that you can carry into your own context.',
    }).select('id').single();
    if (de) warn(`Discussion: ${de.message}`);
    else {
      log('Created Freedom Bus welcome thread');
      await db.from('club_discussions').insert({
        club_id: freedomClubId,
        author_id: freedomReaderIds[0],
        parent_id: disc.id,
        body: 'The section on volunteer culture in Chapter 2 resonates deeply. The distinction between good intentions and good preparation is one we need to revisit in our own organization. We have been losing volunteers at a rate that correlates directly with inadequate orientation. This framework is exactly what we have been missing.',
      });
      await db.from('club_discussions').insert({
        club_id: freedomClubId,
        author_id: freedomReaderIds[1],
        parent_id: disc.id,
        body: 'Chapter 1 stopped me at the phrase "presence, provision, belonging." We have been measuring our outreach ministry almost exclusively on provision — meals served, beds filled, items distributed. But belonging? I am not sure we have ever measured that, or even asked how to cultivate it. That is a significant gap.',
      });
      log('Added Freedom Bus discussion replies');
    }
  } else {
    log('Freedom Bus discussions exist');
  }

  // Red Rock club
  const { data: existingRD } = await db.from('club_discussions')
    .select('id').eq('club_id', redrockClubId).eq('author_id', authorId).is('parent_id', null).limit(1);

  if (!existingRD?.length) {
    const { data: disc, error: de } = await db.from('club_discussions').insert({
      club_id: redrockClubId,
      author_id: authorId,
      body: 'Welcome to the Red Rock Recovery Circle. "Where Hope Finds You" was written to bridge two communities that too often talk past each other — the clinical world and the faith community. My hope is that this book becomes a resource for building the kind of integrated, whole-person approach that genuinely transforms lives. I look forward to the conversations ahead.',
    }).select('id').single();
    if (de) warn(`Discussion: ${de.message}`);
    else {
      log('Created Red Rock welcome thread');
      await db.from('club_discussions').insert({
        club_id: redrockClubId,
        author_id: redrockReaderIds[0],
        parent_id: disc.id,
        body: 'The H.O.P.E. framework is something I have been looking for for years. I have seen Healing-only programs, Opportunity-only programs, and Employment-only programs — and watched each fail in predictable ways. The integration is what makes the difference, and Chapter 1 articulates that with a clarity I have not seen elsewhere.',
      });
      await db.from('club_discussions').insert({
        club_id: redrockClubId,
        author_id: redrockReaderIds[2],
        parent_id: disc.id,
        body: 'Chapter 2\'s treatment of faith as a recovery framework is careful and nuanced in a way I appreciate. The defense of the integrated model is not anti-clinical — it is pro-human. Fragmented people do not recover well in fragmented systems. This is the strongest argument I have encountered for why faith and clinical care belong together.',
      });
      log('Added Red Rock discussion replies');
    }
  } else {
    log('Red Rock discussions exist');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════');
  console.log('  ✅ Seed Part 2 complete!');
  console.log('════════════════════════════════════════════════════');
  console.log(`\n  Author:    ${AUTHOR.email}  /  ${AUTHOR.password}`);
  console.log(`\n  Freedom Bus readers (password: Demo@2026!):`);
  for (const r of FREEDOM_READERS) console.log(`    ${r.email}`);
  console.log(`\n  Red Rock readers (password: Demo@2026!):`);
  for (const r of REDROCK_READERS) console.log(`    ${r.email}`);
  console.log(`\n  Book 3 ID (Freedom Bus):  ${book3Id}`);
  console.log(`  Book 4 ID (Red Rock):      ${book4Id}`);
  console.log(`  Club 2 ID (Freedom Bus):   ${freedomClubId}`);
  console.log(`  Club 3 ID (Red Rock):      ${redrockClubId}`);
  console.log('\n  Dashboard URLs:');
  console.log(`    http://localhost:5178/edit/book/${book3Id}/dashboard`);
  console.log(`    http://localhost:5178/edit/book/${book4Id}/dashboard`);
  console.log('\n  Reader views:');
  console.log(`    http://localhost:5178/book/${book3Id}`);
  console.log(`    http://localhost:5178/book/${book4Id}`);
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
