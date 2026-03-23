-- ============================================================================
-- BookFlow - Full Database Migration for Railway/Supabase Cloud
-- ============================================================================
-- Combined migration (001 + 002) - Run this in Supabase SQL Editor
-- This script is idempotent - safe to run multiple times
-- ============================================================================

-- ============================================================================
-- SCHEMA
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS bookflow;

-- ============================================================================
-- USER PROFILES
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    is_author BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON bookflow.profiles(email);

-- ============================================================================
-- BOOKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    cover_image_url TEXT,
    author_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_author ON bookflow.books(author_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON bookflow.books(status);
CREATE INDEX IF NOT EXISTS idx_books_visibility ON bookflow.books(visibility);

-- ============================================================================
-- BOOK SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.book_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID UNIQUE NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    allow_reader_highlights BOOLEAN DEFAULT TRUE,
    allow_reader_notes BOOLEAN DEFAULT TRUE,
    allow_reader_questions BOOLEAN DEFAULT TRUE,
    allow_reader_polls BOOLEAN DEFAULT FALSE,
    show_author_highlights BOOLEAN DEFAULT TRUE,
    show_author_notes BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CHAPTERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content JSONB,
    content_text TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    word_count INTEGER DEFAULT 0,
    estimated_read_time_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chapters_book ON bookflow.chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_order ON bookflow.chapters(book_id, order_index);

-- ============================================================================
-- INLINE CONTENT (with interactive element types from migration 002)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.inline_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES bookflow.chapters(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN (
        'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
        'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
        'code_block', 'scripture_block'
    )),
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    anchor_text TEXT,
    content_data JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    is_author_content BOOLEAN DEFAULT FALSE,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('author_only', 'all_readers', 'private')),
    position_in_chapter TEXT DEFAULT 'inline' CHECK (position_in_chapter IN ('inline', 'end_of_chapter', 'start_of_chapter')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inline_content_chapter ON bookflow.inline_content(chapter_id);
CREATE INDEX IF NOT EXISTS idx_inline_content_book ON bookflow.inline_content(book_id);
CREATE INDEX IF NOT EXISTS idx_inline_content_type ON bookflow.inline_content(content_type);
CREATE INDEX IF NOT EXISTS idx_inline_content_author ON bookflow.inline_content(is_author_content);
CREATE INDEX IF NOT EXISTS idx_inline_content_offsets ON bookflow.inline_content(chapter_id, start_offset, end_offset);

-- ============================================================================
-- POLL RESPONSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.poll_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inline_content_id UUID NOT NULL REFERENCES bookflow.inline_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    selected_option TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inline_content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_responses_content ON bookflow.poll_responses(inline_content_id);

-- ============================================================================
-- QUESTION ANSWERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.question_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inline_content_id UUID NOT NULL REFERENCES bookflow.inline_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    answer_text TEXT,
    selected_options JSONB,
    is_correct BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_answers_content ON bookflow.question_answers(inline_content_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_user ON bookflow.question_answers(user_id);

-- ============================================================================
-- FORM RESPONSES (from migration 002)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inline_content_id UUID NOT NULL REFERENCES bookflow.inline_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    response_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inline_content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_form_responses_content ON bookflow.form_responses(inline_content_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_user ON bookflow.form_responses(user_id);

-- ============================================================================
-- READING PROGRESS
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.reading_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    current_chapter_id UUID REFERENCES bookflow.chapters(id),
    scroll_position FLOAT DEFAULT 0,
    percent_complete FLOAT DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON bookflow.reading_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_book ON bookflow.reading_progress(book_id);

-- ============================================================================
-- FILE REFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.file_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES bookflow.books(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES bookflow.chapters(id) ON DELETE CASCADE,
    inline_content_id UUID REFERENCES bookflow.inline_content(id) ON DELETE CASCADE,
    fileflow_file_id UUID,
    file_type TEXT NOT NULL,
    display_name TEXT,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_references_book ON bookflow.file_references(book_id);
CREATE INDEX IF NOT EXISTS idx_file_references_fileflow ON bookflow.file_references(fileflow_file_id);

-- ============================================================================
-- CHANGE LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
    changed_by UUID REFERENCES bookflow.profiles(id),
    before_data JSONB,
    after_data JSONB,
    change_description TEXT,
    synced_to_changeflow BOOLEAN DEFAULT FALSE,
    changeflow_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_log_entity ON bookflow.change_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_change_log_synced ON bookflow.change_log(synced_to_changeflow);
CREATE INDEX IF NOT EXISTS idx_change_log_created ON bookflow.change_log(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE bookflow.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.book_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.inline_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.file_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.form_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DO $$ BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "profiles_select" ON bookflow.profiles;
    DROP POLICY IF EXISTS "profiles_insert" ON bookflow.profiles;
    DROP POLICY IF EXISTS "profiles_update" ON bookflow.profiles;
    -- Books
    DROP POLICY IF EXISTS "books_select" ON bookflow.books;
    DROP POLICY IF EXISTS "books_insert" ON bookflow.books;
    DROP POLICY IF EXISTS "books_update" ON bookflow.books;
    DROP POLICY IF EXISTS "books_delete" ON bookflow.books;
    -- Book Settings
    DROP POLICY IF EXISTS "book_settings_select" ON bookflow.book_settings;
    DROP POLICY IF EXISTS "book_settings_manage" ON bookflow.book_settings;
    -- Chapters
    DROP POLICY IF EXISTS "chapters_select" ON bookflow.chapters;
    DROP POLICY IF EXISTS "chapters_insert" ON bookflow.chapters;
    DROP POLICY IF EXISTS "chapters_update" ON bookflow.chapters;
    DROP POLICY IF EXISTS "chapters_delete" ON bookflow.chapters;
    -- Inline Content
    DROP POLICY IF EXISTS "inline_content_select" ON bookflow.inline_content;
    DROP POLICY IF EXISTS "inline_content_insert" ON bookflow.inline_content;
    DROP POLICY IF EXISTS "inline_content_update" ON bookflow.inline_content;
    DROP POLICY IF EXISTS "inline_content_delete" ON bookflow.inline_content;
    -- Poll Responses
    DROP POLICY IF EXISTS "poll_responses_select" ON bookflow.poll_responses;
    DROP POLICY IF EXISTS "poll_responses_manage" ON bookflow.poll_responses;
    -- Question Answers
    DROP POLICY IF EXISTS "question_answers_select" ON bookflow.question_answers;
    DROP POLICY IF EXISTS "question_answers_manage" ON bookflow.question_answers;
    -- Form Responses
    DROP POLICY IF EXISTS "form_responses_select" ON bookflow.form_responses;
    DROP POLICY IF EXISTS "form_responses_manage" ON bookflow.form_responses;
    -- Reading Progress
    DROP POLICY IF EXISTS "reading_progress_select" ON bookflow.reading_progress;
    DROP POLICY IF EXISTS "reading_progress_manage" ON bookflow.reading_progress;
    -- File References
    DROP POLICY IF EXISTS "file_references_select" ON bookflow.file_references;
    DROP POLICY IF EXISTS "file_references_manage" ON bookflow.file_references;
    -- Change Log
    DROP POLICY IF EXISTS "change_log_select" ON bookflow.change_log;
    DROP POLICY IF EXISTS "change_log_insert" ON bookflow.change_log;
END $$;

-- Profiles
CREATE POLICY "profiles_select" ON bookflow.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON bookflow.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON bookflow.profiles FOR UPDATE USING (auth.uid() = id);

-- Books
CREATE POLICY "books_select" ON bookflow.books FOR SELECT
    USING (visibility = 'public' OR author_id = auth.uid());
CREATE POLICY "books_insert" ON bookflow.books FOR INSERT
    WITH CHECK (author_id = auth.uid());
CREATE POLICY "books_update" ON bookflow.books FOR UPDATE
    USING (author_id = auth.uid());
CREATE POLICY "books_delete" ON bookflow.books FOR DELETE
    USING (author_id = auth.uid());

-- Book Settings
CREATE POLICY "book_settings_select" ON bookflow.book_settings FOR SELECT USING (true);
CREATE POLICY "book_settings_manage" ON bookflow.book_settings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()
    ));

-- Chapters
CREATE POLICY "chapters_select" ON bookflow.chapters FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM bookflow.books
        WHERE books.id = chapters.book_id
        AND (books.visibility = 'public' OR books.author_id = auth.uid())
    ));
CREATE POLICY "chapters_insert" ON bookflow.chapters FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM bookflow.books
        WHERE books.id = book_id AND books.author_id = auth.uid()
    ));
