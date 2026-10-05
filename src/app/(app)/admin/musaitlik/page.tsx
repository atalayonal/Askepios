import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { addDays, eachDay, monthDays, shiftMonth } from "@/lib/dates";
import { AvailabilityGrid, type GridRow } from "./availability-grid";

export default async function AvailabilityPage({ searchParams }: PageProps<"/admin/musaitlik">) {
  await requireAdmin();
  const t = await getDictionary();
  const locale = await getLocale();
  const params = await searchParams;
  const hotelFilter = typeof params.otel === "string" ? params.otel : "";
  const { month, days } = monthDays(typeof params.ay === "string" ? params.ay : undefined);
  const first = days[0];
  const last = days[days.length - 1];

  const supabase = await createClient();
  let roomsQuery = supabase
    .from("room_types")
    .select("id, name_tr, hotel_id, hotels!inner(name, is_active)")
    .eq("is_active", true)
    .eq("hotels.is_active", true);
  if (hotelFilter) roomsQuery = roomsQuery.eq("hotel_id", hotelFilter);

  const [{ data: hotels }, { data: rooms }, { data: closures }, { data: reservations }] = await Promise.all([
    supabase.from("hotels").select("id, name").eq("is_active", true).order("name"),
    roomsQuery,
    supabase.from("room_closures").select("room_type_id, date_from, date_to").lte("date_from", last).gte("date_to", first),
    supabase
      .from("reservations")
      .select("room_type_id, check_in, check_out, status")
      .in("status", ["PENDING", "CONFIRMED"])
      .lte("check_in", last)
      .gt("check_out", first),
  ]);

  const rows: GridRow[] = (rooms ?? [])
    .map((room) => {
      const hotel = room.hotels as unknown as { name: string };
      const closed = new Set<string>();
      for (const c of closures ?? []) {
        if (c.room_type_id !== room.id) continue;
        for (const day of eachDay(c.date_from < first ? first : c.date_from, c.date_to > last ? last : c.date_to)) closed.add(day);
      }
      const pending: Record<string, number> = {};
      const confirmed: Record<string, number> = {};
      for (const r of reservations ?? []) {
        if (r.room_type_id !== room.id) continue;
        const target = r.status === "CONFIRMED" ? confirmed : pending;
        const from = r.check_in < first ? first : r.check_in;
        const lastNight = addDays(r.check_out, -1);
        for (const day of eachDay(from, lastNight > last ? last : lastNight)) target[day] = (target[day] ?? 0) + 1;
      }
      return { roomId: room.id, hotelName: hotel.name, roomName: room.name_tr, closed: [...closed], pending, confirmed };
    })
    .sort((a, b) => a.hotelName.localeCompare(b.hotelName, "tr") || a.roomName.localeCompare(b.roomName, "tr"));

  const monthLabel = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + i))),
  );
  const link = (m: string) => `/admin/musaitlik?ay=${m}${hotelFilter ? `&otel=${hotelFilter}` : ""}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t.availability.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.availability.intro}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={link(shiftMonth(month, -1))} className="btn-secondary" aria-label={t.availability.prevMonth}>
          ←
        </Link>
        <span className="min-w-36 text-center font-medium capitalize">{monthLabel}</span>
        <Link href={link(shiftMonth(month, 1))} className="btn-secondary" aria-label={t.availability.nextMonth}>
          →
        </Link>
        <form className="ml-auto flex gap-2">
          <input type="hidden" name="ay" value={month} />
          <select name="otel" defaultValue={hotelFilter} className="input w-56">
            <option value="">{t.availability.allHotels}</option>
            {(hotels ?? []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            {t.availability.filter}
          </button>
        </form>
      </div>

      {rows.length ? (
        <AvailabilityGrid days={days} rows={rows} weekdayLabels={weekdayLabels} t={t.availability} errorText={t.common.unexpectedError} />
      ) : (
        <p className="text-sm text-slate-500">{t.availability.noRooms}</p>
      )}
    </div>
  );
}
