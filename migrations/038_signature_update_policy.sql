-- Allow users to update (upsert) their own signature responses
CREATE POLICY IF NOT EXISTS "Users update own signatures" ON bookflow.signature_responses FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT UPDATE ON bookflow.signature_responses TO authenticated;
