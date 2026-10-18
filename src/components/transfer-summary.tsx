import { Plane } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { TRANSFER_LEGS, formatTransferTime, type Transfer } from "@/lib/transfer";

/** Rezervasyon detayında ve onay belgesinde istenen transferler. Transfer yoksa hiçbir şey göstermez. */
export function TransferSummary({ transfer, t, locale }: { transfer: Transfer | null | undefined; t: Dictionary; locale: Locale }) {
  const legs = TRANSFER_LEGS.filter((leg) => transfer?.[leg]);
  if (!legs.length) return null;
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Plane aria-hidden className="h-4 w-4 text-blue" />
        {t.transfer.detailTitle}
      </h2>
      <ul className="divide-y divide-line/70 rounded-md border border-line text-sm">
        {legs.map((leg) => {
          const l = transfer![leg]!;
          return (
            <li key={leg} className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2">
              <span className="font-medium">{leg === "arrival" ? t.transfer.arrival : t.transfer.departure}</span>
              <span>{t.transfer.airports[l.airport] ?? l.airport}</span>
              <span className="text-muted">{formatTransferTime(l.at, locale)}</span>
              {l.flight && <span className="font-mono text-muted">{l.flight}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
