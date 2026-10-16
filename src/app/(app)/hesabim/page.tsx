import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { PasswordChangeForm } from "./password-change-form";

export default async function AccountPage() {
  const user = await requireUser();
  const t = await getDictionary();

  return (
    <div className="space-y-6">
      <h1 className="page-title">{t.account.title}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-2 p-6 text-sm">
          <h2 className="mb-2 font-semibold">{t.account.info}</h2>
          <p>
            <span className="text-muted">{t.admin.fullName}:</span> {user.fullName}
          </p>
          <p>
            <span className="text-muted">{t.admin.loginEmail}:</span> {user.email}
          </p>
          {user.clinicName && (
            <p>
              <span className="text-muted">{t.account.clinic}:</span> {user.clinicName}
            </p>
          )}
        </section>
        <section className="card p-6">
          <h2 className="mb-4 font-semibold">{t.account.changePassword}</h2>
          <PasswordChangeForm t={t} />
        </section>
      </div>
    </div>
  );
}
