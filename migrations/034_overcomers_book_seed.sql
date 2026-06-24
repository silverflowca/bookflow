-- ============================================================================
-- Migration 034: Overcomers — 10-chapter interactive book seed
-- ============================================================================

DO $$
DECLARE
  v_author_id   uuid;
  v_book_id     uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_ch          uuid[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid()
  ];
BEGIN
  -- Author lookup
  SELECT id INTO v_author_id FROM bookflow.profiles
  WHERE email IN ('admin.steen@silverflow.ca','damion.steen@silverflow.ca')
  ORDER BY (email = 'admin.steen@silverflow.ca') DESC
  LIMIT 1;

  IF v_author_id IS NULL THEN
    SELECT id INTO v_author_id FROM bookflow.profiles
    WHERE system_role = 'super_admin' LIMIT 1;
  END IF;

  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM bookflow.books WHERE id = v_book_id) THEN
    RAISE NOTICE 'Overcomers book already seeded — skipping.';
    RETURN;
  END IF;

  -- ── BOOK ──────────────────────────────────────────────────────────────────
  INSERT INTO bookflow.books (
    id, title, subtitle, description, cover_image_url,
    author_id, status, visibility, slug, published_at, review_status
  ) VALUES (
    v_book_id,
    'Overcomers',
    'A Journey from Struggle to Strength',
    'A 10-chapter interactive guide for those walking through life''s hardest seasons — addiction, grief, fear, shame, and loss — with reflection questions, community polls, and personal journaling throughout.',
    'https://mladgojbfyofgauiylxw.supabase.co/storage/v1/object/public/bookflow-covers/covers/55914126-5a8a-4b86-a7c6-33eb3c201a36/overcomers-cover.png',
    v_author_id,
    'published',
    'public',
    'overcomers',
    NOW(),
    'none'
  );

  -- ── BOOK SETTINGS ─────────────────────────────────────────────────────────
  INSERT INTO bookflow.book_settings (
    book_id, allow_reader_highlights, allow_reader_notes,
    allow_reader_questions, allow_reader_polls,
    show_author_highlights, show_author_notes,
    enable_progress_tracking, show_ratings
  ) VALUES (
    v_book_id, true, true, true, true, true, true, true, true
  ) ON CONFLICT (book_id) DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 1 — The Weight We Carry
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[1], v_book_id, 'The Weight We Carry', 0, 'published', 420, 3,
  'Every overcomer has a starting point — a moment when the weight became too heavy to ignore. This chapter explores what it means to acknowledge our burdens.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"The Weight We Carry"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Every overcomer has a starting point — a moment when the weight became too heavy to ignore. Before we can rise, we must first be honest about what is pulling us down. Burdens come in many forms: addiction, grief, shame, fear, broken relationships, and the quiet despair that nobody else can see."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1474418397713-7ede21d49118?w=900&q=80","alt":"Person sitting alone on a hillside at dusk","title":"The weight of unspoken pain"}},
      {"type":"paragraph","content":[{"type":"text","text":"The first act of overcoming is naming what is real. For too long, many of us have minimised our pain — told ourselves it is not that bad, that others have it worse, that we should just push through. But unnamed burdens grow heavier in the dark. They do not shrink when ignored; they expand."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Psychologists call this process acknowledgment, and research consistently shows that the simple act of putting words to our pain activates different neural pathways — pathways associated with regulation and healing rather than avoidance and shame. You are not weak for feeling the weight. You are human."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Throughout history, the greatest stories of transformation begin not with a triumph but with a breaking point. The moment someone hits the floor is often the moment the journey upward begins. Your floor — whatever it looks like — is not your end. It is your starting line."}]},
      {"type":"paragraph","content":[{"type":"text","text":"In this book, we will walk through ten chapters of honest conversation. You will be invited to reflect, to answer, to wrestle, and to grow. There are no right answers here — only your answers. Give yourself permission to be honest, even when honesty is uncomfortable."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=80","alt":"Mountain path in the fog representing the journey ahead","title":"Every journey begins with a single step"}}
    ]
  }'::jsonb);

  -- Ch1 interactive content
  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[1], 'question', 0, 0,
   '{"question_text":"What is the heaviest burden you are carrying right now? Describe it in your own words.","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[1], 'poll', 0, 0,
   '{"poll_text":"Which best describes where you are starting this journey?","options":[{"id":"a","text":"I am in crisis and need help now"},{"id":"b","text":"I am struggling but managing"},{"id":"c","text":"I am healing but want to go deeper"},{"id":"d","text":"I am supporting someone else"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[1], 'textbox', 0, 0,
   '{"label":"Complete this sentence: The one thing I have never told anyone about my struggle is ___","placeholder":"Write freely — this is your private space","required":false,"max_length":300}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2);

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 2 — Breaking the Silence
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[2], v_book_id, 'Breaking the Silence', 1, 'published', 450, 3,
  'Silence is not always golden. For those walking through pain, silence can become a prison. This chapter is about finding your voice.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Breaking the Silence"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Silence is not always golden. For those walking through pain, silence can become a prison — a place where shame multiplies and hope diminishes. One of the most courageous acts a person can take is to speak their truth to another human being."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1521791136064-7986c2920216?w=900&q=80","alt":"Two people having an honest conversation over coffee","title":"Breaking the silence with trusted community"}},
      {"type":"paragraph","content":[{"type":"text","text":"The science of vulnerability is compelling. Dr. Brené Brown''s decades of research reveal that vulnerability — the willingness to be seen in our imperfection — is not weakness. It is, in fact, the birthplace of connection, creativity, and change. When we choose silence to protect ourselves, we often end up more isolated and more ashamed."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Breaking the silence does not mean broadcasting your story to the world. It means finding one safe person — a counsellor, a trusted friend, a spiritual leader, a support group — and saying out loud what you have only said to yourself in the dark. That single conversation can be the turning point."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Many overcomers describe the moment they first spoke honestly about their struggle as the scariest and simultaneously most relieving experience of their lives. The secret they feared would destroy them turned out to be the thing that, once released, began to lose its power."}]},
      {"type":"paragraph","content":[{"type":"text","text":"If you are not ready to speak to a person, start here. Write. Type. Draw. Externalise the internal. The act of expressing your pain — in any form — begins the process of separating you from your story so you can author a new one."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=80","alt":"Journal open on a wooden table with pen","title":"Writing as a form of breaking silence"}}
    ]
  }'::jsonb);

  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[2], 'poll', 0, 0,
   '{"poll_text":"Have you ever told anyone the full truth about your struggle?","options":[{"id":"a","text":"Yes — and it helped"},{"id":"b","text":"Yes — but it did not go well"},{"id":"c","text":"No — I am too afraid"},{"id":"d","text":"I am still deciding who to trust"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[2], 'question', 0, 0,
   '{"question_text":"Who is one person in your life you could trust with your story? What makes them safe?","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[2], 'textbox', 0, 0,
   '{"label":"Fill in the blank: I have been silent about ___ because I feared ___","placeholder":"Your honest answer here","required":false,"max_length":250}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2);

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 3 — The Root, Not the Fruit
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[3], v_book_id, 'The Root, Not the Fruit', 2, 'published', 460, 3,
  'Behaviours are fruit. Healing requires going to the root. This chapter helps identify the underlying causes beneath the surface struggles.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"The Root, Not the Fruit"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Addiction, anger, avoidance, anxiety — these are fruit. They are visible symptoms of something deeper growing underground. To truly overcome, we must go to the root. Cutting fruit off a tree without addressing the root system only produces more fruit of the same kind."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=900&q=80","alt":"Tree roots exposed along a riverbank","title":"Roots run deeper than what we see"}},
      {"type":"paragraph","content":[{"type":"text","text":"Common roots beneath destructive patterns include unresolved trauma, attachment wounds from childhood, deep shame, unmet emotional needs, and lies we have believed about ourselves. A person who numbs with alcohol may be medicating a wound of abandonment. Someone who rages may be protecting a core belief that they are powerless."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Root work is not about blame — not of others, and not of yourself. It is about understanding. When we understand why we do what we do, we gain the ability to make new choices. Without that understanding, we are simply white-knuckling our way through life, fighting symptoms while the root goes untreated."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Trauma-informed therapy, inner healing prayer, twelve-step work, and other evidence-based approaches all aim at the same thing: creating the conditions for root-level change. This kind of work takes time and often requires a guide — a therapist, a sponsor, a spiritual director — who has walked the path before you."}]},
      {"type":"paragraph","content":[{"type":"text","text":"As you reflect on your own patterns, approach yourself with the curiosity of a compassionate friend rather than the harshness of a critic. Ask: when did I first feel this way? What did I learn about myself in that season? What belief was formed? These questions, gently explored, are the beginning of root work."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&q=80","alt":"Seeds sprouting in soil representing new growth","title":"New growth begins underground"}}
    ]
  }'::jsonb);

  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[3], 'question', 0, 0,
   '{"question_text":"What pattern in your life keeps repeating? What do you think the root of it might be?","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[3], 'poll', 0, 0,
   '{"poll_text":"What do you think is most often the root of destructive patterns?","options":[{"id":"a","text":"Childhood trauma or wounds"},{"id":"b","text":"Unmet emotional needs"},{"id":"c","text":"Learned behaviour from family"},{"id":"d","text":"Spiritual emptiness or disconnection"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[3], 'textarea', 0, 0,
   '{"label":"Root reflection: The earliest memory I have of feeling the way I feel in my struggle is...","placeholder":"Take your time with this one. There is no rush.","required":false,"max_length":500,"rows":5}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2);

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 4 — Shame Off You
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[4], v_book_id, 'Shame Off You', 3, 'published', 440, 3,
  'Shame is one of the most powerful forces keeping people stuck. This chapter dismantles the shame narrative and replaces it with truth.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Shame Off You"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Guilt says: I did something bad. Shame says: I am something bad. This distinction is everything. Guilt can motivate change. Shame paralyses it. Overcomers must learn to separate who they are from what they have done — or what was done to them."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1504439468489-c8920d796a29?w=900&q=80","alt":"Person standing in sunlight with arms open wide","title":"Stepping out of the shadow of shame"}},
      {"type":"paragraph","content":[{"type":"text","text":"Shame thrives in secrecy, silence, and judgment. It is the inner voice that says you are too far gone, too broken, too much of a failure to deserve healing or community. Shame is a liar. It takes our worst moments and constructs an identity around them, convincing us that the moment defines us rather than merely describing us."}]},
      {"type":"paragraph","content":[{"type":"text","text":"The antidote to shame is not positive thinking. It is empathy — both from others and from ourselves. When we tell our story in a safe space and are met with compassion rather than judgment, shame loses its grip. This is why community is not optional for overcomers. Isolation feeds shame; connection starves it."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Many traditions speak to the power of being fully known and fully loved. This is not earned through behaviour improvement — it is the foundation from which behaviour change becomes possible. When you know at your core that your worth is not contingent on your performance, you are free to change — not to earn acceptance, but to express the person you already are."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Practise speaking truth against the shame narrative. When the voice says you are worthless, respond with: I am worthy of healing. When it says no one could love the real you, respond: I am fully known and fully loved. These are not affirmations to fake — they are truths to grow into."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=900&q=80","alt":"Group of people embracing in support","title":"Community breaks the power of shame"}}
    ]
  }'::jsonb);

  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[4], 'textbox', 0, 0,
   '{"label":"Fill in the blank: The shame message I hear most often is: \"I am ___\"","placeholder":"e.g. not enough, too broken, unlovable","required":false,"max_length":200}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[4], 'question', 0, 0,
   '{"question_text":"What would change in your life if you fully believed you were worthy of healing and love exactly as you are right now?","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[4], 'poll', 0, 0,
   '{"poll_text":"How often does shame stop you from seeking help or connection?","options":[{"id":"a","text":"Almost always"},{"id":"b","text":"Often"},{"id":"c","text":"Sometimes"},{"id":"d","text":"Rarely — I have worked through much of it"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2);

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 5 — Rewiring the Mind
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[5], v_book_id, 'Rewiring the Mind', 4, 'published', 465, 3,
  'Neuroscience confirms what overcomers experience: lasting change requires reshaping how we think. This chapter explores practical brain rewiring.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Rewiring the Mind"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Neuroscience has given us a remarkable gift: the discovery of neuroplasticity. The brain, once thought to be fixed after childhood, is actually capable of forming new pathways throughout life. This means that no matter how long a destructive pattern has been in place, the brain can learn new ways of thinking, feeling, and responding."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=900&q=80","alt":"Abstract image of glowing neural pathways","title":"The brain is always capable of new pathways"}},
      {"type":"paragraph","content":[{"type":"text","text":"Every thought you think travels along a neural pathway. Repeated thoughts wear grooves — like a path through a field. The more you travel that path, the more established it becomes. To rewire, you do not destroy the old path; you begin walking a new one, consistently, until the new path becomes the default."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Practical rewiring tools include: cognitive behavioural therapy (CBT) techniques for catching and challenging distorted thinking, mindfulness practices for observing thoughts without being controlled by them, gratitude journalling to redirect the brain''s negativity bias, and scripture or affirmation meditation for those with a faith framework."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Triggers are the brain''s old pathway activators. When a trigger arises — a smell, a person, a memory, an emotion — the brain defaults to its worn-in response. Rewiring involves creating a pause between trigger and response: notice, breathe, choose. That pause is where freedom lives."}]},
      {"type":"paragraph","content":[{"type":"text","text":"The work of rewiring is repetitive and sometimes tedious. It rarely feels dramatic. But over time, the new pathway strengthens and the old one weakens. One day you will find yourself responding differently without even trying — and you will know that the rewiring has taken hold."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&q=80","alt":"Person meditating peacefully outdoors in morning light","title":"Daily practice creates new neural pathways"}}
    ]
  }'::jsonb);

  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[5], 'poll', 0, 0,
   '{"poll_text":"Which rewiring practice have you found most helpful?","options":[{"id":"a","text":"Journalling and writing"},{"id":"b","text":"Meditation or mindfulness"},{"id":"c","text":"Therapy or counselling"},{"id":"d","text":"Prayer or scripture memorisation"},{"id":"e","text":"I have not tried any yet"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[5], 'textbox', 0, 0,
   '{"label":"My biggest mental trigger is ___ and my new chosen response will be ___","placeholder":"Identify one trigger and one new response","required":false,"max_length":300}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[5], 'question', 0, 0,
   '{"question_text":"What is one thought pattern you want to rewire? What new thought will you practise instead?","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2);

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 6 — The Power of Community
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[6], v_book_id, 'The Power of Community', 5, 'published', 450, 3,
  'No one overcomes alone. This chapter explores why community is not optional and how to build the right support network.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"The Power of Community"}]},
      {"type":"paragraph","content":[{"type":"text","text":"The lie of independence tells us we should be able to figure this out on our own. Needing others is seen as weakness in many cultures. But the data tells a different story: people who have strong social support networks recover faster, stay sober longer, grieve more healthily, and report significantly higher levels of wellbeing than those who go it alone."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=80","alt":"Diverse group of people gathered in a circle outdoors","title":"Community is the context for transformation"}},
      {"type":"paragraph","content":[{"type":"text","text":"Community does not mean surrounding yourself with anyone who is available. It means intentionally building relationships with people who are safe, honest, growing, and committed to your wellbeing even when it is inconvenient. Not everyone in your life qualifies for the inner circle."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Support groups — whether twelve-step programmes, church small groups, therapy groups, or recovery communities — provide a unique combination of accountability, shared understanding, and hope. Hearing the story of someone who has walked where you are walking and come out the other side is one of the most powerful forces for change available."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Healthy community also involves reciprocity — you give and you receive. As you begin to experience healing, one of the greatest accelerators is helping someone else who is earlier in the journey. This is not about being qualified or having it all together. It is about offering what you have received."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Begin small. You do not need a large network — you need a faithful few. Identify two or three people with whom you can be honest, who will speak truth to you in love, and who will show up when things get hard. Then protect and invest in those relationships like the lifelines they are."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1543269664-76bc3997d9ea?w=900&q=80","alt":"Friends sitting together around a campfire at night","title":"A faithful few change everything"}}
    ]
  }'::jsonb);

  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[6], 'question', 0, 0,
   '{"question_text":"Who are the two or three people in your life who could form your inner circle of support? What makes them trustworthy?","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[6], 'poll', 0, 0,
   '{"poll_text":"What is your biggest barrier to building a support community?","options":[{"id":"a","text":"Fear of judgment or rejection"},{"id":"b","text":"I do not know where to find safe people"},{"id":"c","text":"Past experiences of betrayal"},{"id":"d","text":"I prefer to handle things alone"},{"id":"e","text":"I already have good community"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[6], 'textbox', 0, 0,
   '{"label":"One step I will take this week to invest in community is ___","placeholder":"Be specific — what will you do and when?","required":false,"max_length":200}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2);

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 7 — Forgiving the Unforgivable
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[7], v_book_id, 'Forgiving the Unforgivable', 6, 'published', 455, 3,
  'Forgiveness is one of the most misunderstood concepts in healing. This chapter reframes forgiveness as a gift you give yourself.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Forgiving the Unforgivable"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Forgiveness is one of the most misunderstood and most resisted parts of the healing journey. Many people confuse forgiveness with excusing, forgetting, or reconciling. None of those are true. Forgiveness is the decision to release another person from the debt you feel they owe you — not because they deserve it, but because you deserve to be free."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=900&q=80","alt":"Open hands releasing a butterfly into the sky","title":"Forgiveness is releasing what is weighing you down"}},
      {"type":"paragraph","content":[{"type":"text","text":"Unforgiveness is like drinking poison and waiting for the other person to die. The anger, bitterness, and resentment that we hold onto do not punish the person who hurt us — in most cases, they have moved on and are entirely unaware. We are the ones who lie awake. We are the ones whose blood pressure rises. We are the ones imprisoned by what happened."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Forgiving does not mean the hurt was not real. It was. It does not mean what happened was acceptable. It was not. It does not mean you must restore the relationship. You may not. Forgiveness is an internal act — a decision of the will, often repeated many times as the emotions catch up — to no longer demand that the past be different."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Forgiveness of self is equally important and often harder. Many overcomers can eventually forgive others but remain mercilessly self-condemning. The same compassion you are learning to extend to others must eventually be turned inward. You, too, deserve to be released from the weight of your worst moments."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Forgiveness is a process, not a moment. Begin with willingness. Tell yourself — and perhaps tell God, if that is part of your framework — that you are willing to forgive, even if you cannot feel it yet. That willingness is enough to begin. The feeling follows the decision, not the other way around."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=80","alt":"Sunrise breaking over calm water representing a new beginning","title":"Forgiveness opens the door to a new beginning"}}
    ]
  }'::jsonb);

  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[7], 'poll', 0, 0,
   '{"poll_text":"Where are you in the forgiveness journey?","options":[{"id":"a","text":"I am not ready — the wound is too fresh"},{"id":"b","text":"I am willing but do not know how"},{"id":"c","text":"I am in the process — it is hard"},{"id":"d","text":"I have forgiven and experienced freedom"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[7], 'textbox', 0, 0,
   '{"label":"The person or situation I most need to forgive is ___ and the cost of not forgiving is ___","placeholder":"You do not have to share this with anyone","required":false,"max_length":300}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[7], 'question', 0, 0,
   '{"question_text":"What does forgiveness of yourself look like? What would you need to believe about yourself to extend that grace?","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2);

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 8 — Building New Habits
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[8], v_book_id, 'Building New Habits', 7, 'published', 460, 3,
  'Sustainable change is built on daily practices. This chapter provides a practical framework for replacing destructive habits with life-giving ones.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Building New Habits"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Overcoming is not a single dramatic event. It is a series of small daily choices that accumulate over time into a transformed life. The gap between who you are and who you are becoming is bridged not by grand gestures but by consistent, small practices — habits that eventually become automatic."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=900&q=80","alt":"Person journalling in a morning routine with coffee and a plant","title":"Small daily practices build a transformed life"}},
      {"type":"paragraph","content":[{"type":"text","text":"James Clear, in his landmark book Atomic Habits, argues that every action you take is a vote for the type of person you wish to become. Habits are not about outcomes — they are about identity. Rather than saying I am trying to quit drinking, the overcomer says I am someone who does not use alcohol to cope. The identity shift precedes the behaviour change."}]},
      {"type":"paragraph","content":[{"type":"text","text":"The habit loop — cue, routine, reward — applies to both destructive and life-giving patterns. To replace a harmful habit, identify its cue (what triggers it) and its reward (what need it meets), then insert a new routine that meets the same need without the harm. This is not willpower — it is engineering."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Morning routines are one of the most powerful habit anchors. When you structure the first hour of your day with intention — prayer, movement, reading, journalling — you set a tone that carries through the rest of your hours. Evening routines create a container for reflection and rest. Bookend your day with purpose."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Expect setbacks. Falling back into old patterns does not erase your progress — it is part of the process. The research shows that people who frame setbacks as learning experiences rather than failures return to their new habits faster and with more insight. The question is never whether you will stumble but how quickly you will get back up."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=900&q=80","alt":"Runner on an early morning road representing consistent discipline","title":"Discipline is the bridge between goals and results"}}
    ]
  }'::jsonb);

  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[8], 'question', 0, 0,
   '{"question_text":"What is one destructive habit you want to replace? What new habit will meet the same underlying need?","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[8], 'textbox', 0, 0,
   '{"label":"My morning routine commitment: Every morning I will ___ before I look at my phone","placeholder":"e.g. pray for 5 minutes, write 3 things I am grateful for, drink water and take a walk","required":false,"max_length":200}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[8], 'poll', 0, 0,
   '{"poll_text":"What is the hardest part of building new habits for you?","options":[{"id":"a","text":"Starting — getting the momentum going"},{"id":"b","text":"Consistency — I start well but fade"},{"id":"c","text":"Recovering after a setback"},{"id":"d","text":"Believing I am capable of change"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2);

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 9 — Purpose from Pain
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[9], v_book_id, 'Purpose from Pain', 8, 'published', 450, 3,
  'The deepest wounds often carry the most powerful messages. This chapter explores how your story becomes your assignment.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Purpose from Pain"}]},
      {"type":"paragraph","content":[{"type":"text","text":"One of the most remarkable patterns in human transformation is this: the thing that nearly destroys you often becomes the very thing you are called to address in the world. The recovering addict becomes the addiction counsellor. The survivor of domestic violence becomes the shelter advocate. The bereaved parent becomes the grief support group leader."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&q=80","alt":"Person standing at a podium speaking to a group with confidence","title":"Your story has the power to set others free"}},
      {"type":"paragraph","content":[{"type":"text","text":"This is not a guarantee — pain does not automatically produce purpose. The conversion of wound to calling requires intentional work: processing the pain, finding meaning in the suffering, and choosing to use the insight gained for the benefit of others. It is a choice, and it is one of the most powerful choices available to any overcomer."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Viktor Frankl, a Holocaust survivor and psychiatrist, wrote in Man''s Search for Meaning that those who survived the unimaginable were not necessarily the strongest — they were the ones who found meaning in their suffering. Meaning does not minimise pain. It transcends it."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Your story — the full, unedited version including the darkest chapters — is exactly what someone else needs to hear. Not a polished, Instagram-ready version. The raw, honest account of where you have been and how you are finding your way through. That story, vulnerably shared in the right context, carries a power no professional credential can replicate."}]},
      {"type":"paragraph","content":[{"type":"text","text":"You do not need to be fully healed to begin helping others. In fact, the most effective helpers are often those in the middle of the journey — close enough to the pain to be credible, far enough along to offer hope. Ask yourself: who is five steps behind me on this path? What do I know now that I wish someone had told me then?"}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=900&q=80","alt":"Mentor and mentee walking together on a path","title":"Turn your test into your testimony"}}
    ]
  }'::jsonb);

  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[9], 'question', 0, 0,
   '{"question_text":"Looking at your pain and your journey so far — who is one person or group of people your story could help? How might you begin to share it?","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[9], 'poll', 0, 0,
   '{"poll_text":"Have you ever shared your story in a way that helped someone else?","options":[{"id":"a","text":"Yes — and it was powerful for both of us"},{"id":"b","text":"Yes — but I am not sure it helped"},{"id":"c","text":"No — I am not ready yet"},{"id":"d","text":"No — I do not think my story matters to others"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[9], 'textbox', 0, 0,
   '{"label":"The assignment I believe may have come from my pain is ___","placeholder":"Even a small or tentative answer is valuable here","required":false,"max_length":250}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2);

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAPTER 10 — Walking in Freedom
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, word_count, estimated_read_time_minutes, content_text, content)
  VALUES (v_ch[10], v_book_id, 'Walking in Freedom', 9, 'published', 470, 3,
  'Freedom is not a destination you arrive at — it is a way of walking. This final chapter equips you to sustain the transformation you have begun.',
  '{
    "type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Walking in Freedom"}]},
      {"type":"paragraph","content":[{"type":"text","text":"You have come to the final chapter. But this is not an ending — it is a commissioning. The work of overcoming is not finished when you close this book. Freedom is not a destination you arrive at and unpack your bags. It is a way of walking — a daily orientation toward truth, community, health, and purpose."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?w=900&q=80","alt":"Person walking on a wide open road towards the horizon in golden light","title":"Freedom is the way you walk, not just where you arrive"}},
      {"type":"paragraph","content":[{"type":"text","text":"Walking in freedom requires maintenance. Athletes do not get fit once and then stop training. Musicians do not master their instrument and then put it down. Freedom is cultivated through ongoing practice — continued community, continued honesty, continued growth, continued service. The moment we think we have arrived is often the moment we become most vulnerable."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Identify your warning signs — the internal indicators that you are drifting. For some it is isolation. For others it is irritability, dishonesty, or neglect of self-care. Know your early warning signs and have people around you who are permitted to name them when they see them. This is not weakness; it is wisdom."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Celebrate your progress. Overcomers have a tendency to minimise how far they have come. Comparison to where you want to be can blind you to how far you have already travelled. Look back. Acknowledge the courage it took to begin. Honour the work you have done. And let that acknowledgment fuel you for the road ahead."}]},
      {"type":"paragraph","content":[{"type":"text","text":"Finally, remember that your freedom is not just for you. Every person walking in authentic freedom carries a quiet authority that impacts everyone around them. Your children, your colleagues, your community — they are all affected by the choices you make to keep walking. You are not just healing yourself. You are rewriting the story for generations to come."}]},
      {"type":"image","attrs":{"src":"https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&q=80","alt":"Aerial view of a person standing on a mountain summit with arms raised","title":"You are further than you think — keep walking"}}
    ]
  }'::jsonb);

  INSERT INTO bookflow.inline_content (book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by, order_index) VALUES
  (v_book_id, v_ch[10], 'question', 0, 0,
   '{"question_text":"Reflecting on all ten chapters — what is the single most important thing you are taking away from this journey?","question_type":"free_response"}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 0),
  (v_book_id, v_ch[10], 'poll', 0, 0,
   '{"poll_text":"Which chapter impacted you the most?","options":[{"id":"1","text":"Ch 1 — The Weight We Carry"},{"id":"2","text":"Ch 2 — Breaking the Silence"},{"id":"3","text":"Ch 3 — The Root, Not the Fruit"},{"id":"4","text":"Ch 4 — Shame Off You"},{"id":"5","text":"Ch 5 — Rewiring the Mind"},{"id":"6","text":"Ch 6 — The Power of Community"},{"id":"7","text":"Ch 7 — Forgiving the Unforgivable"},{"id":"8","text":"Ch 8 — Building New Habits"},{"id":"9","text":"Ch 9 — Purpose from Pain"},{"id":"10","text":"Ch 10 — Walking in Freedom"}]}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 1),
  (v_book_id, v_ch[10], 'textbox', 0, 0,
   '{"label":"My commitment going forward: I will ___ to sustain my freedom and help others find theirs","placeholder":"Write a specific, personal commitment","required":false,"max_length":300}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 2),
  (v_book_id, v_ch[10], 'textarea', 0, 0,
   '{"label":"Write a letter to yourself one year from now — who do you hope to be?","placeholder":"Dear future me...","required":false,"max_length":1000,"rows":8}'::jsonb,
   'all_readers','end_of_chapter', true, v_author_id, 3);

  RAISE NOTICE 'Overcomers book seeded successfully with ID: %', v_book_id;
END $$;
