#!/usr/bin/env node
/**
 * Seed: "Understanding the Gospels" — Response Review Test Book
 *
 * Purpose: Test the full response / review flow:
 *   - 3 chapters, each with rich paragraph text + YouTube videos
 *   - 10+ form elements spread across chapters (questions, polls,
 *     quizzes, textboxes, textareas, radio, checkbox, select, multiselect)
 *   - Varied response_visibility so the review page has interesting data
 *
 * Run:
 *   node book-seeder.mjs seed-test-responses-book.mjs --author=damion.steen2@silverflow.ca
 */

import {
  db, resolveAuthor, createBook, createChapter, addInlineContent,
  doc, p, h, text, bold, italic, ul, ol, blockquote, widget, marked,
} from './book-seeder.mjs';

const author = await resolveAuthor();
console.log(`\n  Author: ${author.email} (${author.id})\n`);

// ─────────────────────────────────────────────────────────────────────────────
// BOOK
// ─────────────────────────────────────────────────────────────────────────────
const book = await createBook({
  authorId:    author.id,
  title:       'Understanding the Gospels',
  subtitle:    'An Interactive Study for Groups & Individuals',
  description: 'A three-chapter interactive Bible study that walks through the life, teachings, and resurrection of Jesus across the four Gospels. Each chapter includes videos, reflection questions, quizzes, polls, and practical response activities — designed to test the BookFlow response review system.',
  visibility:  'public',
  slug:        'understanding-the-gospels-test',
  coverImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
});

const bookId   = book.id;
const authorId = author.id;

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER 1 — The Life and Ministry of Jesus
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  Chapter 1 — The Life and Ministry of Jesus…');

const ch1 = await createChapter({
  bookId,
  title:      'The Life and Ministry of Jesus',
  contentText: 'placeholder',
  content:    doc(p('placeholder')),
  status:     'published',
  orderIndex: 0,
});

// ── Form elements ─────────────────────────────────────────────────────────────

// 1. Poll — prior knowledge
const c1_poll_prior = await addInlineContent({
  chapterId: ch1.id, bookId, authorId,
  contentType: 'poll',
  anchorText: 'Prior knowledge poll',
  position: 'start_of_chapter',
  responseVisibility: 'members_only',
  contentData: {
    question: 'Before starting this chapter, how familiar are you with the life of Jesus?',
    allow_multiple: false,
    show_results_before_vote: true,
    options: [
      { id: 'p1_a', text: 'Complete beginner — I know very little' },
      { id: 'p1_b', text: 'Some familiarity — I have heard the stories' },
      { id: 'p1_c', text: 'Moderate knowledge — I have read the Gospels before' },
      { id: 'p1_d', text: 'Deep knowledge — I have studied this extensively' },
    ],
  },
});

// 2. Open question — personal context
const c1_q_context = await addInlineContent({
  chapterId: ch1.id, bookId, authorId,
  contentType: 'question',
  anchorText: 'Your experience with the Gospels',
  position: 'inline',
  responseVisibility: 'private',
  contentData: {
    question: 'What has been your experience with reading the Gospels so far? What draws you to this study?',
    type: 'open',
  },
});

// 3. Quiz question — historical fact
const c1_quiz_birth = await addInlineContent({
  chapterId: ch1.id, bookId, authorId,
  contentType: 'question',
  anchorText: 'Birthplace quiz',
  position: 'inline',
  responseVisibility: 'private',
  contentData: {
    question: 'In which town was Jesus born, according to the Gospels of Matthew and Luke?',
    type: 'quiz',
    options: [
      { id: 'q1_a', text: 'Nazareth' },
      { id: 'q1_b', text: 'Bethlehem' },
      { id: 'q1_c', text: 'Jerusalem' },
      { id: 'q1_d', text: 'Capernaum' },
    ],
    correct_answer: 'q1_b',
    explanation: 'Jesus was born in Bethlehem of Judea (Matthew 2:1, Luke 2:4–7), though he grew up in Nazareth, which is why he is often called "Jesus of Nazareth".',
  },
});

