import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { withSignedUrls, type ImageRow } from "@/lib/images";
import { amenityList } from "@/lib/amenities";
import { formatMoney } from "@/lib/format";
import { toIso } from "@/lib/dates";
import { AmenityIcon } from "@/components/amenity-icon";
import { Stars } from "@/components/stars";
import type { Dictionary, Locale } from "@/i18n/dictionaries";

type HotelCard = {
  id: string;
  name: string;
  city: string;
  district: string;
  stars: number | null;
  description_tr: string;
  description_en: string;
  amenities: string[];
  coverUrl: string | null;
  fromPrice: { price: number; currency: string } | null;
  partnered: boolean;
};

export default async function ClinicHotelsPage({ searchParams }: PageProps<"/klinik/oteller">) {
  const user = await requireClinicUser();
  const t = await getDictionary();
  const locale = await getLocale();
  const params = await searchParams;
  const q = typeof params.ara === "string" ? params.ara.trim().slice(0, 60) : "";
  const supabase = await createClient();
  const today = toIso(new Date());

  const [{ data: hotels }, { data: access }, { data: covers }, { data: rates }] = await Promise.all([
    supabase.from("hotels").select("id, name, city, district, stars, description_tr, description_en, amenities").order("name"),
    supabase.from("clinic_hotel_access").select("hotel_id").eq("clinic_id", user.clinicId!),
    supabase.from("hotel_images").select("id, hotel_id, storage_path, sort_order, is_cover").is("room_type_id", null).eq("is_cover", true),
    // RLS: sadece anlaşmalı otellerin fiyatları döner.
    supabase.from("room_rates").select("price, currency, room_types!inner(hotel_id)").gte("valid_to", today),
  ]);

  const signed = await withSignedUrls(supabase, (covers ?? []) as (ImageRow & { hotel_id: string })[]);
  const coverByHotel = new Map(signed.map((c) => [c.hotel_id, c.url]));
  const partnered = new Set((access ?? []).map((a) => a.hotel_id as string));
  const minPrice = new Map<string, { price: number; currency: string }>();
  for (const r of rates ?? []) {
    const hotelId = (r.room_types as unknown as { hotel_id: string }).hotel_id;
    const current = minPrice.get(hotelId);
    if (!current || Number(r.price) < current.price) minPrice.set(hotelId, { price: Number(r.price), currency: r.currency });
  }

  const needle = q.toLocaleLowerCase("tr");
  const cards: HotelCard[] = (hotels ?? [])
    .filter((h) => !needle || `${h.name} ${h.district} ${h.city}`.toLocaleLowerCase("tr").includes(needle))
    .map((h) => ({
      ...h,
      amenities: h.amenities ?? [],
      coverUrl: coverByHotel.get(h.id) ?? null,
      fromPrice: minPrice.get(h.id) ?? null,
      partnered: partnered.has(h.id),
    }));
  const open = cards.filter((h) => h.partnered);
  const others = cards.filter((h) => !h.partnered);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="page-title">{t.ui.hotelsTitle}</h1>
          <p className="mt-1 text-sm text-muted">{t.ui.hotelsIntro}</p>
        </div>
        <form className="ml-auto flex w-full max-w-sm items-center gap-2 rounded-xl border-2 border-amber bg-white p-1 sm:w-auto">
          <Search aria-hidden className="ml-2 h-4 w-4 text-muted" />
          <input name="ara" defaultValue={q} placeholder={t.ui.searchHotels} aria-label={t.ui.searchHotels} className="min-w-0 flex-1 py-1.5 text-sm outline-none" />
          <button type="submit" className="btn-primary px-3 py-1.5">
            {t.ui.search}
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          {t.clinic.partneredHotels} <span className="font-medium text-muted">({open.length})</span>
        </h2>
        <HotelList hotels={open} t={t} locale={locale} />
      </section>

      {others.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">
              {t.clinic.otherHotels} <span className="font-medium text-muted">({others.length})</span>
            </h2>
            <p className="text-sm text-muted">{t.clinic.otherHotelsIntro}</p>
          </div>
          <HotelList hotels={others} t={t} locale={locale} />
        </section>
      )}
    </div>
  );
}

function HotelList({ hotels, t, locale }: { hotels: HotelCard[]; t: Dictionary; locale: Locale }) {
  if (!hotels.length) return <p className="card p-6 text-sm text-muted">{t.ui.noHotelsFound}</p>;
  return (
    <ul className="space-y-4">
      {hotels.map((h) => {
        const description = (locale === "en" && h.description_en) || h.description_tr;
        const amenities = amenityList(h.amenities, "hotel", locale).slice(0, 5);
        return (
          <li key={h.id} className="card group overflow-hidden hover:border-blue/40 hover:shadow-[0_6px_24px_-12px_rgba(12,45,87,0.35)]">
            <Link href={`/klinik/oteller/${h.id}`} className="grid sm:grid-cols-[17rem_1fr_13rem]">
              <div className="relative aspect-[16/10] bg-background sm:aspect-auto sm:min-h-52">
                {h.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
              </div>
              <div className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-blue group-hover:underline">{h.name}</h3>
                  <Stars count={h.stars} />
                </div>
                <p className="flex items-center gap-1 text-sm text-muted">
                  <MapPin aria-hidden className="h-4 w-4" />
                  {[h.district, h.city].filter(Boolean).join(", ")}
                </p>
                {description && <p className="line-clamp-2 text-sm text-foreground/80">{description}</p>}
                {amenities.length > 0 && (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-success">
                    {amenities.map((a) => (
                      <li key={a.key} className="flex items-center gap-1">
                        <AmenityIcon name={a.key} className="h-3.5 w-3.5" />
                        {a.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col justify-between gap-3 border-t border-line p-5 sm:border-l sm:border-t-0 sm:text-right">
                {h.partnered ? (
                  <span className="badge self-start bg-success-soft text-success sm:self-end">{t.ui.openToClinic}</span>
                ) : (
                  <span className="badge self-start bg-background text-muted sm:self-end">{t.ui.viaAskepios}</span>
                )}
                <div>
                  {h.fromPrice ? (
                    <>
                      <p className="text-xs text-muted">{t.ui.fromPerNight}</p>
                      <p className="text-2xl font-extrabold">{formatMoney(h.fromPrice.price, h.fromPrice.currency, locale)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">{h.partnered ? t.ui.noPriceYet : t.ui.priceOnRequest}</p>
                  )}
                  <span className="btn-primary mt-3 w-full">{h.partnered ? t.ui.seeRooms : t.ui.viewHotel}</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