CREATE POLICY "chapters_update" ON bookflow.chapters FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM bookflow.books
        WHERE books.id = book_id AND books.author_id = auth.uid()
    ));
CREATE POLICY "chapters_delete" ON bookflow.chapters FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM bookflow.books
        WHERE books.id = book_id AND books.author_id = auth.uid()
    ));

-- Inline Content
CREATE POLICY "inline_content_select" ON bookflow.inline_content FOR SELECT
    USING (
        created_by = auth.uid()
        OR visibility = 'all_readers'
        OR (is_author_content = true AND visibility = 'author_only' AND EXISTS (
            SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()
        ))
    );
CREATE POLICY "inline_content_insert" ON bookflow.inline_content FOR INSERT
    WITH CHECK (created_by = auth.uid());
CREATE POLICY "inline_content_update" ON bookflow.inline_content FOR UPDATE
    USING (created_by = auth.uid());
CREATE POLICY "inline_content_delete" ON bookflow.inline_content FOR DELETE
    USING (created_by = auth.uid());

-- Poll Responses
CREATE POLICY "poll_responses_select" ON bookflow.poll_responses FOR SELECT USING (true);
CREATE POLICY "poll_responses_manage" ON bookflow.poll_responses FOR ALL
    USING (user_id = auth.uid());

