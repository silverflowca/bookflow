-- ============================================================================
-- BookFlow - Create bookflow-covers storage bucket
-- Run in Supabase SQL Editor (local and Railway/production)
-- Safe to run multiple times
-- ============================================================================

-- Create the public bucket for book cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bookflow-covers',
  'bookflow-covers',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
CREATE POLICY "Authenticated users can upload covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bookflow-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update/delete their own covers
DROP POLICY IF EXISTS "Users can manage their own covers" ON storage.objects;
CREATE POLICY "Users can manage their own covers"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'bookflow-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public read access (bucket is public, but policy still needed for anon)
DROP POLICY IF EXISTS "Public can view covers" ON storage.objects;
CREATE POLICY "Public can view covers"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'bookflow-covers');
