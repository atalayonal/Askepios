import type { Locale } from "@/i18n/dictionaries";

const intlLocale = (locale: Locale) => (locale === "tr" ? "tr-TR" : "en-GB");

/** "2026-10-14" gibi bir tarihi saat dilimi kaydırması olmadan biçimlendirir. */
export function formatDate(isoDate: string, locale: Locale): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatMoney(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency }).format(amount);
}
