import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { toIso } from "@/lib/dates";
import { fetchMonthReservations } from "@/lib/summary-data";
import { ReservationTable } from "@/components/reservation-table";
import { PendingCard } from "@/components/pending-card";
import { SummaryTiles, monthLabel } from "@/components/monthly-summary";

const COLUMNS = "id, reference, hotel_name, room_name, check_in, check_out, guest_count, total_price, currency, status, created_at, clinics(name)";

export default async function AdminDashboard() {
  await requireAdmin();
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();
  const today = toIso(new Date());
  const month = today.slice(0, 7);

  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;
  const [clinics, hotels, monthRows, { data: pending }, { data: upcoming }] = await Promise.all([
    count(supabase.from("clinics").select("*", { count: "exact", head: true }).eq("is_active", true)),
    count(supabase.from("hotels").select("*", { count: "exact", head: true }).eq("is_active", true)),
    fetchMonthReservations(supabase, month),
    supabase.from("reservations").select(COLUMNS).eq("status", "PENDING").order("created_at").limit(30),
    supabase.from("reservations").select(COLUMNS).eq("status", "CONFIRMED").gte("check_out", today).order("check_in").limit(20),
  ]);

  const withClinic = <T extends { clinics: unknown }>(rows: T[] | null) =>
    (rows ?? []).map((r) => ({ ...r, clinic_name: (r.clinics as { name: string } | null)?.name }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="page-title">{t.admin.dashboardTitle}</h1>
          <p className="mt-1 text-sm text-muted">
            {clinics} {t.ui.activeClinics} · {hotels} {t.ui.activeHotels}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold capitalize">{monthLabel(month, locale)}</h2>
          <Link href="/admin/ozet" className="text-sm font-semibold text-blue hover:underline">
            {t.ui.openSummary}
          </Link>
        </div>
        <SummaryTiles rows={monthRows} t={t} locale={locale} admin />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          {t.ui.awaitingDecision} <span className="font-medium text-muted">({pending?.length ?? 0})</span>
        </h2>
        {pending?.length ? (
          <ul className="space-y-3">
            {withClinic(pending).map((r) => (
              <PendingCard key={r.id} r={r} t={t} locale={locale} />
            ))}
          </ul>
        ) : (
          <p className="card p-5 text-sm text-muted">{t.ui.nothingPending}</p>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="px-5 pb-2 pt-5 text-lg font-bold">{t.reservations.upcomingConfirmed}</h2>
        <ReservationTable items={withClinic(upcoming)} hrefBase="/admin/rezervasyonlar" t={t} locale={locale} showClinic />
      </section>
    </div>
  );
}