// 4. Radio — learning style
const c1_radio_learn = await addInlineContent({
  chapterId: ch1.id, bookId, authorId,
  contentType: 'radio',
  anchorText: 'Learning style',
  position: 'inline',
  responseVisibility: 'members_only',
  contentData: {
    label: 'How do you learn best when studying the Bible?',
    required: true,
    layout: 'vertical',
    options: [
      { id: 'r1_a', text: 'Reading and reflecting on my own' },
      { id: 'r1_b', text: 'Watching video teachings' },
      { id: 'r1_c', text: 'Group discussion and conversation' },
      { id: 'r1_d', text: 'A mix of all three' },
    ],
  },
});

// 5. Video inline mark — YouTube intro video
const c1_video_intro = await addInlineContent({
  chapterId: ch1.id, bookId, authorId,
  contentType: 'video',
  anchorText: 'The Life of Jesus — BibleProject Overview',
  position: 'inline',
  visibility: 'all_readers',
  responseVisibility: 'private',
  contentData: {
    url: 'https://www.youtube.com/watch?v=HGHqu9-DtXk',
    title: 'The Life of Jesus — BibleProject Overview',
    description: 'A beautifully animated 8-minute overview of the life of Jesus from the BibleProject team.',
    width: '75',
  },
});

// Now build chapter 1 rich TipTap content
const ch1Content = doc(
  h(2, 'Who Was Jesus of Nazareth?'),
  p(
    text('Jesus of Nazareth is one of the most studied, debated, and discussed figures in all of human history. The four Gospels — Matthew, Mark, Luke, and John — each offer a unique perspective on his life, each written with a specific audience and purpose in mind. Together they paint a rich and multi-dimensional portrait of a man who claimed to be the Son of God.'),
  ),
  p(
    text('Before we dive into the content, take a moment to reflect on where you are coming from. '),
    marked('How familiar are you with the Gospels?', c1_poll_prior),
  ),
  h(2, 'The Four Gospel Writers'),
  p(
    text('Each Gospel author emphasised different aspects of Jesus\'s identity. '),
    text('Matthew', [bold]),
    text(' wrote primarily for a Jewish audience, tracing Jesus\'s genealogy back to Abraham and demonstrating how he fulfilled Old Testament prophecy. '),
    text('Mark', [bold]),
    text(' is the shortest Gospel and moves at a breathless pace — the word "immediately" appears over 40 times. '),
    text('Luke', [bold]),
    text(', a physician and companion of Paul, wrote with great literary care and included stories found nowhere else, such as the parable of the Prodigal Son. '),
    text('John', [bold]),
    text(' stands apart entirely, opening not with a genealogy but with a cosmic prologue: "In the beginning was the Word."'),
  ),
  p(
    marked('Share your experience with the Gospels so far.', c1_q_context),
  ),
  h(2, 'The Nativity Accounts'),
  p(
    text('Only Matthew and Luke record the birth of Jesus, and their accounts complement each other. Matthew focuses on Joseph\'s perspective — the dreams, the visit of the Magi, and the flight to Egypt. Luke centres on Mary — the Annunciation by the angel Gabriel, the Magnificat, the journey to Bethlehem, the shepherds, and the manger.'),
  ),
  blockquote('"And she gave birth to her firstborn son and wrapped him in swaddling cloths and laid him in a manger, because there was no place for them in the inn." — Luke 2:7'),
  p(
    marked('Quick quiz: where was Jesus born?', c1_quiz_birth),
  ),
  h(2, 'Video: The Life of Jesus — An Overview'),
  p(
    text('Watch the following overview from BibleProject to get a bird\'s-eye view of the Gospels before diving deeper.'),
  ),
  p(
    marked('The Life of Jesus — BibleProject Overview (8 min)', c1_video_intro),
  ),
  h(2, 'How Do You Learn Best?'),
  p(
    text('This study uses a mix of text, video, and interactive questions. '),
    widget(c1_radio_learn),
  ),
  h(2, 'The Ministry of Jesus'),
  p(
    text('Jesus began his public ministry around the age of 30, after being baptised by John in the Jordan River. The heavens opened, the Holy Spirit descended as a dove, and a voice from heaven said: "This is my beloved Son, with whom I am well pleased." (Matthew 3:17)'),
  ),
  p(
    text('He then spent 40 days fasting in the wilderness, where he was tempted by Satan three times. When he emerged, he called his first disciples — Simon (Peter) and Andrew, then James and John — with the simple words: "Follow me, and I will make you fishers of men."'),
  ),
  ul(
    'He performed miracles: healing the blind, raising the dead, feeding thousands.',
    'He taught in parables: the Prodigal Son, the Good Samaritan, the Sower and the Seed.',
    'He challenged religious leaders: the Pharisees, Sadducees, and teachers of the law.',
    'He crossed social boundaries: speaking with Samaritans, eating with tax collectors, welcoming sinners.',
  ),
);

