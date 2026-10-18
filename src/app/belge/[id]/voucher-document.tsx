import Image from "next/image";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { formatDate } from "@/lib/format";
import { nightsBetween } from "@/lib/summary";
import { countryName } from "@/lib/countries";

export type Hotel = { address: string; district: string; city: string };

type VoucherReservation = {
  reference: string;
  hotel_name: string;
  room_name: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  hotel_confirmation_no: string;
};

/** Onay belgesinin kendisi: fiyat ve kimlik numarası içermez. */
export function VoucherDocument({
  r,
  hotel,
  clinicName,
  guests,
  t,
  locale,
  issuedAt,
  contact,
}: {
  r: VoucherReservation;
  hotel: Hotel | null;
  clinicName?: string;
  guests: { position: number; full_name: string; nationality: string }[];
  t: Dictionary;
  locale: Locale;
  issuedAt: string;
  contact: string;
}) {
  return (
    <article lang={locale} className="card space-y-6 p-8 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <Image src="/logo.png" alt="Asklepios" width={794} height={132} priority className="h-9 w-auto" />
        <div className="text-right">
          <h1 className="text-xl font-bold">{t.voucher.title}</h1>
          <p className="text-sm text-muted">
            {t.voucher.issuedAt}: {formatDate(issuedAt, locale)}
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
          <dd className="text-2xl font-extrabold">
            {r.hotel_confirmation_no || <span className="text-base font-medium text-muted">{t.voucher.hotelConfirmationPending}</span>}
          </dd>
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
        {clinicName && (
          <p>
            {t.voucher.clinic}: <span className="font-semibold">{clinicName}</span>
          </p>
        )}
        {contact && (
          <p>
            {t.voucher.contact}: {contact}
          </p>
        )}
        <p className="pt-2 font-medium">{t.voucher.footer}</p>
      </footer>
    </article>
  );
}
