"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";
import { deleteImage, moveImage, registerImage, setCoverImage } from "./actions";

type Image = { id: string; url: string | null; is_cover: boolean };

const MAX_SIDE = 1600;

/** Görseli tarayıcıda küçültüp WebP'ye çevirir; sayfalar klinik tarafında hızlı açılır. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/webp", 0.82),
  );
}

export function ImageManager({
  hotelId,
  roomTypeId,
  images,
  t,
}: {
  hotelId: string;
  roomTypeId: string | null;
  images: Image[];
  t: Dictionary["hotels"];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const blob = await shrink(file);
        const path = `hotels/${hotelId}/${roomTypeId ? `rooms/${roomTypeId}/` : ""}${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("hotel-images")
          .upload(path, blob, { contentType: "image/webp" });
        if (uploadError) throw uploadError;
        await registerImage(hotelId, roomTypeId, path);
      }
    } catch {
      setError(t.uploadFailed);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  const run = (fn: () => Promise<void>) => startTransition(async () => fn());

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label className="btn-secondary cursor-pointer">
          {uploading ? t.uploading : t.uploadImages}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={uploading}
            className="sr-only"
            onChange={(e) => upload(e.target.files)}
          />
        </label>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-slate-500">{t.noImages}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="relative aspect-[4/3] bg-slate-100">
                {image.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                )}
                {image.is_cover && <span className="badge absolute left-2 top-2 bg-teal-700 text-white">{t.cover}</span>}
              </div>
              <div className="flex flex-wrap gap-1 p-2 text-xs">
                {!image.is_cover && (
                  <button type="button" disabled={pending} onClick={() => run(() => setCoverImage(image.id))} className="btn-secondary px-2 py-1 text-xs">
                    {t.makeCover}
                  </button>
                )}
                <button type="button" disabled={pending || index === 0} onClick={() => run(() => moveImage(image.id, -1))} className="btn-secondary px-2 py-1 text-xs" aria-label={t.moveUp}>
                  ←
                </button>
                <button type="button" disabled={pending || index === images.length - 1} onClick={() => run(() => moveImage(image.id, 1))} className="btn-secondary px-2 py-1 text-xs" aria-label={t.moveDown}>
                  →
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => confirm(t.confirmDelete) && run(() => deleteImage(image.id))}
                  className="btn-secondary ml-auto px-2 py-1 text-xs text-red-700"
                >
                  {t.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
