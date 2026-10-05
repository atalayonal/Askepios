import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { ActionForm } from "@/components/action-form";
import { ClinicFields, StatusBadge } from "../components";
import { createClinicUser, resetUserPassword, setClinicActive, setUserActive, updateClinic } from "../actions";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/klinikler" className="text-sm text-slate-500 hover:underline">
          ← {t.admin.clinicsTitle}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{clinic.name}</h1>
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
            {(pending) => (
              <>
                <ClinicFields t={t} defaults={clinic} />
                <button type="submit" disabled={pending} className="btn-primary">
                  {t.common.save}
                </button>
              </>
            )}
          </ActionForm>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 font-semibold">{t.admin.newUser}</h2>
          <ActionForm action={createClinicUser.bind(null, clinic.id)} className="space-y-3" resetOnSuccess>
            {(pending) => (
              <>
                <label className="block">
                  <span className="text-sm font-medium">{t.admin.fullName}</span>
                  <input name="full_name" required className="input mt-1" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">{t.common.email}</span>
                  <input name="email" type="email" required className="input mt-1" />
                </label>
                <button type="submit" disabled={pending} className="btn-primary">
                  {t.common.save}
                </button>
              </>
            )}
          </ActionForm>
        </div>
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
                      {(pending) => (
                        <button type="submit" disabled={pending} className="btn-secondary">
                          {t.admin.resetPassword}
                        </button>
                      )}
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
                <td colSpan={3} className="text-slate-500">
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
