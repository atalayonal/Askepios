"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

type Photo = { id: string; url: string };
type Labels = { showAll: string; close: string; previous: string; next: string; photos: string };

/** Tam ekran görsel gezgini: ok tuşları ve Esc ile çalışır. */
function Lightbox({ photos, index, onClose, onMove, labels }: { photos: Photo[]; index: number; onClose: () => void; onMove: (i: number) => void; labels: Labels }) {
  const move = useCallback((step: number) => onMove((index + step + photos.length) % photos.length), [index, onMove, photos.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [move, onClose]);

  const photo = photos[index];
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-navy-deep/95 text-white" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span>
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label={labels.close} autoFocus>
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => move(-1)} aria-label={labels.previous} className="absolute left-4 rounded-full bg-white/15 p-3 hover:bg-white/25">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => move(1)} aria-label={labels.next} className="absolute right-4 rounded-full bg-white/15 p-3 hover:bg-white/25">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <button key={p.id} type="button" onClick={() => onMove(i)} className={`h-14 w-20 flex-none overflow-hidden rounded ${i === index ? "ring-2 ring-amber" : "opacity-60 hover:opacity-100"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Otel sayfasının üstündeki görsel mozaiği: bir büyük, dört küçük görsel. */
export function HotelMosaic({ photos, labels }: { photos: Photo[]; labels: Labels }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  const shown = photos.slice(0, 5);
  // Beşten az görselde küçük kutular boşluk kalmayacak şekilde genişler.
  const smallClass = (i: number) => {
    const n = shown.length - 1;
    if (n === 1) return "sm:col-span-2 sm:row-span-2";
    if (n === 2) return "sm:col-span-2";
    if (n === 3 && i === 3) return "sm:col-span-2";
    return "";
  };

  return (
    <>
      <div className="grid h-72 grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl sm:h-96">
        {shown.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            className={`relative overflow-hidden bg-background ${i === 0 ? `col-span-4 row-span-2 ${shown.length === 1 ? "" : "sm:col-span-2"}` : `hidden sm:block ${smallClass(i)}`}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]" />
            {i === shown.length - 1 && (
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-semibold text-foreground">
                <Images aria-hidden className="h-4 w-4" />
                {labels.showAll} ({photos.length})
              </span>
            )}
          </button>
        ))}
      </div>
      {open !== null && <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} onMove={setOpen} labels={labels} />}
    </>
  );
}

/** Oda satırındaki küçük görsel; tıklanınca odanın tüm görselleri açılır. */
export function RoomPhotos({ photos, labels }: { photos: Photo[]; labels: Labels }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return <div className="aspect-[4/3] w-full rounded-lg bg-background" />;

  return (
    <>
      <button type="button" onClick={() => setOpen(0)} className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[0].url} alt="" className="h-full w-full object-cover" />
        {photos.length > 1 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-navy-deep/80 px-2 py-0.5 text-xs font-semibold text-white">
            <Images aria-hidden className="h-3.5 w-3.5" />
            {photos.length} {labels.photos}
          </span>
        )}
      </button>
      {open !== null && <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} onMove={setOpen} labels={labels} />}
    </>
  );
}
