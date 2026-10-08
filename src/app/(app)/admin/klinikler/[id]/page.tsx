import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { ClinicFields, StatusBadge } from "../components";
import { createClinicUser, resetUserPassword, setClinicActive, setUserActive, updateClinic } from "../actions";
import { setClinicHotelAccess } from "../../oteller/actions";

export default async function ClinicDetailPage({ params }: PageProps<"/admin/klinikler/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const t = await getDictionary();
  const supabase = await createClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, contact_email, contact_phone, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!clinic) notFound();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, is_active, must_change_password")
    .eq("clinic_id", id)
    .order("full_name");

  const [{ data: hotels }, { data: access }] = await Promise.all([
    supabase.from("hotels").select("id, name, is_active").order("name"),
    supabase.from("clinic_hotel_access").select("hotel_id").eq("clinic_id", id),
  ]);
  const partnered = new Set((access ?? []).map((a) => a.hotel_id as string));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/klinikler" className="back-link">
          ← {t.admin.clinicsTitle}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">{clinic.name}</h1>
        <StatusBadge active={clinic.is_active} labels={t.common} />
        <form action={setClinicActive.bind(null, clinic.id, !clinic.is_active)} className="ml-auto">
          <button type="submit" className="btn-secondary">
            {clinic.is_active ? t.common.deactivate : t.common.activate}
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <ActionForm action={updateClinic.bind(null, clinic.id)} className="space-y-3">
            <>
              <>
                <ClinicFields t={t} defaults={clinic} />
                <SubmitButton className="btn-primary">
                  {t.common.save}
                </SubmitButton>
              </>
            </>
          </ActionForm>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 font-semibold">{t.admin.newUser}</h2>
          <ActionForm action={createClinicUser.bind(null, clinic.id)} className="space-y-3" resetOnSuccess>
            <>
              <>
                <label className="block">
                  <span className="text-sm font-medium">{t.admin.fullName}</span>
                  <input name="full_name" required className="input mt-1" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">{t.common.email}</span>
                  <input name="email" type="email" required className="input mt-1" />
                </label>
                <SubmitButton className="btn-primary">
                  {t.common.save}
                </SubmitButton>
              </>
            </>
          </ActionForm>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">{t.hotels.hotelAccessTitle}</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{t.hotels.hotelAccessIntro}</p>
        <ActionForm action={setClinicHotelAccess.bind(null, clinic.id)}>
          <>
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(hotels ?? []).map((h) => (
                  <label key={h.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="hotel_id" value={h.id} defaultChecked={partnered.has(h.id)} className="h-4 w-4 accent-blue" />
                    <span className={h.is_active ? "" : "text-muted/70"}>{h.name}</span>
                  </label>
                ))}
              </div>
              <SubmitButton className="btn-primary mt-4">
                {t.common.save}
              </SubmitButton>
            </>
          </>
        </ActionForm>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="px-3 pt-4 font-semibold">{t.admin.users}</h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>{t.admin.fullName}</th>
              <th>{t.common.status}</th>
              <th>{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td className="space-x-2">
                  <StatusBadge active={u.is_active} labels={t.common} />
                  {u.must_change_password && <span className="badge bg-amber-50 text-amber-800">{t.admin.mustChangePassword}</span>}
                </td>
                <td>
                  <div className="flex flex-wrap items-start gap-2">
                    <ActionForm action={resetUserPassword.bind(null, u.id, clinic.id)}>
                      <>
                        <SubmitButton className="btn-secondary">
                          {t.admin.resetPassword}
                        </SubmitButton>
                      </>
                    </ActionForm>
                    <form action={setUserActive.bind(null, u.id, clinic.id, !u.is_active)}>
                      <button type="submit" className="btn-secondary">
                        {u.is_active ? t.common.deactivate : t.common.activate}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {!users?.length && (
              <tr>
                <td colSpan={3} className="text-muted">
                  {t.common.none}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
