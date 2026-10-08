import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { ReservationTable } from "@/components/reservation-table";

export default async function ClinicReservationsPage() {
  await requireClinicUser();
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("id, reference, hotel_name, room_name, check_in, check_out, guest_count, total_price, currency, status")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="page-title">{t.clinic.myReservations}</h1>
      <div className="card overflow-hidden">
        <ReservationTable items={data ?? []} hrefBase="/klinik/rezervasyonlar" t={t} locale={locale} />
      </div>
    </div>
  );
}
