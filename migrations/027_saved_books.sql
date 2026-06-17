-- Migration 027: Saved books (user reading list / "My Books" shelf)
-- Users can save/bookmark public books to their personal shelf.

CREATE TABLE IF NOT EXISTS bookflow.saved_books (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  book_id     UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS saved_books_user_id_idx ON bookflow.saved_books(user_id);
CREATE INDEX IF NOT EXISTS saved_books_book_id_idx ON bookflow.saved_books(book_id);

-- RLS
ALTER TABLE bookflow.saved_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved books"
  ON bookflow.saved_books
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
