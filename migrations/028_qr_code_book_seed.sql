-- ============================================================
-- BookFlow Migration 028: QR Code Guide Book Seed
-- Seeds "Bring Your Paper Book to Life with QR Codes" —
-- a public demo book explaining how authors can embed QR codes
-- in printed books, flyers, and bulletins to link to BookFlow content.
--
-- Fixed book ID: 1d717227-d9a5-4b6f-a08c-5fa5b5bd31ff
-- URL: https://books.silverflow.ca/book/1d717227-d9a5-4b6f-a08c-5fa5b5bd31ff
--
-- Run in Supabase Cloud SQL Editor:
--   paste contents → Run
-- ============================================================

DO $$
DECLARE
  v_author_id   uuid;
  v_book_id     uuid := '1d717227-d9a5-4b6f-a08c-5fa5b5bd31ff';
  v_ch1_id      uuid;
  v_ch2_id      uuid;
  v_ch3_id      uuid;
  v_ch4_id      uuid;
BEGIN
  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM bookflow.books WHERE id = v_book_id) THEN
    RAISE NOTICE 'QR Code book already exists — skipping seed.';
    RETURN;
  END IF;

  -- Author: main admin account
  SELECT id INTO v_author_id FROM bookflow.profiles WHERE email = 'damion.steen@silverflow.ca';
  IF v_author_id IS NULL THEN
    -- fallback to any super_admin
    SELECT id INTO v_author_id FROM bookflow.profiles WHERE system_role = 'super_admin' LIMIT 1;
  END IF;
  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'No admin author found. Ensure an admin user exists.';
  END IF;

  v_ch1_id := gen_random_uuid();
  v_ch2_id := gen_random_uuid();
  v_ch3_id := gen_random_uuid();
  v_ch4_id := gen_random_uuid();

  -- ── Insert book ──────────────────────────────────────────────────────────────
  INSERT INTO bookflow.books (id, title, subtitle, description, author_id, status, visibility, slug)
  VALUES (
    v_book_id,
    'Bring Your Paper Book to Life with QR Codes',
    'How authors can link printed books, flyers & bulletins to interactive digital content',
    'Discover how a simple QR code printed inside your book, church bulletin, or flyer can instantly connect your readers to videos, audio narration, polls, study questions, and a full interactive edition — all powered by BookFlow. No app required.',
    v_author_id,
    'published',
    'public',
    'qr-codes-for-authors'
  );

  -- ── Book settings ─────────────────────────────────────────────────────────────
  INSERT INTO bookflow.book_settings (
    book_id, allow_reader_highlights, allow_reader_notes,
    allow_reader_questions, allow_reader_polls,
    show_author_highlights, show_author_notes,
    allow_public_tts, enable_progress_tracking, show_ratings
  ) VALUES (
    v_book_id, true, true, true, true, true, true, true, true, true
  ) ON CONFLICT (book_id) DO NOTHING;

  -- ── Chapter 1: What Is a BookFlow QR Code? ───────────────────────────────────
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
  VALUES (
    v_ch1_id, v_book_id,
    'What Is a BookFlow QR Code?',
    0, 'published',
    'Learn what a BookFlow QR code is and why it transforms the reader experience.',
    '{"type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"What Is a BookFlow QR Code?"}]},
      {"type":"paragraph","content":[{"type":"text","text":"A BookFlow QR code is a small scannable graphic you print inside your physical book, on a flyer, or in a church bulletin. When a reader points their phone camera at it, they are instantly taken to your interactive BookFlow edition — no app download, no login required for public books."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Why Add a QR Code to Your Printed Book?"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Printed books are static. BookFlow lets you attach living digital content to any page — audio narration, embedded video, reflection questions, live polls, and community discussion. A QR code is the bridge between the physical and digital world."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"What Can the QR Code Link To?"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Your full interactive BookFlow book"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"A specific chapter or section"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"An audio narration or podcast episode"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"A video walkthrough or teaching session"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"A study guide with questions and polls"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"A reading club or community group"}]}]}
      ]}
    ]}'::jsonb
  );

  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch1_id, 'poll', 0, 0,
    '{"poll_text":"Have you ever scanned a QR code inside a printed book?","options":[{"id":"a","text":"Yes, and it was great"},{"id":"b","text":"Yes, but it didn''t work well"},{"id":"c","text":"No, this is new to me"},{"id":"d","text":"I didn''t know books could do this!"}]}'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id);

  -- ── Chapter 2: How to Generate Your QR Code ───────────────────────────────────
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
  VALUES (
    v_ch2_id, v_book_id,
    'How to Generate Your QR Code',
    1, 'published',
    'Step-by-step: create a book on BookFlow and get your QR code in seconds.',
    '{"type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"How to Generate Your QR Code"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Getting your QR code takes less than 5 minutes. Here is the exact process from start to finish."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 1 — Create Your Book on BookFlow"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Sign up for a free BookFlow account and click New Book on your dashboard. Give it the same title as your printed book — or use it as a companion guide with extra content."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 2 — Add Your Content"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Write chapters, embed audio or video, add study questions, and configure your book settings. You can make the book public (anyone with the link can read it) or private (invite-only)."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 3 — Publish and Get Your Link"}]},
      {"type":"paragraph","content":[{"type":"text","text":"When ready, publish your book. BookFlow gives you a permanent link like: books.silverflow.ca/book/YOUR-ID. Copy this link."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 4 — Generate the QR Code"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Paste your BookFlow book link into any free QR generator (QR Code Monkey, QRCode.io, or Canva). Download the QR code as a high-resolution PNG or SVG."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 5 — Place It in Your Printed Book"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Add the QR code to your book cover, inside front page, chapter openers, or church bulletin. Add a short instruction like: ''Scan to access the interactive edition and study resources.''"}]}
    ]}'::jsonb
  );

  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch2_id, 'question', 0, 0,
    '{"question_text":"What content would you add to your BookFlow edition that your printed book doesn''t have? (e.g. audio, video, study questions)","question_type":"free_response"}'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id);

  -- ── Chapter 3: Where to Place QR Codes ───────────────────────────────────────
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
  VALUES (
    v_ch3_id, v_book_id,
    'Where to Place Your QR Code',
    2, 'published',
    'Smart placement tips for books, bulletins, flyers, and more.',
    '{"type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Where to Place Your QR Code"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Placement makes or breaks QR code engagement. Here are the best locations for maximum scans."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Inside Printed Books"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Inside front cover — first thing readers see"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Chapter openers — link each chapter to its interactive companion"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Back cover — drive readers to the digital edition"}]}]}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Church Bulletins & Programmes"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Link to this week''s sermon notes or study guide"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Connect the bulletin to a book club or recovery group"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Let congregation members answer reflection questions during the service"}]}]}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Flyers & Posters"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Event flyers linking to registration or reading material"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Book launch posters linking directly to the book"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Classroom handouts with embedded quizzes and polls"}]}]}
      ]}
    ]}'::jsonb
  );

  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch3_id, 'poll', 0, 0,
    '{"poll_text":"Where would you most likely place a QR code?","options":[{"id":"a","text":"Inside my printed book"},{"id":"b","text":"Church bulletin or programme"},{"id":"c","text":"Flyer or poster"},{"id":"d","text":"All of the above"}]}'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id);

  -- ── Chapter 4: Real Examples & Getting Started ────────────────────────────────
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
  VALUES (
    v_ch4_id, v_book_id,
    'Real Examples & Getting Started Today',
    3, 'published',
    'See real-world use cases and take your first step to publishing with QR codes.',
    '{"type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Real Examples & Getting Started Today"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Authors around the world are already using BookFlow QR codes to extend the life of their printed books. Here are a few examples to inspire you."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Pastor''s Study Guide"}]},
      {"type":"paragraph","content":[{"type":"text","text":"A church printed 200 copies of a 12-week Bible study workbook. Each chapter opener has a QR code linking to that week''s BookFlow chapter — with an embedded video devotional, 5 reflection questions, and a live poll. Congregation members complete the questions at home and the pastor sees all responses before Sunday."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Recovery Programme Handbook"}]},
      {"type":"paragraph","content":[{"type":"text","text":"A recovery organisation printed a participant handbook and added a QR code to each step. The digital version includes audio narration, private journaling questions, and a community chat for group members — all behind a secure reading club."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Children''s Activity Book"}]},
      {"type":"paragraph","content":[{"type":"text","text":"An author added QR codes to a printed children''s activity book — each code plays an audio story narration and shows a fun poll. Parents love it; kids scan it themselves."}]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Start Today — It''s Free"}]},
      {"type":"paragraph","content":[{"type":"text","text":"BookFlow is free to start. Create your account, build your interactive companion book, and generate your first QR code in under 10 minutes. Your printed words deserve to come alive."}]}
    ]}'::jsonb
  );

  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch4_id, 'question', 0, 0,
    '{"question_text":"Describe your book or project and how you plan to use a QR code with it. We''d love to feature your story!","question_type":"free_response"}'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id);

  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch4_id, 'checkbox', 0, 0,
    '{"label":"My QR Code Launch Checklist","options":[{"id":"a","text":"Created my BookFlow account"},{"id":"b","text":"Built my interactive book and added content"},{"id":"c","text":"Published the book as public"},{"id":"d","text":"Generated my QR code from the book link"},{"id":"e","text":"Placed the QR code in my printed material"},{"id":"f","text":"Tested the scan on my phone"}]}'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id);

  RAISE NOTICE 'QR Code book seeded. Book ID: %', v_book_id;
END $$;
