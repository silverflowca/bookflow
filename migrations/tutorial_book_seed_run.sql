DO $$
DECLARE
  v_author_id   uuid := 'e7dc2c8c-72d0-487b-be63-08d074f1b993';
  v_book_id     uuid := gen_random_uuid();
  v_ch1_id      uuid := gen_random_uuid();
  v_ch2_id      uuid := gen_random_uuid();
  v_ch3_id      uuid := gen_random_uuid();
  v_ch4_id      uuid := gen_random_uuid();
BEGIN

INSERT INTO bookflow.books (id, title, subtitle, description, author_id, status, visibility, slug)
VALUES (
  v_book_id,
  'How To Use BookFlow',
  'Your complete guide to creating, publishing and sharing books',
  'A hands-on walkthrough of every major feature in BookFlow.',
  v_author_id,
  'published',
  'public',
  'how-to-use-bookflow'
);

UPDATE bookflow.book_settings SET
  allow_reader_highlights = true,
  allow_reader_notes = true,
  allow_reader_questions = true,
  allow_reader_polls = true,
  show_author_highlights = true,
  show_author_notes = true,
  enable_progress_tracking = true,
  show_ratings = true
WHERE book_id = v_book_id;

-- Chapter 1
INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
VALUES (
  v_ch1_id, v_book_id,
  'Welcome — Navigating BookFlow',
  0, 'published',
  'Welcome to BookFlow! This chapter introduces the reading interface and shows you how to navigate the app.',
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Welcome to BookFlow"}]},{"type":"paragraph","content":[{"type":"text","text":"BookFlow is a rich, interactive reading and publishing platform. This guide will walk you through every major feature, step by step."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"The Reading Interface"}]},{"type":"paragraph","content":[{"type":"text","text":"On the left you have the "},{"type":"text","marks":[{"type":"bold"}],"text":"Table of Contents sidebar"},{"type":"text","text":" — click any chapter to jump straight to it. On the right is the "},{"type":"text","marks":[{"type":"bold"}],"text":"component toolbar"},{"type":"text","text":" which filters interactive elements like questions, polls and forms."}]},{"type":"paragraph","content":[{"type":"text","text":"At the top you will find the "},{"type":"text","marks":[{"type":"bold"}],"text":"Listen"},{"type":"text","text":" button (text-to-speech) and the "},{"type":"text","marks":[{"type":"bold"}],"text":"Tutorial"},{"type":"text","text":" button which launches this interactive walkthrough."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Progress Tracking"}]},{"type":"paragraph","content":[{"type":"text","text":"BookFlow tracks your completion of interactive items. Click the "},{"type":"text","marks":[{"type":"bold"}],"text":"Progress"},{"type":"text","text":" button in the sidebar to see a bar chart for each chapter. The button turns bold green when the current chapter is fully complete."}]},{"type":"paragraph","content":[{"type":"text","text":"Try completing the reflection question below, then check your progress bar."}]}]}'::jsonb
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch1_id, 'question', 0, 0, NULL,
  '{"question":"In your own words, what are the three main areas of the BookFlow interface described in this chapter?","type":"open"}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch1_id, 'poll', 0, 0, NULL,
  '{"poll_text":"Have you used a book-reading app before?","options":[{"id":"a","text":"Yes, regularly"},{"id":"b","text":"Yes, occasionally"},{"id":"c","text":"No, this is my first"}]}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

