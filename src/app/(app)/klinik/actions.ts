"use server";

import { redirect } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";

export type Quote =
  | { ok: true; nights: { night: string; price: number }[]; total: number; currency: string }
  | { ok: false; reason: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function quote(roomTypeId: string, checkIn: string, checkOut: string, guestCount: number): Promise<Quote> {
  await requireClinicUser();
  if (!ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut)) return { ok: false, reason: "invalid_dates" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_reservation", {
    p_room_type_id: roomTypeId,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_guest_count: guestCount,
  });
  if (error) return { ok: false, reason: error.message };
  return data as Quote;
}

export type RequestState = { error?: string };

export async function createReservation(_prev: RequestState, fd: FormData): Promise<RequestState> {
  await requireClinicUser();
  const t = await getDictionary();

  const guestCount = Number(fd.get("guest_count"));
  const guests = Array.from({ length: Number.isInteger(guestCount) && guestCount > 0 && guestCount <= 10 ? guestCount : 0 }, (_, i) => ({
    full_name: String(fd.get(`guest_${i}_name`) ?? "").trim(),
    nationality: String(fd.get(`guest_${i}_nationality`) ?? "").trim(),
    phone: String(fd.get(`guest_${i}_phone`) ?? "").trim(),
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_reservation_request", {
    p_room_type_id: String(fd.get("room_type_id") ?? ""),
    p_check_in: String(fd.get("check_in") ?? ""),
    p_check_out: String(fd.get("check_out") ?? ""),
    p_guests: guests,
    p_notes: String(fd.get("notes") ?? ""),
  });
  if (error) return { error: t.clinic.errors[error.message] ?? t.common.unexpectedError };

  redirect(`/klinik/rezervasyonlar/${data}?yeni=1`);
}