-- Question Answers
CREATE POLICY "question_answers_select" ON bookflow.question_answers FOR SELECT
    USING (user_id = auth.uid());
CREATE POLICY "question_answers_manage" ON bookflow.question_answers FOR ALL
    USING (user_id = auth.uid());

-- Form Responses
CREATE POLICY "form_responses_select" ON bookflow.form_responses FOR SELECT
    USING (user_id = auth.uid());
CREATE POLICY "form_responses_manage" ON bookflow.form_responses FOR ALL
    USING (user_id = auth.uid());

-- Reading Progress
CREATE POLICY "reading_progress_select" ON bookflow.reading_progress FOR SELECT
    USING (user_id = auth.uid());
CREATE POLICY "reading_progress_manage" ON bookflow.reading_progress FOR ALL
    USING (user_id = auth.uid());

-- File References
CREATE POLICY "file_references_select" ON bookflow.file_references FOR SELECT USING (true);
CREATE POLICY "file_references_manage" ON bookflow.file_references FOR ALL
    USING (EXISTS (
        SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()
    ));

-- Change Log
CREATE POLICY "change_log_select" ON bookflow.change_log FOR SELECT USING (true);
CREATE POLICY "change_log_insert" ON bookflow.change_log FOR INSERT WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION bookflow.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers before recreating (idempotent)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON bookflow.profiles;
DROP TRIGGER IF EXISTS update_books_updated_at ON bookflow.books;
DROP TRIGGER IF EXISTS update_book_settings_updated_at ON bookflow.book_settings;
DROP TRIGGER IF EXISTS update_chapters_updated_at ON bookflow.chapters;
DROP TRIGGER IF EXISTS update_inline_content_updated_at ON bookflow.inline_content;
DROP TRIGGER IF EXISTS update_question_answers_updated_at ON bookflow.question_answers;
DROP TRIGGER IF EXISTS update_form_responses_updated_at ON bookflow.form_responses;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON bookflow.profiles
    FOR EACH ROW EXECUTE FUNCTION bookflow.update_updated_at();
CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON bookflow.books
    FOR EACH ROW EXECUTE FUNCTION bookflow.update_updated_at();
CREATE TRIGGER update_book_settings_updated_at BEFORE UPDATE ON bookflow.book_settings
    FOR EACH ROW EXECUTE FUNCTION bookflow.update_updated_at();
CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON bookflow.chapters
    FOR EACH ROW EXECUTE FUNCTION bookflow.update_updated_at();
CREATE TRIGGER update_inline_content_updated_at BEFORE UPDATE ON bookflow.inline_content
    FOR EACH ROW EXECUTE FUNCTION bookflow.update_updated_at();
CREATE TRIGGER update_question_answers_updated_at BEFORE UPDATE ON bookflow.question_answers
    FOR EACH ROW EXECUTE FUNCTION bookflow.update_updated_at();
CREATE TRIGGER update_form_responses_updated_at BEFORE UPDATE ON bookflow.form_responses
    FOR EACH ROW EXECUTE FUNCTION bookflow.update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION bookflow.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO bookflow.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_bookflow ON auth.users;
CREATE TRIGGER on_auth_user_created_bookflow
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION bookflow.handle_new_user();

