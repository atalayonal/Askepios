/** Listelerde rezervasyonla birlikte istenen misafir alanları. */
export const GUEST_COLUMNS = "reservation_guests(full_name, position)";

/** Rezervasyon detayında gösterilen misafir alanları. */
export const GUEST_DETAIL_COLUMNS = "position, full_name, nationality, phone, id_number, birth_date, gender, identity_purged_at";

export type GuestRow = { full_name: string; position: number };

/** Ana misafirin adı; birden fazla misafir varsa "+N" eklenir. Listelerde rezervasyonu tanımak için. */
export function mainGuestLabel(guests: GuestRow[] | null | undefined): string {
  if (!guests?.length) return "";
  const sorted = [...guests].sort((a, b) => a.position - b.position);
  return sorted.length > 1 ? `${sorted[0].full_name} +${sorted.length - 1}` : sorted[0].full_name;
}