// Update ch1 with full content
await db.from('chapters').update({ content: ch1Content, content_text: 'Who Was Jesus of Nazareth The four Gospels Matthew Mark Luke John each offer a unique perspective on his life', word_count: 380, estimated_read_time_minutes: 2 }).eq('id', ch1.id);
console.log('    ✓ Chapter 1 content updated');

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER 2 — The Teachings of Jesus
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  Chapter 2 — The Teachings of Jesus…');

const ch2 = await createChapter({
  bookId,
  title:      'The Teachings of Jesus',
  contentText: 'placeholder',
  content:    doc(p('placeholder')),
  status:     'published',
  orderIndex: 1,
});

// 6. Checkbox — topics of interest
const c2_cb_topics = await addInlineContent({
  chapterId: ch2.id, bookId, authorId,
  contentType: 'checkbox',
  anchorText: 'Topics of interest',
  position: 'start_of_chapter',
  responseVisibility: 'members_only',
  contentData: {
    label: 'Which of Jesus\'s teachings are you most interested in exploring? (Select all that apply)',
    required: false,
    layout: 'vertical',
    options: [
      { id: 'cb_a', text: 'The Sermon on the Mount (Beatitudes)' },
      { id: 'cb_b', text: 'Parables (stories about the Kingdom of God)' },
      { id: 'cb_c', text: 'Love your enemies / forgiveness' },
      { id: 'cb_d', text: 'Prayer (the Lord\'s Prayer)' },
      { id: 'cb_e', text: 'Social justice (caring for the poor and marginalised)' },
      { id: 'cb_f', text: 'End times / eschatology' },
    ],
  },
});

// 7. Quiz — Beatitudes
const c2_quiz_beat = await addInlineContent({
  chapterId: ch2.id, bookId, authorId,
  contentType: 'question',
  anchorText: 'Beatitudes quiz',
  position: 'inline',
  responseVisibility: 'private',
  contentData: {
    question: 'In the Beatitudes (Matthew 5), Jesus says "Blessed are the meek, for they shall…" — complete this saying.',
    type: 'quiz',
    options: [
      { id: 'b_a', text: '…receive the Holy Spirit' },
      { id: 'b_b', text: '…inherit the earth' },
      { id: 'b_c', text: '…see God' },
      { id: 'b_d', text: '…be called children of God' },
    ],
    correct_answer: 'b_b',
    explanation: '"Blessed are the meek, for they shall inherit the earth." (Matthew 5:5) This is one of the eight Beatitudes Jesus declared at the beginning of the Sermon on the Mount.',
  },
});

// 8. Select — favourite parable
const c2_select_parable = await addInlineContent({
  chapterId: ch2.id, bookId, authorId,
  contentType: 'select',
  anchorText: 'Favourite parable',
  position: 'inline',
  responseVisibility: 'members_only',
  contentData: {
    label: 'Which parable of Jesus resonates most with you personally?',
    required: false,
    placeholder: 'Choose a parable…',
    options: [
      { id: 'par_a', text: 'The Prodigal Son (Luke 15)' },
      { id: 'par_b', text: 'The Good Samaritan (Luke 10)' },
      { id: 'par_c', text: 'The Sower and the Seed (Matthew 13)' },
      { id: 'par_d', text: 'The Lost Sheep (Luke 15)' },
      { id: 'par_e', text: 'The Mustard Seed (Matthew 13)' },
      { id: 'par_f', text: 'The Talents (Matthew 25)' },
    ],
  },
});

// 9. Textarea — personal reflection
const c2_textarea_reflection = await addInlineContent({
  chapterId: ch2.id, bookId, authorId,
  contentType: 'textarea',
  anchorText: 'Personal reflection',
  position: 'inline',
  responseVisibility: 'private',
  contentData: {
    label: 'Reflection: Which teaching of Jesus challenges you the most and why?',
    placeholder: 'Write your honest thoughts here. This is private — only you and the group leader can see it.',
    required: false,
    rows: 5,
    max_length: 1000,
  },
});

