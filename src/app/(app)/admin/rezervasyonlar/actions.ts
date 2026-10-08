"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { notifyStatusChange } from "@/lib/notifications/reservations";

export type FormState = { error?: string; message?: string };

const STATUSES = ["CONFIRMED", "REJECTED", "CANCELLED"];

export async function changeStatus(reservationId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const status = String(fd.get("status") ?? "");
  if (!STATUSES.includes(status)) return { error: t.common.unexpectedError };

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_reservation_status", {
    p_reservation_id: reservationId,
    p_new_status: status,
    p_note: String(fd.get("note") ?? ""),
  });
  if (error) return { error: t.common.unexpectedError };

  after(() => notifyStatusChange(reservationId));
  revalidatePath(`/admin/rezervasyonlar/${reservationId}`);
  revalidatePath("/admin/rezervasyonlar");
  revalidatePath("/admin");
  return { message: t.reservations.statusChangedTo[status] ?? t.common.saved };
}

export async function addInternalNote(reservationId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const t = await getDictionary();
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("reservation_admin_notes").insert({ reservation_id: reservationId, author_id: user.id, body });
  if (error) return { error: t.common.unexpectedError };

  revalidatePath(`/admin/rezervasyonlar/${reservationId}`);
  return { message: t.common.saved };
}
