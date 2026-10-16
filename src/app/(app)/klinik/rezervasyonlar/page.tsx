import Link from "next/link";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { ReservationTable } from "@/components/reservation-table";
import { GUEST_COLUMNS } from "@/lib/reservation-guests";
import { reservationSearchFilter } from "@/lib/reservation-search";

export default async function ClinicReservationsPage({ searchParams }: PageProps<"/klinik/rezervasyonlar">) {
  await requireClinicUser();
  const t = await getDictionary();
  const locale = await getLocale();
  const { ara } = await searchParams;
  const q = typeof ara === "string" ? ara.trim().slice(0, 100) : "";
  const supabase = await createClient();
  let query = supabase
    .from("reservations")
    .select(`id, reference, hotel_name, room_name, check_in, check_out, guest_count, total_price, currency, status, ${GUEST_COLUMNS}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.or(await reservationSearchFilter(supabase, q));
  const { data } = await query;

  return (
    <div className="space-y-4">
      <h1 className="page-title">{t.clinic.myReservations}</h1>
      <form className="card flex flex-wrap gap-2 p-4">
        <input name="ara" defaultValue={q} placeholder={t.reservations.search} className="input min-w-0 flex-1" />
        <button type="submit" className="btn-primary">
          {t.ui.search}
        </button>
        {q && (
          <Link href="/klinik/rezervasyonlar" className="btn-secondary">
            {t.reservations.clearFilters}
          </Link>
        )}
      </form>
      <div className="card overflow-hidden">
        <ReservationTable items={data ?? []} hrefBase="/klinik/rezervasyonlar" t={t} locale={locale} />
      </div>
    </div>
  );
}
