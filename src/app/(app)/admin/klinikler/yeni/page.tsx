import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { ClinicFields } from "../components";
import { NewClinicForm } from "./new-clinic-form";

export default async function NewClinicPage() {
  await requireAdmin();
  const t = await getDictionary();

  return (
    <div className="space-y-6">
      <Link href="/admin/klinikler" className="back-link">
        ← {t.admin.clinicsTitle}
      </Link>
      <div>
        <h1 className="page-title">{t.admin.newClinicTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.admin.newClinicIntro}</p>
      </div>

      <NewClinicForm t={t}>
        <section className="card space-y-3 p-6">
          <h2 className="font-semibold">{t.admin.clinicInfo}</h2>
          <ClinicFields t={t} />
        </section>
        <section className="card space-y-3 p-6">
          <h2 className="font-semibold">{t.admin.clinicLogin}</h2>
          <p className="text-sm text-muted">{t.admin.clinicLoginIntro}</p>
          <label className="block">
            <span className="text-sm font-medium">{t.admin.fullName}</span>
            <input name="full_name" required className="input mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.admin.loginEmail}</span>
            <input name="email" type="email" required autoComplete="off" className="input mt-1" />
            <span className="mt-1 block text-xs text-muted">{t.admin.loginEmailHint}</span>
          </label>
        </section>
      </NewClinicForm>
    </div>
  );
}
