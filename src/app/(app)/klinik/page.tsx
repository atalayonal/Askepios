import Link from "next/link";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { toIso } from "@/lib/dates";
import { fetchMonthReservations } from "@/lib/summary-data";
import { ReservationTable } from "@/components/reservation-table";
import { SummaryTiles, monthLabel } from "@/components/monthly-summary";

const COLUMNS = "id, reference, hotel_name, room_name, check_in, check_out, guest_count, total_price, currency, status";

export default async function ClinicDashboard() {
  const user = await requireClinicUser();
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();
  const today = toIso(new Date());
  const month = today.slice(0, 7);

  // RLS sadece bu kliniğin rezervasyonlarını döndürür.
  const [monthRows, { data: upcoming }, { data: pending }] = await Promise.all([
    fetchMonthReservations(supabase, month),
    supabase.from("reservations").select(COLUMNS).eq("status", "CONFIRMED").gte("check_out", today).order("check_in").limit(10),
    supabase.from("reservations").select(COLUMNS).eq("status", "PENDING").order("created_at", { ascending: false }).limit(10),
  ]);

  const sections = [
    { title: t.clinic.pendingRequests, intro: t.ui.pendingClinicIntro, items: pending ?? [] },
    { title: t.clinic.upcoming, intro: "", items: upcoming ?? [] },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-navy p-6 text-white">
        <div>
          <p className="text-sm text-white/70">{user.clinicName}</p>
          <h1 className="text-2xl font-bold tracking-tight">{t.ui.clinicWelcome}</h1>
        </div>
        <Link href="/klinik/oteller" className="ml-auto inline-flex items-center rounded-lg bg-amber px-5 py-3 font-bold text-navy-deep hover:brightness-105">
          {t.ui.newReservation}
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold capitalize">{monthLabel(month, locale)}</h2>
          <Link href="/klinik/ozet" className="text-sm font-semibold text-blue hover:underline">
            {t.ui.openSummary}
          </Link>
        </div>
        <SummaryTiles rows={monthRows} t={t} locale={locale} admin={false} />
      </section>

      {sections.map((s) => (
        <section key={s.title} className="card overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-5">
            <div>
              <h2 className="text-lg font-bold">{s.title}</h2>
              {s.intro && <p className="text-sm text-muted">{s.intro}</p>}
            </div>
            <Link href="/klinik/rezervasyonlar" className="text-sm font-semibold text-blue hover:underline">
              {t.clinic.viewAll}
            </Link>
          </div>
          <ReservationTable items={s.items} hrefBase="/klinik/rezervasyonlar" t={t} locale={locale} />
        </section>
      ))}
    </div>
  );
}
