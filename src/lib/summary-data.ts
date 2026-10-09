import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shiftMonth } from "@/lib/dates";
import type { SummaryReservation } from "@/lib/summary";

/** Girişi verilen ayda olan rezervasyonlar. Klinik kullanıcısı için RLS zaten sadece kendi kliniğini döndürür. */
export async function fetchMonthReservations(supabase: SupabaseClient, month: string, clinicId?: string): Promise<SummaryReservation[]> {
  let query = supabase
    .from("reservations")
    .select("id, reference, hotel_id, hotel_name, room_name, clinic_id, check_in, check_out, guest_count, total_price, currency, status, clinics(name)")
    .gte("check_in", `${month}-01`)
    .lt("check_in", `${shiftMonth(month, 1)}-01`)
    .order("check_in")
    .limit(2000);
  if (clinicId) query = query.eq("clinic_id", clinicId);
  const { data } = await query;
  return (data ?? []).map(({ clinics, ...r }) => ({ ...r, clinic_name: (clinics as unknown as { name: string } | null)?.name }));
}
