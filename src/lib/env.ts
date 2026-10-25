function readEnv(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  // Tangani juga nilai yang terlanjur ditulis sebagai teks "undefined"/"null".
  return text === 'undefined' || text === 'null' ? '' : text;
}

export const supabaseUrl = readEnv(import.meta.env.VITE_SUPABASE_URL);
export const supabaseAnonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const missingSupabaseEnv: string[] = [];
if (!supabaseUrl) missingSupabaseEnv.push('VITE_SUPABASE_URL');
if (!supabaseAnonKey) missingSupabaseEnv.push('VITE_SUPABASE_ANON_KEY');

const buildNote =
  'Vite menyisipkan nilai environment saat build. Set variabel tersebut sebelum build/deploy, bukan setelahnya.';

export const supabaseConfigError = missingSupabaseEnv.length
  ? `Konfigurasi Supabase belum lengkap. Variabel berikut kosong atau tidak terbaca: ${missingSupabaseEnv.join(', ')}. ${buildNote}`
  : null;
