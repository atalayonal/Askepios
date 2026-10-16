import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "./password-form";

export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/oturum-kapat");
  const t = await getDictionary();

  return (
    <AuthShell>
      <div className="card p-6">
        <h1 className="text-base font-semibold">{t.auth.changePasswordTitle}</h1>
        <p className="mb-4 mt-1 text-sm text-muted">{t.auth.changePasswordIntro}</p>
        <p className="mb-4 text-sm">
          {t.auth.loginEmailIs} <strong>{user.email}</strong>
        </p>
        <PasswordForm t={t} />
      </div>
    </AuthShell>
  );
}
