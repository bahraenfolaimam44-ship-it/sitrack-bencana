import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseConfigError, supabaseUrl } from './env';

if (supabaseConfigError) {
  throw new Error(supabaseConfigError);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
