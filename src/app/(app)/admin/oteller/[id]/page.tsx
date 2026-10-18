import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { withSignedUrls } from "@/lib/images";
import { formatMoney } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge } from "../../klinikler/components";
import { HotelFields, RoomFields, SetupSteps } from "../components";
import { ImageManager } from "../image-manager";
import { createRoomType, setHotelActive, updateHotel, updateHotelContacts } from "../actions";

type Rate = { occupancy: number; price: number; currency: string; valid_from: string; valid_to: string; clinic_id: string | null };

/** Genel (klinik dışı) fiyatlardan bugün geçerli olanı, yoksa en yakın gelecektekini kişi sayısına göre seçer. */
function upcomingPrices(rates: Rate[], today: string): Rate[] {
  const best = new Map<number, Rate>();
  for (const rate of rates) {
    if (rate.clinic_id || rate.valid_to < today) continue;
    const current = best.get(rate.occupancy);
    if (!current || rate.valid_from < current.valid_from) best.set(rate.occupancy, rate);
  }
  return [...best.values()].sort((a, b) => a.occupancy - b.occupancy);
}

export default async function HotelDetailPage({ params }: PageProps<"/admin/oteller/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: hotel } = await supabase.from("hotels").select("*").eq("id", id).maybeSingle();
  if (!hotel) notFound();

  const [{ data: contacts }, { data: rooms }, { data: images }, { data: access }] = await Promise.all([
    supabase.from("hotel_contacts").select("*").eq("hotel_id", id).maybeSingle(),
    supabase
      .from("room_types")
      .select(
        "id, name_tr, max_occupancy, is_active, room_rates(occupancy, price, currency, valid_from, valid_to, clinic_id), hotel_images(count)",
      )
      .eq("hotel_id", id)
      .order("name_tr"),
    supabase
      .from("hotel_images")
      .select("id, storage_path, sort_order, is_cover")
      .eq("hotel_id", id)
      .is("room_type_id", null)
      .order("sort_order"),
    supabase.from("clinic_hotel_access").select("clinics(id, name)").eq("hotel_id", id),
  ]);
  const signed = await withSignedUrls(supabase, images ?? []);
  const clinics = (access ?? []).map((a) => a.clinics as unknown as { id: string; name: string });

  const today = new Date().toISOString().slice(0, 10);
  const roomRows = (rooms ?? []).map((r) => ({
    ...r,
    prices: upcomingPrices(r.room_rates as Rate[], today),
    imageCount: (r.hotel_images as unknown as { count: number }[])[0]?.count ?? 0,
  }));
  const activeRooms = roomRows.filter((r) => r.is_active);
  const steps = [
    { done: (images ?? []).length > 0, label: t.hotels.setupImages, href: "#gorseller" },
    { done: activeRooms.length > 0, label: t.hotels.setupRooms, href: "#odalar" },
    { done: activeRooms.length > 0 && activeRooms.every((r) => r.prices.length > 0), label: t.hotels.setupRates, href: "#odalar" },
    { done: clinics.length > 0, label: t.hotels.setupClinics, href: "/admin/klinikler" },
    { done: hotel.is_active, label: t.hotels.setupPublish, href: null },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/oteller" className="back-link">
        ← {t.hotels.title}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">{hotel.name}</h1>
        <StatusBadge active={hotel.is_active} labels={t.common} />
        <form action={setHotelActive.bind(null, hotel.id, !hotel.is_active)} className="ml-auto">
          <button type="submit" className="btn-secondary">
            {hotel.is_active ? t.common.deactivate : t.common.activate}
          </button>
        </form>
      </div>

      <SetupSteps hotelId={hotel.id} steps={steps} t={t} />

      <section id="gorseller" className="card scroll-mt-20 p-6">
        <h2 className="font-semibold">{t.hotels.images}</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{t.hotels.imagesHint}</p>
        <ImageManager hotelId={hotel.id} roomTypeId={null} images={signed} t={t.hotels} />
      </section>

      <section id="odalar" className="card scroll-mt-20 overflow-x-auto">
        <h2 className="px-3 pt-4 font-semibold">{t.hotels.rooms}</h2>
        <p className="px-3 text-sm text-muted">{t.hotels.roomsHint}</p>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>{t.common.name}</th>
              <th>{t.hotels.maxOccupancy}</th>
              <th>{t.hotels.currentPrices}</th>
              <th>{t.hotels.images}</th>
              <th>{t.common.status}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {roomRows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/oteller/${hotel.id}/odalar/${r.id}`} className="font-medium text-blue hover:underline">
                    {r.name_tr}
                  </Link>
                </td>
                <td>{r.max_occupancy}</td>
                <td>
                  {r.prices.length ? (
                    <span className="whitespace-nowrap">
                      {r.prices.map((p) => `${p.occupancy}: ${formatMoney(Number(p.price), p.currency, locale)}`).join(" · ")}
                    </span>
                  ) : (
                    <span className="text-red-700">{t.hotels.noPrice}</span>
                  )}
                </td>
                <td>{r.imageCount}</td>
                <td>
                  <StatusBadge active={r.is_active} labels={t.common} />
                </td>
                <td>
                  <Link href={`/admin/oteller/${hotel.id}/odalar/${r.id}`} className="btn-secondary whitespace-nowrap px-2 py-1 text-xs">
                    {t.hotels.editRoom}
                  </Link>
                </td>
              </tr>
            ))}
            {!roomRows.length && (
              <tr>
                <td colSpan={6} className="text-muted">
                  {t.common.none}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <details className="p-4">
          <summary className="cursor-pointer text-sm font-medium text-blue">{t.hotels.newRoom}</summary>
          <ActionForm action={createRoomType.bind(null, hotel.id)} className="mt-4 space-y-4">
            <>
              <>
                <RoomFields t={t} locale={locale} />
                <SubmitButton className="btn-primary">{t.common.save}</SubmitButton>
              </>
            </>
          </ActionForm>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold">{t.hotels.infoTitle}</h2>
          <ActionForm action={updateHotel.bind(null, hotel.id)} className="space-y-4">
            <>
              <>
                <HotelFields t={t} locale={locale} defaults={hotel} />
                <SubmitButton className="btn-primary">{t.common.save}</SubmitButton>
              </>
            </>
          </ActionForm>
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold">{t.hotels.contactTitle}</h2>
            <ActionForm action={updateHotelContacts.bind(null, hotel.id)} className="space-y-3">
              <>
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
                  <SubmitButton className="btn-primary">{t.common.save}</SubmitButton>
                </>
              </>
            </ActionForm>
          </section>

          <section className="card p-6">
            <h2 className="mb-2 text-sm font-semibold">{t.hotels.partneredClinics}</h2>
            {clinics.length ? (
              <ul className="space-y-1 text-sm">
                {clinics.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/klinikler/${c.id}`} className="text-blue hover:underline">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.common.none}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
