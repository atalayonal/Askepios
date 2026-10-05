import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { toIso } from "@/lib/dates";
import { ReservationTable } from "@/components/reservation-table";

const COLUMNS = "id, reference, hotel_name, room_name, check_in, check_out, guest_count, total_price, currency, status, clinics(name)";

export default async function AdminDashboard() {
  await requireAdmin();
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();
  const today = toIso(new Date());

  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;
  const [pendingCount, confirmedCount, rejectedCount, clinics, hotels, { data: pending }, { data: upcoming }] = await Promise.all([
    count(supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "PENDING")),
    count(supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "CONFIRMED").gte("check_out", today)),
    count(supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "REJECTED")),
    count(supabase.from("clinics").select("*", { count: "exact", head: true }).eq("is_active", true)),
    count(supabase.from("hotels").select("*", { count: "exact", head: true }).eq("is_active", true)),
    supabase.from("reservations").select(COLUMNS).eq("status", "PENDING").order("created_at").limit(20),
    supabase.from("reservations").select(COLUMNS).eq("status", "CONFIRMED").gte("check_out", today).order("check_in").limit(20),
  ]);

  const stats = [
    { label: t.admin.pendingReservations, value: pendingCount, href: "/admin/rezervasyonlar?durum=PENDING" },
    { label: t.admin.confirmedReservations, value: confirmedCount, href: "/admin/rezervasyonlar?durum=CONFIRMED" },
    { label: t.reservations.rejectedReservations, value: rejectedCount, href: "/admin/rezervasyonlar?durum=REJECTED" },
    { label: t.admin.clinicCount, value: clinics, href: "/admin/klinikler" },
    { label: t.admin.hotelCount, value: hotels, href: "/admin/oteller" },
  ];
  const withClinic = (rows: typeof pending) =>
    (rows ?? []).map((r) => ({ ...r, clinic_name: (r.clinics as unknown as { name: string } | null)?.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t.admin.dashboardTitle}</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 hover:border-teal-600">
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </Link>
        ))}
      </div>
      <section className="card">
        <h2 className="px-4 pt-4 font-semibold">{t.admin.pendingReservations}</h2>
        <ReservationTable items={withClinic(pending)} hrefBase="/admin/rezervasyonlar" t={t} locale={locale} showClinic />
      </section>
      <section className="card">
        <h2 className="px-4 pt-4 font-semibold">{t.reservations.upcomingConfirmed}</h2>
        <ReservationTable items={withClinic(upcoming)} hrefBase="/admin/rezervasyonlar" t={t} locale={locale} showClinic />
      </section>
    </div>
  );
}
