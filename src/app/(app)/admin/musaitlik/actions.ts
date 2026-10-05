"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function setAvailability(
  roomTypeIds: string[],
  from: string,
  to: string,
  available: boolean,
  note: string,
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_room_availability", {
    p_room_type_ids: roomTypeIds,
    p_from: from,
    p_to: to,
    p_available: available,
    p_note: note,
  });
  revalidatePath("/admin/musaitlik");
  return { ok: !error };
}
