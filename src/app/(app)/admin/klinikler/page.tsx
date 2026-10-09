import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { createClinic } from "./actions";
import { ClinicFields, StatusBadge } from "./components";

export default async function ClinicsPage() {
  await requireAdmin();
  const t = await getDictionary();
  const supabase = await createClient();
  const { data: clinics } = await supabase
    .from("clinics")
    .select("id, name, contact_email, is_active, profiles(count)")
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="page-title">{t.admin.clinicsTitle}</h1>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{t.common.name}</th>
              <th>{t.common.email}</th>
              <th>{t.admin.users}</th>
              <th>{t.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {(clinics ?? []).map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/klinikler/${c.id}`} className="font-medium text-blue hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td>{c.contact_email}</td>
                <td>{(c.profiles as unknown as { count: number }[])[0]?.count ?? 0}</td>
                <td>
                  <StatusBadge active={c.is_active} labels={t.common} />
                </td>
              </tr>
            ))}
            {!clinics?.length && (
              <tr>
                <td colSpan={4} className="text-muted">
                  {t.common.none}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card max-w-xl p-6">
        <h2 className="mb-4 font-semibold">{t.admin.newClinic}</h2>
        <ActionForm action={createClinic} className="space-y-3">
          <>
            <>
              <ClinicFields t={t} />
              <SubmitButton className="btn-primary">
                {t.common.save}
              </SubmitButton>
            </>
          </>
        </ActionForm>
      </div>
    </div>
  );
}