// 10. Video — Sermon on the Mount
const c2_video_sermon = await addInlineContent({
  chapterId: ch2.id, bookId, authorId,
  contentType: 'video',
  anchorText: 'Sermon on the Mount — BibleProject',
  position: 'inline',
  visibility: 'all_readers',
  responseVisibility: 'private',
  contentData: {
    url: 'https://www.youtube.com/watch?v=VYVF1K0cFHQ',
    title: 'Sermon on the Mount — BibleProject',
    description: 'BibleProject\'s animated exploration of the Sermon on the Mount — the most famous teaching of Jesus.',
    width: '75',
  },
});

// 11. Multiselect — practical application
const c2_multi_apply = await addInlineContent({
  chapterId: ch2.id, bookId, authorId,
  contentType: 'multiselect',
  anchorText: 'Practical applications',
  position: 'end_of_chapter',
  responseVisibility: 'members_only',
  contentData: {
    label: 'From this chapter, which teachings will you intentionally practise this week?',
    placeholder: 'Select everything that applies…',
    required: false,
    options: [
      { id: 'ap_a', text: 'Pray the Lord\'s Prayer daily' },
      { id: 'ap_b', text: 'Show kindness to someone I find difficult' },
      { id: 'ap_c', text: 'Give quietly to someone in need' },
      { id: 'ap_d', text: 'Fast for one meal or one day' },
      { id: 'ap_e', text: 'Memorise one of the Beatitudes' },
      { id: 'ap_f', text: 'Read the full Sermon on the Mount (Matthew 5–7)' },
    ],
  },
});

// Build chapter 2 content
const ch2Content = doc(
  h(2, 'The Greatest Teacher'),
  p(
    text('No teacher in history has been quoted more, debated more, or had more lasting impact than Jesus of Nazareth. His teachings were radical, subversive, and profoundly compassionate. He spoke with an authority that astonished crowds: "For he was teaching them as one who had authority, and not as their scribes." (Matthew 7:29)'),
  ),
  p(
    text('Before we begin, tell us what draws you to his teachings. '),
    widget(c2_cb_topics),
  ),
  h(2, 'The Sermon on the Mount'),
  p(
    text('The Sermon on the Mount (Matthew 5–7) is the most extensive collection of Jesus\'s teachings found anywhere in the Gospels. He opens with the Beatitudes — eight declarations of blessing directed at those the world would not expect to be blessed: the poor in spirit, the mourners, the meek, the peacemakers.'),
  ),
  blockquote('"Blessed are the pure in heart, for they shall see God." — Matthew 5:8'),
  p(
    text('The Beatitudes turn conventional wisdom on its head. Strength is found in weakness. Honour comes through service. The path to greatness runs directly through humility. Test your knowledge:'),
  ),
  p(
    marked('Quiz: Complete the Beatitude.', c2_quiz_beat),
  ),
  h(2, 'Video: The Sermon on the Mount'),
  p(
    text('Watch BibleProject\'s animated overview of the Sermon on the Mount — one of the most important documents in human history.'),
  ),
  p(
    marked('The Sermon on the Mount — BibleProject (7 min)', c2_video_sermon),
  ),
  h(2, 'Teaching in Parables'),
  p(
    text('Jesus frequently taught using parables — short, memorable stories drawn from everyday life that carried deeper spiritual truths. He told parables about farmers and seeds, about lost sheep and lost coins, about extravagant fathers and wasteful sons, about workers in vineyards and servants entrusted with talents.'),
  ),
  p(
    text('When asked why he spoke in parables, Jesus answered: "Because seeing they do not see, and hearing they do not hear, nor do they understand." (Matthew 13:13) Parables were not designed to obscure the truth — they were designed to draw listeners in, to make them think, and to reveal what was already in their hearts.'),
  ),
  p(
    text('Which parable speaks most deeply to you? '),
    widget(c2_select_parable),
  ),
  h(2, 'Love, Forgiveness, and Enemies'),
  p(
    text('Perhaps the most radical teaching of Jesus is found in Matthew 5:44: "But I say to you, Love your enemies and pray for those who persecute you." This command flies in the face of natural human instinct. It demands not merely tolerance but active goodwill toward those who harm us.'),
  ),
  p(
    text('This teaching was not abstract philosophy. Jesus modelled it on the cross: "Father, forgive them, for they know not what they do." (Luke 23:34) The teaching and the example are inseparable.'),
  ),
  p(
    text('Take time now to reflect honestly on this. '),
    widget(c2_textarea_reflection),
  ),
  h(2, 'The Lord\'s Prayer'),
  p(
    text('In Matthew 6:9–13, Jesus gives his disciples a model for prayer:'),
  ),
  ol(
    'Our Father in heaven, hallowed be your name.',
    'Your kingdom come, your will be done, on earth as it is in heaven.',
    'Give us this day our daily bread.',
    'And forgive us our debts, as we also have forgiven our debtors.',
    'And lead us not into temptation, but deliver us from evil.',
  ),
  p(
    text('This prayer is simultaneously cosmic in scope — invoking the coming Kingdom of God — and intensely practical, asking for daily bread and daily forgiveness. It is a prayer that a child can memorise and a theologian can spend a lifetime unpacking.'),
  ),
  h(2, 'Practical Application'),
  p(
    text('Knowing what Jesus taught is not enough. James 1:22 says: "Be doers of the word, and not hearers only." Select the practices you will carry into this week: '),
    widget(c2_multi_apply),
  ),
);

