import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { formatDate, formatMoney } from "@/lib/format";
import { mainGuestLabel, type GuestRow } from "@/lib/reservation-guests";
import { ReservationStatus } from "./reservation-status";
import { QuickDecision } from "./decision";

export type ReservationListItem = {
  id: string;
  reference: string;
  hotel_name: string;
  room_name: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  total_price: number | string;
  currency: string;
  status: string;
  clinic_name?: string;
  reservation_guests?: GuestRow[] | null;
};

export function ReservationTable({
  items,
  hrefBase,
  t,
  locale,
  showClinic = false,
  decide = false,
}: {
  items: ReservationListItem[];
  hrefBase: string;
  t: Dictionary;
  locale: Locale;
  showClinic?: boolean;
  /** Admin listelerinde bekleyen talepler için Onayla / Reddet düğmeleri. */
  decide?: boolean;
}) {
  if (!items.length) return <p className="px-5 pb-5 pt-2 text-sm text-muted">{showClinic ? t.common.none : t.clinic.noReservations}</p>;
  return (
    <>
      {/* Telefonda tablo yerine kartlar: sütunlar sıkışmasın, yatay kaydırma gerekmesin. */}
      <ul className="divide-y divide-line/70 border-t border-line md:hidden">
        {items.map((r) => (
          <li key={r.id} className="space-y-1.5 px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`${hrefBase}/${r.id}`} className="whitespace-nowrap font-semibold text-blue hover:underline">
                  {r.reference}
                </Link>
                {r.reservation_guests?.length ? (
                  <div className="truncate text-xs text-muted">{mainGuestLabel(r.reservation_guests)}</div>
                ) : null}
              </div>
              <ReservationStatus status={r.status} labels={t.status} />
            </div>
            {showClinic && <div className="font-medium">{r.clinic_name}</div>}
            <div>
              {r.hotel_name} <span className="text-muted">· {r.room_name}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 text-muted">
              <span>
                {formatDate(r.check_in, locale)} – {formatDate(r.check_out, locale)} · {r.guest_count} {t.clinic.guests}
              </span>
              <span className="font-semibold text-foreground">{formatMoney(Number(r.total_price), r.currency, locale)}</span>
            </div>
            {decide && r.status === "PENDING" && <QuickDecision reservationId={r.id} t={t} />}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="table">
          <thead>
            <tr>
              <th>{t.clinic.reference}</th>
              {showClinic && <th>{t.ui.clinic}</th>}
              <th>{t.clinic.hotel}</th>
              <th>{t.clinic.dates}</th>
              <th>{t.clinic.guestCount}</th>
              <th>{t.clinic.total}</th>
              <th>{t.common.status}</th>
              {decide && <th>{t.ui.decision}</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`${hrefBase}/${r.id}`} className="whitespace-nowrap font-semibold text-blue hover:underline">
                    {r.reference}
                  </Link>
                  {r.reservation_guests?.length ? <div className="text-xs text-muted">{mainGuestLabel(r.reservation_guests)}</div> : null}
                </td>
                {showClinic && <td>{r.clinic_name}</td>}
                <td>
                  <div>{r.hotel_name}</div>
                  <div className="text-xs text-muted">{r.room_name}</div>
                </td>
                <td className="whitespace-nowrap">
                  {formatDate(r.check_in, locale)} – {formatDate(r.check_out, locale)}
                </td>
                <td>{r.guest_count}</td>
                <td className="whitespace-nowrap">{formatMoney(Number(r.total_price), r.currency, locale)}</td>
                <td>
                  <ReservationStatus status={r.status} labels={t.status} />
                </td>
                {decide && <td>{r.status === "PENDING" && <QuickDecision reservationId={r.id} t={t} />}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
