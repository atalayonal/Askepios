import type { Dictionary } from "@/i18n/dictionaries";
import { mainGuestLabel } from "@/lib/reservation-guests";
import { nightsBetween, summarize, type SummaryGroup, type SummaryReservation } from "@/lib/summary";
import { buildXlsx, type XlsxCell, type XlsxSheet } from "@/lib/xlsx";

function groupSheet(name: string, firstColumn: string, groups: SummaryGroup[], t: Dictionary): XlsxSheet {
  // Para birimleri karışabileceği için her para birimi ayrı sütundur.
  const currencies = [...new Set(groups.flatMap((g) => Object.keys(g.totals)))].sort();
  return {
    name,
    widths: [32, 18, 10, 12, ...currencies.map(() => 14)],
    rows: [
      [firstColumn, t.excel.reservationCount, t.excel.nights, t.excel.guests, ...currencies.map((c) => `${t.excel.total} (${c})`)],
      ...groups.map((g) => [g.name, g.reservations, g.nights, g.guests, ...currencies.map((c) => g.totals[c] ?? null)]),
    ],
  };
}

/** Aylık özetin Excel dosyası: ayın bütün rezervasyonları ve onaylıların otel / klinik bazında toplamları. */
export function monthWorkbook(rows: SummaryReservation[], t: Dictionary, admin: boolean): Uint8Array {
  const list = [...rows].sort((a, b) => a.check_in.localeCompare(b.check_in) || a.reference.localeCompare(b.reference));
  const header: XlsxCell[] = [
    t.excel.reference,
    ...(admin ? [t.excel.clinic] : []),
    t.excel.hotel,
    t.excel.room,
    t.excel.checkIn,
    t.excel.checkOut,
    t.excel.nights,
    t.excel.guests,
    t.excel.mainGuest,
    t.excel.status,
    t.excel.total,
    t.excel.currency,
    t.excel.hotelConfirmationNo,
  ];
  const reservations: XlsxSheet = {
    name: t.excel.reservations,
    widths: [14, ...(admin ? [24] : []), 28, 20, 12, 12, 8, 10, 26, 14, 12, 10, 18],
    rows: [
      header,
      ...list.map((r) => [
        r.reference,
        ...(admin ? [r.clinic_name ?? ""] : []),
        r.hotel_name,
        r.room_name,
        { date: r.check_in },
        { date: r.check_out },
        nightsBetween(r.check_in, r.check_out),
        r.guest_count,
        mainGuestLabel(r.reservation_guests),
        t.status[r.status] ?? r.status,
        Number(r.total_price),
        r.currency,
        r.hotel_confirmation_no ?? "",
      ]),
    ],
  };

  const s = summarize(rows);
  const sheets = [reservations, groupSheet(t.excel.byHotel, t.excel.hotel, s.byHotel, t)];
  if (admin) sheets.push(groupSheet(t.excel.byClinic, t.excel.clinic, s.byClinic, t));
  return buildXlsx(sheets);
}

export function xlsxResponse(data: Uint8Array, filename: string): Response {
  return new Response(data as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
