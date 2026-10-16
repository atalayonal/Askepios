import { getLocale } from "@/i18n/server";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/dictionaries";

/** Dil seçimi; tone koyu zemin (dark) ya da açık zemin (light) için renkleri seçer. */
export async function LocaleSwitch({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const current = await getLocale();
  return (
    <div className="flex gap-1 text-xs">
      {locales.map((locale) => (
        <form key={locale} action={setLocale.bind(null, locale)}>
          <button
            type="submit"
            aria-pressed={locale === current}
            className={`rounded-md px-2 py-1 uppercase ${
              tone === "dark"
                ? locale === current
                  ? "bg-white font-semibold text-navy"
                  : "text-white/80 hover:bg-white/15"
                : locale === current
                  ? "bg-navy font-semibold text-white"
                  : "text-muted hover:bg-sky"
            }`}
          >
            {locale}
          </button>
        </form>
      ))}
    </div>
  );
}