-- Auto-create book settings on book insert
CREATE OR REPLACE FUNCTION bookflow.create_book_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO bookflow.book_settings (book_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_book_settings_on_insert ON bookflow.books;
CREATE TRIGGER create_book_settings_on_insert AFTER INSERT ON bookflow.books
    FOR EACH ROW EXECUTE FUNCTION bookflow.create_book_settings();

-- Calculate word count and read time
CREATE OR REPLACE FUNCTION bookflow.calculate_chapter_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.content_text IS NOT NULL THEN
        NEW.word_count = array_length(regexp_split_to_array(trim(NEW.content_text), '\s+'), 1);
        NEW.estimated_read_time_minutes = GREATEST(1, NEW.word_count / 200);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_chapter_stats ON bookflow.chapters;
CREATE TRIGGER calculate_chapter_stats BEFORE INSERT OR UPDATE ON bookflow.chapters
    FOR EACH ROW EXECUTE FUNCTION bookflow.calculate_chapter_stats();

-- Change log function
CREATE OR REPLACE FUNCTION bookflow.log_change()
RETURNS TRIGGER AS $$
DECLARE
    v_entity_type TEXT;
    v_change_type TEXT;
    v_changed_by UUID;
BEGIN
    v_entity_type = TG_ARGV[0];

    IF TG_OP = 'INSERT' THEN
        v_change_type = 'create';
        v_changed_by = NEW.created_by;
        IF v_changed_by IS NULL THEN
            v_changed_by = COALESCE(
                (SELECT author_id FROM bookflow.books WHERE id = NEW.book_id),
                NEW.author_id
            );
        END IF;
        INSERT INTO bookflow.change_log (entity_type, entity_id, change_type, changed_by, after_data)
        VALUES (v_entity_type, NEW.id, v_change_type, v_changed_by, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_change_type = 'update';
        v_changed_by = COALESCE(NEW.created_by, NEW.author_id);
        INSERT INTO bookflow.change_log (entity_type, entity_id, change_type, changed_by, before_data, after_data)
        VALUES (v_entity_type, NEW.id, v_change_type, v_changed_by, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_change_type = 'delete';
        v_changed_by = COALESCE(OLD.created_by, OLD.author_id);
        INSERT INTO bookflow.change_log (entity_type, entity_id, change_type, changed_by, before_data)
        VALUES (v_entity_type, OLD.id, v_change_type, v_changed_by, to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_book_changes ON bookflow.books;
DROP TRIGGER IF EXISTS log_chapter_changes ON bookflow.chapters;
DROP TRIGGER IF EXISTS log_inline_content_changes ON bookflow.inline_content;

CREATE TRIGGER log_book_changes AFTER INSERT OR UPDATE OR DELETE ON bookflow.books
    FOR EACH ROW EXECUTE FUNCTION bookflow.log_change('book');
CREATE TRIGGER log_chapter_changes AFTER INSERT OR UPDATE OR DELETE ON bookflow.chapters
    FOR EACH ROW EXECUTE FUNCTION bookflow.log_change('chapter');
CREATE TRIGGER log_inline_content_changes AFTER INSERT OR UPDATE OR DELETE ON bookflow.inline_content
    FOR EACH ROW EXECUTE FUNCTION bookflow.log_change('inline_content');

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT USAGE ON SCHEMA bookflow TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA bookflow TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bookflow TO authenticated;
GRANT USAGE ON SCHEMA bookflow TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA bookflow TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bookflow TO service_role;
GRANT USAGE ON SCHEMA bookflow TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA bookflow TO anon;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON SCHEMA bookflow IS 'BookFlow - Interactive book authoring and reading platform';
COMMENT ON TABLE bookflow.profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE bookflow.books IS 'Books created by authors';
COMMENT ON TABLE bookflow.book_settings IS 'Author-configurable reader permissions per book';
COMMENT ON TABLE bookflow.chapters IS 'Book chapters with TipTap JSON content';
COMMENT ON TABLE bookflow.inline_content IS 'Questions, polls, highlights, notes, links, media, and interactive form elements';
COMMENT ON TABLE bookflow.poll_responses IS 'User votes on polls';
COMMENT ON TABLE bookflow.question_answers IS 'User answers to inline questions';
COMMENT ON TABLE bookflow.form_responses IS 'User responses to interactive form elements';
COMMENT ON TABLE bookflow.reading_progress IS 'User reading progress tracking';
COMMENT ON TABLE bookflow.file_references IS 'Links to files stored in FileFlow';
COMMENT ON TABLE bookflow.change_log IS 'Change history for ChangeFlow integration';

-- ============================================================================
-- APP SETTINGS (migration 006 + 008)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookflow.app_settings (
  user_id             UUID PRIMARY KEY REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  fileflow_url        TEXT NOT NULL DEFAULT 'http://localhost:8680',
  fileflow_access_key TEXT NOT NULL DEFAULT '',
  deepgram_api_key    TEXT NOT NULL DEFAULT '',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL PRIVILEGES ON bookflow.app_settings TO service_role, authenticated;

ALTER TABLE bookflow.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own settings"
  ON bookflow.app_settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role bypass"
  ON bookflow.app_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);
