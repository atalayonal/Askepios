"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { createReservation, quote, type Quote, type RequestState } from "../../actions";
import { GuestFields } from "./guest-fields";
import { TransferFields } from "./transfer-fields";

type Room = { id: string; name: string; maxOccupancy: number };

function money(amount: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency }).format(amount);
}

export function ReservationForm({
  rooms,
  initialRoomId,
  t,
  kvkk,
  transfer,
  locale,
  today,
}: {
  rooms: Room[];
  initialRoomId?: string;
  t: Dictionary["clinic"];
  kvkk: Dictionary["kvkk"];
  transfer: Dictionary["transfer"];
  locale: Locale;
  today: string;
}) {
  const [state, action, submitting] = useActionState<RequestState, FormData>(createReservation, {});
  const [roomId, setRoomId] = useState(initialRoomId ?? rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [result, setResult] = useState<Quote | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [blocker, setBlocker] = useState("");
  const [attempted, setAttempted] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const room = rooms.find((r) => r.id === roomId);
  const maxGuests = room?.maxOccupancy ?? 1;
  const ready = Boolean(roomId && checkIn && checkOut);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const q = await quote(roomId, checkIn, checkOut, guestCount);
      if (!cancelled) setResult(q);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, roomId, checkIn, checkOut, guestCount]);

  const shownResult = ready ? result : null;

  // Sunucudan hata dönerse uyarı görünür hale getirilir.
  useEffect(() => {
    if (state.error) alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  return (
    <form
      action={action}
      noValidate
      className="space-y-4"
      data-attempted={attempted || undefined}
      onSubmit={(e) => {
        // Eksik ya da hatalı alanlar kırmızıyla işaretlenir, düğmenin üstünde listelenir ve ilk alana gidilir.
        setAttempted(true);
        const invalid = [...e.currentTarget.elements].filter(
          (el): el is HTMLInputElement => "validity" in el && !(el as HTMLInputElement).validity.valid,
        );
        setMissing([...new Set(invalid.map((el) => el.dataset.label ?? el.name).filter(Boolean))]);
        // Tarihler tamamsa ama müsaitlik/fiyat uygun değilse ya da henüz hesaplanmadıysa talep gönderilmez.
        const quoteProblem = !ready || shownResult?.ok ? "" : shownResult ? (t.errors[shownResult.reason] ?? shownResult.reason) : t.quotePending;
        setBlocker(quoteProblem);
        if (invalid.length) {
          e.preventDefault();
          invalid[0].focus();
          invalid[0].reportValidity();
        } else if (quoteProblem) {
          e.preventDefault();
          quoteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          quoteRef.current?.focus();
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">{t.room}</span>
          <select
            name="room_type_id"
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              setGuestCount(1);
            }}
            className="input mt-1"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.checkIn}</span>
          <input name="check_in" type="date" required data-label={t.checkIn} min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="input mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.checkOut}</span>
          <input
            name="check_out"
            type="date"
            required
            data-label={t.checkOut}
            min={checkIn || today}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.guestCount}</span>
          <select name="guest_count" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} className="input mt-1">
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {shownResult && (
        <div
          ref={quoteRef}
          tabIndex={-1}
          className={`rounded-lg px-4 py-3 text-sm outline-none ${
            shownResult.ok ? "bg-success-soft text-success" : blocker ? "bg-red-50 font-medium text-red-700 ring-2 ring-red-300" : "bg-amber-soft text-foreground"
          }`}
          aria-live="polite"
        >
          {shownResult.ok ? (
            <>
              <p className="font-medium">{t.available}</p>
              <p className="mt-1">
                {shownResult.nights.length} {t.nights} ·{" "}
                {[...new Set(shownResult.nights.map((n) => n.price))].map((p) => money(p, shownResult.currency, locale)).join(" / ")} {t.perNight}
              </p>
              <p className="mt-1 text-lg font-extrabold text-foreground">
                {t.total}: {money(shownResult.total, shownResult.currency, locale)}
              </p>
            </>
          ) : (
            <p>{t.errors[shownResult.reason] ?? shownResult.reason}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm text-muted">{t.guestInfoIntro}</p>
        {Array.from({ length: guestCount }, (_, i) => (
          <GuestFields key={i} index={i} t={t} locale={locale} today={today} />
        ))}
      </div>

      <TransferFields t={transfer} today={today} checkIn={checkIn} checkOut={checkOut} />

      <label className="block">
        <span className="text-sm font-medium">{t.notes}</span>
        <textarea name="notes" rows={3} className="input mt-1" />
      </label>

      <label className="flex items-start gap-2 rounded-lg bg-background p-3 text-sm">
        <input name="consent" type="checkbox" value="1" required data-label={kvkk.consentFieldLabel} className="mt-0.5 h-4 w-4 flex-none accent-blue" />
        <span>
          {kvkk.consentLabel}{" "}
          <a href="/kvkk" target="_blank" className="font-semibold text-blue hover:underline">
            {kvkk.readNotice}
          </a>
          <span className="mt-1 block text-xs text-muted">{kvkk.retentionNote}</span>
        </span>
      </label>

      {(missing.length > 0 || blocker || state.error) && (
        <div ref={alertRef} role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-semibold">{t.notSent}</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
            {blocker && <li>{blocker}</li>}
            {state.error && <li>{state.error}</li>}
          </ul>
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-base">
        {t.submit}
      </button>
    </form>
  );
}
