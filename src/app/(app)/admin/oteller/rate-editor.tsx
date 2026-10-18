import type { Dictionary } from "@/i18n/dictionaries";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { CurrencySelect } from "./components";
import { createRates, deleteRate, updateRate } from "./actions";

type Rate = { id: string; occupancy: number; price: number; currency: string; valid_from: string; valid_to: string; clinics: unknown };

/** Oda fiyatları: bir dönem için tüm kişi sayılarını tek formda ekleme ve mevcut dönemleri yerinde düzenleme. */
export function RateEditor({
  roomId,
  hotelId,
  occupancies,
  rates,
  clinics,
  t,
}: {
  roomId: string;
  hotelId: string;
  occupancies: number[];
  rates: Rate[];
  clinics: { id: string; name: string }[];
  t: Dictionary;
}) {
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="font-semibold">{t.hotels.rates}</h2>
      <p className="mt-1 text-sm text-muted">{t.hotels.ratesIntro}</p>

      <div className="mt-4 rounded-lg border border-line bg-sky/40 p-4">
        <h3 className="mb-3 text-sm font-semibold">{t.hotels.newRate}</h3>
        <ActionForm action={createRates.bind(null, roomId, hotelId)} resetOnSuccess className="space-y-3">
          <>
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="text-xs font-medium">{t.hotels.validFrom}</span>
                  <input name="valid_from" type="date" required className="input mt-1" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium">{t.hotels.validTo}</span>
                  <input name="valid_to" type="date" required className="input mt-1" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium">{t.hotels.currency}</span>
                  <CurrencySelect />
                </label>
                <label className="block">
                  <span className="text-xs font-medium">{t.hotels.rateClinic}</span>
                  <select name="clinic_id" className="input mt-1">
                    <option value="">{t.hotels.allClinics}</option>
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset>
                <legend className="text-xs font-medium">{t.hotels.pricePerOccupancy}</legend>
                <div className="mt-1 grid gap-3 sm:grid-cols-3">
                  {occupancies.map((o) => (
                    <label key={o} className="block">
                      <span className="text-xs text-muted">{t.hotels.occupancyLabels[o] ?? `${o} ${t.hotels.occupancy}`}</span>
                      <input name={`price_${o}`} inputMode="decimal" placeholder="0,00" className="input mt-1" />
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">{t.hotels.priceBlankHint}</p>
              </fieldset>
              <SubmitButton className="btn-primary">{t.hotels.addRates}</SubmitButton>
            </>
          </>
        </ActionForm>
      </div>

      <div className="mt-6 space-y-2">
        <div className="hidden grid-cols-[1fr_1fr_1fr_1.4fr_1.2fr_auto] gap-2 px-1 text-xs font-medium text-muted lg:grid">
          <span>{t.hotels.validFrom}</span>
          <span>{t.hotels.validTo}</span>
          <span>{t.hotels.occupancy}</span>
          <span>{t.hotels.price}</span>
          <span>{t.hotels.rateClinic}</span>
          <span />
        </div>
        {rates.map((r) => (
          <div key={r.id} className="rounded-lg border border-line p-2">
            <ActionForm
              action={updateRate.bind(null, r.id, roomId, hotelId)}
              className="grid items-center gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_1.2fr_auto]"
            >
              <>
                <>
                  <input
                    name="valid_from"
                    type="date"
                    required
                    defaultValue={r.valid_from}
                    aria-label={t.hotels.validFrom}
                    className="input"
                  />
                  <input name="valid_to" type="date" required defaultValue={r.valid_to} aria-label={t.hotels.validTo} className="input" />
                  <span className="text-sm">{t.hotels.occupancyLabels[r.occupancy] ?? r.occupancy}</span>
                  <div className="flex gap-1">
                    <input
                      name="price"
                      inputMode="decimal"
                      required
                      defaultValue={String(r.price)}
                      aria-label={t.hotels.price}
                      className="input"
                    />
                    <CurrencySelect defaultValue={r.currency} className="input w-24" />
                  </div>
                  <span className="text-sm">{(r.clinics as unknown as { name: string } | null)?.name ?? t.hotels.allClinics}</span>
                  <SubmitButton className="btn-secondary px-3 py-1.5 text-sm">{t.common.save}</SubmitButton>
                </>
              </>
            </ActionForm>
            <form action={deleteRate.bind(null, r.id, roomId, hotelId)} className="mt-1 text-right">
              <button type="submit" className="text-xs text-red-700 hover:underline">
                {t.hotels.delete}
              </button>
            </form>
          </div>
        ))}
        {!rates.length && <p className="text-sm text-muted">{t.hotels.noRates}</p>}
      </div>
    </section>
  );
}
