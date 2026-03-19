import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Ensure env vars are loaded
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:55321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Log which vars are present (mask the actual values)
console.log('[supabase] SUPABASE_URL:', SUPABASE_URL);
console.log('[supabase] SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✓ set' : '✗ MISSING');
console.log('[supabase] SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓ set' : '✗ MISSING');

if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required');
}

// Supabase client with service role (bypasses RLS)
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'bookflow' }
  }
);

// Supabase client with anon key (respects RLS) - for public endpoints
const supabasePublic = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'bookflow' }
  }
);

export { supabase, supabasePublic };
export default supabase;
