import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const IMAGE_BUCKET = "hotel-images";

export type ImageRow = { id: string; storage_path: string; sort_order: number; is_cover: boolean };
export type ImageWithUrl = ImageRow & { url: string | null };

/** Özel depodaki görseller için 1 saat geçerli imzalı adresler üretir. */
export async function withSignedUrls(supabase: SupabaseClient, images: ImageRow[]): Promise<ImageWithUrl[]> {
  if (images.length === 0) return [];
  const { data } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(
    images.map((i) => i.storage_path),
    60 * 60,
  );
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return images.map((i) => ({ ...i, url: byPath.get(i.storage_path) ?? null }));
}
