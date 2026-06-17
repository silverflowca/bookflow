-- ============================================================
-- Tutorial Book Content Update
-- Book ID: f0c66a4a-ced2-4b75-ab42-84dafba9cd3d
-- Updates chapter content and replaces inline_content with
-- rich, high-quality reflective questions
-- Run in Supabase SQL Editor (production)
-- ============================================================

DO $$
DECLARE
  v_book_id     uuid := 'f0c66a4a-ced2-4b75-ab42-84dafba9cd3d';
  v_author_id   uuid;
  v_ch1_id      uuid;
  v_ch2_id      uuid;
  v_ch3_id      uuid;
  v_ch4_id      uuid;
BEGIN

  -- Look up author
  SELECT id INTO v_author_id
  FROM bookflow.profiles
  WHERE email = 'damion.steen@silverflow.ca';

  -- Look up existing chapter IDs by order_index
  SELECT id INTO v_ch1_id FROM bookflow.chapters WHERE book_id = v_book_id AND order_index = 0;
  SELECT id INTO v_ch2_id FROM bookflow.chapters WHERE book_id = v_book_id AND order_index = 1;
  SELECT id INTO v_ch3_id FROM bookflow.chapters WHERE book_id = v_book_id AND order_index = 2;
  SELECT id INTO v_ch4_id FROM bookflow.chapters WHERE book_id = v_book_id AND order_index = 3;

  IF v_ch1_id IS NULL THEN
    RAISE EXCEPTION 'Chapter 1 not found for book %', v_book_id;
  END IF;

  RAISE NOTICE 'Updating tutorial book % — ch1=% ch2=% ch3=% ch4=%',
    v_book_id, v_ch1_id, v_ch2_id, v_ch3_id, v_ch4_id;

  -- ── Update book description ────────────────────────────────
  UPDATE bookflow.books SET
    description = 'Welcome to BookFlow — your all-in-one platform for writing, publishing and sharing interactive books. This hands-on guide walks you through every major feature: navigating the reading interface, writing and structuring chapters, embedding rich media and interactive content, and publishing your book to a live audience or a private reading club. By the end of this tutorial you will have everything you need to publish your first book.',
    updated_at = now()
  WHERE id = v_book_id;


  -- ════════════════════════════════════════════════════════
  -- CHAPTER 1: Welcome — Navigating BookFlow
  -- ════════════════════════════════════════════════════════
  UPDATE bookflow.chapters SET
    content_text = 'Welcome to BookFlow — your all-in-one platform for writing, publishing and sharing interactive digital books. This opening chapter gives you a guided tour of the reading interface so you know where everything lives before you dive into the deeper features.',
    content = '{
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": {"level": 1},
          "content": [{"type": "text", "text": "Welcome to BookFlow"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "BookFlow is a rich, interactive reading and publishing platform designed to turn every book into a "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "living experience"},
            {"type": "text", "text": " — complete with video, audio, polls, reflection questions, and tracked reader progress. Whether you are a teacher, coach, ministry leader, author or lifelong learner, BookFlow gives you the tools to create and consume books in a whole new way."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "This tutorial is itself a BookFlow book, so everything you are about to learn is demonstrated right here as you read."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "The Sidebar — Table of Contents"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "On the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "left side"},
            {"type": "text", "text": " of the screen you will find the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Table of Contents sidebar"},
            {"type": "text", "text": ". It lists every chapter in the book. Click any chapter title to jump straight to it. The chapter you are currently reading is highlighted in the sidebar. If the sidebar is collapsed, click the "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "menu icon"},
            {"type": "text", "text": " (☰) at the top left to expand it."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "The Top Bar — Actions & Navigation"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "At the top of every chapter you will find the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "action bar"},
            {"type": "text", "text": ". It includes:"}
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Listen"},
                {"type": "text", "text": " — reads the entire chapter aloud using high-quality AI text-to-speech. Click again to pause. Perfect for multitasking or accessibility."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Progress"},
                {"type": "text", "text": " — shows a per-chapter progress bar. The icon turns solid green once every interactive item in the chapter is completed. Track your journey through the whole book here."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Highlight & Notes"},
                {"type": "text", "text": " — select any text in the chapter and a tooltip appears, letting you save a highlight or attach a private note. Your annotations are saved to your account."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Previous / Next"},
                {"type": "text", "text": " — navigate between chapters at the bottom of the page, or use the arrow buttons in the sidebar."}
              ]}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Interactive Elements"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Scattered throughout each chapter you will find "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "interactive elements"},
            {"type": "text", "text": " — embedded videos to watch, audio clips to play, polls to vote on, reflection questions to answer, and forms to fill in. Each one contributes to your chapter progress. Complete all of them to see the green checkmark appear next to that chapter in the sidebar."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "The "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Component Toolbar"},
            {"type": "text", "text": " on the right side lets you filter the view to show only a specific type of interactive item — for example, show only questions or only videos. This is especially useful in longer chapters."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Progress Tracking"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "BookFlow tracks your completion of every interactive item. Open the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Progress panel"},
            {"type": "text", "text": " to see a visual progress bar for each chapter. Items are only marked complete once you actively engage with them — watching a video to completion, submitting a form answer, voting on a poll, or responding to a question."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "The reflection question and poll below will be your first opportunity to earn progress. Try completing both before moving on to Chapter 2."}
          ]
        }
      ]
    }'::jsonb,
    updated_at = now()
  WHERE id = v_ch1_id;

  -- Remove old inline_content for ch1 and re-insert with better questions
  DELETE FROM bookflow.inline_content WHERE chapter_id = v_ch1_id;

  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch1_id, 'question',
    0, 0, NULL,
    '{
      "question_text": "Think about how you typically read books — digital or physical. What is one reading habit or workflow you hope BookFlow can support or improve for you?",
      "question_type": "free_response"
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );

  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch1_id, 'poll',
    0, 0, NULL,
    '{
      "poll_text": "Which BookFlow feature are you most excited to explore?",
      "options": [
        {"id":"a", "text": "Interactive questions and polls"},
        {"id":"b", "text": "Embedded video and audio"},
        {"id":"c", "text": "Progress tracking and completion"},
        {"id":"d", "text": "Book clubs and shared reading"}
      ]
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );


  -- ════════════════════════════════════════════════════════
  -- CHAPTER 2: Creating Your Book
  -- ════════════════════════════════════════════════════════
  UPDATE bookflow.chapters SET
    content_text = 'Learn how to create a new book from the dashboard, add and organise chapters, and write rich content using the full-featured editor.',
    content = '{
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": {"level": 1},
          "content": [{"type": "text", "text": "Creating Your Book"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Every great book in BookFlow starts on the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Dashboard"},
            {"type": "text", "text": ". From there you can manage all your books, access your reading clubs and discover new public titles. Click the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "BookFlow logo"},
            {"type": "text", "text": " in the top-left of the sidebar at any time to return to the dashboard."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Step 1 — Create a New Book"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "On the dashboard, click the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "New Book"},
            {"type": "text", "text": " button. A creation dialog will appear asking for:"}
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Title"},
                {"type": "text", "text": " (required) — the name of your book as it will appear to readers."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Subtitle"},
                {"type": "text", "text": " (optional) — a short tagline or clarifying phrase shown below the title."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Description"},
                {"type": "text", "text": " (optional) — a paragraph summary shown on the book cover page. This helps readers decide if your book is right for them."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Visibility"},
                {"type": "text", "text": " — choose "},
                {"type": "text", "marks": [{"type": "italic"}], "text": "Private"},
                {"type": "text", "text": " (only you can see it) or "},
                {"type": "text", "marks": [{"type": "italic"}], "text": "Public"},
                {"type": "text", "text": " (discoverable by anyone). You can change this later."}
              ]}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Step 2 — Add and Organise Chapters"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Once your book is created, you are taken into the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Book Editor"},
            {"type": "text", "text": ". On the left you will see the chapter list. Click "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Add Chapter"},
            {"type": "text", "text": " to create a new one, and give it a clear, descriptive title."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "To "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "reorder chapters"},
            {"type": "text", "text": ", drag them using the handle (⠿) on the left side of each chapter title. Your order is saved automatically. Readers will always see chapters in the order you set."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Each chapter has a "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "status"},
            {"type": "text", "text": " — "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "Draft"},
            {"type": "text", "text": " (only visible to you as author) or "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "Published"},
            {"type": "text", "text": " (visible to readers). You can write and refine a chapter in Draft mode and only publish it when it is ready."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Step 3 — Write Your Content"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Click a chapter title to open the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Chapter Editor"},
            {"type": "text", "text": " — a powerful rich-text environment built on TipTap. The editor supports:"}
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Headings"},
                {"type": "text", "text": " (H1, H2, H3) to structure your content"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Bold, italic, underline, strikethrough"},
                {"type": "text", "text": " for emphasis"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Bullet lists and numbered lists"},
                {"type": "text", "text": " to present steps or options"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Block quotes"},
                {"type": "text", "text": " to highlight key passages"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Code blocks"},
                {"type": "text", "text": " for technical or reference content"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Horizontal rules"},
                {"type": "text", "text": " to separate sections within a chapter"}
              ]}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Your work is "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "auto-saved"},
            {"type": "text", "text": " every few seconds — you will see a small "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "\"Saved\""},
            {"type": "text", "text": " indicator in the editor toolbar when a save has completed. You never need to manually save."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Tips for Strong Chapter Structure"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Great chapters share a few common traits:"}
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Start with a clear "},
                {"type": "text", "marks": [{"type": "bold"}], "text": "objective or hook"},
                {"type": "text", "text": " — tell readers what they will learn or experience."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Break content into "},
                {"type": "text", "marks": [{"type": "bold"}], "text": "short, scannable sections"},
                {"type": "text", "text": " using headings and bullet points. Walls of text lose readers."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "End with a "},
                {"type": "text", "marks": [{"type": "bold"}], "text": "call to action or reflection"},
                {"type": "text", "text": " — something for the reader to do, think about, or answer."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Keep chapters "},
                {"type": "text", "marks": [{"type": "bold"}], "text": "focused on a single idea"},
                {"type": "text", "text": ". If a chapter is growing too long, split it into two."}
              ]}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Now use the interactive form below to capture your first book concept. This information stays private to your account."}
          ]
        }
      ]
    }'::jsonb,
    updated_at = now()
  WHERE id = v_ch2_id;

  DELETE FROM bookflow.inline_content WHERE chapter_id = v_ch2_id;

  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch2_id, 'textbox',
    0, 0, NULL,
    '{
      "label": "What will your first BookFlow book be called?",
      "placeholder": "Enter your working title...",
      "required": true,
      "max_length": 120
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );

  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch2_id, 'textarea',
    0, 0, NULL,
    '{
      "label": "Who is your book for, and what transformation or insight will it give them?",
      "placeholder": "My book is for... After reading it, they will...",
      "rows": 4,
      "max_length": 600
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );

  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch2_id, 'select',
    0, 0, NULL,
    '{
      "label": "What genre or category best describes your book?",
      "placeholder": "Select a genre...",
      "options": [
        {"id": "nonfiction", "text": "Non-Fiction"},
        {"id": "selfhelp",   "text": "Self-Help / Personal Development"},
        {"id": "devotional", "text": "Devotional / Spiritual"},
        {"id": "educational","text": "Educational / Training"},
        {"id": "leadership", "text": "Leadership / Business"},
        {"id": "memoir",     "text": "Memoir / Biography"},
        {"id": "fiction",    "text": "Fiction"},
        {"id": "other",      "text": "Other"}
      ],
      "required": true
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );

  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch2_id, 'question',
    0, 0, NULL,
    '{
      "question_text": "What is the single most important thing you want a reader to walk away with after finishing your book? Be as specific as possible.",
      "question_type": "free_response"
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );


  -- ════════════════════════════════════════════════════════
  -- CHAPTER 3: Adding Rich Content
  -- ════════════════════════════════════════════════════════
  UPDATE bookflow.chapters SET
    content_text = 'Take your chapters beyond plain text. Learn how to embed YouTube or Vimeo videos, add audio clips, create polls and reflection questions, and build interactive form elements — all with tracked reader progress.',
    content = '{
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": {"level": 1},
          "content": [{"type": "text", "text": "Adding Rich Content"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "One of the things that makes BookFlow unique is that your chapters are not just text on a page. You can enrich any chapter with "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "embedded media"},
            {"type": "text", "text": ", "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "interactive questions"},
            {"type": "text", "text": ", "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "polls"},
            {"type": "text", "text": " and "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "fill-in forms"},
            {"type": "text", "text": " — all of which count toward the reader''s chapter progress."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Embedding Video"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "In the chapter editor, click the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Insert"},
            {"type": "text", "text": " menu in the toolbar and choose "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Video"},
            {"type": "text", "text": ". Paste a "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "YouTube"},
            {"type": "text", "text": " or "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Vimeo"},
            {"type": "text", "text": " URL. The video is embedded directly in the chapter — readers watch it inline without leaving the page."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Once a reader has watched at least "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "80% of the video"},
            {"type": "text", "text": ", a "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "\"Mark as watched\""},
            {"type": "text", "text": " button appears. They can click it to record completion, which contributes to their chapter progress. They can also click "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "\"Mark as not watched\""},
            {"type": "text", "text": " to undo it if they want to rewatch."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Adding Audio"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Choose "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Audio"},
            {"type": "text", "text": " from the Insert menu to embed an MP3 or hosted audio clip. This is ideal for background music, spoken introductions, interviews, sermon recordings, or any supplemental listening material."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "You can also use the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Listen"},
            {"type": "text", "text": " button in the top action bar to have the chapter read aloud by AI text-to-speech. As the author, you can enable or disable this feature per-book in "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "Book Settings → Allow Public TTS"},
            {"type": "text", "text": "."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Reflection Questions"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "In the "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Interactive Content panel"},
            {"type": "text", "text": " (accessible from the right sidebar in the editor), choose "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Question"},
            {"type": "text", "text": " to add a free-response prompt at the end of a chapter. Use questions to encourage readers to process, apply and personalise what they have just read."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Questions are private by default — only the reader can see their own response. You can optionally make responses visible to all club members if you want to foster shared discussion."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Polls"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Choose "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Poll"},
            {"type": "text", "text": " to add a multiple-choice survey question. Readers vote for one option and immediately see a live bar chart of how others have voted. Polls are a great way to build community engagement inside your book."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Interactive Form Fields"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Beyond questions and polls, you can insert a full range of "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "form elements"},
            {"type": "text", "text": " into any chapter:"}
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Text input"},
                {"type": "text", "text": " — short single-line entries (names, titles, brief answers)"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Textarea"},
                {"type": "text", "text": " — longer multi-line entries (paragraphs, plans, reflections)"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Dropdown (Select)"},
                {"type": "text", "text": " — single-choice from a predefined list"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Radio buttons"},
                {"type": "text", "text": " — single-choice displayed as a visible list"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Checkboxes"},
                {"type": "text", "text": " — multi-select checklist (check all that apply)"}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Multi-select"},
                {"type": "text", "text": " — choose multiple options from a styled list"}
              ]}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Each form element you insert becomes a "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "trackable completion item"},
            {"type": "text", "text": ". Readers must interact with it (submit a value) for it to count toward their progress."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Planning Your Interactive Content"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "The most effective BookFlow chapters have a clear "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "rhythm"},
            {"type": "text", "text": ": teach a concept → illustrate it with media → invite the reader to respond. Think of interactive elements not as extras, but as the heartbeat of reader engagement."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Work through the interactive items below to practice with each content type:"}
          ]
        }
      ]
    }'::jsonb,
    updated_at = now()
  WHERE id = v_ch3_id;

  DELETE FROM bookflow.inline_content WHERE chapter_id = v_ch3_id;

  -- Ch3: poll
  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch3_id, 'poll',
    0, 0, NULL,
    '{
      "poll_text": "What type of content do you think will make your chapters most engaging for your readers?",
      "options": [
        {"id": "v", "text": "Embedded video — show instead of tell"},
        {"id": "q", "text": "Reflection questions — invite personal application"},
        {"id": "f", "text": "Interactive forms — capture structured responses"},
        {"id": "p", "text": "Polls — build community and see shared opinions"}
      ]
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );

  -- Ch3: checkbox — features tried
  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch3_id, 'checkbox',
    0, 0, NULL,
    '{
      "label": "Which interactive content types do you plan to use in your book? (check all that apply)",
      "options": [
        {"id": "vid", "text": "Embedded YouTube or Vimeo video"},
        {"id": "aud", "text": "Audio clips or AI text-to-speech"},
        {"id": "que", "text": "Reflection questions (free response)"},
        {"id": "pol", "text": "Polls to gather reader opinions"},
        {"id": "frm", "text": "Form fields (text, dropdown, checkboxes)"},
        {"id": "non", "text": "I will start with plain text and add media later"}
      ]
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );

  -- Ch3: deep reflection question
  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch3_id, 'question',
    0, 0, NULL,
    '{
      "question_text": "Imagine a reader opening Chapter 1 of your book. What is the single most powerful piece of interactive content you could include — a video, a question, a poll or a form — that would immediately show them this is not just another ordinary book? Describe it.",
      "question_type": "free_response"
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );


  -- ════════════════════════════════════════════════════════
  -- CHAPTER 4: Publishing & Sharing
  -- ════════════════════════════════════════════════════════
  UPDATE bookflow.chapters SET
    content_text = 'Your book is written. Now learn how to publish it, share it with a live audience, invite collaborators, and build a reading club where members read together and track progress.',
    content = '{
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": {"level": 1},
          "content": [{"type": "text", "text": "Publishing & Sharing Your Book"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "You have written your chapters and added rich interactive content. Now it is time to share your work with the world — or with a carefully chosen group. This chapter walks you through publishing, collaborators and reading clubs."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Publishing Your Book"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Inside the book editor, click "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Settings"},
            {"type": "text", "text": " in the top navigation. Under "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "Visibility"},
            {"type": "text", "text": ", toggle from "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "Private"},
            {"type": "text", "text": " to "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "Public"},
            {"type": "text", "text": ". This:"}
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Makes the book appear in the "},
                {"type": "text", "marks": [{"type": "bold"}], "text": "Discover"},
                {"type": "text", "text": " tab on the dashboard for all logged-in users."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Generates a "},
                {"type": "text", "marks": [{"type": "bold"}], "text": "shareable link"},
                {"type": "text", "text": " anyone can use to read your book directly — even without a BookFlow account, if public access is allowed."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Allows you to add the book to a reading club."}
              ]}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "You can switch back to "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "Private"},
            {"type": "text", "text": " at any time to hide the book while you continue editing. Individual chapters can also remain in "},
            {"type": "text", "marks": [{"type": "italic"}], "text": "Draft"},
            {"type": "text", "text": " status so they are invisible to readers even when the book is public."}
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Inviting Collaborators"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Click "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Collaborators"},
            {"type": "text", "text": " in the book editor header to invite others by email. There are three collaboration roles:"}
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Editor"},
                {"type": "text", "text": " — can write and edit chapter content, add interactive items and update settings."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Commenter"},
                {"type": "text", "text": " — can read, highlight and leave notes, but cannot modify the book content."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Viewer"},
                {"type": "text", "text": " — read-only access. Perfect for early readers and beta testers."}
              ]}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Creating a Reading Club"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Reading clubs let you group readers together around a book. Navigate to "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Clubs"},
            {"type": "text", "text": " in the main navigation and click "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Create Club"},
            {"type": "text", "text": ". Give it a name, add a description, and then:"}
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Add your book to the club by clicking "},
                {"type": "text", "marks": [{"type": "bold"}], "text": "Add Book"},
                {"type": "text", "text": "."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Invite members by email or share the club join link."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Enable "},
                {"type": "text", "marks": [{"type": "bold"}], "text": "Progress Tracking"},
                {"type": "text", "text": " in Club Settings so you can see which members have completed which chapters."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "text": "Enable "},
                {"type": "text", "marks": [{"type": "bold"}], "text": "Show Member Reading Progress"},
                {"type": "text", "text": " to let members see each other''s progress — great for accountability groups."}
              ]}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "Reader Permission Settings"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Under "},
            {"type": "text", "marks": [{"type": "bold"}], "text": "Book Settings → Reader Permissions"},
            {"type": "text", "text": ", you have fine-grained control over what readers are allowed to do:"}
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Allow reader highlights"},
                {"type": "text", "text": " — readers can select and save key passages."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Allow reader notes"},
                {"type": "text", "text": " — readers can attach private notes to any highlighted section."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Allow reader questions"},
                {"type": "text", "text": " — readers can submit questions that you as the author can see and respond to."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Allow reader polls"},
                {"type": "text", "text": " — readers can create and share their own poll questions within the book."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Enable progress tracking"},
                {"type": "text", "text": " — turns on the completion tracking system for all interactive items."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Allow public TTS"},
                {"type": "text", "text": " — enables the Listen button for all readers, not just the author."}
              ]}]
            },
            {
              "type": "listItem",
              "content": [{"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": "Show ratings"},
                {"type": "text", "text": " — allows readers to give the book a star rating visible to other readers."}
              ]}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 2},
          "content": [{"type": "text", "text": "You Are Ready"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "You have now completed the full BookFlow tutorial. You know how to navigate the reader interface, create and structure a book, add rich interactive content, and publish your work to a live audience or a reading club."}
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "text": "Complete the items below — then go write something worth reading."}
          ]
        }
      ]
    }'::jsonb,
    updated_at = now()
  WHERE id = v_ch4_id;

  DELETE FROM bookflow.inline_content WHERE chapter_id = v_ch4_id;

  -- Ch4: radio — audience
  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch4_id, 'radio',
    0, 0, NULL,
    '{
      "label": "Who is the primary audience for the book you are planning to create?",
      "options": [
        {"id": "pub",   "text": "The general public — I will make it public on BookFlow"},
        {"id": "club",  "text": "A specific reading group, class or congregation"},
        {"id": "team",  "text": "A team or organisation I am part of"},
        {"id": "self",  "text": "Myself — it is a personal journal or private project"}
      ]
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );

  -- Ch4: multiselect — settings to enable
  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch4_id, 'multiselect',
    0, 0, NULL,
    '{
      "label": "Which reader permission settings will you enable in your book? (select all that apply)",
      "options": [
        {"id": "hi",  "text": "Allow reader highlights"},
        {"id": "no",  "text": "Allow reader notes"},
        {"id": "pt",  "text": "Enable progress tracking"},
        {"id": "tts", "text": "Allow public text-to-speech (Listen button)"},
        {"id": "rt",  "text": "Show star ratings"},
        {"id": "cl",  "text": "Share via a reading club with progress dashboard"}
      ]
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );

  -- Ch4: final deep reflection
  INSERT INTO bookflow.inline_content (
    id, book_id, chapter_id, content_type,
    start_offset, end_offset, anchor_text,
    content_data, visibility, position_in_chapter,
    is_author_content, created_by
  ) VALUES (
    gen_random_uuid(), v_book_id, v_ch4_id, 'question',
    0, 0, NULL,
    '{
      "question_text": "You have completed the BookFlow tutorial. Describe the book you are going to create — its title, its audience, and the one outcome you most hope a reader experiences after finishing it. Treat this as your public commitment.",
      "question_type": "free_response"
    }'::jsonb,
    'all_readers', 'end_of_chapter', true, v_author_id
  );

  RAISE NOTICE 'Tutorial book content updated successfully. Book ID: %', v_book_id;
  RAISE NOTICE 'Chapters updated: ch1=% ch2=% ch3=% ch4=%', v_ch1_id, v_ch2_id, v_ch3_id, v_ch4_id;

END $$;