-- Chapter 2
INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
VALUES (
  v_ch2_id, v_book_id,
  'Creating Your Book',
  1, 'published',
  'Learn how to create a book, add chapters and structure your content.',
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Creating Your Book"}]},{"type":"paragraph","content":[{"type":"text","text":"Every great book starts on the "},{"type":"text","marks":[{"type":"bold"}],"text":"Dashboard"},{"type":"text","text":". Click the BookFlow logo in the sidebar to return to the dashboard at any time."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 1 — New Book"}]},{"type":"paragraph","content":[{"type":"text","text":"On the dashboard, click "},{"type":"text","marks":[{"type":"bold"}],"text":"New Book"},{"type":"text","text":". Give it a title, subtitle and description. Choose Private or Public visibility."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 2 — Add Chapters"}]},{"type":"paragraph","content":[{"type":"text","text":"Inside the book editor, click "},{"type":"text","marks":[{"type":"bold"}],"text":"Add Chapter"},{"type":"text","text":". Give it a meaningful title. Drag chapters to reorder them."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 3 — Write Content"}]},{"type":"paragraph","content":[{"type":"text","text":"Click a chapter title to open the "},{"type":"text","marks":[{"type":"bold"}],"text":"Chapter Editor"},{"type":"text","text":" — a full rich-text editor with auto-save."}]},{"type":"paragraph","content":[{"type":"text","text":"Use the form below to record your book idea before moving on."}]}]}'::jsonb
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch2_id, 'textbox', 0, 0, NULL,
  '{"label":"What will your first BookFlow book be called?","placeholder":"Enter your book title...","required":true,"max_length":120}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch2_id, 'textarea', 0, 0, NULL,
  '{"label":"Write a one-paragraph description of your book","placeholder":"What is it about? Who is it for?","rows":4,"max_length":600}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch2_id, 'select', 0, 0, NULL,
  '{"label":"What genre best describes your book?","placeholder":"Select a genre...","options":[{"id":"nonfiction","text":"Non-Fiction"},{"id":"selfhelp","text":"Self-Help"},{"id":"devotional","text":"Devotional / Spiritual"},{"id":"educational","text":"Educational"},{"id":"fiction","text":"Fiction"},{"id":"other","text":"Other"}],"required":true}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

