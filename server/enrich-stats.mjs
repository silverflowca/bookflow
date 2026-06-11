/**
 * Enrich reading stats for Books 3 & 4 (Freedom Bus + Red Rock Revival)
 * Run: node enrich-stats.mjs
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient('http://localhost:55321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: 'bookflow' } }
);

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const rand    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const log     = (msg) => console.log('  ✓ ' + msg);
const step    = (msg) => console.log('\n▸ ' + msg);

// ── fetch books ──────────────────────────────────────────────────────────────
const { data: books } = await db.from('books').select('id, title, slug')
  .in('slug', ['mobile-mercy-freedom-bus', 'where-hope-finds-you']);
const book3 = books.find(b => b.slug === 'mobile-mercy-freedom-bus');
const book4 = books.find(b => b.slug === 'where-hope-finds-you');
console.log('Book 3:', book3.title, book3.id);
console.log('Book 4:', book4.title, book4.id);

const { data: ch3 } = await db.from('chapters').select('id, order_index').eq('book_id', book3.id).order('order_index');
const { data: ch4 } = await db.from('chapters').select('id, order_index').eq('book_id', book4.id).order('order_index');

// ── fetch readers ────────────────────────────────────────────────────────────
const freedomEmails = [
  'pastor.linda.cross@efhci-demo.com', 'tobias.grant@efhci-demo.com',
  'michelle.beaumont@efhci-demo.com',  'samuel.osei@efhci-demo.com',
  'nadia.kowalski@efhci-demo.com',
];
const redrockEmails = [
  'pastor.derek.hayes@efhci-demo.com', 'carla.renner@efhci-demo.com',
  'joseph.whitehorse@efhci-demo.com',  'grace.nkemelu@efhci-demo.com',
  'brendan.mcallister@efhci-demo.com',
];
const crossEmails = [
  'james.okafor@efhci-demo.com', 'priya.sharma@efhci-demo.com',
  'marcus.thornton@efhci-demo.com', 'elena.vasquez@efhci-demo.com',
];

const { data: allProfiles } = await db.from('profiles').select('id, email')
  .in('email', [...freedomEmails, ...redrockEmails, ...crossEmails]);

const byEmail = Object.fromEntries(allProfiles.map(p => [p.email, p.id]));

// ── helper ───────────────────────────────────────────────────────────────────
async function upsertProgress(userId, bookId, chapters, chIdx, startDaysAgo) {
  const isLast = chIdx === chapters.length - 1;
  const pct    = isLast ? 100 : Math.round(((chIdx + 1) / chapters.length) * 100);
  await db.from('reading_progress').upsert({
    user_id:            userId,
    book_id:            bookId,
    current_chapter_id: chapters[chIdx].id,
    scroll_position:    isLast ? 0.97 : Math.random() * 0.8,
    percent_complete:   pct,
    last_read_at:       daysAgo(rand(0, 5)),
    started_at:         daysAgo(startDaysAgo),
    completed_at:       isLast ? daysAgo(rand(0, 3)) : null,
  }, { onConflict: 'user_id,book_id' });
  return pct;
}

// ── Book 3 reading progress ──────────────────────────────────────────────────
step('Book 3 (Mobile Mercy) reading progress');
const b3Rows = [
  { email: 'pastor.linda.cross@efhci-demo.com',  chIdx: 2, start: 22 },
  { email: 'tobias.grant@efhci-demo.com',         chIdx: 2, start: 18 },
  { email: 'michelle.beaumont@efhci-demo.com',    chIdx: 1, start: 14 },
  { email: 'samuel.osei@efhci-demo.com',          chIdx: 1, start: 12 },
  { email: 'nadia.kowalski@efhci-demo.com',       chIdx: 0, start:  8 },
  { email: 'james.okafor@efhci-demo.com',         chIdx: 2, start: 20 },
  { email: 'priya.sharma@efhci-demo.com',         chIdx: 1, start: 10 },
];
for (const r of b3Rows) {
  const uid = byEmail[r.email];
  if (!uid) { console.log('  ⚠ not found: ' + r.email); continue; }
  const pct = await upsertProgress(uid, book3.id, ch3, r.chIdx, r.start);
  log(r.email.split('@')[0] + ' → ' + pct + '%');
}

// ── Book 4 reading progress ──────────────────────────────────────────────────
step('Book 4 (Where Hope Finds You) reading progress');
const b4Rows = [
  { email: 'pastor.derek.hayes@efhci-demo.com',  chIdx: 2, start: 21 },
  { email: 'carla.renner@efhci-demo.com',         chIdx: 1, start: 16 },
  { email: 'joseph.whitehorse@efhci-demo.com',    chIdx: 2, start: 19 },
  { email: 'grace.nkemelu@efhci-demo.com',        chIdx: 0, start:  9 },
  { email: 'brendan.mcallister@efhci-demo.com',   chIdx: 1, start: 13 },
  { email: 'marcus.thornton@efhci-demo.com',      chIdx: 2, start: 17 },
  { email: 'elena.vasquez@efhci-demo.com',        chIdx: 1, start: 11 },
];
for (const r of b4Rows) {
  const uid = byEmail[r.email];
  if (!uid) { console.log('  ⚠ not found: ' + r.email); continue; }
  const pct = await upsertProgress(uid, book4.id, ch4, r.chIdx, r.start);
  log(r.email.split('@')[0] + ' → ' + pct + '%');
}

// ── Poll votes from cross-readers ────────────────────────────────────────────
step('Poll votes from cross-readers');
const { data: polls3 } = await db.from('inline_content').select('id, content_data').eq('book_id', book3.id).eq('content_type', 'poll');
const { data: polls4 } = await db.from('inline_content').select('id, content_data').eq('book_id', book4.id).eq('content_type', 'poll');

async function castVotes(polls, uids) {
  for (const poll of polls) {
    const opts = poll.content_data?.options || [];
    if (!opts.length) continue;
    for (const uid of uids) {
      const { data: ex } = await db.from('poll_responses').select('id')
        .eq('inline_content_id', poll.id).eq('user_id', uid).maybeSingle();
      if (!ex) {
        await db.from('poll_responses').insert({
          inline_content_id: poll.id,
          user_id:           uid,
          selected_option:   opts[rand(0, opts.length - 1)].id,
        });
      }
    }
  }
  log('Votes cast: ' + polls.length + ' polls x ' + uids.length + ' readers');
}

await castVotes(polls3, [byEmail['james.okafor@efhci-demo.com'], byEmail['priya.sharma@efhci-demo.com']].filter(Boolean));
await castVotes(polls4, [byEmail['marcus.thornton@efhci-demo.com'], byEmail['elena.vasquez@efhci-demo.com']].filter(Boolean));

// ── Reflection answers from cross-readers ───────────────────────────────────
step('Reflection answers from cross-readers');
const { data: qs3 } = await db.from('inline_content').select('id').eq('book_id', book3.id).eq('content_type', 'question');
const { data: qs4 } = await db.from('inline_content').select('id').eq('book_id', book4.id).eq('content_type', 'question');

const extraAnswers = [
  'Reading this has reframed how I think about community response to crisis. The emphasis on sustained presence over transactional giving is a conviction I want to bring back to my own church leadership context.',
  'What strikes me most is the integration of professional preparation with genuine spiritual motivation. So often those are in tension — here they are mutually reinforcing, and the outcomes speak for themselves.',
  'The framework presented here is something I will use directly in the next leadership planning retreat I facilitate. The practical and the theological are held together without collapsing into either extreme.',
  'I came to this book skeptical of the faith-based framing. I leave convinced that the integration of spiritual conviction with operational excellence is not a liability in the model — it may be the source of its particular effectiveness.',
];

async function addAnswers(questions, uids, answers) {
  for (const q of questions) {
    for (let i = 0; i < uids.length; i++) {
      const { data: ex } = await db.from('question_answers').select('id')
        .eq('inline_content_id', q.id).eq('user_id', uids[i]).maybeSingle();
      if (!ex) {
        await db.from('question_answers').insert({
          inline_content_id: q.id,
          user_id:           uids[i],
          answer_text:       answers[i % answers.length],
        });
      }
    }
  }
  log('Answers added: ' + questions.length + ' questions x ' + uids.length + ' readers');
}

const b3CrossUids = [byEmail['james.okafor@efhci-demo.com'], byEmail['priya.sharma@efhci-demo.com']].filter(Boolean);
const b4CrossUids = [byEmail['marcus.thornton@efhci-demo.com'], byEmail['elena.vasquez@efhci-demo.com']].filter(Boolean);
if (b3CrossUids.length) await addAnswers(qs3, b3CrossUids, extraAnswers);
if (b4CrossUids.length) await addAnswers(qs4, b4CrossUids, extraAnswers);

// ── Verification ─────────────────────────────────────────────────────────────
step('Verification');
for (const [bk, bkId] of [[book3, book3.id], [book4, book4.id]]) {
  const { data: rp } = await db.from('reading_progress').select('user_id, percent_complete').eq('book_id', bkId);
  const completed = rp.filter(r => r.percent_complete === 100).length;
  const avg = Math.round(rp.reduce((s, r) => s + r.percent_complete, 0) / (rp.length || 1));
  console.log('  ' + bk.title + ': ' + rp.length + ' readers | ' + completed + ' completed | avg ' + avg + '%');

  const { data: pvotes } = await db.from('poll_responses').select('id')
    .in('inline_content_id', (await db.from('inline_content').select('id').eq('book_id', bkId).eq('content_type', 'poll')).data.map(p => p.id));
  const { data: qans } = await db.from('question_answers').select('id')
    .in('inline_content_id', (await db.from('inline_content').select('id').eq('book_id', bkId).eq('content_type', 'question')).data.map(q => q.id));
  console.log('  ' + bk.title + ': ' + (pvotes?.length || 0) + ' poll votes | ' + (qans?.length || 0) + ' answers');
}

console.log('\n✅ Done');
