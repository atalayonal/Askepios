import { getLocale } from "@/i18n/server";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/dictionaries";

export async function LocaleSwitch() {
  const current = await getLocale();
  return (
    <div className="flex gap-1 text-xs">
      {locales.map((locale) => (
        <form key={locale} action={setLocale.bind(null, locale)}>
          <button
            type="submit"
            aria-pressed={locale === current}
            className={`rounded-md px-2 py-1 uppercase ${locale === current ? "bg-white font-semibold text-navy" : "text-white/80 hover:bg-white/15"}`}
          >
            {locale}
          </button>
        </form>
      ))}
    </div>
  );
}