-- Chapter 3
INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
VALUES (
  v_ch3_id, v_book_id,
  'Adding Rich Content',
  2, 'published',
  'Add videos, audio, polls, questions and interactive forms to bring your book to life.',
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Adding Rich Content"}]},{"type":"paragraph","content":[{"type":"text","text":"BookFlow books are not just text. You can embed "},{"type":"text","marks":[{"type":"bold"}],"text":"video"},{"type":"text","text":", "},{"type":"text","marks":[{"type":"bold"}],"text":"audio"},{"type":"text","text":", interactive "},{"type":"text","marks":[{"type":"bold"}],"text":"questions"},{"type":"text","text":", "},{"type":"text","marks":[{"type":"bold"}],"text":"polls"},{"type":"text","text":" and "},{"type":"text","marks":[{"type":"bold"}],"text":"form fields"},{"type":"text","text":" — all trackable for reader progress."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Embedding Video"}]},{"type":"paragraph","content":[{"type":"text","text":"In the chapter editor, highlight any text and choose Video from the toolbar. Paste a YouTube or Vimeo URL. Readers earn progress credit for watching at least 80% of the video."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Adding Audio"}]},{"type":"paragraph","content":[{"type":"text","text":"Choose Audio from the toolbar to embed MP3 clips. You can also use the Listen button at the top to have the entire chapter read aloud using AI text-to-speech."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Polls and Questions"}]},{"type":"paragraph","content":[{"type":"text","text":"Select text and choose Question to add a reflection prompt, or Poll to gather reader opinions."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Interactive Forms"}]},{"type":"paragraph","content":[{"type":"text","text":"Place text inputs, dropdowns, checkboxes and radio buttons anywhere in your chapter. Readers must fill them in to complete the chapter."}]},{"type":"paragraph","content":[{"type":"text","text":"Complete the items below to practice with each content type."}]}]}'::jsonb
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch3_id, 'video', 0, 0, NULL,
  '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","type":"video","title":"BookFlow walkthrough demo","autoplay":false,"controls":true}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch3_id, 'poll', 0, 0, NULL,
  '{"poll_text":"Which content type are you most excited to add to your book?","options":[{"id":"v","text":"Video"},{"id":"a","text":"Audio"},{"id":"q","text":"Questions"},{"id":"f","text":"Interactive Forms"}]}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch3_id, 'checkbox', 0, 0, NULL,
  '{"label":"Tick each feature you have now tried in the editor:","options":[{"id":"txt","text":"Added formatted text (bold, heading, list)"},{"id":"vid","text":"Embedded a video"},{"id":"aud","text":"Embedded audio or used TTS"},{"id":"que","text":"Added a reflection question"},{"id":"pol","text":"Created a poll"},{"id":"frm","text":"Added a form field (textbox, dropdown, etc.)"}]}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch3_id, 'question', 0, 0, NULL,
  '{"question":"Describe one way interactive content will make your book more engaging for readers.","type":"open"}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

-- Chapter 4
INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
VALUES (
  v_ch4_id, v_book_id,
  'Publishing & Sharing',
  3, 'published',
  'Publish your book, invite collaborators and create a reading club.',
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Publishing & Sharing"}]},{"type":"paragraph","content":[{"type":"text","text":"Once your book is ready, it is time to share it with the world."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Publishing Your Book"}]},{"type":"paragraph","content":[{"type":"text","text":"From the book editor, click "},{"type":"text","marks":[{"type":"bold"}],"text":"Settings"},{"type":"text","text":". Under Visibility, switch from Private to Public. This creates a shareable link anyone can use without logging in."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Inviting Collaborators"}]},{"type":"paragraph","content":[{"type":"text","text":"Click "},{"type":"text","marks":[{"type":"bold"}],"text":"Collaborators"},{"type":"text","text":" to invite co-authors, editors or reviewers by email. Editors can change content; commenters can only leave notes; viewers can only read."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Book Clubs"}]},{"type":"paragraph","content":[{"type":"text","text":"Go to "},{"type":"text","marks":[{"type":"bold"}],"text":"Clubs"},{"type":"text","text":" to create a reading group. Add your book, invite members, and they can read together with shared progress and chapter chat."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Reader Settings"}]},{"type":"paragraph","content":[{"type":"text","text":"Under "},{"type":"text","marks":[{"type":"bold"}],"text":"Settings — Reader Permissions"},{"type":"text","text":", control what readers can do: highlight, add notes, vote on polls, and more. Enable Progress Tracking to see completion rates per chapter."}]},{"type":"paragraph","content":[{"type":"text","text":"Congratulations! Complete the checklist below and you are ready to publish your first BookFlow book."}]}]}'::jsonb
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch4_id, 'radio', 0, 0, NULL,
  '{"label":"Who will your book be for?","options":[{"id":"pub","text":"Anyone — I will make it public"},{"id":"club","text":"A specific reading club or class"},{"id":"col","text":"A team of collaborators"},{"id":"prv","text":"Just for me, for now"}]}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch4_id, 'multiselect', 0, 0, NULL,
  '{"label":"Which reader settings will you enable for your book?","options":[{"id":"hi","text":"Allow reader highlights"},{"id":"no","text":"Allow reader notes"},{"id":"pt","text":"Enable progress tracking"},{"id":"tts","text":"Allow public text-to-speech"},{"id":"rt","text":"Show ratings"},{"id":"cl","text":"Share via a reading club"}]}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, anchor_text, content_data, visibility, position_in_chapter, is_author_content, created_by)
VALUES (
  gen_random_uuid(), v_book_id, v_ch4_id, 'question', 0, 0, NULL,
  '{"question":"You have now completed the BookFlow tutorial. What is the first book you plan to create, and who is your target reader?","type":"open"}'::jsonb,
  'all_readers', 'end_of_chapter', true, v_author_id
);

RAISE NOTICE 'Tutorial book seeded! Book ID: %', v_book_id;
RAISE NOTICE 'Chapters: %, %, %, %', v_ch1_id, v_ch2_id, v_ch3_id, v_ch4_id;
END $$;
