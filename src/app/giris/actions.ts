"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/server";

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const t = await getDictionary();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: t.auth.invalidCredentials, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Supabase Auth giriş denemelerini kendi tarafında sınırlar (429).
    if (error.status === 429) return { error: t.auth.tooManyAttempts, email };
    if (error.code === "invalid_credentials") return { error: t.auth.invalidCredentials, email };
    if (error.code === "email_not_confirmed") return { error: t.auth.emailNotConfirmed, email };
    // Yanlış anahtar veya adres gibi kurulum hataları "hatalı şifre" gibi görünmesin.
    console.error("Giriş hatası", error.status, error.code, error.message);
    return { error: `${t.auth.loginFailed} ${error.code ?? error.status ?? "bilinmiyor"}`, email };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/giris");
}
