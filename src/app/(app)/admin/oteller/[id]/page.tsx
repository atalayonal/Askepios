import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { withSignedUrls } from "@/lib/images";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "../../klinikler/components";
import { HotelFields, RoomFields } from "../components";
import { ImageManager } from "../image-manager";
import { createRoomType, setHotelActive, updateHotel, updateHotelContacts } from "../actions";

export default async function HotelDetailPage({ params }: PageProps<"/admin/oteller/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const t = await getDictionary();
  const supabase = await createClient();

  const { data: hotel } = await supabase.from("hotels").select("*").eq("id", id).maybeSingle();
  if (!hotel) notFound();

  const [{ data: contacts }, { data: rooms }, { data: images }, { data: access }] = await Promise.all([
    supabase.from("hotel_contacts").select("*").eq("hotel_id", id).maybeSingle(),
    supabase.from("room_types").select("id, name_tr, max_occupancy, is_active").eq("hotel_id", id).order("name_tr"),
    supabase.from("hotel_images").select("id, storage_path, sort_order, is_cover").eq("hotel_id", id).is("room_type_id", null).order("sort_order"),
    supabase.from("clinic_hotel_access").select("clinics(id, name)").eq("hotel_id", id),
  ]);
  const signed = await withSignedUrls(supabase, images ?? []);
  const clinics = (access ?? []).map((a) => a.clinics as unknown as { id: string; name: string });

  return (
    <div className="space-y-6">
      <Link href="/admin/oteller" className="text-sm text-slate-500 hover:underline">
        ← {t.hotels.title}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{hotel.name}</h1>
        <StatusBadge active={hotel.is_active} labels={t.common} />
        <form action={setHotelActive.bind(null, hotel.id, !hotel.is_active)} className="ml-auto">
          <button type="submit" className="btn-secondary">
            {hotel.is_active ? t.common.deactivate : t.common.activate}
          </button>
        </form>
      </div>

      <section className="card p-6">
        <h2 className="mb-4 font-semibold">{t.hotels.images}</h2>
        <ImageManager hotelId={hotel.id} roomTypeId={null} images={signed} t={t.hotels} />
      </section>

      <section className="card overflow-x-auto">
        <h2 className="px-3 pt-4 font-semibold">{t.hotels.rooms}</h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>{t.common.name}</th>
              <th>{t.hotels.maxOccupancy}</th>
              <th>{t.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {(rooms ?? []).map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/oteller/${hotel.id}/odalar/${r.id}`} className="font-medium text-teal-800 hover:underline">
                    {r.name_tr}
                  </Link>
                </td>
                <td>{r.max_occupancy}</td>
                <td>
                  <StatusBadge active={r.is_active} labels={t.common} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="p-4">
          <summary className="cursor-pointer text-sm font-medium text-teal-800">{t.hotels.newRoom}</summary>
          <ActionForm action={createRoomType.bind(null, hotel.id)} className="mt-4 space-y-4">
            {(pending) => (
              <>
                <RoomFields t={t} />
                <button type="submit" disabled={pending} className="btn-primary">
                  {t.common.save}
                </button>
              </>
            )}
          </ActionForm>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <ActionForm action={updateHotel.bind(null, hotel.id)} className="space-y-4">
            {(pending) => (
              <>
                <HotelFields t={t} defaults={hotel} />
                <button type="submit" disabled={pending} className="btn-primary">
                  {t.common.save}
                </button>
              </>
            )}
          </ActionForm>
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold">{t.hotels.contactTitle}</h2>
            <ActionForm action={updateHotelContacts.bind(null, hotel.id)} className="space-y-3">
              {(pending) => (
                <>
                  {(
                    [
                      ["contact_person", t.hotels.contactPerson],
                      ["phone", t.common.phone],
                      ["email", t.common.email],
                      ["whatsapp", t.hotels.whatsapp],
                    ] as const
                  ).map(([name, label]) => (
                    <label key={name} className="block">
                      <span className="text-sm font-medium">{label}</span>
                      <input name={name} defaultValue={contacts?.[name] ?? ""} className="input mt-1" />
                    </label>
                  ))}
                  <label className="block">
                    <span className="text-sm font-medium">{t.hotels.internalNotes}</span>
                    <textarea name="internal_notes" rows={3} defaultValue={contacts?.internal_notes ?? ""} className="input mt-1" />
                  </label>
                  <button type="submit" disabled={pending} className="btn-primary">
                    {t.common.save}
                  </button>
                </>
              )}
            </ActionForm>
          </section>

          <section className="card p-6">
            <h2 className="mb-2 text-sm font-semibold">{t.hotels.partneredClinics}</h2>
            {clinics.length ? (
              <ul className="space-y-1 text-sm">
                {clinics.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/klinikler/${c.id}`} className="text-teal-800 hover:underline">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{t.common.none}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
