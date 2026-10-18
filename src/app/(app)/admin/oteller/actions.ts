"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { IMAGE_BUCKET, isBundledImage } from "@/lib/images";
import { cleanAmenities } from "@/lib/amenities";

export type FormState = { error?: string; message?: string };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optional = (fd: FormData, key: string) => text(fd, key) || null;

function hotelFields(fd: FormData) {
  const stars = Number(text(fd, "stars"));
  return {
    name: text(fd, "name"),
    city: text(fd, "city"),
    district: text(fd, "district"),
    address: text(fd, "address"),
    stars: stars >= 1 && stars <= 5 ? stars : null,
    website: optional(fd, "website"),
    description_tr: text(fd, "description_tr"),
    description_en: text(fd, "description_en"),
    amenities: cleanAmenities(fd.getAll("amenities").map(String), "hotel"),
  };
}

function roomFields(fd: FormData) {
  const maxOccupancy = Number(text(fd, "max_occupancy"));
  const size = Number(text(fd, "size_m2"));
  const roomCount = Number(text(fd, "room_count"));
  return {
    name_tr: text(fd, "name_tr"),
    name_en: text(fd, "name_en"),
    description_tr: text(fd, "description_tr"),
    description_en: text(fd, "description_en"),
    bed_info: text(fd, "bed_info"),
    max_occupancy: Number.isInteger(maxOccupancy) && maxOccupancy >= 1 && maxOccupancy <= 10 ? maxOccupancy : 3,
    size_m2: Number.isInteger(size) && size >= 5 && size <= 500 ? size : null,
    // Boş bırakılırsa kontenjan takip edilmez.
    room_count: text(fd, "room_count") && Number.isInteger(roomCount) && roomCount >= 1 && roomCount <= 500 ? roomCount : null,
    amenities: cleanAmenities(fd.getAll("amenities").map(String), "room"),
  };
}

// ---------------------------------------------------------------- oteller

export async function createHotel(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const fields = hotelFields(fd);
  if (!fields.name) return { error: t.admin.nameRequired };

  const supabase = await createClient();
  // Yeni otel pasif başlar: fotoğraf, oda ve fiyatlar girilmeden klinikler görmesin. Kurulum adımları sayfada görünür.
  const { data, error } = await supabase
    .from("hotels")
    .insert({ ...fields, is_active: false })
    .select("id")
    .single();
  if (error) return { error: t.common.unexpectedError };
  await supabase.from("hotel_contacts").insert({ hotel_id: data.id });

  revalidatePath("/admin/oteller");
  redirect(`/admin/oteller/${data.id}`);
}

export async function updateHotel(hotelId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const fields = hotelFields(fd);
  if (!fields.name) return { error: t.admin.nameRequired };

  const supabase = await createClient();
  const { error } = await supabase.from("hotels").update(fields).eq("id", hotelId);
  if (error) return { error: t.common.unexpectedError };

  revalidatePath(`/admin/oteller/${hotelId}`);
  return { message: t.common.saved };
}

export async function setHotelActive(hotelId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("hotels").update({ is_active: isActive }).eq("id", hotelId);
  revalidatePath(`/admin/oteller/${hotelId}`);
  revalidatePath("/admin/oteller");
}

export async function updateHotelContacts(hotelId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const supabase = await createClient();
  const { error } = await supabase.from("hotel_contacts").upsert({
    hotel_id: hotelId,
    contact_person: optional(fd, "contact_person"),
    phone: optional(fd, "phone"),
    email: optional(fd, "email"),
    whatsapp: optional(fd, "whatsapp"),
    internal_notes: text(fd, "internal_notes"),
  });
  if (error) return { error: t.common.unexpectedError };
  return { message: t.common.saved };
}

// ---------------------------------------------------------------- oda tipleri

export async function createRoomType(hotelId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const fields = roomFields(fd);
  if (!fields.name_tr) return { error: t.admin.nameRequired };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_types")
    .insert({ ...fields, hotel_id: hotelId })
    .select("id")
    .single();
  if (error) return { error: t.common.unexpectedError };

  redirect(`/admin/oteller/${hotelId}/odalar/${data.id}`);
}

