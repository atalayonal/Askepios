/** Saat dilimi sorunu olmaması için tarihler "YYYY-MM-DD" metni olarak, UTC üzerinden işlenir. */

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** "2026-10" biçimindeki ayın günleri. Geçersizse bugünün ayı kullanılır. */
export function monthDays(month: string | undefined, today = new Date()): { month: string; days: string[] } {
  const valid = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : toIso(today).slice(0, 7);
  const [y, m] = valid.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { month: valid, days: Array.from({ length: count }, (_, i) => `${valid}-${String(i + 1).padStart(2, "0")}`) };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return toIso(d).slice(0, 7);
}

/** [from, to] (ikisi dahil) aralığındaki günler. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}
