"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";

export type PasswordState = { error?: string };

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const t = await getDictionary();
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) return { error: t.auth.passwordTooShort };
  if (password !== repeat) return { error: t.auth.passwordMismatch };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.code === "same_password" ? t.auth.passwordSame : t.common.unexpectedError };
  }

  const { error: flagError } = await supabase.rpc("mark_password_changed");
  if (flagError) return { error: t.common.unexpectedError };

  redirect("/");
}