export async function updateRoomType(roomId: string, hotelId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const fields = roomFields(fd);
  if (!fields.name_tr) return { error: t.admin.nameRequired };

  const supabase = await createClient();
  const { error } = await supabase.from("room_types").update(fields).eq("id", roomId).eq("hotel_id", hotelId);
  if (error) return { error: t.common.unexpectedError };

  revalidatePath(`/admin/oteller/${hotelId}/odalar/${roomId}`);
  return { message: t.common.saved };
}

export async function setRoomActive(roomId: string, hotelId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("room_types").update({ is_active: isActive }).eq("id", roomId).eq("hotel_id", hotelId);
  revalidatePath(`/admin/oteller/${hotelId}/odalar/${roomId}`);
  revalidatePath(`/admin/oteller/${hotelId}`);
}

// ---------------------------------------------------------------- fiyatlar

function ratePeriod(fd: FormData, t: Awaited<ReturnType<typeof getDictionary>>) {
  const validFrom = text(fd, "valid_from");
  const validTo = text(fd, "valid_to");
  if (!validFrom || !validTo || validTo < validFrom) return { error: t.hotels.invalidPeriod };
  return { validFrom, validTo, currency: text(fd, "currency").toUpperCase() || "EUR" };
}

const parsePrice = (raw: string) => (raw ? Number(raw.replace(/\s/g, "").replace(",", ".")) : null);

/** Bir dönem için her kişi sayısının fiyatını tek seferde ekler; boş bırakılan kişi sayıları atlanır. */
export async function createRates(roomId: string, hotelId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const period = ratePeriod(fd, t);
  if ("error" in period) return period;
  const clinicId = optional(fd, "clinic_id");

  const rows = [];
  for (let occupancy = 1; occupancy <= 10; occupancy++) {
    const price = parsePrice(text(fd, `price_${occupancy}`));
    if (price === null) continue;
    if (!Number.isFinite(price) || price < 0) return { error: t.hotels.invalidPrice };
    rows.push({
      room_type_id: roomId,
      clinic_id: clinicId,
      occupancy,
      price,
      currency: period.currency,
      valid_from: period.validFrom,
      valid_to: period.validTo,
    });
  }
  if (!rows.length) return { error: t.hotels.priceRequired };

  const supabase = await createClient();
  const { error } = await supabase.from("room_rates").insert(rows);
  if (error) {
    return { error: error.code === "23P01" ? t.hotels.rateOverlap : t.common.unexpectedError };
  }

  revalidatePath(`/admin/oteller/${hotelId}/odalar/${roomId}`);
  revalidatePath(`/admin/oteller/${hotelId}`);
  return { message: t.common.saved };
}

/** Mevcut bir fiyat döneminin tarihlerini ve fiyatını değiştirir. */
export async function updateRate(rateId: string, roomId: string, hotelId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const period = ratePeriod(fd, t);
  if ("error" in period) return period;
  const price = parsePrice(text(fd, "price"));
  if (price === null || !Number.isFinite(price) || price < 0) return { error: t.hotels.invalidPrice };

  const supabase = await createClient();
  const { error } = await supabase
    .from("room_rates")
    .update({ price, currency: period.currency, valid_from: period.validFrom, valid_to: period.validTo })
    .eq("id", rateId)
    .eq("room_type_id", roomId);
  if (error) {
    return { error: error.code === "23P01" ? t.hotels.rateOverlap : t.common.unexpectedError };
  }

  revalidatePath(`/admin/oteller/${hotelId}/odalar/${roomId}`);
  revalidatePath(`/admin/oteller/${hotelId}`);
  return { message: t.common.saved };
}

export async function deleteRate(rateId: string, roomId: string, hotelId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("room_rates").delete().eq("id", rateId).eq("room_type_id", roomId);
  revalidatePath(`/admin/oteller/${hotelId}/odalar/${roomId}`);
  revalidatePath(`/admin/oteller/${hotelId}`);
}

// ---------------------------------------------------------------- görseller

function imagesPath(hotelId: string, roomTypeId: string | null) {
  return roomTypeId ? `/admin/oteller/${hotelId}/odalar/${roomTypeId}` : `/admin/oteller/${hotelId}`;
}

