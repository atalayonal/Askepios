import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { PasswordForm } from "./password-form";

export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/oturum-kapat");
  const t = await getDictionary();

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-base font-semibold">{t.auth.changePasswordTitle}</h1>
        <p className="mb-4 mt-1 text-sm text-slate-600">{t.auth.changePasswordIntro}</p>
        <PasswordForm t={t} />
      </div>
    </main>
  );
}
