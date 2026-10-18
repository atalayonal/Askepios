import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { monthDays } from "@/lib/dates";
import { fetchMonthReservations } from "@/lib/summary-data";
import { monthWorkbook, xlsxResponse } from "@/lib/summary-export";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: NextRequest) {
  await requireAdmin();
  const t = await getDictionary();
  const params = request.nextUrl.searchParams;
  const { month } = monthDays(params.get("ay") ?? undefined);
  const clinic = UUID.test(params.get("klinik") ?? "") ? params.get("klinik")! : undefined;
  const rows = await fetchMonthReservations(await createClient(), month, clinic);
  return xlsxResponse(monthWorkbook(rows, t, true), `asklepios-ozet-${month}.xlsx`);
}
