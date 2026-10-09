"use client";

import { useActionState, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { createReservation, quote, type Quote, type RequestState } from "../../actions";

type Room = { id: string; name: string; maxOccupancy: number };

function money(amount: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency }).format(amount);
}

export function ReservationForm({
  rooms,
  initialRoomId,
  t,
  locale,
  today,
}: {
  rooms: Room[];
  initialRoomId?: string;
  t: Dictionary["clinic"];
  locale: Locale;
  today: string;
}) {
  const [state, action, submitting] = useActionState<RequestState, FormData>(createReservation, {});
  const [roomId, setRoomId] = useState(initialRoomId ?? rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [result, setResult] = useState<Quote | null>(null);

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

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
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
          <input name="check_in" type="date" required min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="input mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.checkOut}</span>
          <input
            name="check_out"
            type="date"
            required
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
        <div className={`rounded-lg px-4 py-3 text-sm ${shownResult.ok ? "bg-success-soft text-success" : "bg-amber-soft text-foreground"}`} aria-live="polite">
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

      <fieldset className="space-y-3">
        {Array.from({ length: guestCount }, (_, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-line p-3">
            <legend className="sr-only">
              {t.guest} {i + 1}
            </legend>
            <label className="block">
              <span className="text-xs font-medium">
                {t.guest} {i + 1} · {t.guestName}
              </span>
              <input name={`guest_${i}_name`} required className="input mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-medium">{t.nationality}</span>
              <input name={`guest_${i}_nationality`} className="input mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-medium">{t.phone}</span>
              <input name={`guest_${i}_phone`} type="tel" className="input mt-1" />
            </label>
          </div>
        ))}
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium">{t.notes}</span>
        <textarea name="notes" rows={3} className="input mt-1" />
      </label>

      <button type="submit" disabled={submitting || !shownResult?.ok} className="btn-primary w-full py-3 text-base">
        {t.submit}
      </button>
    </form>
  );
}
