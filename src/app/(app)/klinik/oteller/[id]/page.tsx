import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { withSignedUrls, type ImageRow } from "@/lib/images";
import { formatDate, formatMoney } from "@/lib/format";
import { toIso } from "@/lib/dates";
import { ReservationForm } from "./reservation-form";

type Rate = { room_type_id: string; clinic_id: string | null; occupancy: number; price: number; currency: string; valid_from: string; valid_to: string };

/** Kliniğe özel fiyat, aynı kişi sayısı ve çakışan dönemdeki genel fiyatın yerine geçer. */
function effectiveRates(rates: Rate[]): Rate[] {
  const specific = rates.filter((r) => r.clinic_id);
  return rates
    .filter(
      (r) =>
        r.clinic_id ||
        !specific.some(
          (s) => s.room_type_id === r.room_type_id && s.occupancy === r.occupancy && s.valid_from <= r.valid_to && s.valid_to >= r.valid_from,
        ),
    )
    .sort((a, b) => a.valid_from.localeCompare(b.valid_from) || a.occupancy - b.occupancy);
}

export default async function ClinicHotelPage({ params }: PageProps<"/klinik/oteller/[id]">) {
  const user = await requireClinicUser();
  const { id } = await params;
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();
  const today = toIso(new Date());

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id, name, city, district, address, stars, website, description_tr, description_en")
    .eq("id", id)
    .maybeSingle();
  if (!hotel) notFound();

  const [{ data: access }, { data: rooms }, { data: images }, { data: rates }] = await Promise.all([
    supabase.from("clinic_hotel_access").select("hotel_id").eq("clinic_id", user.clinicId!).eq("hotel_id", id).maybeSingle(),
    supabase
      .from("room_types")
      .select("id, name_tr, name_en, description_tr, description_en, max_occupancy, bed_info")
      .eq("hotel_id", id)
      .order("name_tr"),
    supabase.from("hotel_images").select("id, storage_path, sort_order, is_cover, room_type_id").eq("hotel_id", id).order("sort_order"),
    // RLS: anlaşmasız otelde hiç satır dönmez; anlaşmalı otelde genel ve bu kliniğe özel fiyatlar döner.
    supabase.from("room_rates").select("room_type_id, clinic_id, occupancy, price, currency, valid_from, valid_to").gte("valid_to", today),
  ]);

  const partnered = Boolean(access);
  const imagesWithRoom = await withSignedUrls(supabase, (images ?? []) as (ImageRow & { room_type_id: string | null })[]);
  const hotelImages = imagesWithRoom.filter((i) => !i.room_type_id).sort((a, b) => Number(b.is_cover) - Number(a.is_cover));
  const roomIds = new Set((rooms ?? []).map((r) => r.id));
  const visibleRates = effectiveRates(((rates ?? []) as Rate[]).filter((r) => roomIds.has(r.room_type_id)));
  const pick = (tr: string, en: string) => (locale === "en" && en) || tr;
  const description = pick(hotel.description_tr, hotel.description_en);

  const contactEmail = process.env.ASKEPIOS_CONTACT_EMAIL;
  const contactWhatsapp = process.env.ASKEPIOS_CONTACT_WHATSAPP?.replace(/\D/g, "");
  const contactText = encodeURIComponent(`${hotel.name} - ${user.clinicName ?? ""}`);

  return (
    <div className="space-y-6">
      <Link href="/klinik/oteller" className="text-sm text-slate-500 hover:underline">
        ← {t.nav.hotels}
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{hotel.name}</h1>
          {hotel.stars && <span className="text-amber-600">{"★".repeat(hotel.stars)}</span>}
        </div>
        <p className="text-sm text-slate-600">{[hotel.address, hotel.district, hotel.city].filter(Boolean).join(", ")}</p>
      </div>

      {hotelImages.length > 0 && (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {hotelImages.map((img) =>
            img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.id} src={img.url} alt="" className="h-56 w-80 flex-none snap-start rounded-lg object-cover sm:h-64 sm:w-96" />
            ) : null,
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {description && <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{description}</p>}

          <section>
            <h2 className="mb-3 font-semibold">{t.clinic.rooms}</h2>
            <ul className="space-y-3">
              {(rooms ?? []).map((room) => {
                const roomRates = visibleRates.filter((r) => r.room_type_id === room.id);
                const roomImages = imagesWithRoom.filter((i) => i.room_type_id === room.id);
                return (
                  <li key={room.id} className="card p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-medium">{pick(room.name_tr, room.name_en)}</h3>
                      <span className="text-xs text-slate-500">
                        {t.clinic.upTo} {room.max_occupancy} {t.clinic.guests}
                        {room.bed_info ? ` · ${room.bed_info}` : ""}
                      </span>
                    </div>
                    {pick(room.description_tr, room.description_en) && (
                      <p className="mt-1 text-sm text-slate-600">{pick(room.description_tr, room.description_en)}</p>
                    )}
                    {roomImages.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {roomImages.map((img) =>
                          img.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={img.id} src={img.url} alt="" className="h-24 w-36 flex-none rounded object-cover" />
                          ) : null,
                        )}
                      </div>
                    )}
                    {partnered && roomRates.length > 0 && (
                      <table className="table mt-3">
                        <thead>
                          <tr>
                            <th>{t.clinic.dates}</th>
                            <th>{t.hotels.occupancy}</th>
                            <th>
                              {t.clinic.pricesFrom} ({t.clinic.perNight})
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomRates.map((r) => (
                            <tr key={`${r.valid_from}-${r.occupancy}-${r.clinic_id}`}>
                              <td className="whitespace-nowrap">
                                {formatDate(r.valid_from, locale)} – {formatDate(r.valid_to, locale)}
                              </td>
                              <td>{t.hotels.occupancyLabels[r.occupancy] ?? r.occupancy}</td>
                              <td>{formatMoney(Number(r.price), r.currency, locale)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="lg:col-span-2">
          <div className="card p-5 lg:sticky lg:top-4">
            {partnered ? (
              <>
                <h2 className="mb-4 font-semibold">{t.clinic.requestTitle}</h2>
                <ReservationForm
                  rooms={(rooms ?? []).map((r) => ({ id: r.id, name: pick(r.name_tr, r.name_en), maxOccupancy: r.max_occupancy }))}
                  t={t.clinic}
                  locale={locale}
                  today={today}
                />
              </>
            ) : (
              <>
                <h2 className="font-semibold">{t.clinic.contactAskepios}</h2>
                <p className="mt-2 text-sm text-slate-600">{t.clinic.notPartneredNote}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {contactEmail && (
                    <a href={`mailto:${contactEmail}?subject=${contactText}`} className="btn-primary">
                      {t.clinic.contactByEmail}
                    </a>
                  )}
                  {contactWhatsapp && (
                    <a href={`https://wa.me/${contactWhatsapp}?text=${contactText}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                      {t.clinic.contactByWhatsapp}
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
