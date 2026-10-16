import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  const t = await getDictionary();
  const { hesap } = await searchParams;

  return (
    <AuthShell footer={<p className="mt-4 text-center text-xs text-muted">{t.auth.closedSystemNote}</p>}>
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold">{t.auth.loginTitle}</h2>
        <LoginForm t={t} notice={hesap === "pasif" ? t.auth.accountInactive : undefined} />
        <p className="mt-4 text-center text-sm">
          <Link href="/sifremi-unuttum" className="text-blue hover:underline">
            {t.auth.forgotLink}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
