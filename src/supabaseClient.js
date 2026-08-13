// src/supabaseClient.js
//
// 1. Install the client:
//      npm install @supabase/supabase-js
//
// 2. Add these two vars to a `.env` file at your project root
//    (Vite only exposes env vars prefixed with VITE_):
//
//      VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
//      VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
//
// 3. Make sure Realtime is turned on for the `invoices` table:
//      Supabase Dashboard -> Database -> Replication -> invoices -> toggle ON
//
// 4. Import { supabase } from './supabaseClient' wherever you need it.
 
import { createClient } from '@supabase/supabase-js';
 
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
 
if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at boot instead of silently returning empty data later.
  throw new Error(
    'Missing Supabase env vars. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
  );
}
 
export const supabase = createClient(supabaseUrl, supabaseAnonKey);