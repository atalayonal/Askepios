import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, sendEmail } from "@/lib/notifications/email";

export type PasswordLinkKind = "invite" | "reset";

export type PasswordLinkResult = { ok: false } | { ok: true; link: string; emailed: boolean };

/**
 * Kullanıcının kendi şifresini belirleyeceği tek kullanımlık bağlantıyı üretir ve e-postayla yollar.
 * Bağlantı Supabase'in "recovery" jetonunu taşır; süresi Supabase'deki "Email OTP Expiration" ayarıdır.
 * Supabase'in kendi e-posta servisi kullanılmaz: e-posta Resend ile gider. Resend tanımlı değilse
 * ya da gönderim başarısızsa emailed=false döner; yönetici bağlantıyı kendisi iletebilir.
 */
export async function sendPasswordLink(email: string, kind: PasswordLinkKind): Promise<PasswordLinkResult> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) return { ok: false };

  // Jeton doğrudan Supabase'e değil sitedeki onay sayfasına gider; e-posta tarayıcılarının
  // bağlantıyı önceden açıp jetonu harcamaması için sayfa ayrıca bir düğmeye basılmasını ister.
  const link = appUrl(`/hesap-onayla?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`);
  const emailed = await sendEmail([email], SUBJECTS[kind], BODIES[kind](link));
  return { ok: true, link, emailed };
}

const SUBJECTS: Record<PasswordLinkKind, string> = {
  invite: "Asklepios Rezervasyon hesabınız açıldı",
  reset: "Asklepios Rezervasyon şifre belirleme",
};

const BODIES: Record<PasswordLinkKind, (link: string) => string> = {
  invite: (link) =>
    [
      "Merhaba,",
      "",
      "Asklepios Rezervasyon sisteminde sizin için bir hesap açıldı.",
      "Aşağıdaki bağlantıdan kendi şifrenizi belirleyerek giriş yapabilirsiniz:",
      "",
      link,
      "",
      "Bağlantı tek kullanımlıktır ve bir süre sonra geçersiz olur. Süresi dolarsa giriş sayfasındaki",
      "\"Şifremi unuttum\" bağlantısından yenisini isteyebilirsiniz. Giriş adınız bu e-posta adresidir.",
      "",
      "Asklepios",
    ].join("\n"),
  reset: (link) =>
    [
      "Merhaba,",
      "",
      "Asklepios Rezervasyon hesabınız için şifre belirleme isteği alındı.",
      "Yeni şifrenizi aşağıdaki bağlantıdan belirleyebilirsiniz:",
      "",
      link,
      "",
      "Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın; şifreniz değişmez.",
      "",
      "Asklepios",
    ].join("\n"),
};
