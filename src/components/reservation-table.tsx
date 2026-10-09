import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { formatDate, formatMoney } from "@/lib/format";
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
    <div className="overflow-x-auto">
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
                <Link href={`${hrefBase}/${r.id}`} className="font-semibold text-blue hover:underline">
                  {r.reference}
                </Link>
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
  );
}
