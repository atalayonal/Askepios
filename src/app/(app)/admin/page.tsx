import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";

export default async function AdminDashboard() {
  await requireAdmin();
  const t = await getDictionary();
  const supabase = await createClient();

  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;
  const [pending, confirmed, clinics, hotels] = await Promise.all([
    count(supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "PENDING")),
    count(supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "CONFIRMED")),
    count(supabase.from("clinics").select("*", { count: "exact", head: true })),
    count(supabase.from("hotels").select("*", { count: "exact", head: true })),
  ]);

  const stats = [
    { label: t.admin.pendingReservations, value: pending },
    { label: t.admin.confirmedReservations, value: confirmed },
    { label: t.admin.clinicCount, value: clinics },
    { label: t.admin.hotelCount, value: hotels },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold">{t.admin.dashboardTitle}</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
