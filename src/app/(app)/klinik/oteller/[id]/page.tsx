import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, ChevronLeft, Globe, Maximize2, MapPin, Users } from "lucide-react";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { withSignedUrls, type ImageRow } from "@/lib/images";
import { amenityList } from "@/lib/amenities";
import { formatDate, formatMoney } from "@/lib/format";
import { toIso } from "@/lib/dates";
import { AmenityIcon } from "@/components/amenity-icon";
import { HotelMosaic, RoomPhotos } from "@/components/photo-gallery";
import { Stars } from "@/components/stars";
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

export default async function ClinicHotelPage({ params, searchParams }: PageProps<"/klinik/oteller/[id]">) {
  const user = await requireClinicUser();
  const { id } = await params;
  const { oda } = await searchParams;
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();
  const today = toIso(new Date());

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id, name, city, district, address, stars, website, description_tr, description_en, amenities")
    .eq("id", id)
    .maybeSingle();
  if (!hotel) notFound();

  const [{ data: access }, { data: rooms }, { data: images }, { data: rates }] = await Promise.all([
    supabase.from("clinic_hotel_access").select("hotel_id").eq("clinic_id", user.clinicId!).eq("hotel_id", id).maybeSingle(),
    supabase
      .from("room_types")
      .select("id, name_tr, name_en, description_tr, description_en, max_occupancy, bed_info, size_m2, amenities")
      .eq("hotel_id", id)
      .order("max_occupancy")
      .order("name_tr"),
    supabase.from("hotel_images").select("id, storage_path, sort_order, is_cover, room_type_id").eq("hotel_id", id).order("sort_order"),
    // RLS: anlaşmasız otelde hiç satır dönmez; anlaşmalı otelde genel ve bu kliniğe özel fiyatlar döner.
    supabase.from("room_rates").select("room_type_id, clinic_id, occupancy, price, currency, valid_from, valid_to").gte("valid_to", today),
  ]);

  const partnered = Boolean(access);
  const imagesWithRoom = await withSignedUrls(supabase, (images ?? []) as (ImageRow & { room_type_id: string | null })[]);
  const photos = (list: typeof imagesWithRoom) => list.filter((i) => i.url).map((i) => ({ id: i.id, url: i.url! }));
  const hotelPhotos = photos(imagesWithRoom.filter((i) => !i.room_type_id).sort((a, b) => Number(b.is_cover) - Number(a.is_cover)));
  const roomIds = new Set((rooms ?? []).map((r) => r.id));
  const visibleRates = effectiveRates(((rates ?? []) as Rate[]).filter((r) => roomIds.has(r.room_type_id)));
  const pick = (tr: string, en: string) => (locale === "en" && en) || tr;
  const description = pick(hotel.description_tr, hotel.description_en);
  const hotelAmenities = amenityList(hotel.amenities, "hotel", locale);
  const selectedRoom = typeof oda === "string" && roomIds.has(oda) ? oda : undefined;
  const galleryLabels = { showAll: t.ui.allPhotos, close: t.ui.close, previous: t.ui.previous, next: t.ui.next, photos: t.ui.photos };

  const contactEmail = process.env.ASKEPIOS_CONTACT_EMAIL;
  const contactWhatsapp = process.env.ASKEPIOS_CONTACT_WHATSAPP?.replace(/\D/g, "");
  const contactText = encodeURIComponent(`${hotel.name} - ${user.clinicName ?? ""}`);

  return (
    <div className="space-y-6">
      <Link href="/klinik/oteller" className="back-link">
        <ChevronLeft aria-hidden className="h-4 w-4" />
        {t.nav.hotels}
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{hotel.name}</h1>
            <Stars count={hotel.stars} />
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin aria-hidden className="h-4 w-4 flex-none text-blue" />
            {[hotel.address, hotel.district, hotel.city].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hotel.website && (
            <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <Globe aria-hidden className="h-4 w-4" />
              {t.ui.website}
            </a>
          )}
          {partnered ? (
            <a href="#talep" className="btn-primary">
              {t.clinic.reserve}
            </a>
          ) : (
            <span className="badge bg-background py-1.5 text-muted">{t.ui.viaAskepios}</span>
          )}
        </div>
      </div>

      <HotelMosaic photos={hotelPhotos} labels={galleryLabels} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {description && (
            <section className="card p-6">
              <h2 className="mb-2 text-lg font-bold">{t.ui.aboutHotel}</h2>
              <p className="whitespace-pre-line leading-7 text-foreground/85">{description}</p>
            </section>
          )}

          {hotelAmenities.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-4 text-lg font-bold">{t.ui.hotelAmenities}</h2>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                {hotelAmenities.map((a) => (
                  <li key={a.key} className="flex items-center gap-2">
                    <AmenityIcon name={a.key} className="h-5 w-5 text-success" />
                    {a.label}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside id="talep" className="order-last scroll-mt-6 lg:order-none lg:row-span-2">
          <div className="card overflow-hidden lg:sticky lg:top-4">
            {partnered ? (
              <>
                <div className="bg-navy px-5 py-4 text-white">
                  <h2 className="text-lg font-bold">{t.clinic.requestTitle}</h2>
                  <p className="text-sm text-white/75">{t.ui.requestIntro}</p>
                </div>
                <div className="p-5">
                  <ReservationForm
                    key={selectedRoom ?? "default"}
                    rooms={(rooms ?? []).map((r) => ({ id: r.id, name: pick(r.name_tr, r.name_en), maxOccupancy: r.max_occupancy }))}
                    initialRoomId={selectedRoom}
                    t={t.clinic}
                    locale={locale}
                    today={today}
                  />
                </div>
              </>
            ) : (
              <div className="p-5">
                <h2 className="text-lg font-bold">{t.clinic.contactAskepios}</h2>
                <p className="mt-2 text-sm text-muted">{t.clinic.notPartneredNote}</p>
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
              </div>
            )}
          </div>
        </aside>

        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-bold">{t.ui.roomOptions}</h2>
          <ul className="space-y-4">
            {(rooms ?? []).map((room) => {
              const roomRates = visibleRates.filter((r) => r.room_type_id === room.id);
              const fromRate = roomRates.reduce<Rate | null>((min, r) => (!min || Number(r.price) < Number(min.price) ? r : min), null);
              const roomAmenities = amenityList(room.amenities, "room", locale);
              const roomDescription = pick(room.description_tr, room.description_en);
              return (
                <li key={room.id} className={`card overflow-hidden ${selectedRoom === room.id ? "border-blue ring-2 ring-blue/20" : ""}`}>
                  <div className="grid gap-4 p-4 sm:grid-cols-[14rem_1fr]">
                    <RoomPhotos photos={photos(imagesWithRoom.filter((i) => i.room_type_id === room.id))} labels={galleryLabels} />
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-blue">{pick(room.name_tr, room.name_en)}</h3>
                          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                            <li className="flex items-center gap-1">
                              <Users aria-hidden className="h-4 w-4" />
                              {t.clinic.upTo} {room.max_occupancy} {t.clinic.guests}
                            </li>
                            {room.bed_info && (
                              <li className="flex items-center gap-1">
                                <BedDouble aria-hidden className="h-4 w-4" />
                                {room.bed_info}
                              </li>
                            )}
                            {room.size_m2 && (
                              <li className="flex items-center gap-1">
                                <Maximize2 aria-hidden className="h-4 w-4" />
                                {room.size_m2} m²
                              </li>
                            )}
                          </ul>
                        </div>
                        {partnered && (
                          <div className="text-right">
                            {fromRate ? (
                              <>
                                <p className="text-xs text-muted">{t.ui.perRoomPerNight}</p>
                                <p className="text-xl font-extrabold">{formatMoney(Number(fromRate.price), fromRate.currency, locale)}</p>
                              </>
                            ) : (
                              <p className="text-sm text-muted">{t.ui.noPriceYet}</p>
                            )}
                          </div>
                        )}
                      </div>
                      {roomDescription && <p className="text-sm text-foreground/80">{roomDescription}</p>}
                      {roomAmenities.length > 0 && (
                        <ul className="flex flex-wrap gap-2 text-xs">
                          {roomAmenities.map((a) => (
                            <li key={a.key} className="flex items-center gap-1 rounded-md bg-background px-2 py-1">
                              <AmenityIcon name={a.key} className="h-3.5 w-3.5 text-muted" />
                              {a.label}
                            </li>
                          ))}
                        </ul>
                      )}
                      {partnered && (
                        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
                          {roomRates.length > 0 ? (
                            <details className="text-sm">
                              <summary className="cursor-pointer font-medium text-blue">{t.ui.ratePeriods}</summary>
                              <table className="table mt-2">
                                <tbody>
                                  {roomRates.map((r) => (
                                    <tr key={`${r.valid_from}-${r.occupancy}-${r.clinic_id}`}>
                                      <td className="whitespace-nowrap px-2">
                                        {formatDate(r.valid_from, locale)} – {formatDate(r.valid_to, locale)}
                                      </td>
                                      <td className="px-2">{t.hotels.occupancyLabels[r.occupancy] ?? r.occupancy}</td>
                                      <td className="px-2 text-right font-semibold">{formatMoney(Number(r.price), r.currency, locale)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </details>
                          ) : (
                            <span />
                          )}
                          <Link href={`/klinik/oteller/${hotel.id}?oda=${room.id}#talep`} className="btn-primary">
                            {t.ui.selectRoom}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
