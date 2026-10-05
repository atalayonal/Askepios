import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service role anahtarıyla çalışan istemci: RLS'yi atlar.
 * Sadece kullanıcı oluşturma gibi Supabase Auth admin işlemleri için, ve sadece
 * çağıran kişinin admin olduğu doğrulandıktan sonra kullanılır.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
