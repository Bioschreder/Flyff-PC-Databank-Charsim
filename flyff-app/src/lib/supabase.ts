import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || supabaseUrl.includes('DEIN-PROJEKT')) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL ist nicht gesetzt. ' +
    'Kopiere env.local.example nach .env.local und trage deine Werte ein.'
  );
}

export const supabase = createClient(
  supabaseUrl  ?? 'https://placeholder.supabase.co',
  supabaseKey  ?? 'placeholder',
);

export type SupabaseClient = typeof supabase;
