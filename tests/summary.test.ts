import { describe, expect, it } from "vitest";
import { nightsBetween, summarize, type SummaryReservation } from "@/lib/summary";

const row = (over: Partial<SummaryReservation>): SummaryReservation => ({
  id: Math.random().toString(36),
  reference: "ASK-1",
  hotel_id: "h1",
  hotel_name: "Otel X",
  room_name: "Double Oda",
  clinic_id: "c1",
  clinic_name: "Klinik A",
  check_in: "2026-10-10",
  check_out: "2026-10-13",
  guest_count: 2,
  total_price: "189.00",
  currency: "EUR",
  status: "CONFIRMED",
  ...over,
});

describe("aylık özet", () => {
  it("gece sayısını ay geçişinde de doğru hesaplar", () => {
    expect(nightsBetween("2026-10-30", "2026-11-02")).toBe(3);
  });

  it("ödenecek tutarı sadece onaylı rezervasyonlardan, otel ve klinik bazında toplar", () => {
    const s = summarize([
      row({}),
      row({ hotel_id: "h2", hotel_name: "Otel Y", total_price: 100.1, clinic_id: "c2", clinic_name: "Klinik B" }),
      row({ total_price: 63, guest_count: 1, check_out: "2026-10-11" }),
      row({ status: "PENDING", total_price: 500 }),
      row({ status: "REJECTED", total_price: 999 }),
      row({ status: "CANCELLED", total_price: 999 }),
    ]);

    expect(s.confirmed).toEqual({ reservations: 3, nights: 7, guests: 5, totals: { EUR: 352.1 } });
    expect(s.pending).toEqual({ reservations: 1, totals: { EUR: 500 } });
    expect(s.closed).toBe(2);
    expect(s.byHotel.map((h) => [h.name, h.reservations, h.nights, h.totals.EUR])).toEqual([
      ["Otel X", 2, 4, 252],
      ["Otel Y", 1, 3, 100.1],
    ]);
    expect(s.byClinic.map((c) => [c.name, c.totals.EUR])).toEqual([
      ["Klinik A", 252],
      ["Klinik B", 100.1],
    ]);
  });

  it("farklı para birimlerini karıştırmaz", () => {
    const s = summarize([row({ currency: "EUR", total_price: 10 }), row({ currency: "USD", total_price: 20 })]);
    expect(s.confirmed.totals).toEqual({ EUR: 10, USD: 20 });
  });
});