await db.from('chapters').update({ content: ch2Content, content_text: 'The Greatest Teacher No teacher in history has been quoted more debated more or had more lasting impact than Jesus of Nazareth', word_count: 420, estimated_read_time_minutes: 2 }).eq('id', ch2.id);
console.log('    ✓ Chapter 2 content updated');

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER 3 — The Death and Resurrection of Jesus
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  Chapter 3 — The Death and Resurrection of Jesus…');

const ch3 = await createChapter({
  bookId,
  title:      'The Death and Resurrection of Jesus',
  contentText: 'placeholder',
  content:    doc(p('placeholder')),
  status:     'published',
  orderIndex: 2,
});

// 12. Poll — before reading
const c3_poll_belief = await addInlineContent({
  chapterId: ch3.id, bookId, authorId,
  contentType: 'poll',
  anchorText: 'Resurrection belief poll',
  position: 'start_of_chapter',
  responseVisibility: 'members_only',
  contentData: {
    question: 'Before reading this chapter, how would you describe your belief in the resurrection of Jesus?',
    allow_multiple: false,
    show_results_before_vote: false,
    options: [
      { id: 'rb_a', text: 'I firmly believe it happened historically' },
      { id: 'rb_b', text: 'I believe it spiritually, but I have questions about the historical claims' },
      { id: 'rb_c', text: 'I am genuinely unsure — open but uncertain' },
      { id: 'rb_d', text: 'I am sceptical — I see it as symbolic, not literal' },
    ],
  },
});

// 13. Quiz — crucifixion location
const c3_quiz_location = await addInlineContent({
  chapterId: ch3.id, bookId, authorId,
  contentType: 'question',
  anchorText: 'Crucifixion location quiz',
  position: 'inline',
  responseVisibility: 'private',
  contentData: {
    question: 'At what location (in Hebrew: Golgotha) was Jesus crucified?',
    type: 'quiz',
    options: [
      { id: 'gl_a', text: 'The Garden of Gethsemane' },
      { id: 'gl_b', text: 'The Mount of Olives' },
      { id: 'gl_c', text: 'The Place of the Skull' },
      { id: 'gl_d', text: 'The Temple Mount' },
    ],
    correct_answer: 'gl_c',
    explanation: 'Golgotha means "Place of the Skull" in Aramaic (John 19:17). It is identified in tradition with a site outside the city walls of Jerusalem, where criminals were executed by crucifixion.',
  },
});

// 14. Textbox — one word
const c3_tb_word = await addInlineContent({
  chapterId: ch3.id, bookId, authorId,
  contentType: 'textbox',
  anchorText: 'One word response',
  position: 'inline',
  responseVisibility: 'all_readers',
  contentData: {
    label: 'In one word — what does the resurrection mean to you personally?',
    placeholder: 'e.g. Hope, Life, Everything, Freedom…',
    required: false,
    max_length: 30,
    width: 'md',
  },
});

// 15. Video — Resurrection
const c3_video_resurrection = await addInlineContent({
  chapterId: ch3.id, bookId, authorId,
  contentType: 'video',
  anchorText: 'The Resurrection of Jesus — BibleProject',
  position: 'inline',
  visibility: 'all_readers',
  responseVisibility: 'private',
  contentData: {
    url: 'https://www.youtube.com/watch?v=G8KPaCnCKgE',
    title: 'The Resurrection — BibleProject',
    description: 'BibleProject\'s animated overview of the death and resurrection of Jesus and its significance.',
    width: '75',
  },
});

