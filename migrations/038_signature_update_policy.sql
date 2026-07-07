-- Allow users to update (upsert) their own signature responses
CREATE POLICY "Users update own signatures" ON bookflow.signature_responses FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Grant full access to authenticated users and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.signature_responses TO authenticated;
GRANT ALL ON bookflow.signature_responses TO service_role;
