import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminNotificationEmails, appUrl, sendEmail } from "./email";

const STATUS_TR: Record<string, string> = {
  PENDING: "Beklemede",
  CONFIRMED: "Onaylandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal edildi",
};

type ReservationSummary = {
  id: string;
  reference: string;
  hotel_name: string;
  room_name: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  status: string;
  created_by: string;
  clinics: { name: string; contact_email: string | null } | null;
};

async function loadReservation(id: string): Promise<ReservationSummary | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await createAdminClient()
    .from("reservations")
    .select("id, reference, hotel_name, room_name, check_in, check_out, guest_count, status, created_by, clinics(name, contact_email)")
    .eq("id", id)
    .maybeSingle();
  return data as unknown as ReservationSummary | null;
}

function summary(r: ReservationSummary): string {
  return [
    `Referans: ${r.reference}`,
    `Klinik: ${r.clinics?.name ?? ""}`,
    `Otel: ${r.hotel_name} · ${r.room_name}`,
    `Tarihler: ${r.check_in} → ${r.check_out}`,
    `Misafir sayısı: ${r.guest_count}`,
    `Durum: ${STATUS_TR[r.status] ?? r.status}`,
  ].join("\n");
}

/** Yeni talep: Askepios yöneticilerine bildirim. */
export async function notifyNewReservation(id: string): Promise<void> {
  const r = await loadReservation(id);
  if (!r) return;
  await sendEmail(
    adminNotificationEmails(),
    `Yeni rezervasyon talebi: ${r.reference} · ${r.hotel_name}`,
    `Yeni bir rezervasyon talebi oluşturuldu.\n\n${summary(r)}\n\n${appUrl(`/admin/rezervasyonlar/${r.id}`)}`,
  );
}

/** Durum değişikliği: talebi oluşturan klinik kullanıcısına ve kliniğin iletişim adresine bildirim. */
export async function notifyStatusChange(id: string): Promise<void> {
  const r = await loadReservation(id);
  if (!r) return;
  const { data: creator } = await createAdminClient().auth.admin.getUserById(r.created_by);
  const recipients = [...new Set([creator?.user?.email, r.clinics?.contact_email].filter((e): e is string => Boolean(e)))];
  await sendEmail(
    recipients,
    `Rezervasyon ${STATUS_TR[r.status]?.toLowerCase() ?? r.status}: ${r.reference} · ${r.hotel_name}`,
    `Rezervasyon talebinizin durumu güncellendi.\n\n${summary(r)}\n\n${appUrl(`/klinik/rezervasyonlar/${r.id}`)}`,
  );
}
