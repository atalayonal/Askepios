"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";

export type ChangePasswordState = { error?: string; message?: string };

/** Oturumdaki kullanıcının şifresini değiştirir; önce mevcut şifre doğrulanır. */
export async function updateOwnPassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await requireUser();
  const t = await getDictionary();
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) return { error: t.auth.passwordTooShort };
  if (password !== repeat) return { error: t.auth.passwordMismatch };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (signInError) {
    return { error: signInError.status === 429 ? t.auth.tooManyAttempts : t.account.currentPasswordWrong };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.code === "same_password" ? t.auth.passwordSame : t.common.unexpectedError };

  return { message: t.account.passwordChanged };
}
