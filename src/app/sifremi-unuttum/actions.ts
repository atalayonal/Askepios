"use server";

import { getDictionary } from "@/i18n/server";
import { sendPasswordLink } from "@/lib/password-links";

export type ForgotState = { error?: string; sent?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Şifre belirleme bağlantısını e-postayla yollar. Adresin kayıtlı olup olmadığı belli edilmez:
 * sonuç ne olursa olsun aynı mesaj gösterilir. Kayıtlı olmayan adres için Supabase bağlantı üretmez.
 * Pasif bir hesap bağlantıyı kullansa bile giriş yapamaz (bkz. getCurrentUser).
 */
export async function requestPasswordLink(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const t = await getDictionary();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: t.admin.invalidEmail };

  await sendPasswordLink(email, "reset");

  return { sent: true };
}
