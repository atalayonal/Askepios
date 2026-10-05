function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Ortam değişkeni eksik: ${name}. .env.example dosyasına bakın.`);
  }
  return value;
}

// NEXT_PUBLIC_ değişkenleri derleme sırasında koda gömülür, bu yüzden tek tek yazılmaları gerekir.
export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
};
