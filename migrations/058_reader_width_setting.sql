-- Migration 058: Reader width setting
--
-- Adds two columns to book_settings:
--   reading_width       — author-chosen default width: NULL (original max-w-3xl), 75, or 100 (percent of container)
--   allow_reader_resize — when true, a width toggle button is shown to readers

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS reading_width     SMALLINT  DEFAULT NULL
    CHECK (reading_width IS NULL OR reading_width IN (75, 100)),
  ADD COLUMN IF NOT EXISTS allow_reader_resize BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN bookflow.book_settings.reading_width IS
  'Default content width: NULL = original (max-w-3xl / ~48rem), 75 = 75% of viewport, 100 = full width';
COMMENT ON COLUMN bookflow.book_settings.allow_reader_resize IS
  'When true, readers see a width-toggle button in the reader header so they can switch between widths';
