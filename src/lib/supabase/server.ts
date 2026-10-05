import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Oturumdaki kullanıcı adına çalışan Supabase istemcisi (Server Component, Server Action, Route Handler).
 * Bütün sorgular veritabanındaki RLS kurallarına tabidir.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component içinden çağrıldıysa çerez yazılamaz; oturumu proxy yeniler.
        }
      },
    },
  });
}
