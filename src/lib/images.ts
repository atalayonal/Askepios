import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const IMAGE_BUCKET = "hotel-images";

export type ImageRow = { id: string; storage_path: string; sort_order: number; is_cover: boolean };
export type ImageWithUrl = ImageRow & { url: string | null };

/**
 * "/" ile başlayan yollar uygulamayla gelen hazır görsellerdir (public/otel-gorselleri);
 * bunlar da sadece giriş yapmış kullanıcılara açıktır (src/proxy.ts).
 */
export const isBundledImage = (storagePath: string) => storagePath.startsWith("/");

/** Özel depodaki görseller için 1 saat geçerli imzalı adresler üretir; hazır görsellerin adresi yolun kendisidir. */
export async function withSignedUrls<T extends ImageRow>(supabase: SupabaseClient, images: T[]): Promise<(T & { url: string | null })[]> {
  if (images.length === 0) return [];
  const stored = images.filter((i) => !isBundledImage(i.storage_path));
  const byPath = new Map<string, string>();
  if (stored.length) {
    const { data } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(
      stored.map((i) => i.storage_path),
      60 * 60,
    );
    for (const d of data ?? []) if (d.path && d.signedUrl) byPath.set(d.path, d.signedUrl);
  }
  return images.map((i) => ({ ...i, url: isBundledImage(i.storage_path) ? i.storage_path : (byPath.get(i.storage_path) ?? null) }));
}
