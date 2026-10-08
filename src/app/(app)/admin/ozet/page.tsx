import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { monthDays } from "@/lib/dates";
import { fetchMonthReservations } from "@/lib/summary-data";
import { MonthlySummary, MonthPicker } from "@/components/monthly-summary";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AdminSummaryPage({ searchParams }: PageProps<"/admin/ozet">) {
  await requireAdmin();
  const t = await getDictionary();
  const locale = await getLocale();
  const params = await searchParams;
  const { month } = monthDays(typeof params.ay === "string" ? params.ay : undefined);
  const clinic = typeof params.klinik === "string" && UUID.test(params.klinik) ? params.klinik : "";
  const supabase = await createClient();
  const [rows, { data: clinics }] = await Promise.all([
    fetchMonthReservations(supabase, month, clinic || undefined),
    supabase.from("clinics").select("id, name").order("name"),
  ]);
  const href = (m: string, c = clinic) => `/admin/ozet?ay=${m}${c ? `&klinik=${c}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="page-title">{t.ui.summaryTitle}</h1>
          <p className="mt-1 text-sm text-muted">{t.ui.summaryIntro}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <form className="flex items-center gap-2">
            <input type="hidden" name="ay" value={month} />
            <select name="klinik" defaultValue={clinic} className="input w-auto" aria-label={t.nav.clinics}>
              <option value="">{t.reservations.allClinics}</option>
              {(clinics ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              {t.reservations.filter}
            </button>
          </form>
          <MonthPicker month={month} href={(m) => href(m)} locale={locale} t={t} />
        </div>
      </div>
      <MonthlySummary rows={rows} t={t} locale={locale} admin hrefBase="/admin/rezervasyonlar" />
    </div>
  );
}
