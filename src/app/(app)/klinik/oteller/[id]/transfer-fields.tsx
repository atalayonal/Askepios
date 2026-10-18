"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { AIRPORTS, TRANSFER_LEGS } from "@/lib/transfer";

/** Talebe isteğe bağlı geliş / dönüş transferi. İşaretlenen yönün havalimanı ve uçuş saati zorunludur. */
export function TransferFields({ t, today }: { t: Dictionary["transfer"]; today: string }) {
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
              <div className="grid gap-2 pl-6 sm:grid-cols-2">
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
                <label className="block">
                  <span className="text-xs font-medium">{timeLabel} *</span>
                  <input
                    name={`transfer_${leg}_at`}
                    type="datetime-local"
                    required
                    min={`${today}T00:00`}
                    data-label={`${label}: ${timeLabel}`}
                    className="input mt-1"
                  />
                </label>
                <label className="block sm:col-span-2">
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
