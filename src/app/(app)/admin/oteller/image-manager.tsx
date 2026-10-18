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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const uploading = progress !== null;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(files: FileList | File[] | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!list.length || uploading) return;
    setProgress({ done: 0, total: list.length });
    setError(null);
    const supabase = createClient();
    const failed: string[] = [];
    // Bir dosya bozuksa diğerleri yüklenmeye devam eder; sonunda başarısız olanlar listelenir.
    for (const [index, file] of list.entries()) {
      try {
        const blob = await shrink(file);
        const path = `hotels/${hotelId}/${roomTypeId ? `rooms/${roomTypeId}/` : ""}${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage.from("hotel-images").upload(path, blob, { contentType: "image/webp" });
        if (uploadError) throw uploadError;
        await registerImage(hotelId, roomTypeId, path);
      } catch {
        failed.push(file.name);
      }
      setProgress({ done: index + 1, total: list.length });
    }
    if (failed.length) setError(`${t.uploadFailed} ${failed.join(", ")}`);
    setProgress(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  const run = (fn: () => Promise<void>) => startTransition(async () => fn());

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        className={`mb-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition ${
          dragging ? "border-blue bg-sky" : "border-line hover:border-blue hover:bg-sky/50"
        }`}
      >
        <span className="font-medium text-blue">{uploading ? `${t.uploading} ${progress.done}/${progress.total}` : t.uploadImages}</span>
        <span className="text-xs text-muted">{t.dropHint}</span>
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
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {images.length === 0 ? (
        <p className="text-sm text-muted">{t.noImages}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-md border border-line bg-white">
              <div className="relative aspect-[4/3] bg-background">
                {image.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                )}
                {image.is_cover && <span className="badge absolute left-2 top-2 bg-blue text-white">{t.cover}</span>}
              </div>
              <div className="flex flex-wrap gap-1 p-2 text-xs">
                {!image.is_cover && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setCoverImage(image.id))}
                    className="btn-secondary px-2 py-1 text-xs"
                  >
                    {t.makeCover}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending || index === 0}
                  onClick={() => run(() => moveImage(image.id, -1))}
                  className="btn-secondary px-2 py-1 text-xs"
                  aria-label={t.moveUp}
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={pending || index === images.length - 1}
                  onClick={() => run(() => moveImage(image.id, 1))}
                  className="btn-secondary px-2 py-1 text-xs"
                  aria-label={t.moveDown}
                >
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
