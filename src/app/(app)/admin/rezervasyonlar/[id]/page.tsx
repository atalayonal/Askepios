import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { ReservationDetail } from "@/components/reservation-detail";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { DecisionPanel } from "@/components/decision";
import { AdminChangeRequest, CHANGE_REQUEST_COLUMNS, ChangeRequestList, type ChangeRequest } from "@/components/change-requests";
import { GUEST_DETAIL_COLUMNS } from "@/lib/reservation-guests";
import { addInternalNote, setHotelConfirmationNo } from "../actions";

export default async function AdminReservationPage({ params }: PageProps<"/admin/rezervasyonlar/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: reservation } = await supabase.from("reservations").select("*, clinics(name)").eq("id", id).maybeSingle();
  if (!reservation) notFound();

  const [{ data: guests }, { data: history }, { data: notes }, { data: creator }, { data: requests }] = await Promise.all([
    supabase.from("reservation_guests").select(GUEST_DETAIL_COLUMNS).eq("reservation_id", id).order("position"),
    supabase
      .from("reservation_status_history")
      .select("id, from_status, to_status, note, changed_at, profiles(full_name)")
      .eq("reservation_id", id)
      .order("changed_at"),
    supabase.from("reservation_admin_notes").select("id, body, created_at, profiles(full_name)").eq("reservation_id", id).order("created_at"),
    supabase.from("profiles").select("full_name").eq("id", reservation.created_by).maybeSingle(),
    supabase.from("reservation_change_requests").select(CHANGE_REQUEST_COLUMNS).eq("reservation_id", id).order("created_at", { ascending: false }),
  ]);
  const changeRequests = (requests ?? []) as ChangeRequest[];
  const openRequest = changeRequests.find((r) => r.status === "OPEN");

  const historyWithNames = (history ?? []).map((h) => ({
    ...h,
    changed_by_name: (h.profiles as unknown as { full_name: string } | null)?.full_name,
  }));
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso));

  return (
    <div className="space-y-4">
      <Link href="/admin/rezervasyonlar" className="back-link">
        <ChevronLeft aria-hidden className="h-4 w-4" />
        {t.reservations.title}
      </Link>

      {openRequest && <AdminChangeRequest request={openRequest} reservationId={reservation.id} t={t} />}
      <DecisionPanel reservationId={reservation.id} status={reservation.status} t={t} />

      <ReservationDetail
        reservation={reservation}
        guests={guests ?? []}
        history={historyWithNames}
        t={t}
        locale={locale}
        clinicName={`${(reservation.clinics as unknown as { name: string }).name}${creator ? ` · ${creator.full_name}` : ""}`}
        voucherHref={`/belge/${reservation.id}`}
      />

      <ChangeRequestList requests={changeRequests} t={t} locale={locale} />

      {reservation.status === "CONFIRMED" && (
        <section className="card p-5">
          <ActionForm action={setHotelConfirmationNo.bind(null, reservation.id)} className="flex flex-wrap items-end gap-3">
            <>
              <label className="block min-w-48 flex-1">
                <span className="text-sm font-medium">{t.voucher.hotelConfirmationNo}</span>
                <input name="hotel_confirmation_no" defaultValue={reservation.hotel_confirmation_no} maxLength={60} className="input mt-1" />
                <span className="mt-1 block text-xs text-muted">{t.voucher.hotelConfirmationHint}</span>
              </label>
              <SubmitButton className="btn-secondary mb-6">{t.common.save}</SubmitButton>
            </>
          </ActionForm>
        </section>
      )}

      <div className="grid gap-4">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">{t.reservations.internalNotes}</h2>
          <ul className="mb-3 space-y-2 text-sm">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="rounded-md bg-background px-3 py-2">
                <p className="whitespace-pre-line">{n.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {(n.profiles as unknown as { full_name: string } | null)?.full_name} · {dateTime(n.created_at)}
                </p>
              </li>
            ))}
          </ul>
          <ActionForm action={addInternalNote.bind(null, reservation.id)} className="space-y-2" resetOnSuccess>
            <>
              <>
                <textarea name="body" rows={2} required className="input" />
                <SubmitButton className="btn-secondary">
                  {t.reservations.addNote}
                </SubmitButton>
              </>
            </>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
