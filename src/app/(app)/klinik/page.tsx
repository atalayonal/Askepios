import Link from "next/link";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { toIso } from "@/lib/dates";
import { ReservationTable } from "@/components/reservation-table";

const COLUMNS = "id, reference, hotel_name, room_name, check_in, check_out, guest_count, total_price, currency, status";

export default async function ClinicDashboard() {
  const user = await requireClinicUser();
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();
  const today = toIso(new Date());

  // RLS sadece bu kliniğin rezervasyonlarını döndürür.
  const [{ data: upcoming }, { data: pending }, { data: recent }] = await Promise.all([
    supabase.from("reservations").select(COLUMNS).eq("status", "CONFIRMED").gte("check_out", today).order("check_in").limit(10),
    supabase.from("reservations").select(COLUMNS).eq("status", "PENDING").order("created_at", { ascending: false }).limit(10),
    supabase.from("reservations").select(COLUMNS).order("created_at", { ascending: false }).limit(5),
  ]);

  const sections = [
    { title: t.clinic.upcoming, items: upcoming ?? [] },
    { title: t.clinic.pendingRequests, items: pending ?? [] },
    { title: t.clinic.recent, items: recent ?? [] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t.clinic.dashboardTitle}</h1>
          <p className="text-sm text-slate-600">{user.clinicName}</p>
        </div>
        <Link href="/klinik/oteller" className="btn-primary ml-auto">
          {t.clinic.reserve}
        </Link>
      </div>
      {sections.map((s) => (
        <section key={s.title} className="card">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="font-semibold">{s.title}</h2>
            <Link href="/klinik/rezervasyonlar" className="text-sm text-teal-800 hover:underline">
              {t.clinic.viewAll}
            </Link>
          </div>
          <ReservationTable items={s.items} hrefBase="/klinik/rezervasyonlar" t={t} locale={locale} />
        </section>
      ))}
    </div>
  );
}
