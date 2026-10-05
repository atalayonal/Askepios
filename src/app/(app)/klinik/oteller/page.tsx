import Link from "next/link";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { withSignedUrls, type ImageRow } from "@/lib/images";
import type { Dictionary, Locale } from "@/i18n/dictionaries";

type HotelCard = {
  id: string;
  name: string;
  city: string;
  district: string;
  stars: number | null;
  description_tr: string;
  description_en: string;
  coverUrl: string | null;
};

export default async function ClinicHotelsPage() {
  const user = await requireClinicUser();
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: hotels }, { data: access }, { data: covers }] = await Promise.all([
    supabase.from("hotels").select("id, name, city, district, stars, description_tr, description_en").order("name"),
    supabase.from("clinic_hotel_access").select("hotel_id").eq("clinic_id", user.clinicId!),
    supabase.from("hotel_images").select("id, hotel_id, storage_path, sort_order, is_cover").is("room_type_id", null).eq("is_cover", true),
  ]);

  const signed = await withSignedUrls(supabase, (covers ?? []) as (ImageRow & { hotel_id: string })[]);
  const coverByHotel = new Map(signed.map((c) => [c.hotel_id, c.url]));
  const partnered = new Set((access ?? []).map((a) => a.hotel_id as string));
  const cards: HotelCard[] = (hotels ?? []).map((h) => ({ ...h, coverUrl: coverByHotel.get(h.id) ?? null }));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">{t.clinic.partneredHotels}</h1>
        <HotelGrid hotels={cards.filter((h) => partnered.has(h.id))} t={t} locale={locale} partnered />
      </section>
      <section>
        <h2 className="text-lg font-semibold">{t.clinic.otherHotels}</h2>
        <p className="mb-4 text-sm text-slate-600">{t.clinic.otherHotelsIntro}</p>
        <HotelGrid hotels={cards.filter((h) => !partnered.has(h.id))} t={t} locale={locale} partnered={false} />
      </section>
    </div>
  );
}

function HotelGrid({ hotels, t, locale, partnered }: { hotels: HotelCard[]; t: Dictionary; locale: Locale; partnered: boolean }) {
  if (!hotels.length) return <p className="text-sm text-slate-500">{t.common.none}</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {hotels.map((h) => {
        const description = (locale === "en" && h.description_en) || h.description_tr;
        return (
          <li key={h.id} className="card overflow-hidden">
            <Link href={`/klinik/oteller/${h.id}`} className="block">
              <div className="aspect-[16/9] bg-slate-100">
                {h.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.coverUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{h.name}</h3>
                  {h.stars && <span className="text-xs text-amber-600">{"★".repeat(h.stars)}</span>}
                </div>
                <p className="text-sm text-slate-500">{[h.district, h.city].filter(Boolean).join(", ")}</p>
                {description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{description}</p>}
                <span className={`mt-3 inline-block text-sm font-medium ${partnered ? "text-teal-800" : "text-slate-600"}`}>
                  {partnered ? t.clinic.reserve : t.clinic.contactAskepios} →
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
