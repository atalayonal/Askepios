/**
 * Aylık özet: bir ayda girişi olan rezervasyonların otel ve klinik bazında toplamları.
 * Ödenecek tutar sadece onaylı rezervasyonlardan hesaplanır; bekleyenler ayrıca gösterilir.
 * Para birimleri karışabileceği için tutarlar para birimine göre ayrı tutulur.
 */

export type SummaryReservation = {
  id: string;
  reference: string;
  hotel_id: string;
  hotel_name: string;
  room_name: string;
  clinic_id: string;
  clinic_name?: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  total_price: number | string;
  currency: string;
  status: string;
};

export type Money = Record<string, number>;

export type SummaryGroup = {
  id: string;
  name: string;
  reservations: number;
  nights: number;
  guests: number;
  totals: Money;
};

export type MonthSummary = {
  confirmed: { reservations: number; nights: number; guests: number; totals: Money };
  pending: { reservations: number; totals: Money };
  closed: number;
  byHotel: SummaryGroup[];
  byClinic: SummaryGroup[];
};

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
}

const addMoney = (money: Money, currency: string, amount: number) => {
  money[currency] = Math.round(((money[currency] ?? 0) + amount) * 100) / 100;
};

function group(rows: SummaryReservation[], key: (r: SummaryReservation) => [string, string]): SummaryGroup[] {
  const groups = new Map<string, SummaryGroup>();
  for (const r of rows) {
    const [id, name] = key(r);
    const g = groups.get(id) ?? { id, name, reservations: 0, nights: 0, guests: 0, totals: {} };
    g.reservations += 1;
    g.nights += nightsBetween(r.check_in, r.check_out);
    g.guests += r.guest_count;
    addMoney(g.totals, r.currency, Number(r.total_price));
    groups.set(id, g);
  }
  return [...groups.values()].sort((a, b) => b.reservations - a.reservations || a.name.localeCompare(b.name, "tr"));
}

export function summarize(rows: SummaryReservation[]): MonthSummary {
  const confirmed = rows.filter((r) => r.status === "CONFIRMED");
  const pending = rows.filter((r) => r.status === "PENDING");
  const summary: MonthSummary = {
    confirmed: { reservations: confirmed.length, nights: 0, guests: 0, totals: {} },
    pending: { reservations: pending.length, totals: {} },
    closed: rows.length - confirmed.length - pending.length,
    byHotel: group(confirmed, (r) => [r.hotel_id, r.hotel_name]),
    byClinic: group(confirmed, (r) => [r.clinic_id, r.clinic_name ?? ""]),
  };
  for (const r of confirmed) {
    summary.confirmed.nights += nightsBetween(r.check_in, r.check_out);
    summary.confirmed.guests += r.guest_count;
    addMoney(summary.confirmed.totals, r.currency, Number(r.total_price));
  }
  for (const r of pending) addMoney(summary.pending.totals, r.currency, Number(r.total_price));
  return summary;
}
