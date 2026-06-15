-- ============================================================
-- BookFlow Railway Patch: 023 → 024
-- Covers migrations not yet applied to production:
--   010_club_join_requests
--   023_book_ratings
--   024_super_admin_role
--   tutorial_book_seed (with fixed author UUID)
--
-- Run in Supabase Cloud SQL Editor or via psql:
--   psql "postgresql://postgres:PASSWORD@db.PROJECTREF.supabase.co:5432/postgres" < railway_patch_023_024.sql
-- ============================================================

-- ── 010: Club Join Requests ───────────────────────────────────────────────────
ALTER TABLE bookflow.club_settings
  ADD COLUMN IF NOT EXISTS allow_join_requests BOOLEAN DEFAULT FALSE;

ALTER TABLE bookflow.club_members
  ADD COLUMN IF NOT EXISTS is_join_request BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS join_request_message TEXT;

CREATE INDEX IF NOT EXISTS idx_club_members_join_request
  ON bookflow.club_members(club_id, is_join_request)
  WHERE is_join_request = TRUE AND invite_accepted_at IS NULL;


-- ── 023: Book Ratings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookflow.book_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_book_ratings_book ON bookflow.book_ratings(book_id);
CREATE INDEX IF NOT EXISTS idx_book_ratings_user ON bookflow.book_ratings(user_id);

CREATE OR REPLACE FUNCTION bookflow.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS update_book_ratings_updated_at ON bookflow.book_ratings;
CREATE TRIGGER update_book_ratings_updated_at
    BEFORE UPDATE ON bookflow.book_ratings
    FOR EACH ROW EXECUTE FUNCTION bookflow.set_updated_at();

ALTER TABLE bookflow.book_settings
    ADD COLUMN IF NOT EXISTS show_ratings BOOLEAN DEFAULT TRUE;

ALTER TABLE bookflow.book_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "book_ratings_select" ON bookflow.book_ratings;
CREATE POLICY "book_ratings_select" ON bookflow.book_ratings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "book_ratings_manage" ON bookflow.book_ratings;
CREATE POLICY "book_ratings_manage" ON bookflow.book_ratings
    FOR ALL USING (auth.uid() = user_id);


-- ── 024: Super Admin Role ─────────────────────────────────────────────────────
ALTER TABLE bookflow.profiles
  ADD COLUMN IF NOT EXISTS system_role TEXT
    CHECK (system_role IN ('super_admin'))
    DEFAULT NULL;

DROP POLICY IF EXISTS "Super admins can view all profiles" ON bookflow.profiles;
CREATE POLICY "Super admins can view all profiles"
  ON bookflow.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can update profiles" ON bookflow.profiles;
CREATE POLICY "Super admins can update profiles"
  ON bookflow.profiles FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can view all books" ON bookflow.books;
CREATE POLICY "Super admins can view all books"
  ON bookflow.books FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can view all clubs" ON bookflow.book_clubs;
CREATE POLICY "Super admins can view all clubs"
  ON bookflow.book_clubs FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can view all club members" ON bookflow.club_members;
CREATE POLICY "Super admins can view all club members"
  ON bookflow.club_members FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM bookflow.profiles WHERE system_role = 'super_admin'
    )
  );

-- Assign super_admin to platform admins
-- NOTE: Safe to re-run — idempotent.
UPDATE bookflow.profiles
SET system_role = 'super_admin'
WHERE email IN ('admin.steen2@silverflow.ca', 'damion.steen@silverflow.ca');


-- ── Tutorial Book Seed ────────────────────────────────────────────────────────
-- Seeds the "How To Use BookFlow" tutorial book.
-- Author is assigned to admin.steen2@silverflow.ca.
-- Uses a FIXED book ID so this is safe to skip if already seeded.
DO $$
DECLARE
  v_author_id   uuid;
  v_book_id     uuid := 'f0c66a4a-ced2-4b75-ab42-84dafba9cd3d';
  v_ch1_id      uuid;
  v_ch2_id      uuid;
  v_ch3_id      uuid;
  v_ch4_id      uuid;
