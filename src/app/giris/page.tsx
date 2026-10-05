import { getDictionary } from "@/i18n/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  const t = await getDictionary();
  const { hesap } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t.appName}</h1>
          <LocaleSwitch />
        </div>
        <div className="card p-6">
          <h2 className="mb-4 text-base font-semibold">{t.auth.loginTitle}</h2>
          <LoginForm t={t} notice={hesap === "pasif" ? t.auth.accountInactive : undefined} />
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">{t.auth.closedSystemNote}</p>
      </div>
    </main>
  );
}
