import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminNotificationEmails, appUrl, sendEmail } from "./email";
import { TRANSFER_LEGS, formatTransferTime, type Transfer } from "@/lib/transfer";

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
  transfer: Transfer | null;
  clinics: { name: string; contact_email: string | null } | null;
};

async function loadReservation(id: string): Promise<ReservationSummary | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await createAdminClient()
    .from("reservations")
    .select("id, reference, hotel_name, room_name, check_in, check_out, guest_count, status, created_by, transfer, clinics(name, contact_email)")
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
    ...TRANSFER_LEGS.filter((leg) => r.transfer?.[leg]).map((leg) => {
      const l = r.transfer![leg]!;
      return `${leg === "arrival" ? "Geliş transferi" : "Dönüş transferi"}: ${l.airport} · ${formatTransferTime(l.at, "tr")}${l.flight ? ` · ${l.flight}` : ""}`;
    }),
  ].join("\n");
}

/** Yeni talep: Asklepios yöneticilerine bildirim. */
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

const CHANGE_TR: Record<string, string> = {
  CANCEL: "İptal talebi",
  CHANGE: "Değişiklik talebi",
  WITHDRAWN: "Talep geri çekildi",
};

/**
 * Klinik iptal / değişiklik istedi ya da bekleyen talebini geri çekti: yöneticilere bildirim.
 * Kliniğin açıklaması (geri çekmede sebebi) e-postaya eklenir; sadece Asklepios yöneticilerine gider.
 */
export async function notifyChangeRequest(id: string, kind: "CANCEL" | "CHANGE" | "WITHDRAWN", message = ""): Promise<void> {
  const r = await loadReservation(id);
  if (!r) return;
  const text = message.trim();
  const label = kind === "WITHDRAWN" ? "Sebep" : "Kliniğin açıklaması";
  await sendEmail(
    adminNotificationEmails(),
    `${CHANGE_TR[kind]}: ${r.reference} · ${r.hotel_name}`,
    `${CHANGE_TR[kind]} (${r.clinics?.name ?? ""}).\n\n${text ? `${label}:\n${text}\n\n` : ""}${summary(r)}\n\n${appUrl(`/admin/rezervasyonlar/${r.id}`)}`,
  );
}

/** Admin değişiklik talebini kapattı: talebi oluşturan klinik kullanıcısına bildirim. */
export async function notifyChangeResolved(requestId: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createAdminClient();
  const { data: request } = await admin.from("reservation_change_requests").select("reservation_id, created_by").eq("id", requestId).maybeSingle();
  if (!request) return;
  const r = await loadReservation(request.reservation_id);
  if (!r) return;
  const { data: creator } = request.created_by ? await admin.auth.admin.getUserById(request.created_by) : { data: null };
  const recipients = [...new Set([creator?.user?.email, r.clinics?.contact_email].filter((e): e is string => Boolean(e)))];
  await sendEmail(
    recipients,
    `Talebiniz sonuçlandı: ${r.reference} · ${r.hotel_name}`,
    `Rezervasyonunuz için gönderdiğiniz değişiklik talebi sonuçlandı.\n\n${summary(r)}\n\n${appUrl(`/klinik/rezervasyonlar/${r.id}`)}`,
  );
}