BEGIN
  -- Skip if book already exists
  IF EXISTS (SELECT 1 FROM bookflow.books WHERE id = v_book_id) THEN
    RAISE NOTICE 'Tutorial book already exists — skipping seed.';
    RETURN;
  END IF;

  -- Look up author dynamically (user must have signed up first)
  SELECT id INTO v_author_id FROM bookflow.profiles WHERE email = 'admin.steen2@silverflow.ca';
  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'User admin.steen2@silverflow.ca not found in profiles — sign up on the app first, then re-run this migration.';
  END IF;

  v_ch1_id := gen_random_uuid();
  v_ch2_id := gen_random_uuid();
  v_ch3_id := gen_random_uuid();
  v_ch4_id := gen_random_uuid();

  INSERT INTO bookflow.books (id, title, subtitle, description, author_id, status, visibility, slug)
  VALUES (
    v_book_id,
    'How To Use BookFlow',
    'Your complete guide to creating, publishing and sharing books',
    'A hands-on walkthrough of every major feature in BookFlow — from writing your first chapter to publishing and sharing with a reading club.',
    v_author_id, 'published', 'public', 'how-to-use-bookflow'
  );

  INSERT INTO bookflow.book_settings (
    book_id, allow_reader_highlights, allow_reader_notes,
    allow_reader_questions, allow_reader_polls,
    show_author_highlights, show_author_notes,
    allow_public_tts, enable_progress_tracking, show_ratings
  ) VALUES (
    v_book_id, true, true, true, true, true, true, true, true, true
  );

  -- Chapter 1
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
  VALUES (
    v_ch1_id, v_book_id, 'Welcome — Navigating BookFlow', 0, 'published',
    'Welcome to BookFlow! This chapter introduces the reading interface and shows you how to navigate the app.',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Welcome to BookFlow"}]},{"type":"paragraph","content":[{"type":"text","text":"BookFlow is a rich, interactive reading and publishing platform. This guide will walk you through every major feature — step by step, hands-on."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"The Reading Interface"}]},{"type":"paragraph","content":[{"type":"text","text":"On the left you have the "},{"type":"text","marks":[{"type":"bold"}],"text":"Table of Contents sidebar"},{"type":"text","text":" — click any chapter to jump straight to it. On the right is the "},{"type":"text","marks":[{"type":"bold"}],"text":"component toolbar"},{"type":"text","text":" which filters interactive elements like questions, polls and forms."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Progress Tracking"}]},{"type":"paragraph","content":[{"type":"text","text":"BookFlow tracks your completion of interactive items. Click the "},{"type":"text","marks":[{"type":"bold"}],"text":"Progress"},{"type":"text","text":" button in the sidebar to see a bar chart for each chapter."}]}]}'::jsonb
  );
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch1_id, 'question', 0, 0, '{"question_text":"In your own words, what are the three main areas of the BookFlow interface described in this chapter?","question_type":"free_response"}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch1_id, 'poll', 0, 0, '{"poll_text":"Have you used a book-reading app before?","options":[{"id":"a","text":"Yes, regularly"},{"id":"b","text":"Yes, occasionally"},{"id":"c","text":"No, this is my first"}]}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);

  -- Chapter 2
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
  VALUES (
    v_ch2_id, v_book_id, 'Creating Your Book', 1, 'published',
    'Learn how to create a book, add chapters and structure your content.',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Creating Your Book"}]},{"type":"paragraph","content":[{"type":"text","text":"Every great book starts on the "},{"type":"text","marks":[{"type":"bold"}],"text":"Dashboard"},{"type":"text","text":". Click the BookFlow logo in the sidebar to return to the dashboard at any time."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 1 — New Book"}]},{"type":"paragraph","content":[{"type":"text","text":"On the dashboard, click "},{"type":"text","marks":[{"type":"bold"}],"text":"New Book"},{"type":"text","text":". Give it a title, an optional subtitle and a description."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 2 — Add Chapters"}]},{"type":"paragraph","content":[{"type":"text","text":"Inside the book editor, click "},{"type":"text","marks":[{"type":"bold"}],"text":"Add Chapter"},{"type":"text","text":". Drag chapters to reorder them using the handle on the left."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Step 3 — Write Content"}]},{"type":"paragraph","content":[{"type":"text","text":"Click a chapter title to open the "},{"type":"text","marks":[{"type":"bold"}],"text":"Chapter Editor"},{"type":"text","text":". Your work is auto-saved every few seconds."}]}]}'::jsonb
  );
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch2_id, 'textbox', 0, 0, '{"label":"What will your first BookFlow book be called?","placeholder":"Enter your book title...","required":true,"max_length":120}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch2_id, 'textarea', 0, 0, '{"label":"Write a one-paragraph description of your book","placeholder":"What is it about? Who is it for?","rows":4,"max_length":600}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch2_id, 'select', 0, 0, '{"label":"What genre best describes your book?","placeholder":"Select a genre...","options":[{"id":"nonfiction","text":"Non-Fiction"},{"id":"selfhelp","text":"Self-Help"},{"id":"devotional","text":"Devotional / Spiritual"},{"id":"educational","text":"Educational"},{"id":"fiction","text":"Fiction"},{"id":"other","text":"Other"}],"required":true}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);

  -- Chapter 3
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
  VALUES (
    v_ch3_id, v_book_id, 'Adding Rich Content', 2, 'published',
    'Add videos, audio, polls, questions and interactive forms to bring your book to life.',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Adding Rich Content"}]},{"type":"paragraph","content":[{"type":"text","text":"BookFlow books are not just text. You can embed video, audio, interactive questions, polls and typed form fields — all trackable for reader progress."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Embedding Video"}]},{"type":"paragraph","content":[{"type":"text","text":"In the chapter editor, highlight any text and choose Video from the toolbar. Paste a YouTube or Vimeo URL."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Polls and Questions"}]},{"type":"paragraph","content":[{"type":"text","text":"Select text and choose Question to add a reflection prompt, or Poll to gather reader opinions."}]}]}'::jsonb
  );
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch3_id, 'video', 0, 0, '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","type":"video","title":"BookFlow walkthrough demo","autoplay":false,"controls":true}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch3_id, 'poll', 0, 0, '{"poll_text":"Which content type are you most excited to add to your book?","options":[{"id":"v","text":"Video"},{"id":"a","text":"Audio"},{"id":"q","text":"Questions"},{"id":"f","text":"Interactive Forms"}]}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch3_id, 'checkbox', 0, 0, '{"label":"Tick each feature you have now tried in the editor:","options":[{"id":"txt","text":"Added formatted text (bold, heading, list)"},{"id":"vid","text":"Embedded a video"},{"id":"aud","text":"Embedded audio or used TTS"},{"id":"que","text":"Added a reflection question"},{"id":"pol","text":"Created a poll"},{"id":"frm","text":"Added a form field (textbox, dropdown, etc.)"}]}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch3_id, 'question', 0, 0, '{"question_text":"Describe one way interactive content will make your book more engaging for readers.","question_type":"free_response"}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);

  -- Chapter 4
  INSERT INTO bookflow.chapters (id, book_id, title, order_index, status, content_text, content)
  VALUES (
    v_ch4_id, v_book_id, 'Publishing & Sharing', 3, 'published',
    'Publish your book, invite collaborators and create a reading club.',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Publishing & Sharing"}]},{"type":"paragraph","content":[{"type":"text","text":"Once your book is ready, it is time to share it with the world — or just with a trusted group."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Publishing Your Book"}]},{"type":"paragraph","content":[{"type":"text","text":"From the book editor, click Settings in the top navigation. Under Visibility, switch from Private to Public."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Book Clubs"}]},{"type":"paragraph","content":[{"type":"text","text":"Go to Clubs in the main navigation to create a reading group. Add your book to the club. Members can read together and chat chapter by chapter."}]},{"type":"paragraph","content":[{"type":"text","text":"Congratulations! Complete the checklist below and you are ready to publish your first BookFlow book."}]}]}'::jsonb
  );
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch4_id, 'radio', 0, 0, '{"label":"Who will your book be for?","options":[{"id":"pub","text":"Anyone — I will make it public"},{"id":"club","text":"A specific reading club or class"},{"id":"col","text":"A team of collaborators"},{"id":"prv","text":"Just for me, for now"}]}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch4_id, 'multiselect', 0, 0, '{"label":"Which reader settings will you enable for your book? (select all that apply)","options":[{"id":"hi","text":"Allow reader highlights"},{"id":"no","text":"Allow reader notes"},{"id":"pt","text":"Enable progress tracking"},{"id":"tts","text":"Allow public text-to-speech"},{"id":"rt","text":"Show ratings"},{"id":"cl","text":"Share via a reading club"}]}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);
  INSERT INTO bookflow.inline_content (id, book_id, chapter_id, content_type, start_offset, end_offset, content_data, visibility, position_in_chapter, is_author_content, created_by)
  VALUES (gen_random_uuid(), v_book_id, v_ch4_id, 'question', 0, 0, '{"question_text":"You have now completed the BookFlow tutorial. What is the first book you plan to create, and who is your target reader?","question_type":"free_response"}'::jsonb, 'all_readers', 'end_of_chapter', true, v_author_id);

  RAISE NOTICE 'Tutorial book seeded. Book ID: %', v_book_id;
END $$;
