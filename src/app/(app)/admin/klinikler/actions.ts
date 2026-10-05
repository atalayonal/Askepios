"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/i18n/server";
import { generateTemporaryPassword } from "@/lib/passwords";

export type FormState = { error?: string; message?: string; password?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function createClinic(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const name = text(formData, "name");
  if (!name) return { error: t.admin.nameRequired };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinics")
    .insert({ name, contact_email: text(formData, "contact_email") || null, contact_phone: text(formData, "contact_phone") || null })
    .select("id")
    .single();
  if (error) return { error: t.common.unexpectedError };

  revalidatePath("/admin/klinikler");
  redirect(`/admin/klinikler/${data.id}`);
}

export async function updateClinic(clinicId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const name = text(formData, "name");
  if (!name) return { error: t.admin.nameRequired };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update({ name, contact_email: text(formData, "contact_email") || null, contact_phone: text(formData, "contact_phone") || null })
    .eq("id", clinicId);
  if (error) return { error: t.common.unexpectedError };

  revalidatePath(`/admin/klinikler/${clinicId}`);
  return { message: t.common.saved };
}

export async function setClinicActive(clinicId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("clinics").update({ is_active: isActive }).eq("id", clinicId);
  revalidatePath(`/admin/klinikler/${clinicId}`);
  revalidatePath("/admin/klinikler");
}

export async function createClinicUser(clinicId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  if (!fullName) return { error: t.admin.nameRequired };
  if (!EMAIL_RE.test(email)) return { error: t.admin.invalidEmail };

  const password = generateTemporaryPassword();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    return { error: error?.code === "email_exists" ? t.admin.emailTaken : t.common.unexpectedError };
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, full_name: fullName, role: "clinic_user", clinic_id: clinicId });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: t.common.unexpectedError };
  }

  revalidatePath(`/admin/klinikler/${clinicId}`);
  return { message: t.admin.userCreatedNote, password };
}

export async function resetUserPassword(userId: string, clinicId: string, _prev: FormState): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const supabase = await createClient();

  // Sadece bu kliniğe ait bir kullanıcının şifresi sıfırlanabilir.
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).eq("clinic_id", clinicId).maybeSingle();
  if (!profile) return { error: t.common.unexpectedError };

  const password = generateTemporaryPassword();
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
  if (error) return { error: t.common.unexpectedError };
  await supabase.from("profiles").update({ must_change_password: true }).eq("id", userId);

  revalidatePath(`/admin/klinikler/${clinicId}`);
  return { message: t.admin.passwordResetNote, password };
}

export async function setUserActive(userId: string, clinicId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId).eq("clinic_id", clinicId);
  revalidatePath(`/admin/klinikler/${clinicId}`);
}
