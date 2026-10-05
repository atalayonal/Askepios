import "server-only";
import { cookies } from "next/headers";
import { dictionaries, locales, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return locales.includes(value as Locale) ? (value as Locale) : "tr";
}

export async function getDictionary() {
  return dictionaries[await getLocale()];
}
