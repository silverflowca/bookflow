-- ============================================================================
-- Migration 032: Grant PostgREST role access to feedback tables
-- ============================================================================

-- Grant schema usage
GRANT USAGE ON SCHEMA bookflow TO anon, authenticated, service_role;

-- Grant table access to service_role (server, bypasses RLS via policy)
GRANT ALL ON bookflow.feedback_config     TO service_role;
GRANT ALL ON bookflow.feedback            TO service_role;
GRANT ALL ON bookflow.feedback_screenshots TO service_role;
GRANT ALL ON bookflow.feedback_audio      TO service_role;
GRANT ALL ON bookflow.feedback_comments   TO service_role;

-- Grant table access to authenticated (RLS policies enforce row-level access)
GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.feedback            TO authenticated;
GRANT SELECT, INSERT                 ON bookflow.feedback_screenshots TO authenticated;
GRANT SELECT, INSERT                 ON bookflow.feedback_audio       TO authenticated;
GRANT SELECT                         ON bookflow.feedback_comments    TO authenticated;
GRANT SELECT                         ON bookflow.feedback_config      TO authenticated;

-- Grant sequence access for UUID defaults (gen_random_uuid doesn't need this,
-- but include for safety)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA bookflow TO authenticated, service_role;
