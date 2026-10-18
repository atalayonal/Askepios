"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { AIRPORTS, TRANSFER_LEGS } from "@/lib/transfer";

/**
 * Talebe isteğe bağlı geliş / dönüş transferi. İşaretlenen yönün havalimanı ve uçuş tarihi/saati zorunludur.
 * Tarih, giriş (geliş) ya da çıkış (dönüş) tarihiyle önceden doldurulur.
 */
export function TransferFields({ t, today, checkIn, checkOut }: { t: Dictionary["transfer"]; today: string; checkIn: string; checkOut: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <fieldset className="space-y-3 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{t.title}</legend>
      <p className="text-xs text-muted">{t.intro}</p>
      {TRANSFER_LEGS.map((leg) => {
        const label = leg === "arrival" ? t.arrival : t.departure;
        const timeLabel = leg === "arrival" ? t.arrivalAt : t.departureAt;
        return (
          <div key={leg} className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name={`transfer_${leg}`}
                value="1"
                checked={Boolean(open[leg])}
                onChange={(e) => setOpen((o) => ({ ...o, [leg]: e.target.checked }))}
                className="h-4 w-4 accent-blue"
              />
              {label}
            </label>
            {open[leg] && (
              <div className="grid gap-2 pl-6">
                <label className="block">
                  <span className="text-xs font-medium">{t.airport} *</span>
                  <select name={`transfer_${leg}_airport`} required data-label={`${label}: ${t.airport}`} defaultValue="" className="input mt-1">
                    <option value="" disabled>
                      —
                    </option>
                    {AIRPORTS.map((a) => (
                      <option key={a} value={a}>
                        {t.airports[a]}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend className="text-xs font-medium">{timeLabel} *</legend>
                  <div className="mt-1 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
                    <input
                      // Giriş/çıkış tarihi değişince önceden doldurulan tarih de güncellenir.
                      key={leg === "arrival" ? checkIn : checkOut}
                      name={`transfer_${leg}_date`}
                      type="date"
                      required
                      min={today}
                      defaultValue={leg === "arrival" ? checkIn : checkOut}
                      aria-label={`${timeLabel}: ${t.date}`}
                      data-label={`${label}: ${t.date}`}
                      className="input"
                    />
                    <input
                      name={`transfer_${leg}_time`}
                      type="time"
                      required
                      aria-label={`${timeLabel}: ${t.time}`}
                      data-label={`${label}: ${t.time}`}
                      className="input"
                    />
                  </div>
                </fieldset>
                <label className="block">
                  <span className="text-xs font-medium">{t.flight}</span>
                  <input
                    name={`transfer_${leg}_flight`}
                    maxLength={10}
                    pattern="[A-Za-z0-9 \-]{0,10}"
                    placeholder="TK1234"
                    data-label={`${label}: ${t.flight}`}
                    autoComplete="off"
                    className="input mt-1 uppercase sm:w-40"
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