/** Tarayıcının depoya yüklediği görseli kaydeder. */
export async function registerImage(hotelId: string, roomTypeId: string | null, storagePath: string) {
  await requireAdmin();
  const prefix = `hotels/${hotelId}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) return;

  const supabase = await createClient();
  let query = supabase.from("hotel_images").select("sort_order").eq("hotel_id", hotelId);
  query = roomTypeId ? query.eq("room_type_id", roomTypeId) : query.is("room_type_id", null);
  const { data: existing } = await query.order("sort_order", { ascending: false }).limit(1);
  const isFirst = !existing?.length;

  await supabase.from("hotel_images").insert({
    hotel_id: hotelId,
    room_type_id: roomTypeId,
    storage_path: storagePath,
    sort_order: isFirst ? 0 : existing[0].sort_order + 1,
    is_cover: isFirst,
  });
  revalidatePath(imagesPath(hotelId, roomTypeId));
}

async function siblings(imageId: string) {
  const supabase = await createClient();
  const { data: image } = await supabase.from("hotel_images").select("*").eq("id", imageId).maybeSingle();
  if (!image) return null;
  let query = supabase.from("hotel_images").select("id, sort_order, is_cover, storage_path").eq("hotel_id", image.hotel_id);
  query = image.room_type_id ? query.eq("room_type_id", image.room_type_id) : query.is("room_type_id", null);
  const { data: all } = await query.order("sort_order");
  return { supabase, image, all: all ?? [] };
}

export async function setCoverImage(imageId: string) {
  await requireAdmin();
  const ctx = await siblings(imageId);
  if (!ctx) return;
  await ctx.supabase
    .from("hotel_images")
    .update({ is_cover: false })
    .in(
      "id",
      ctx.all.map((i) => i.id),
    );
  await ctx.supabase.from("hotel_images").update({ is_cover: true }).eq("id", imageId);
  revalidatePath(imagesPath(ctx.image.hotel_id, ctx.image.room_type_id));
}

export async function moveImage(imageId: string, direction: -1 | 1) {
  await requireAdmin();
  const ctx = await siblings(imageId);
  if (!ctx) return;
  const order = ctx.all.map((i) => i.id);
  const index = order.indexOf(imageId);
  const target = index + direction;
  if (target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  await Promise.all(order.map((id, i) => ctx.supabase.from("hotel_images").update({ sort_order: i }).eq("id", id)));
  revalidatePath(imagesPath(ctx.image.hotel_id, ctx.image.room_type_id));
}

export async function deleteImage(imageId: string) {
  await requireAdmin();
  const ctx = await siblings(imageId);
  if (!ctx) return;
  if (!isBundledImage(ctx.image.storage_path)) await ctx.supabase.storage.from(IMAGE_BUCKET).remove([ctx.image.storage_path]);
  await ctx.supabase.from("hotel_images").delete().eq("id", imageId);
  if (ctx.image.is_cover) {
    const next = ctx.all.find((i) => i.id !== imageId);
    if (next) await ctx.supabase.from("hotel_images").update({ is_cover: true }).eq("id", next.id);
  }
  revalidatePath(imagesPath(ctx.image.hotel_id, ctx.image.room_type_id));
}

// ---------------------------------------------------------------- klinik–otel erişimi

export async function setClinicHotelAccess(clinicId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const selected = new Set(fd.getAll("hotel_id").map(String));
  const supabase = await createClient();

  const { data: current } = await supabase.from("clinic_hotel_access").select("hotel_id").eq("clinic_id", clinicId);
  const existing = new Set((current ?? []).map((r) => r.hotel_id as string));
  const toAdd = [...selected].filter((id) => !existing.has(id));
  const toRemove = [...existing].filter((id) => !selected.has(id));

  if (toAdd.length) {
    const { error } = await supabase.from("clinic_hotel_access").insert(toAdd.map((hotel_id) => ({ clinic_id: clinicId, hotel_id })));
    if (error) return { error: t.common.unexpectedError };
  }
  if (toRemove.length) {
    const { error } = await supabase.from("clinic_hotel_access").delete().eq("clinic_id", clinicId).in("hotel_id", toRemove);
    if (error) return { error: t.common.unexpectedError };
  }

  revalidatePath(`/admin/klinikler/${clinicId}`);
  return { message: t.common.saved };
}
