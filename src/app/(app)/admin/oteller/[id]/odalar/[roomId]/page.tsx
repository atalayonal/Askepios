import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { withSignedUrls } from "@/lib/images";
import { formatDate, formatMoney } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge } from "../../../../klinikler/components";
import { RoomFields } from "../../../components";
import { ImageManager } from "../../../image-manager";
import { createRate, deleteRate, setRoomActive, updateRoomType } from "../../../actions";

export default async function RoomDetailPage({ params }: PageProps<"/admin/oteller/[id]/odalar/[roomId]">) {
  await requireAdmin();
  const { id: hotelId, roomId } = await params;
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("room_types")
    .select("*, hotels(name)")
    .eq("id", roomId)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (!room) notFound();

  const [{ data: rates }, { data: images }, { data: clinics }] = await Promise.all([
    supabase
      .from("room_rates")
      .select("id, occupancy, price, currency, valid_from, valid_to, clinics(name)")
      .eq("room_type_id", roomId)
      .order("valid_from")
      .order("occupancy"),
    supabase.from("hotel_images").select("id, storage_path, sort_order, is_cover").eq("room_type_id", roomId).order("sort_order"),
    supabase.from("clinics").select("id, name").order("name"),
  ]);
  const signed = await withSignedUrls(supabase, images ?? []);
  const hotelName = (room.hotels as unknown as { name: string }).name;
  const occupancies = Array.from({ length: room.max_occupancy }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <Link href={`/admin/oteller/${hotelId}`} className="back-link">
        ← {hotelName}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">{room.name_tr}</h1>
        <StatusBadge active={room.is_active} labels={t.common} />
        <form action={setRoomActive.bind(null, room.id, hotelId, !room.is_active)} className="ml-auto">
          <button type="submit" className="btn-secondary">
            {room.is_active ? t.common.deactivate : t.common.activate}
          </button>
        </form>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="px-3 pt-4 font-semibold">{t.hotels.rates}</h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>{t.hotels.validFrom}</th>
              <th>{t.hotels.validTo}</th>
              <th>{t.hotels.occupancy}</th>
              <th>{t.hotels.price}</th>
              <th>{t.hotels.rateClinic}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rates ?? []).map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.valid_from, locale)}</td>
                <td>{formatDate(r.valid_to, locale)}</td>
                <td>{t.hotels.occupancyLabels[r.occupancy] ?? r.occupancy}</td>
                <td>{formatMoney(Number(r.price), r.currency, locale)}</td>
                <td>{(r.clinics as unknown as { name: string } | null)?.name ?? t.hotels.allClinics}</td>
                <td>
                  <form action={deleteRate.bind(null, r.id, room.id, hotelId)}>
                    <button type="submit" className="btn-secondary px-2 py-1 text-xs text-red-700">
                      {t.hotels.delete}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!rates?.length && (
              <tr>
                <td colSpan={6} className="text-muted">
                  {t.common.none}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-line/70 p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.hotels.newRate}</h3>
          <ActionForm action={createRate.bind(null, room.id, hotelId)} className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <>
              <>
                <label className="block">
                  <span className="text-xs font-medium">{t.hotels.validFrom}</span>
                  <input name="valid_from" type="date" required className="input mt-1" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium">{t.hotels.validTo}</span>
                  <input name="valid_to" type="date" required className="input mt-1" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium">{t.hotels.occupancy}</span>
                  <select name="occupancy" className="input mt-1">
                    {occupancies.map((o) => (
                      <option key={o} value={o}>
                        {t.hotels.occupancyLabels[o] ?? o}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium">{t.hotels.price}</span>
                  <div className="mt-1 flex gap-1">
                    <input name="price" inputMode="decimal" required className="input" />
                    <select name="currency" defaultValue="EUR" className="input w-24">
                      <option>EUR</option>
                      <option>USD</option>
                      <option>TRY</option>
                      <option>GBP</option>
                    </select>
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-medium">{t.hotels.rateClinic}</span>
                  <select name="clinic_id" className="input mt-1">
                    <option value="">{t.hotels.allClinics}</option>
                    {(clinics ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton className="btn-primary">
                  {t.common.save}
                </SubmitButton>
              </>
            </>
          </ActionForm>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 font-semibold">{t.hotels.images}</h2>
        <ImageManager hotelId={hotelId} roomTypeId={room.id} images={signed} t={t.hotels} />
      </section>

      <section className="card max-w-3xl p-6">
        <ActionForm action={updateRoomType.bind(null, room.id, hotelId)} className="space-y-4">
          <>
            <>
              <RoomFields t={t} locale={locale} defaults={room} />
              <SubmitButton className="btn-primary">
                {t.common.save}
              </SubmitButton>
            </>
          </>
        </ActionForm>
      </section>
    </div>
  );
}