// 16. Textarea — questions and doubts
const c3_textarea_doubts = await addInlineContent({
  chapterId: ch3.id, bookId, authorId,
  contentType: 'textarea',
  anchorText: 'Questions and doubts',
  position: 'inline',
  responseVisibility: 'private',
  contentData: {
    label: 'What questions or doubts do you have about the death and resurrection of Jesus? Be honest.',
    placeholder: 'There are no wrong questions here. Write anything on your mind.',
    required: false,
    rows: 4,
    max_length: 1500,
  },
});

// 17. Radio — significance
const c3_radio_sig = await addInlineContent({
  chapterId: ch3.id, bookId, authorId,
  contentType: 'radio',
  anchorText: 'Significance of resurrection',
  position: 'inline',
  responseVisibility: 'members_only',
  contentData: {
    label: 'What do you believe is the primary significance of the resurrection of Jesus?',
    required: false,
    layout: 'vertical',
    options: [
      { id: 'sig_a', text: 'It proves Jesus is who he claimed to be — the Son of God' },
      { id: 'sig_b', text: 'It offers hope of life after death for all who believe' },
      { id: 'sig_c', text: 'It vindicates his teaching and confirms the Kingdom of God has come' },
      { id: 'sig_d', text: 'It is the foundation of the entire Christian faith (1 Corinthians 15:17)' },
      { id: 'sig_e', text: 'All of the above — these are inseparable' },
    ],
  },
});

// 18. Open question — personal response
const c3_q_personal = await addInlineContent({
  chapterId: ch3.id, bookId, authorId,
  contentType: 'question',
  anchorText: 'Personal response',
  position: 'end_of_chapter',
  responseVisibility: 'private',
  contentData: {
    question: 'Having studied the death and resurrection of Jesus, how has your thinking or feeling about it shifted — if at all? What remains unclear or unresolved for you?',
    type: 'open',
  },
});

