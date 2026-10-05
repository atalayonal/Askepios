import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "../klinikler/components";
import { HotelFields } from "./components";
import { createHotel } from "./actions";

export default async function HotelsPage() {
  await requireAdmin();
  const t = await getDictionary();
  const supabase = await createClient();
  const { data: hotels } = await supabase
    .from("hotels")
    .select("id, name, city, district, stars, is_active, room_types(count), clinic_hotel_access(count)")
    .order("name");

  const count = (v: unknown) => (v as { count: number }[])[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t.hotels.title}</h1>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{t.common.name}</th>
              <th>{t.hotels.city}</th>
              <th>{t.hotels.stars}</th>
              <th>{t.hotels.roomCount}</th>
              <th>{t.hotels.partneredClinics}</th>
              <th>{t.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {(hotels ?? []).map((h) => (
              <tr key={h.id}>
                <td>
                  <Link href={`/admin/oteller/${h.id}`} className="font-medium text-teal-800 hover:underline">
                    {h.name}
                  </Link>
                </td>
                <td>{[h.district, h.city].filter(Boolean).join(", ")}</td>
                <td>{h.stars ? "★".repeat(h.stars) : ""}</td>
                <td>{count(h.room_types)}</td>
                <td>{count(h.clinic_hotel_access)}</td>
                <td>
                  <StatusBadge active={h.is_active} labels={t.common} />
                </td>
              </tr>
            ))}
            {!hotels?.length && (
              <tr>
                <td colSpan={6} className="text-slate-500">
                  {t.common.none}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="card max-w-3xl p-6">
        <summary className="cursor-pointer font-semibold">{t.hotels.newHotel}</summary>
        <ActionForm action={createHotel} className="mt-4 space-y-4">
          {(pending) => (
            <>
              <HotelFields t={t} />
              <button type="submit" disabled={pending} className="btn-primary">
                {t.common.save}
              </button>
            </>
          )}
        </ActionForm>
      </details>
    </div>
  );
}
