"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";
import { setAvailability } from "./actions";

export type GridRow = {
  roomId: string;
  hotelName: string;
  roomName: string;
  closed: string[];
  pending: Record<string, number>;
  confirmed: Record<string, number>;
};

type Cell = { row: number; day: number };

export function AvailabilityGrid({
  days,
  rows,
  weekdayLabels,
  t,
  errorText,
}: {
  days: string[];
  rows: GridRow[];
  weekdayLabels: string[];
  t: Dictionary["availability"];
  errorText: string;
}) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [end, setEnd] = useState<Cell | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const closedSets = rows.map((r) => new Set(r.closed));
  const selection =
    anchor && end
      ? {
          rows: [Math.min(anchor.row, end.row), Math.max(anchor.row, end.row)] as const,
          days: [Math.min(anchor.day, end.day), Math.max(anchor.day, end.day)] as const,
        }
      : anchor
        ? { rows: [anchor.row, anchor.row] as const, days: [anchor.day, anchor.day] as const }
        : null;

  const isSelected = (row: number, day: number) =>
    selection !== null && row >= selection.rows[0] && row <= selection.rows[1] && day >= selection.days[0] && day <= selection.days[1];

  function click(cell: Cell) {
    if (!anchor || end) {
      setAnchor(cell);
      setEnd(null);
    } else {
      setEnd(cell);
    }
  }

  function clear() {
    setAnchor(null);
    setEnd(null);
    setNote("");
  }

  function apply(available: boolean) {
    if (!selection) return;
    const roomIds = rows.slice(selection.rows[0], selection.rows[1] + 1).map((r) => r.roomId);
    startTransition(async () => {
      const result = await setAvailability(roomIds, days[selection.days[0]], days[selection.days[1]], available, note);
      setError(!result.ok);
      if (result.ok) clear();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="card overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-48 border-b border-slate-200 bg-white px-3 py-2 text-left font-medium text-slate-500">
                {t.room}
              </th>
              {days.map((day) => {
                const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
                return (
                  <th key={day} className={`border-b border-slate-200 px-0.5 py-1 font-medium ${weekday === 0 || weekday === 6 ? "text-slate-400" : "text-slate-600"}`}>
                    <div>{Number(day.slice(8))}</div>
                    <div className="font-normal">{weekdayLabels[weekday]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.roomId}>
                <th className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-1 text-left font-normal">
                  <div className="font-medium text-slate-900">{row.hotelName}</div>
                  <div className="text-slate-500">{row.roomName}</div>
                </th>
                {days.map((day, d) => {
                  const closed = closedSets[r].has(day);
                  const selected = isSelected(r, d);
                  const p = row.pending[day] ?? 0;
                  const c = row.confirmed[day] ?? 0;
                  return (
                    <td key={day} className="border-b border-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => click({ row: r, day: d })}
                        title={`${row.hotelName} · ${day} · ${closed ? t.closed : t.available}`}
                        className={`relative flex h-8 w-8 items-center justify-center rounded ${
                          selected ? "ring-2 ring-teal-600" : ""
                        } ${closed ? "bg-rose-100 text-rose-700" : "bg-emerald-50 hover:bg-emerald-100"}`}
                      >
                        {closed && "×"}
                        {(p > 0 || c > 0) && (
                          <span className="absolute bottom-0.5 flex gap-0.5">
                            {c > 0 && <span className="h-1.5 w-1.5 rounded-full bg-teal-700" />}
                            {p > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-50 ring-1 ring-emerald-200" /> {t.available}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-rose-100" /> {t.closed}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> {t.pendingLegend}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-teal-700" /> {t.confirmedLegend}
        </span>
      </div>

      {selection && (
        <div className="card sticky bottom-4 flex flex-wrap items-end gap-3 p-4">
          <div className="text-sm">
            <div className="font-medium">{t.selection}</div>
            <div className="text-slate-600">
              {selection.rows[1] - selection.rows[0] + 1} {t.roomsSelected} · {days[selection.days[0]]} → {days[selection.days[1]]}
            </div>
          </div>
          <label className="block min-w-48 flex-1">
            <span className="text-xs font-medium">{t.note}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input mt-1" />
          </label>
          <button type="button" disabled={pending} onClick={() => apply(false)} className="btn-primary bg-rose-700 hover:bg-rose-800">
            {t.close}
          </button>
          <button type="button" disabled={pending} onClick={() => apply(true)} className="btn-primary">
            {t.open}
          </button>
          <button type="button" disabled={pending} onClick={clear} className="btn-secondary">
            {t.clear}
          </button>
          {error && <p className="w-full text-sm text-red-700">{errorText}</p>}
        </div>
      )}
    </div>
  );
}
