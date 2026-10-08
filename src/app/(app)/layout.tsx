import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { NavLinks } from "@/components/nav-links";
import { logout } from "@/app/giris/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const t = await getDictionary();

  const links =
    user.role === "admin"
      ? [
          { href: "/admin", label: t.nav.dashboard, exact: true },
          { href: "/admin/rezervasyonlar", label: t.nav.reservations },
          { href: "/admin/ozet", label: t.nav.summary },
          { href: "/admin/klinikler", label: t.nav.clinics },
          { href: "/admin/oteller", label: t.nav.hotels },
          { href: "/admin/musaitlik", label: t.nav.availability },
        ]
      : [
          { href: "/klinik", label: t.nav.dashboard, exact: true },
          { href: "/klinik/oteller", label: t.nav.hotels },
          { href: "/klinik/rezervasyonlar", label: t.nav.myReservations },
          { href: "/klinik/ozet", label: t.nav.summary },
        ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 pt-4">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            Askepios
            <span className="ml-2 align-middle text-sm font-medium text-white/60">{t.nav.tagline}</span>
          </Link>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block font-semibold">{user.fullName || user.email}</span>
              <span className="block text-xs text-white/70">{user.clinicName ?? t.nav.askepiosTeam}</span>
            </span>
            <LocaleSwitch />
            <form action={logout}>
              <button type="submit" className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium hover:bg-white/10">
                {t.nav.logout}
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 pt-4">
          <NavLinks links={links} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
