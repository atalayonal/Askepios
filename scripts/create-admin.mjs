// Askepios yöneticisi oluşturur ya da mevcut kullanıcıyı yönetici yapar.
// Kullanım: node --env-file=.env.local scripts/create-admin.mjs <e-posta> "<Ad Soyad>"
// Geçici bir şifre üretir ve ekrana yazar; kullanıcı ilk girişte değiştirir.
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [email, fullName] = process.argv.slice(2);
if (!email || !fullName) {
  console.error('Kullanım: node --env-file=.env.local scripts/create-admin.mjs <e-posta> "<Ad Soyad>"');
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const password = Array.from({ length: 14 }, () => alphabet[randomInt(alphabet.length)]).join("");

const { data, error } = await supabase.auth.admin.createUser({
  email: email.toLowerCase(),
  password,
  email_confirm: true,
});
if (error) {
  console.error("Kullanıcı oluşturulamadı:", error.message);
  process.exit(1);
}

const { error: profileError } = await supabase
  .from("profiles")
  .insert({ id: data.user.id, full_name: fullName, role: "admin" });
if (profileError) {
  await supabase.auth.admin.deleteUser(data.user.id);
  console.error("Profil oluşturulamadı:", profileError.message);
  process.exit(1);
}

console.log(`Yönetici oluşturuldu: ${email}`);
console.log(`Geçici şifre: ${password}`);
