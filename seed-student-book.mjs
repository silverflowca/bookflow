#!/usr/bin/env node
/**
 * Seed: Students: What I Think About School
 *
 * 3 chapters — questions, polls, surveys, video, image, highlight, notes.
 * Run with:
 *   node book-seeder.mjs seed-student-book.mjs --author=you@example.com
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
  title:       'Students: What I Think About School',
  subtitle:    'Your voice. Your story. Your school.',
  description: 'A fun, honest, interactive book where students share what they really think about school — from favourite subjects to dream futures. Every page is a conversation.',
  visibility:  'public',
  slug:        'students-what-i-think-about-school',
  coverImageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80',
});

const bookId   = book.id;
const authorId = author.id;

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER 1 — School Life: The Good, The Bad & The Hilarious
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  Chapter 1…');

// Create chapter shell first so we have the ID for inline content
const ch1 = await createChapter({
  bookId,
  title:      'School Life: The Good, The Bad & The Hilarious',
  content:    doc(p('placeholder')),  // replaced below
  contentText: '',
  status:     'published',
  orderIndex: 0,
  slug:       'school-life-good-bad-hilarious',
});

// ── Inline content ────────────────────────────────────────────────────────────
const c1_poll_fav = await addInlineContent({
  chapterId:   ch1.id, authorId,
  contentType: 'poll',
  anchorText:  'Favourite subject poll',
  position:    'inline',
  contentData: {
    question:               'What is your favourite subject right now?',
    allow_multiple:         false,
    show_results_before_vote: false,
    options: [
      { id: 'opt_math',   text: '📐 Math' },
      { id: 'opt_eng',    text: '📖 English / Language Arts' },
      { id: 'opt_sci',    text: '🔬 Science' },
      { id: 'opt_hist',   text: '🏛️ History / Social Studies' },
      { id: 'opt_art',    text: '🎨 Art or Music' },
      { id: 'opt_pe',     text: '⚽ Physical Education' },
      { id: 'opt_tech',   text: '💻 Technology / Computer Science' },
    ],
  },
});

const c1_q_why_fav = await addInlineContent({
  chapterId:   ch1.id, authorId,
  contentType: 'question',
  anchorText:  'Why is it your favourite?',
  position:    'inline',
  contentData: {
    question: 'Why is that your favourite subject? What makes it click for you?',
    type:     'open',
  },
});

const c1_poll_morning = await addInlineContent({
  chapterId:   ch1.id, authorId,
  contentType: 'poll',
  anchorText:  'Morning feeling poll',
  position:    'inline',
  contentData: {
    question:               'How do you usually feel on Monday mornings?',
    allow_multiple:         false,
    show_results_before_vote: true,
    options: [
      { id: 'opt_excited', text: '😄 Actually excited!' },
      { id: 'opt_ok',      text: '😐 Fine, it is what it is' },
      { id: 'opt_tired',   text: '😴 Half asleep and not happy about it' },
      { id: 'opt_dread',   text: '😩 Full-on dread' },
    ],
  },
});

const c1_highlight_quote = await addInlineContent({
  chapterId:   ch1.id, authorId,
  contentType: 'highlight',
  anchorText:  'School is not just academics',
  position:    'inline',
  contentData: { color: '#fde68a', note: 'Read this slowly — it is worth thinking about.' },
});

const c1_q_funniest = await addInlineContent({
  chapterId:   ch1.id, authorId,
  contentType: 'question',
  anchorText:  'Funniest school moment',
  position:    'inline',
  contentData: {
    question: 'What is the funniest or most unexpected thing that has happened to you at school?',
    type:     'open',
  },
});

const c1_radio_lunch = await addInlineContent({
  chapterId:   ch1.id, authorId,
  contentType: 'radio',
  anchorText:  'Lunch preference',
  position:    'end_of_chapter',
  contentData: {
    label: '🍕 What is your lunch situation?',
    layout: 'vertical',
    options: [
      { id: 'r1', text: 'I bring lunch from home every day' },
      { id: 'r2', text: 'I buy from the cafeteria' },
      { id: 'r3', text: 'Mix of both depending on the day' },
      { id: 'r4', text: 'I somehow always forget lunch' },
    ],
  },
});

const c1_check_activities = await addInlineContent({
  chapterId:   ch1.id, authorId,
  contentType: 'checkbox',
  anchorText:  'School activities',
  position:    'end_of_chapter',
  contentData: {
    label: '🎒 Which of these are part of your school life? (check all that apply)',
    layout: 'vertical',
    options: [
      { id: 'c1', text: 'Sports team or club' },
      { id: 'c2', text: 'Student council or leadership' },
      { id: 'c3', text: 'Arts, drama, or music group' },
      { id: 'c4', text: 'Tutoring or study group' },
      { id: 'c5', text: 'Volunteering or community service' },
      { id: 'c6', text: 'Online clubs or gaming club' },
      { id: 'c7', text: 'I just go to class and go home 😅' },
    ],
  },
});

// ── Build the actual TipTap content ──────────────────────────────────────────
const ch1Content = doc(
  h(1, '🏫 School Life: The Good, The Bad & The Hilarious'),

  p('School. You spend more time there than almost anywhere else in your life. You have probably had days that felt amazing and days that felt like they would never end. This book is about YOUR experience — no wrong answers, no grades, just honest conversations.'),

  p('Let\'s start with the big one:'),

  widget(c1_poll_fav),

  p(marked('School is not just about academics', c1_highlight_quote), text(' — it is about friendships built in hallways, inside jokes in class, the teachers who changed your mind about something, and the weird traditions that only your school has.')),

  p('Now that you picked your favourite subject…'),
  widget(c1_q_why_fav),

  h(2, '⏰ Monday Mornings — A Universal Experience'),

  p('There is a universal human experience that connects students across every country, grade, and school: the Monday morning feeling.'),

  widget(c1_poll_morning),

  p('Whatever your answer — you are not alone. Even teachers have voted on this one (the results might surprise you 👀).'),

  h(2, '😂 School is Also... Hilarious'),

  p('Some of the best memories you will have from school are the completely unexpected ones. The fire drill during the most dramatic moment of a movie. The sub who accidentally showed the wrong video. The lunch tray incident of which we shall not speak.'),

  widget(c1_q_funniest),

  h(2, '🍽️ The Cafeteria Chronicles'),

  p('Let\'s settle this once and for all:'),
  widget(c1_radio_lunch),

  p('And while we are here — what does your school life actually look like beyond class?'),
  widget(c1_check_activities),
);

// Patch the chapter with real content
const ch1Text = `School Life: The Good, The Bad & The Hilarious
School. You spend more time there than almost anywhere else in your life.
Favourite subject poll. Why is that your favourite subject?
How do you usually feel on Monday mornings?
School is not just about academics — it is about friendships.
What is the funniest or most unexpected thing that has happened to you at school?
What is your lunch situation? Which of these are part of your school life?`;

const { error: e1 } = await db.from('chapters').update({
  content: ch1Content,
  content_text: ch1Text,
  word_count: ch1Text.split(/\s+/).filter(Boolean).length,
  estimated_read_time_minutes: Math.max(1, Math.round(ch1Text.split(/\s+/).filter(Boolean).length / 200)),
}).eq('id', ch1.id);
if (e1) console.warn('    ⚠ content patch ch1:', e1.message);
else console.log('    ✓ Chapter 1 content updated');

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER 2 — Teachers, Tests & The Stuff They Don't Teach You
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  Chapter 2…');

const ch2 = await createChapter({
  bookId,
  title:      'Teachers, Tests & The Stuff They Don\'t Teach You',
  content:    doc(p('placeholder')),
  contentText: '',
  status:     'published',
  orderIndex: 1,
  slug:       'teachers-tests-stuff-they-dont-teach',
});

const c2_q_best_teacher = await addInlineContent({
  chapterId: ch2.id, authorId,
  contentType: 'question',
  anchorText:  'Best teacher quality',
  position:    'inline',
  contentData: {
    question: 'Think of the best teacher you have ever had. What made them great? What did they do differently?',
    type:     'open',
  },
});

const c2_poll_test_style = await addInlineContent({
  chapterId: ch2.id, authorId,
  contentType: 'poll',
  anchorText:  'Test style preference',
  position:    'inline',
  contentData: {
    question:               'Which test format do you actually prefer?',
    allow_multiple:         false,
    show_results_before_vote: false,
    options: [
      { id: 'ts1', text: '✏️ Multiple choice — quick and clear' },
      { id: 'ts2', text: '📝 Written essay — I can explain myself' },
      { id: 'ts3', text: '🎤 Oral / presentation — I like to talk' },
      { id: 'ts4', text: '🛠️ Project-based — show what I made' },
      { id: 'ts5', text: '🙈 None. No tests. Please.' },
    ],
  },
});

const c2_poll_stress = await addInlineContent({
  chapterId: ch2.id, authorId,
  contentType: 'poll',
  anchorText:  'Stress level poll',
  position:    'inline',
  contentData: {
    question:               'How stressed do you feel about school on an average week?',
    allow_multiple:         false,
    show_results_before_vote: true,
    options: [
      { id: 'st1', text: '😎 Barely stressed — I have it handled' },
      { id: 'st2', text: '🙂 A little pressure but mostly fine' },
      { id: 'st3', text: '😬 Regularly stressed, especially around deadlines' },
      { id: 'st4', text: '😰 Very stressed most of the time' },
      { id: 'st5', text: '🤯 Completely overwhelmed' },
    ],
  },
});

const c2_q_cope = await addInlineContent({
  chapterId: ch2.id, authorId,
  contentType: 'question',
  anchorText:  'Coping with stress',
  position:    'inline',
  contentData: {
    question: 'What do you do when school stress gets too much? What actually helps you reset?',
    type:     'open',
  },
});

const c2_select_homework = await addInlineContent({
  chapterId: ch2.id, authorId,
  contentType: 'select',
  anchorText:  'Homework timing',
  position:    'end_of_chapter',
  contentData: {
    label: '🏠 When do you usually do homework?',
    placeholder: 'Pick your honest answer…',
    options: [
      { id: 'hw1', text: 'Right after school while it is fresh' },
      { id: 'hw2', text: 'After dinner when things quiet down' },
      { id: 'hw3', text: 'Late at night (aka the night before)' },
      { id: 'hw4', text: 'During a free period at school' },
      { id: 'hw5', text: 'What is homework? 😇' },
    ],
  },
});

const c2_multiselect_missing = await addInlineContent({
  chapterId: ch2.id, authorId,
  contentType: 'multiselect',
  anchorText:  'Missing skills',
  position:    'end_of_chapter',
  contentData: {
    label: '🧠 What life skills do you WISH school taught you? (pick up to 3)',
    max_selections: 3,
    options: [
      { id: 'm1', text: 'Managing money and budgets' },
      { id: 'm2', text: 'Mental health and emotional resilience' },
      { id: 'm3', text: 'Cooking basic meals' },
      { id: 'm4', text: 'How to negotiate or advocate for yourself' },
      { id: 'm5', text: 'Critical thinking about media and news' },
      { id: 'm6', text: 'Time management and productivity' },
      { id: 'm7', text: 'Starting a business or freelancing' },
      { id: 'm8', text: 'Understanding your legal rights' },
    ],
  },
});

const c2_note_ted = await addInlineContent({
  chapterId: ch2.id, authorId,
  contentType: 'note',
  anchorText:  'Ken Robinson quote',
  position:    'inline',
  contentData: {
    type: 'reference',
    text: 'Sir Ken Robinson\'s TED Talk "Do Schools Kill Creativity?" is one of the most-watched TED Talks ever — over 70 million views. He argued that creativity is as important as literacy and should be treated the same way.',
  },
});

// YouTube video embed — Ken Robinson TED Talk
const c2_video = await addInlineContent({
  chapterId: ch2.id, authorId,
  contentType: 'video',
  anchorText:  'Ken Robinson TED Talk',
  position:    'inline',
  contentData: {
    url:   'https://www.youtube.com/watch?v=iG9CE55wbtY',
    title: 'Do Schools Kill Creativity? — Sir Ken Robinson (TED Talk)',
    size:  75,
  },
});

const c2_q_video = await addInlineContent({
  chapterId: ch2.id, authorId,
  contentType: 'question',
  anchorText:  'Reaction to the TED talk',
  position:    'inline',
  contentData: {
    question: 'After watching the video: Do you agree that schools sometimes suppress creativity? Share your honest reaction.',
    type:     'open',
  },
});

const ch2Content = doc(
  h(1, '👩‍🏫 Teachers, Tests & The Stuff They Don\'t Teach You'),

  p('Teachers have the power to make a subject come alive — or put you to sleep before you reach period 2. The best ones do something most people can\'t explain. Let\'s talk about them.'),

  widget(c2_q_best_teacher),

  h(2, '📝 The Test Question'),

  p('Tests are one of the most debated topics in education. Some people love the clear goal of a test. Others think it measures stress tolerance more than actual knowledge.'),

  widget(c2_poll_test_style),

  h(2, '😬 Let\'s Talk About Stress'),

  p('Here is something most adults do not say out loud: student life can be genuinely stressful. Deadlines, social pressure, expectations from home — it adds up.'),

  widget(c2_poll_stress),

  p('Stress is normal. But how you deal with it matters.'),

  widget(c2_q_cope),

  h(2, '🏠 Homework: The Eternal Debate'),

  p('Research on homework is actually mixed — some studies say it helps, others say it hurts wellbeing. Here is what we know: WHEN you do it matters.'),

  widget(c2_select_homework),

  h(2, '🎬 The TED Talk That Shook Education'),

  p(marked('"Do Schools Kill Creativity?"', c2_note_ted), text(' — a question that has sparked debates in classrooms, parliaments, and parent meetings for two decades. Watch it yourself:')),

  widget(c2_video),

  widget(c2_q_video),

  h(2, '🧠 The Skills Gap'),

  p('Most students can solve a quadratic equation but have no idea how to write a cheque, negotiate a salary, or manage anxiety. What do YOU think is missing?'),

  widget(c2_multiselect_missing),
);

const ch2Text = `Teachers, Tests & The Stuff They Don't Teach You
Think of the best teacher you have ever had. What made them great?
Which test format do you actually prefer?
How stressed do you feel about school on an average week?
What do you do when school stress gets too much?
When do you usually do homework?
Do Schools Kill Creativity? TED Talk by Sir Ken Robinson.
After watching the video: Do you agree that schools sometimes suppress creativity?
What life skills do you WISH school taught you?`;

const { error: e2 } = await db.from('chapters').update({
  content: ch2Content,
  content_text: ch2Text,
  word_count: ch2Text.split(/\s+/).filter(Boolean).length,
  estimated_read_time_minutes: Math.max(1, Math.round(ch2Text.split(/\s+/).filter(Boolean).length / 200)),
}).eq('id', ch2.id);
if (e2) console.warn('    ⚠ content patch ch2:', e2.message);
else console.log('    ✓ Chapter 2 content updated');

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER 3 — Dreams, Goals & What Comes After
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  Chapter 3…');

const ch3 = await createChapter({
  bookId,
  title:      'Dreams, Goals & What Comes After',
  content:    doc(p('placeholder')),
  contentText: '',
  status:     'published',
  orderIndex: 2,
  slug:       'dreams-goals-what-comes-after',
});

const c3_poll_future = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'poll',
  anchorText:  'Future direction',
  position:    'inline',
  contentData: {
    question:               'What direction are you leaning after school?',
    allow_multiple:         false,
    show_results_before_vote: true,
    options: [
      { id: 'f1', text: '🎓 University / College' },
      { id: 'f2', text: '🛠️ Trades or technical school' },
      { id: 'f3', text: '💼 Start working right away' },
      { id: 'f4', text: '🚀 Launch my own business' },
      { id: 'f5', text: '✈️ Travel or gap year first' },
      { id: 'f6', text: '🤔 Honestly have no idea yet' },
    ],
  },
});

const c3_q_dream = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'question',
  anchorText:  'Dream job / calling',
  position:    'inline',
  contentData: {
    question: 'If money and grades were not a factor — what would you do with your life? Describe your dream.',
    type:     'open',
  },
});

const c3_poll_obstacle = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'poll',
  anchorText:  'Biggest obstacle',
  position:    'inline',
  contentData: {
    question:               'What feels like your biggest obstacle right now in reaching your goals?',
    allow_multiple:         true,
    show_results_before_vote: false,
    options: [
      { id: 'ob1', text: '💸 Money — fees, costs, lack of resources' },
      { id: 'ob2', text: '📚 Grades — I worry I am not smart enough' },
      { id: 'ob3', text: '🤔 Clarity — I do not know what I want yet' },
      { id: 'ob4', text: '👨‍👩‍👦 Family — expectations or responsibilities at home' },
      { id: 'ob5', text: '🧠 Mental health — anxiety, burnout or confidence' },
      { id: 'ob6', text: '🌍 Opportunity — limited access in my area' },
    ],
  },
});

const c3_q_overcome = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'question',
  anchorText:  'How you will overcome it',
  position:    'inline',
  contentData: {
    question: 'What is ONE thing you could do this week — even something small — to move toward your goal?',
    type:     'open',
  },
});

// Image — students graduating / looking forward
const c3_image = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'image',
  anchorText:  'Students celebrating',
  position:    'inline',
  contentData: {
    url:     'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=900&q=80',
    alt:     'Students celebrating graduation outdoors',
    caption: 'Your next chapter is being written right now.',
    width:   'full',
  },
});

// YouTube — motivational student success video
const c3_video = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'video',
  anchorText:  'Student success stories',
  position:    'inline',
  contentData: {
    url:   'https://www.youtube.com/watch?v=qSJCSR4MuhU',
    title: 'Students Who Changed the World — Inspiring Stories',
    size:  75,
  },
});

const c3_textarea_letter = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'textarea',
  anchorText:  'Letter to future self',
  position:    'end_of_chapter',
  contentData: {
    label:       '✉️ Write a short letter to your future self — 5 years from now',
    placeholder: 'Dear future me, Right now I am in school and I am thinking about… I hope that by now you have…',
    rows:        8,
    auto_expand: true,
    show_label:  true,
    label_position: 'above',
  },
});

const c3_multiselect_change = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'multiselect',
  anchorText:  'School changes',
  position:    'end_of_chapter',
  contentData: {
    label: '🗳️ If you could change 3 things about your school, what would they be?',
    max_selections: 3,
    options: [
      { id: 'sc1', text: 'Start school later in the morning' },
      { id: 'sc2', text: 'More choice in what subjects I take' },
      { id: 'sc3', text: 'Better mental health support on campus' },
      { id: 'sc4', text: 'Less homework and more project time' },
      { id: 'sc5', text: 'Better food in the cafeteria' },
      { id: 'sc6', text: 'More technology and creative tools' },
      { id: 'sc7', text: 'Smaller class sizes' },
      { id: 'sc8', text: 'More real-world skills in the curriculum' },
      { id: 'sc9', text: 'A quieter, calmer environment' },
    ],
  },
});

const c3_textbox_name = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'textbox',
  anchorText:  'Your name',
  position:    'end_of_chapter',
  contentData: {
    label:       '🏅 Sign your name here — you have just completed this book',
    placeholder: 'Your name',
    required:    true,
    max_length:  100,
    width:       'md',
    show_label:  true,
    label_position: 'above',
  },
});

const c3_highlight_end = await addInlineContent({
  chapterId: ch3.id, authorId,
  contentType: 'highlight',
  anchorText:  'Your story is still being written',
  position:    'inline',
  contentData: { color: '#bbf7d0', note: 'Remember this one.' },
});

const ch3Content = doc(
  h(1, '🌟 Dreams, Goals & What Comes After'),

  p('School is preparation — but for what, exactly? The answer is different for every student. Let\'s talk about what comes next for YOU.'),

  widget(c3_poll_future),

  h(2, '💭 The Dream Question'),

  p('Before you answer this next one, take a breath. There is no wrong answer. Nobody is grading this.'),

  widget(c3_q_dream),

  {
    type: 'blockquote',
    content: [p('"The future belongs to those who believe in the beauty of their dreams." — Eleanor Roosevelt')],
  },

  h(2, '🚧 Real Talk: Obstacles Are Real'),

  p('Dreams are great. But let\'s also be honest — there are real things that get in the way. What is standing between you and where you want to be?'),

  widget(c3_poll_obstacle),

  p('Naming the obstacle is the first step. Now — what can you do about it?'),

  widget(c3_q_overcome),

  h(2, '🎓 Imagine the Finish Line'),

  { type: 'paragraph', content: [
    { type: 'text', text: 'Imagine yourself five years from now. You made it through. ', marks: [] },
    { type: 'text', text: 'Your story is still being written', marks: [
      { type: 'inlineContentMark', attrs: { contentType: 'highlight', contentId: c3_highlight_end.id } },
    ]},
    { type: 'text', text: ' — and this chapter is one of the most important ones.', marks: [] },
  ]},

  {
    type: 'paragraph',
    content: [{ type: 'text', text: '' }],
  },

  // Image
  {
    type: 'inlineFormWidget',
    attrs: {
      contentId:   c3_image.id,
      contentType: 'image',
      anchorText:  'Students celebrating',
      position:    'inline',
      contentData: c3_image.content_data,
    },
  },

  h(2, '🎬 Students Who Changed the World'),

  p('You are not alone in having big ideas and feeling uncertain about the future. Watch what is possible:'),

  widget(c3_video),

  h(2, '🏫 If YOU Were in Charge…'),

  p('Before we wrap up — one last survey:'),

  widget(c3_multiselect_change),

  h(2, '✉️ A Note to Future You'),

  p('The most powerful thing you can do right now is write it down. Not a plan — just a letter. From who you are today to who you will be.'),

  widget(c3_textarea_letter),

  p('—'),

  widget(c3_textbox_name),

  p('Thank you for being honest in this book. Your answers matter. Your voice matters. And wherever school takes you next — you have got something to say about it. 🙌'),
);

const ch3Text = `Dreams, Goals & What Comes After
What direction are you leaning after school?
If money and grades were not a factor what would you do with your life?
What feels like your biggest obstacle right now?
What is ONE thing you could do this week to move toward your goal?
Your story is still being written.
Students Who Changed the World video.
If you could change 3 things about your school what would they be?
Write a short letter to your future self.
Sign your name here.`;

const { error: e3 } = await db.from('chapters').update({
  content: ch3Content,
  content_text: ch3Text,
  word_count: ch3Text.split(/\s+/).filter(Boolean).length,
  estimated_read_time_minutes: Math.max(1, Math.round(ch3Text.split(/\s+/).filter(Boolean).length / 200)),
}).eq('id', ch3.id);
if (e3) console.warn('    ⚠ content patch ch3:', e3.message);
else console.log('    ✓ Chapter 3 content updated');

// ─────────────────────────────────────────────────────────────────────────────
console.log(`
✅ Done!

  Book:      "${book.title}"
  ID:        ${book.id}
  Slug:      /bl/students-what-i-think-about-school
  Chapters:  3
  Author:    ${author.email}

  View it at: http://localhost:5177/edit/book/${book.id}
`);
