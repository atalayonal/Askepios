import Link from "next/link";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { ReservationTable } from "@/components/reservation-table";
import { GUEST_COLUMNS } from "@/lib/reservation-guests";
import { reservationSearchFilter } from "@/lib/reservation-search";
import { PAGE_SIZE, Pagination, pageFromParam } from "@/components/pagination";

export default async function ClinicReservationsPage({ searchParams }: PageProps<"/klinik/rezervasyonlar">) {
  await requireClinicUser();
  const t = await getDictionary();
  const locale = await getLocale();
  const { ara, sayfa } = await searchParams;
  const q = typeof ara === "string" ? ara.trim().slice(0, 100) : "";
  const page = pageFromParam(sayfa);
  const supabase = await createClient();
  let query = supabase
    .from("reservations")
    .select(`id, reference, hotel_name, room_name, check_in, check_out, guest_count, total_price, currency, status, ${GUEST_COLUMNS}`)
    .order("created_at", { ascending: false })
    // Bir fazlası istenir: dönerse sonraki sayfa vardır.
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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
        <ReservationTable items={(data ?? []).slice(0, PAGE_SIZE)} hrefBase="/klinik/rezervasyonlar" t={t} locale={locale} />
        <Pagination
          page={page}
          hasNext={(data?.length ?? 0) > PAGE_SIZE}
          href={(p) => `/klinik/rezervasyonlar?${new URLSearchParams({ ...(q ? { ara: q } : {}), sayfa: String(p) })}`}
          t={t}
        />
      </div>
    </div>
  );
}
