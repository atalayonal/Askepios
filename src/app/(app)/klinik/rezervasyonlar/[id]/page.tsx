import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { ReservationDetail } from "@/components/reservation-detail";

export default async function ClinicReservationPage({ params, searchParams }: PageProps<"/klinik/rezervasyonlar/[id]">) {
  await requireClinicUser();
  const { id } = await params;
  const { yeni } = await searchParams;
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();

  // RLS başka kliniğin rezervasyonunu döndürmez; bu durumda 404.
  const { data: reservation } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
  if (!reservation) notFound();

  const [{ data: guests }, { data: history }] = await Promise.all([
    supabase.from("reservation_guests").select("position, full_name, nationality, phone").eq("reservation_id", id).order("position"),
    supabase.from("reservation_status_history").select("id, from_status, to_status, note, changed_at").eq("reservation_id", id).order("changed_at"),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/klinik/rezervasyonlar" className="back-link">
        ← {t.clinic.myReservations}
      </Link>
      {yeni && <p className="rounded-md bg-sky px-3 py-2 text-sm text-navy">{t.clinic.submitted}</p>}
      <ReservationDetail reservation={reservation} guests={guests ?? []} history={history ?? []} t={t} locale={locale} />
    </div>
  );
}
