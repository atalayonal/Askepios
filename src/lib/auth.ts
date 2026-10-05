import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "clinic_user";
  clinicId: string | null;
  clinicName: string | null;
  mustChangePassword: boolean;
};

/** Oturumdaki kullanıcı ve profili. Profili olmayan ya da pasif kullanıcı için null döner. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, clinic_id, is_active, must_change_password, clinics(name, is_active)")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  const clinic = profile.clinics as unknown as { name: string; is_active: boolean } | null;
  if (profile.role === "clinic_user" && !clinic?.is_active) return null;

  return {
    id: profile.id,
    email: String(claims.claims.email ?? ""),
    fullName: profile.full_name,
    role: profile.role,
    clinicId: profile.clinic_id,
    clinicName: clinic?.name ?? null,
    mustChangePassword: profile.must_change_password,
  };
});

/** Giriş yapmış ve şifresini belirlemiş bir kullanıcı ister. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/oturum-kapat");
  if (user.mustChangePassword) redirect("/sifre-belirle");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function requireClinicUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "clinic_user") redirect("/");
  return user;
}
