import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { formatDate, formatMoney } from "@/lib/format";
import { shiftMonth } from "@/lib/dates";
import { nightsBetween, summarize, type Money, type SummaryGroup, type SummaryReservation } from "@/lib/summary";
import { ReservationStatus } from "./reservation-status";

export function formatTotals(totals: Money, locale: Locale): string {
  const entries = Object.entries(totals);
  if (!entries.length) return formatMoney(0, "EUR", locale);
  return entries.map(([currency, amount]) => formatMoney(amount, currency, locale)).join(" + ");
}

export function monthLabel(month: string, locale: Locale): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** Ay seçici: önceki / sonraki ay bağlantıları. */
export function MonthPicker({ month, href, locale, t }: { month: string; href: (month: string) => string; locale: Locale; t: Dictionary }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-white">
      <Link href={href(shiftMonth(month, -1))} className="rounded-l-xl p-2.5 hover:bg-background" aria-label={t.availability.prevMonth}>
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <span className="min-w-36 px-2 text-center font-semibold capitalize">{monthLabel(month, locale)}</span>
      <Link href={href(shiftMonth(month, 1))} className="rounded-r-xl p-2.5 hover:bg-background" aria-label={t.availability.nextMonth}>
        <ChevronRight className="h-5 w-5" />
      </Link>
    </div>
  );
}

/** Ayın üst özet kartları: ödenecek tutar, onaylı rezervasyon/gece, bekleyen talepler. */
export function SummaryTiles({ rows, t, locale, admin }: { rows: SummaryReservation[]; t: Dictionary; locale: Locale; admin: boolean }) {
  const s = summarize(rows);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl bg-navy p-5 text-white sm:col-span-1">
        <p className="text-sm text-white/75">{admin ? t.ui.amountToCollect : t.ui.amountToPay}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight">{formatTotals(s.confirmed.totals, locale)}</p>
        <p className="mt-2 text-xs text-white/70">{t.ui.confirmedOnlyNote}</p>
      </div>
      <div className="card p-5">
        <p className="text-sm text-muted">{t.ui.confirmedStays}</p>
        <p className="mt-1 text-3xl font-extrabold">{s.confirmed.reservations}</p>
        <p className="mt-2 text-sm text-muted">
          {s.confirmed.nights} {t.clinic.nights} · {s.confirmed.guests} {t.clinic.guests}
        </p>
      </div>
      <div className="card p-5">
        <p className="text-sm text-muted">{admin ? t.ui.awaitingDecision : t.ui.awaitingConfirmation}</p>
        <p className="mt-1 text-3xl font-extrabold text-amber-700">{s.pending.reservations}</p>
        <p className="mt-2 text-sm text-muted">
          {s.pending.reservations > 0 ? `${formatTotals(s.pending.totals, locale)} ${t.ui.ifConfirmed}` : t.ui.nothingPending}
        </p>
      </div>
    </div>
  );
}

function GroupTable({ title, groups, t, locale, firstColumn }: { title: string; groups: SummaryGroup[]; t: Dictionary; locale: Locale; firstColumn: string }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="px-5 pb-3 pt-5 text-lg font-bold">{title}</h2>
      {groups.length ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{firstColumn}</th>
                <th className="text-right">{t.ui.reservationsShort}</th>
                <th className="text-right">{t.ui.nightsShort}</th>
                <th className="text-right">{t.ui.guestsShort}</th>
                <th className="text-right">{t.clinic.total}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="font-semibold">{g.name}</td>
                  <td className="text-right">{g.reservations}</td>
                  <td className="text-right">{g.nights}</td>
                  <td className="text-right">{g.guests}</td>
                  <td className="whitespace-nowrap text-right font-bold">{formatTotals(g.totals, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 pb-5 text-sm text-muted">{t.ui.noConfirmedThisMonth}</p>
      )}
    </section>
  );
}

/** Aylık özet sayfasının gövdesi; klinik ve admin aynı bileşeni kullanır. */
export function MonthlySummary({
  rows,
  t,
  locale,
  admin,
  hrefBase,
}: {
  rows: SummaryReservation[];
  t: Dictionary;
  locale: Locale;
  admin: boolean;
  hrefBase: string;
}) {
  const s = summarize(rows);
  const list = [...rows].sort((a, b) => a.check_in.localeCompare(b.check_in));
  return (
    <div className="space-y-6">
      <SummaryTiles rows={rows} t={t} locale={locale} admin={admin} />
      <div className={`grid gap-6 ${admin ? "lg:grid-cols-2" : ""}`}>
        <GroupTable title={t.ui.byHotel} groups={s.byHotel} t={t} locale={locale} firstColumn={t.clinic.hotel} />
        {admin && <GroupTable title={t.ui.byClinic} groups={s.byClinic} t={t} locale={locale} firstColumn={t.ui.clinic} />}
      </div>
      <section className="card overflow-hidden">
        <h2 className="px-5 pb-3 pt-5 text-lg font-bold">{t.ui.monthReservations}</h2>
        {list.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.clinic.reference}</th>
                  {admin && <th>{t.ui.clinic}</th>}
                  <th>{t.clinic.hotel}</th>
                  <th>{t.clinic.dates}</th>
                  <th className="text-right">{t.ui.nightsShort}</th>
                  <th className="text-right">{t.clinic.total}</th>
                  <th>{t.common.status}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={r.status === "REJECTED" || r.status === "CANCELLED" ? "text-muted" : ""}>
                    <td>
                      <Link href={`${hrefBase}/${r.id}`} className="font-semibold text-blue hover:underline">
                        {r.reference}
                      </Link>
                    </td>
                    {admin && <td>{r.clinic_name}</td>}
                    <td>
                      <div className="font-medium">{r.hotel_name}</div>
                      <div className="text-xs text-muted">{r.room_name}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDate(r.check_in, locale)} – {formatDate(r.check_out, locale)}
                    </td>
                    <td className="text-right">{nightsBetween(r.check_in, r.check_out)}</td>
                    <td className="whitespace-nowrap text-right font-semibold">{formatMoney(Number(r.total_price), r.currency, locale)}</td>
                    <td>
                      <ReservationStatus status={r.status} labels={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-muted">{t.ui.noReservationsThisMonth}</p>
        )}
      </section>
    </div>
  );
}
