import type { NextRequest } from "next/server";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { monthDays } from "@/lib/dates";
import { fetchMonthReservations } from "@/lib/summary-data";
import { monthWorkbook, xlsxResponse } from "@/lib/summary-export";

export async function GET(request: NextRequest) {
  await requireClinicUser();
  const t = await getDictionary();
  const { month } = monthDays(request.nextUrl.searchParams.get("ay") ?? undefined);
  // RLS sadece bu kliniğin rezervasyonlarını döndürür.
  const rows = await fetchMonthReservations(await createClient(), month);
  return xlsxResponse(monthWorkbook(rows, t, false), `asklepios-ozet-${month}.xlsx`);
}
