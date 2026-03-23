-- Allow file_references rows that use Supabase Storage (no FileFlow involved)
-- fileflow_file_id is NULL when files are stored directly in Supabase Storage
ALTER TABLE bookflow.file_references
  ALTER COLUMN fileflow_file_id DROP NOT NULL;
