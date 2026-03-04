import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Ensure env vars are loaded
dotenv.config();

// Supabase client with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:55321',
  process.env.SUPABASE_SERVICE_KEY || '',
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'bookflow' }
  }
);

// Supabase client with anon key (respects RLS) - for public endpoints
const supabasePublic = createClient(
  process.env.SUPABASE_URL || 'http://localhost:55321',
  process.env.SUPABASE_ANON_KEY || '',
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'bookflow' }
  }
);

export { supabase, supabasePublic };
export default supabase;
