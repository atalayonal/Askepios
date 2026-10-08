import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { monthDays } from "@/lib/dates";
import { fetchMonthReservations } from "@/lib/summary-data";
import { MonthlySummary, MonthPicker } from "@/components/monthly-summary";

export default async function ClinicSummaryPage({ searchParams }: PageProps<"/klinik/ozet">) {
  const user = await requireClinicUser();
  const t = await getDictionary();
  const locale = await getLocale();
  const { ay } = await searchParams;
  const { month } = monthDays(typeof ay === "string" ? ay : undefined);
  const supabase = await createClient();
  const rows = await fetchMonthReservations(supabase, month);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="page-title">{t.ui.summaryTitle}</h1>
          <p className="mt-1 text-sm text-muted">
            {user.clinicName} · {t.ui.summaryIntro}
          </p>
        </div>
        <div className="ml-auto">
          <MonthPicker month={month} href={(m) => `/klinik/ozet?ay=${m}`} locale={locale} t={t} />
        </div>
      </div>
      <MonthlySummary rows={rows} t={t} locale={locale} admin={false} hrefBase="/klinik/rezervasyonlar" />
    </div>
  );
}
