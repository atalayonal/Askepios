import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/server";
import { dictionaries, locales, type Locale } from "@/i18n/dictionaries";
import { formatDate } from "@/lib/format";
import { nightsBetween } from "@/lib/summary";
import { countryName } from "@/lib/countries";
import { PrintButton } from "./print-button";

export const metadata = { title: "Voucher · Asklepios" };

/**
 * Onaylı rezervasyonun onay belgesi (voucher). Klinik hastaya iletir; tarayıcıdan PDF olarak kaydedilir.
 * Fiyat ve kimlik numaraları belgeye konmaz. Belge dili ?dil=tr|en ile seçilir.
 */
export default async function VoucherPage({ params, searchParams }: PageProps<"/belge/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { dil } = await searchParams;
  const locale: Locale = locales.includes(dil as Locale) ? (dil as Locale) : await getLocale();
  const t = dictionaries[locale];
  const supabase = await createClient();

  // RLS: klinik sadece kendi rezervasyonunu görür.
  const { data: r } = await supabase
    .from("reservations")
    .select("id, reference, hotel_name, room_name, check_in, check_out, guest_count, status, hotel_confirmation_no, hotels(address, district, city), clinics(name)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const { data: guests } = await supabase.from("reservation_guests").select("position, full_name, nationality").eq("reservation_id", id).order("position");

  const hotel = r.hotels as unknown as { address: string; district: string; city: string } | null;
  const clinic = r.clinics as unknown as { name: string } | null;
  const back = `${user.role === "admin" ? "/admin" : "/klinik"}/rezervasyonlar/${r.id}`;
  const contactEmail = process.env.ASKEPIOS_CONTACT_EMAIL;
  const contactWhatsapp = process.env.ASKEPIOS_CONTACT_WHATSAPP;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link href={back} className="back-link">
          ← {t.voucher.back}
        </Link>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">{t.voucher.language}:</span>
          {locales.map((l) => (
            <Link key={l} href={`/belge/${r.id}?dil=${l}`} className={`rounded-md px-2 py-1 uppercase ${l === locale ? "bg-navy font-semibold text-white" : "hover:bg-sky"}`}>
              {l}
            </Link>
          ))}
        </div>
        {r.status === "CONFIRMED" && <PrintButton label={t.voucher.print} />}
      </div>
      {r.status === "CONFIRMED" && <p className="mb-4 text-xs text-muted print:hidden">{t.voucher.printHint}</p>}

      {r.status !== "CONFIRMED" ? (
        <p className="card p-6 text-sm">{t.voucher.notConfirmed}</p>
      ) : (
        <article lang={locale} className="card space-y-6 p-8 print:border-0 print:p-0">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
            <Image src="/logo.png" alt="Asklepios" width={794} height={132} priority className="h-9 w-auto" />
            <div className="text-right">
              <h1 className="text-xl font-bold">{t.voucher.title}</h1>
              <p className="text-sm text-muted">
                {t.voucher.issuedAt}: {formatDate(today, locale)}
              </p>
            </div>
          </header>

          <dl className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t.voucher.reference}</dt>
              <dd className="text-2xl font-extrabold">{r.reference}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t.voucher.hotelConfirmationNo}</dt>
              <dd className="text-2xl font-extrabold">{r.hotel_confirmation_no || <span className="text-base font-medium text-muted">{t.voucher.hotelConfirmationPending}</span>}</dd>
            </div>
          </dl>

          <section className="rounded-lg bg-background p-5 print:border print:border-line print:bg-white">
            <h2 className="text-lg font-bold">{r.hotel_name}</h2>
            {hotel && (
              <p className="text-sm text-foreground/80">
                {t.voucher.address}: {[hotel.address, hotel.district, hotel.city].filter(Boolean).join(", ")}
              </p>
            )}
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3 print:grid-cols-3">
              <div>
                <dt className="text-muted">{t.clinic.checkIn}</dt>
                <dd className="font-semibold">{formatDate(r.check_in, locale)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t.clinic.checkOut}</dt>
                <dd className="font-semibold">{formatDate(r.check_out, locale)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t.voucher.stay}</dt>
                <dd className="font-semibold">
                  {nightsBetween(r.check_in, r.check_out)} {t.clinic.nights} · {r.guest_count} {t.clinic.guests}
                </dd>
              </div>
              <div className="sm:col-span-3 print:col-span-3">
                <dt className="text-muted">{t.voucher.room}</dt>
                <dd className="font-semibold">{r.room_name}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="mb-2 font-bold">{t.voucher.guests}</h2>
            <ol className="divide-y divide-line rounded-md border border-line text-sm">
              {(guests ?? []).map((g) => (
                <li key={g.position} className="flex justify-between gap-4 px-3 py-2">
                  <span className="font-medium">
                    {g.position}. {g.full_name}
                  </span>
                  {g.nationality && <span className="text-muted">{countryName(g.nationality, locale)}</span>}
                </li>
              ))}
            </ol>
          </section>

          <footer className="space-y-1 border-t border-line pt-4 text-sm text-foreground/80">
            {clinic && (
              <p>
                {t.voucher.clinic}: <span className="font-semibold">{clinic.name}</span>
              </p>
            )}
            {(contactEmail || contactWhatsapp) && (
              <p>
                {t.voucher.contact}: {[contactEmail, contactWhatsapp].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="pt-2 font-medium">{t.voucher.footer}</p>
          </footer>
        </article>
      )}
    </main>
  );
}
