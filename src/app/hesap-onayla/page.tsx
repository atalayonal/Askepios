import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { SubmitButton } from "@/components/submit-button";
import { AuthShell } from "@/components/auth-shell";
import { confirmPasswordLink } from "./actions";

/**
 * Şifre belirleme bağlantısının açıldığı sayfa. Jeton sayfa açılınca değil düğmeye basılınca kullanılır:
 * bazı e-posta servisleri bağlantıları önceden açıp kontrol eder, bu da jetonu harcayabilir.
 */
export default async function ConfirmLinkPage({ searchParams }: PageProps<"/hesap-onayla">) {
  const t = await getDictionary();
  const { token_hash, durum } = await searchParams;
  const tokenHash = typeof token_hash === "string" ? token_hash : "";
  const invalid = durum === "gecersiz" || !tokenHash;

  return (
    <AuthShell>
      <div className="card p-6">
        <h1 className="text-base font-semibold">{invalid ? t.auth.linkInvalidTitle : t.auth.linkTitle}</h1>
        <p className="mb-4 mt-1 text-sm text-muted">{invalid ? t.auth.linkInvalid : t.auth.linkIntro}</p>
        {invalid ? (
          <Link href="/sifremi-unuttum" className="btn-primary w-full">
            {t.auth.requestNewLink}
          </Link>
        ) : (
          <form action={confirmPasswordLink.bind(null, tokenHash)}>
            <SubmitButton className="btn-primary w-full">{t.auth.linkContinue}</SubmitButton>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
