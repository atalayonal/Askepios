import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";

export const PAGE_SIZE = 50;

/** ?sayfa= parametresinden 1'den başlayan sayfa numarası. */
export function pageFromParam(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 1 && n < 10_000 ? n : 1;
}

/** Listelerin altındaki önceki / sonraki sayfa bağlantıları. Tek sayfa varsa görünmez. */
export function Pagination({ page, hasNext, href, t }: { page: number; hasNext: boolean; href: (page: number) => string; t: Dictionary }) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm" aria-label={t.pagination.page}>
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn-secondary">
          <ChevronLeft aria-hidden className="h-4 w-4" />
          {t.pagination.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        {t.pagination.page} {page}
      </span>
      {hasNext ? (
        <Link href={href(page + 1)} className="btn-secondary">
          {t.pagination.next}
          <ChevronRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
