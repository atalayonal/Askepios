import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { ReservationTable } from "@/components/reservation-table";

const STATUSES = ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export default async function AdminReservationsPage({ searchParams }: PageProps<"/admin/rezervasyonlar">) {
  await requireAdmin();
  const t = await getDictionary();
  const locale = await getLocale();
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string).trim() : "");
  const status = STATUSES.includes(get("durum")) ? get("durum") : "";
  const clinic = UUID.test(get("klinik")) ? get("klinik") : "";
  const hotel = UUID.test(get("otel")) ? get("otel") : "";
  const from = ISO_DATE.test(get("baslangic")) ? get("baslangic") : "";
  const to = ISO_DATE.test(get("bitis")) ? get("bitis") : "";
  const q = get("ara").slice(0, 100);

  const supabase = await createClient();
  let query = supabase
    .from("reservations")
    .select("id, reference, hotel_name, room_name, check_in, check_out, guest_count, total_price, currency, status, clinics(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (clinic) query = query.eq("clinic_id", clinic);
  if (hotel) query = query.eq("hotel_id", hotel);
  if (from) query = query.gte("check_in", from);
  if (to) query = query.lte("check_in", to);
  if (q) {
    // Referansla ya da misafir adıyla arama.
    const { data: guestMatches } = await supabase
      .from("reservation_guests")
      .select("reservation_id")
      .ilike("full_name", `%${q.replace(/[%_]/g, "")}%`)
      .limit(200);
    const ids = [...new Set((guestMatches ?? []).map((g) => g.reservation_id as string))];
    const reference = q.replace(/[^A-Za-z0-9-]/g, "");
    query = ids.length
      ? query.or(`reference.ilike.%${reference}%,id.in.(${ids.join(",")})`)
      : query.ilike("reference", `%${reference}%`);
  }

  const [{ data: reservations }, { data: clinics }, { data: hotels }] = await Promise.all([
    query,
    supabase.from("clinics").select("id, name").order("name"),
    supabase.from("hotels").select("id, name").order("name"),
  ]);

  const items = (reservations ?? []).map((r) => ({ ...r, clinic_name: (r.clinics as unknown as { name: string } | null)?.name }));

  return (
    <div className="space-y-4">
      <h1 className="page-title">{t.reservations.title}</h1>

      <form className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-7">
        <input name="ara" defaultValue={q} placeholder={t.reservations.search} className="input lg:col-span-2" />
        <select name="durum" defaultValue={status} className="input">
          <option value="">{t.reservations.allStatuses}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
        </select>
        <select name="klinik" defaultValue={clinic} className="input">
          <option value="">{t.reservations.allClinics}</option>
          {(clinics ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="otel" defaultValue={hotel} className="input">
          <option value="">{t.reservations.allHotels}</option>
          {(hotels ?? []).map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <input name="baslangic" type="date" defaultValue={from} aria-label={t.reservations.from} title={t.reservations.from} className="input" />
        <input name="bitis" type="date" defaultValue={to} aria-label={t.reservations.to} title={t.reservations.to} className="input" />
        <div className="flex gap-2 lg:col-span-7">
          <button type="submit" className="btn-primary">
            {t.reservations.filter}
          </button>
          <Link href="/admin/rezervasyonlar" className="btn-secondary">
            {t.reservations.clearFilters}
          </Link>
        </div>
      </form>

      <div className="card overflow-hidden">
        <ReservationTable items={items} hrefBase="/admin/rezervasyonlar" t={t} locale={locale} showClinic decide />
      </div>
    </div>
  );
}
