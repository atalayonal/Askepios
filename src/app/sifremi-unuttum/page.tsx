import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export default async function ForgotPasswordPage() {
  const t = await getDictionary();

  return (
    <AuthShell
      footer={
        <p className="mt-4 text-center text-sm">
          <Link href="/giris" className="text-blue hover:underline">
            ← {t.auth.backToLogin}
          </Link>
        </p>
      }
    >
      <div className="card p-6">
        <h1 className="text-base font-semibold">{t.auth.forgotTitle}</h1>
        <p className="mb-4 mt-1 text-sm text-muted">{t.auth.forgotIntro}</p>
        <ForgotForm t={t} />
      </div>
    </AuthShell>
  );
}
