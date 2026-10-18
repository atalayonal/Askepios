import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { StatusBadge } from "../klinikler/components";

export default async function HotelsPage() {
  await requireAdmin();
  const t = await getDictionary();
  const supabase = await createClient();
  const { data: hotels } = await supabase
    .from("hotels")
    .select("id, name, city, district, stars, is_active, room_types(count), clinic_hotel_access(count), hotel_images(count)")
    .order("name");

  const count = (v: unknown) => (v as { count: number }[])[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">{t.hotels.title}</h1>
        <Link href="/admin/oteller/yeni" className="btn-primary ml-auto">
          + {t.hotels.addHotel}
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{t.common.name}</th>
              <th>{t.hotels.city}</th>
              <th>{t.hotels.stars}</th>
              <th>{t.hotels.roomCount}</th>
              <th>{t.hotels.images}</th>
              <th>{t.hotels.partneredClinics}</th>
              <th>{t.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {(hotels ?? []).map((h) => (
              <tr key={h.id}>
                <td>
                  <Link href={`/admin/oteller/${h.id}`} className="font-medium text-blue hover:underline">
                    {h.name}
                  </Link>
                </td>
                <td>{[h.district, h.city].filter(Boolean).join(", ")}</td>
                <td>{h.stars ? "★".repeat(h.stars) : ""}</td>
                <td>{count(h.room_types)}</td>
                <td>{count(h.hotel_images)}</td>
                <td>{count(h.clinic_hotel_access)}</td>
                <td>
                  <StatusBadge active={h.is_active} labels={t.common} />
                </td>
              </tr>
            ))}
            {!hotels?.length && (
              <tr>
                <td colSpan={7} className="text-muted">
                  {t.common.none}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
