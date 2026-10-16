import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Arama metnine uyan rezervasyonlar için PostgREST "or" filtresi: referansla ya da misafir adıyla.
 * Klinik kullanıcısı için RLS zaten sadece kendi misafirlerini döndürür.
 */
export async function reservationSearchFilter(supabase: Supabase, q: string): Promise<string> {
  const { data: guestMatches } = await supabase
    .from("reservation_guests")
    .select("reservation_id")
    .ilike("full_name", `%${q.replace(/[%_,()]/g, "")}%`)
    .limit(200);
  const ids = [...new Set((guestMatches ?? []).map((g) => g.reservation_id as string))];
  const reference = q.replace(/[^A-Za-z0-9-]/g, "");
  return ids.length ? `reference.ilike.%${reference}%,id.in.(${ids.join(",")})` : `reference.ilike.%${reference}%`;
}
