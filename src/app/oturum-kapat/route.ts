import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Hesabı pasif ya da profili olmayan bir oturum açık kalmışsa oturumu kapatıp giriş ekranına döner.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/giris?hesap=pasif", request.url));
}
