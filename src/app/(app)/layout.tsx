import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { logout } from "@/app/giris/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const t = await getDictionary();

  const links =
    user.role === "admin"
      ? [
          { href: "/admin", label: t.nav.dashboard },
          { href: "/admin/klinikler", label: t.nav.clinics },
          { href: "/admin/oteller", label: t.nav.hotels },
          { href: "/admin/musaitlik", label: t.nav.availability },
        ]
      : [{ href: "/klinik", label: t.nav.dashboard }];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold text-teal-800">
            {t.appName}
          </Link>
          <nav className="flex gap-4 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-slate-600 hover:text-slate-900">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {user.fullName || user.email}
              {user.clinicName ? ` · ${user.clinicName}` : ""}
            </span>
            <LocaleSwitch />
            <form action={logout}>
              <button type="submit" className="btn-secondary">
                {t.nav.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
