import Image from "next/image";
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
      <header>
        <div className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="Asklepios" width={794} height={132} priority className="h-7 w-auto sm:h-8" />
              <span className="hidden text-sm font-medium text-muted sm:inline">{t.nav.tagline}</span>
            </Link>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <Link href="/hesabim" className="hidden rounded-md px-2 py-1 text-right leading-tight hover:bg-sky sm:block" title={t.account.title}>
                <span className="block font-semibold">{user.fullName || user.email}</span>
                <span className="block text-xs text-muted">{user.clinicName ?? t.nav.askepiosTeam}</span>
              </Link>
              <Link href="/hesabim" className="btn-secondary sm:hidden">
                {t.account.title}
              </Link>
              <LocaleSwitch tone="light" />
              <form action={logout}>
                <button type="submit" className="btn-secondary">
                  {t.nav.logout}
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="bg-navy text-white">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <NavLinks links={links} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
