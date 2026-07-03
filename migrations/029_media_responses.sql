-- ============================================================================
-- BookFlow Media Responses
-- Adds author-configurable reader text/audio/video response prompts.
-- Run: docker exec -i supabase_db_silverflow psql -U postgres -d postgres < "bookflow/migrations/029_media_responses.sql"
-- ============================================================================

ALTER TABLE bookflow.inline_content
DROP CONSTRAINT IF EXISTS inline_content_content_type_check;

ALTER TABLE bookflow.inline_content
ADD CONSTRAINT inline_content_content_type_check
CHECK (content_type IN (
    'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
    'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
    'code_block', 'scripture_block', 'image', 'drawing', 'media_response'
));

CREATE TABLE IF NOT EXISTS bookflow.media_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inline_content_id UUID NOT NULL REFERENCES bookflow.inline_content(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES bookflow.chapters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES bookflow.media_responses(id) ON DELETE CASCADE,
    response_type TEXT NOT NULL CHECK (response_type IN ('text', 'audio', 'video')),
    body TEXT,
    media_url TEXT,
    duration_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'flagged', 'hidden')),
    flagged_by UUID REFERENCES bookflow.profiles(id),
    flag_reason TEXT,
    flagged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_responses_inline_content ON bookflow.media_responses(inline_content_id);
CREATE INDEX IF NOT EXISTS idx_media_responses_book_chapter ON bookflow.media_responses(book_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_media_responses_user ON bookflow.media_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_media_responses_parent ON bookflow.media_responses(parent_id);
CREATE INDEX IF NOT EXISTS idx_media_responses_status ON bookflow.media_responses(status);

ALTER TABLE bookflow.media_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_responses_select" ON bookflow.media_responses FOR SELECT
    USING (status <> 'deleted');

CREATE POLICY "media_responses_insert" ON bookflow.media_responses FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "media_responses_update_own" ON bookflow.media_responses FOR UPDATE
    USING (user_id = auth.uid() OR flagged_by = auth.uid());

CREATE TRIGGER update_media_responses_updated_at BEFORE UPDATE ON bookflow.media_responses
    FOR EACH ROW EXECUTE FUNCTION bookflow.update_updated_at();

GRANT ALL ON bookflow.media_responses TO authenticated;
GRANT ALL ON bookflow.media_responses TO service_role;

COMMENT ON TABLE bookflow.media_responses IS 'Text, audio, and video responses to author-created reader response prompts.';
