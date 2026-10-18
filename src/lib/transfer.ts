/** Havalimanı transferi: talepte geliş ve/veya dönüş. Fiyatı sistemde tutulmaz. */

export const AIRPORTS = ["IST", "SAW"] as const;
export const TRANSFER_LEGS = ["arrival", "departure"] as const;

export type TransferLeg = { airport: string; at: string; flight: string };
export type Transfer = Partial<Record<(typeof TRANSFER_LEGS)[number], TransferLeg>>;

/** Formdaki transfer_<leg>_* alanlarından transfer bilgisi; işaretlenmeyen yön eklenmez. */
export function transferFromForm(fd: FormData): Transfer {
  const transfer: Transfer = {};
  for (const leg of TRANSFER_LEGS) {
    if (fd.get(`transfer_${leg}`) !== "1") continue;
    transfer[leg] = {
      airport: String(fd.get(`transfer_${leg}_airport`) ?? "").trim(),
      at: String(fd.get(`transfer_${leg}_at`) ?? "").trim(),
      flight: String(fd.get(`transfer_${leg}_flight`) ?? "")
        .replace(/[\s-]/g, "")
        .toUpperCase(),
    };
  }
  return transfer;
}

/** "2026-11-03T14:30" → "03.11.2026 14:30" (saat İstanbul saatidir, dönüştürülmez). */
export function formatTransferTime(at: string, locale: "tr" | "en"): string {
  const [date, time] = at.split("T");
  const [y, m, d] = date.split("-");
  return locale === "tr" ? `${d}.${m}.${y} ${time}` : `${d}/${m}/${y} ${time}`;
}
