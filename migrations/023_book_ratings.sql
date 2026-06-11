-- Book ratings: readers rate books 1–5 stars
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

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION bookflow.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER update_book_ratings_updated_at
    BEFORE UPDATE ON bookflow.book_ratings
    FOR EACH ROW EXECUTE FUNCTION bookflow.set_updated_at();

-- Add show_ratings toggle to book_settings
ALTER TABLE bookflow.book_settings
    ADD COLUMN IF NOT EXISTS show_ratings BOOLEAN DEFAULT TRUE;

-- RLS
ALTER TABLE bookflow.book_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_ratings_select" ON bookflow.book_ratings
    FOR SELECT USING (true);

CREATE POLICY "book_ratings_manage" ON bookflow.book_ratings
    FOR ALL USING (auth.uid() = user_id);
