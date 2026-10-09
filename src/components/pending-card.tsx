import Link from "next/link";
import { CalendarDays, Hotel, Users } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { formatDate, formatMoney } from "@/lib/format";
import { nightsBetween } from "@/lib/summary";
import { QuickDecision } from "./decision";

export type PendingItem = {
  id: string;
  reference: string;
  hotel_name: string;
  room_name: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  total_price: number | string;
  currency: string;
  created_at: string;
  clinic_name?: string;
};

/** Admin panelinde karar bekleyen talep kartı: bilgiler ve doğrudan Onayla / Reddet. */
export function PendingCard({ r, t, locale }: { r: PendingItem; t: Dictionary; locale: Locale }) {
  return (
    <li className="card flex flex-col gap-4 border-l-4 border-l-amber p-5 md:flex-row md:items-center">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/rezervasyonlar/${r.id}`} className="font-bold text-blue hover:underline">
            {r.reference}
          </Link>
          <span className="text-sm font-semibold">{r.clinic_name}</span>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground/80">
          <li className="flex items-center gap-1.5">
            <Hotel aria-hidden className="h-4 w-4 text-muted" />
            {r.hotel_name} · {r.room_name}
          </li>
          <li className="flex items-center gap-1.5">
            <CalendarDays aria-hidden className="h-4 w-4 text-muted" />
            {formatDate(r.check_in, locale)} – {formatDate(r.check_out, locale)} ({nightsBetween(r.check_in, r.check_out)} {t.clinic.nights})
          </li>
          <li className="flex items-center gap-1.5">
            <Users aria-hidden className="h-4 w-4 text-muted" />
            {r.guest_count} {t.clinic.guests}
          </li>
        </ul>
      </div>
      <div className="text-lg font-extrabold md:text-right">{formatMoney(Number(r.total_price), r.currency, locale)}</div>
      <div className="flex flex-wrap items-center gap-2">
        <QuickDecision reservationId={r.id} t={t} />
        <Link href={`/admin/rezervasyonlar/${r.id}`} className="btn-secondary px-3 py-1.5">
          {t.ui.details}
        </Link>
      </div>
    </li>
  );
}
