"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * E-postadaki şifre belirleme bağlantısını doğrular ve kullanıcıyı oturum açmış hale getirir.
 * Kullanıcı yeni şifresini belirlemeden sisteme devam edemesin diye profil işaretlenir.
 */
export async function confirmPasswordLink(tokenHash: string) {
  const supabase = await createClient();
  // Başka bir hesapla açık oturum varsa önce kapatılır; bağlantı kimin içinse onun oturumu açılır.
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error || !data.user) redirect("/hesap-onayla?durum=gecersiz");

  await createAdminClient().from("profiles").update({ must_change_password: true }).eq("id", data.user.id);
  redirect("/sifre-belirle");
}
