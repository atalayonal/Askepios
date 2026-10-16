"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/i18n/server";
import { sendPasswordLink } from "@/lib/password-links";

export type FormState = { error?: string; message?: string; link?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export type NewClinicState = FormState & { clinicId?: string };

/** Yeni klinik ve ilk kullanıcısı: klinik kaydı açılır, kullanıcıya şifre belirleme bağlantısı gider. */
export async function createClinic(_prev: NewClinicState, formData: FormData): Promise<NewClinicState> {
  await requireAdmin();
  const t = await getDictionary();
  const name = text(formData, "name");
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  if (!name || !fullName) return { error: t.admin.nameRequired };
  if (!EMAIL_RE.test(email)) return { error: t.admin.invalidEmail };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinics")
    .insert({ name, contact_email: text(formData, "contact_email") || null, contact_phone: text(formData, "contact_phone") || null })
    .select("id")
    .single();
  if (error) return { error: t.common.unexpectedError };

  const result = await inviteClinicUser(data.id, fullName, email);
  if (result.error) {
    // Kullanıcı açılamadıysa yarım klinik kaydı bırakılmaz.
    await supabase.from("clinics").delete().eq("id", data.id);
    return result;
  }

  revalidatePath("/admin/klinikler");
  return { ...result, clinicId: data.id };
}

/**
 * Şifresiz bir giriş hesabı ve klinik profili açar, kullanıcıya şifre belirleme bağlantısı yollar.
 * Kullanıcı şifresini bağlantıdan kendisi belirler; düz şifre hiçbir yerde gösterilmez ya da yollanmaz.
 */
async function inviteClinicUser(clinicId: string, fullName: string, email: string): Promise<FormState> {
  const t = await getDictionary();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
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

  return linkResult(await sendPasswordLink(email, "invite"), t.admin.inviteSent, t.admin.inviteNotSent, t.admin.linkFailed);
}

function linkResult(result: Awaited<ReturnType<typeof sendPasswordLink>>, sent: string, notSent: string, failed: string): FormState {
  // Hesap açıldıysa bağlantı sonradan klinik sayfasından yeniden yollanabilir; bu yüzden hata değil, uyarı.
  if (!result.ok) return { message: failed };
  // E-posta gitmediyse bağlantı yöneticiye gösterilir; kendisi WhatsApp ya da e-postayla iletebilir.
  return result.emailed ? { message: sent } : { message: notSent, link: result.link };
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

  const result = await inviteClinicUser(clinicId, fullName, email);
  revalidatePath(`/admin/klinikler/${clinicId}`);
  return result;
}

/** Kullanıcıya yeni bir şifre belirleme bağlantısı yollar; mevcut şifresi bağlantı kullanılana kadar geçerli kalır. */
export async function sendUserPasswordLink(userId: string, clinicId: string, _prev: FormState): Promise<FormState> {
  await requireAdmin();
  const t = await getDictionary();
  const supabase = await createClient();

  // Sadece bu kliniğe ait bir kullanıcıya bağlantı yollanabilir.
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).eq("clinic_id", clinicId).maybeSingle();
  if (!profile) return { error: t.common.unexpectedError };

  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  if (!data.user?.email) return { error: t.common.unexpectedError };

  const result = await sendPasswordLink(data.user.email, "reset");
  if (!result.ok) return { error: t.common.unexpectedError };
  return linkResult(result, t.admin.resetLinkSent, t.admin.resetLinkNotSent, t.common.unexpectedError);
}

export async function setUserActive(userId: string, clinicId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId).eq("clinic_id", clinicId);
  revalidatePath(`/admin/klinikler/${clinicId}`);
}
