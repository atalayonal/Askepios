import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { formatDate, formatMoney } from "@/lib/format";
import { ReservationStatus } from "./reservation-status";

type Reservation = {
  reference: string;
  hotel_name: string;
  room_name: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  total_price: number | string;
  currency: string;
  price_breakdown: { night: string; price: number }[];
  clinic_notes: string;
  status: string;
  created_at: string;
};
type Guest = { position: number; full_name: string; nationality: string; phone: string };
type History = { id: number; from_status: string | null; to_status: string; note: string; changed_at: string; changed_by_name?: string };

export function ReservationDetail({
  reservation: r,
  guests,
  history,
  t,
  locale,
  clinicName,
}: {
  reservation: Reservation;
  guests: Guest[];
  history: History[];
  t: Dictionary;
  locale: Locale;
  clinicName?: string;
}) {
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="card space-y-4 p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{r.reference}</h1>
          <ReservationStatus status={r.status} labels={t.status} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {clinicName && (
            <div>
              <dt className="text-slate-500">{t.nav.clinics}</dt>
              <dd className="font-medium">{clinicName}</dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500">{t.clinic.hotel}</dt>
            <dd className="font-medium">
              {r.hotel_name} · {r.room_name}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.clinic.dates}</dt>
            <dd className="font-medium">
              {formatDate(r.check_in, locale)} – {formatDate(r.check_out, locale)} ({r.price_breakdown.length} {t.clinic.nights})
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.clinic.total}</dt>
            <dd className="font-medium">{formatMoney(Number(r.total_price), r.currency, locale)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.clinic.createdAt}</dt>
            <dd className="font-medium">{dateTime(r.created_at)}</dd>
          </div>
        </dl>

        <div>
          <h2 className="mb-2 text-sm font-semibold">{t.clinic.guestCount}: {r.guest_count}</h2>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
            {guests.map((g) => (
              <li key={g.position} className="flex flex-wrap gap-x-4 px-3 py-2">
                <span className="font-medium">{g.full_name}</span>
                {g.nationality && <span className="text-slate-500">{g.nationality}</span>}
                {g.phone && <span className="text-slate-500">{g.phone}</span>}
              </li>
            ))}
          </ul>
        </div>

        {r.clinic_notes && (
          <div>
            <h2 className="mb-1 text-sm font-semibold">{t.clinic.notes}</h2>
            <p className="whitespace-pre-line text-sm text-slate-700">{r.clinic_notes}</p>
          </div>
        )}

        <details>
          <summary className="cursor-pointer text-sm font-semibold">{t.clinic.priceDetail}</summary>
          <table className="table mt-2">
            <tbody>
              {r.price_breakdown.map((n) => (
                <tr key={n.night}>
                  <td>{formatDate(n.night, locale)}</td>
                  <td className="text-right">{formatMoney(Number(n.price), r.currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">{t.clinic.history}</h2>
        <ol className="space-y-3 text-sm">
          {history.map((h) => (
            <li key={h.id} className="border-l-2 border-slate-200 pl-3">
              <div className="flex items-center gap-2">
                <ReservationStatus status={h.to_status} labels={t.status} />
                <span className="text-xs text-slate-500">{dateTime(h.changed_at)}</span>
              </div>
              {h.changed_by_name && <div className="mt-1 text-xs text-slate-500">{h.changed_by_name}</div>}
              {h.note && <p className="mt-1 text-slate-700">{h.note}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