// Build chapter 3 content
const ch3Content = doc(
  h(2, 'The Road to Jerusalem'),
  p(
    text('Everything in the Gospels moves toward Jerusalem. Jesus had predicted his death three times (Mark 8:31, 9:31, 10:33–34), yet his disciples struggled to understand. When he entered the city on a donkey to shouts of "Hosanna!", fulfilling the prophecy of Zechariah 9:9, the crowd expected a political revolution. They got something far greater.'),
  ),
  p(
    text('Start this chapter by honestly sharing where you are: '),
    marked('What do you currently believe about the resurrection?', c3_poll_belief),
  ),
  h(2, 'The Last Supper and Gethsemane'),
  p(
    text('On the night before he died, Jesus shared a final meal with his twelve disciples — the Last Supper — in which he instituted what Christians call the Eucharist, Communion, or the Lord\'s Supper. He took bread, broke it, and said: "This is my body, which is given for you. Do this in remembrance of me." (Luke 22:19)'),
  ),
  p(
    text('Afterward, he went to the Garden of Gethsemane to pray. Luke records that "his sweat became like great drops of blood falling down to the ground" (Luke 22:44) — a rare medical phenomenon known as hematidrosis, which can occur under extreme psychological stress. He prayed: "Father, if you are willing, remove this cup from me. Nevertheless, not my will, but yours, be done."'),
  ),
  blockquote('"Greater love has no one than this, that someone lay down his life for his friends." — John 15:13'),
  h(2, 'The Trial and Crucifixion'),
  p(
    text('After being betrayed by Judas for thirty pieces of silver, arrested, denied by Peter, and abandoned by most of his disciples, Jesus was brought before Pilate. Despite finding "no guilt in him" (John 18:38), Pilate handed him over to be crucified under pressure from the crowd.'),
  ),
  p(
    text('He was flogged, mocked, crowned with thorns, and forced to carry his own cross. He was crucified between two criminals. From the cross he spoke seven final sayings, including: "It is finished." (John 19:30) The Greek word — '),
    text('tetelestai', [italic]),
    text(' — was used on commercial receipts to mean "paid in full."'),
  ),
  p(
    marked('Quiz: Where was Jesus crucified?', c3_quiz_location),
  ),
  h(2, 'Video: The Death and Resurrection of Jesus'),
  p(
    text('Before reading about the resurrection, watch this overview from BibleProject.'),
  ),
  p(
    marked('The Resurrection — BibleProject (7 min)', c3_video_resurrection),
  ),
  h(2, 'The Empty Tomb'),
  p(
    text('Three days later, on the first day of the week, Mary Magdalene went to the tomb at dawn. She found the stone rolled away. The tomb was empty. An angel appeared and said: "He is not here, for he has risen, as he said." (Matthew 28:6)'),
  ),
  p(
    text('Over the following forty days, the risen Jesus appeared to his disciples on multiple occasions. Paul records that he appeared to more than five hundred people at one time (1 Corinthians 15:6). The disciples — who had locked themselves in a room for fear (John 20:19) — were transformed into bold witnesses who proclaimed the resurrection at the risk of their lives.'),
  ),
  p(
    text('In one word, what does the resurrection mean to you? '),
    widget(c3_tb_word),
  ),
  h(2, 'Questions and Doubts Are Welcome'),
  p(
    text('The resurrection is the most extraordinary claim in the Gospels — and in all of history. Doubt is not a sign of weakness; it is the beginning of honest inquiry. Thomas, one of the twelve, refused to believe until he saw the risen Jesus for himself (John 20:24–28). When Jesus appeared, he did not rebuke Thomas — he showed him his wounds.'),
  ),
  p(
    text('What questions are you wrestling with? '),
    widget(c3_textarea_doubts),
  ),
  h(2, 'Why Does the Resurrection Matter?'),
  p(
    text('Paul\'s letter to the Corinthians cuts straight to the heart: "And if Christ has not been raised, your faith is futile and you are still in your sins." (1 Corinthians 15:17) The resurrection is not a peripheral detail of the Christian faith — it is its foundation.'),
  ),
  ul(
    'It validates Jesus\'s identity and his claims about himself.',
    'It defeats the power of death and offers hope of new life.',
    'It confirms that the sacrifice on the cross was accepted.',
    'It launches the mission of the Church to all nations.',
  ),
  p(
    text('What do you believe is the primary significance? '),
    widget(c3_radio_sig),
  ),
  h(2, 'Final Reflection'),
  p(
    text('You have now surveyed the birth, ministry, teachings, death, and resurrection of Jesus across all four Gospels. Take as much space as you need for a final honest reflection:'),
  ),
  p(
    marked('Your final personal response.', c3_q_personal),
  ),
  h(2, 'Going Deeper'),
  p(
    text('To continue your study, we recommend reading the Gospel of Mark in one sitting (it takes about 90 minutes) — it is the fastest-paced and most visceral of the four accounts. Then compare it with John\'s Gospel, which covers the same events but from an entirely different theological vantage point.'),
  ),
  blockquote('"For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life." — John 3:16'),
);

await db.from('chapters').update({ content: ch3Content, content_text: 'The Road to Jerusalem Everything in the Gospels moves toward Jerusalem Jesus had predicted his death three times', word_count: 500, estimated_read_time_minutes: 3 }).eq('id', ch3.id);
console.log('    ✓ Chapter 3 content updated');

// ─────────────────────────────────────────────────────────────────────────────
// DONE
// ─────────────────────────────────────────────────────────────────────────────
console.log(`
  ✅ Seed complete!

  Book:     "Understanding the Gospels"
  URL:      http://localhost:5173/read/understanding-the-gospels-test
  Edit:     http://localhost:5173/edit/book/${bookId}
  Dashboard: http://localhost:5173/edit/book/${bookId}/dashboard

  Chapters:
    Ch 1 — The Life and Ministry of Jesus      (4 form elements + 1 video)
    Ch 2 — The Teachings of Jesus              (5 form elements + 1 video)
    Ch 3 — The Death and Resurrection of Jesus (5 form elements + 1 video)

  Total interactive elements: 15 (poll ×2, question ×4, quiz ×3, radio ×2,
    checkbox ×1, select ×1, multiselect ×1, textbox ×1, textarea ×2, video ×3)

  To test the response review:
    1. Open the book as a different user (or in an incognito tab)
    2. Answer all questions / polls / forms
    3. Visit the Dashboard → Responses tab as the author
    4. Use the chapter sidebar and filter to review responses
`);
