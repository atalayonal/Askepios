"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Üst banttaki sekmeler; bulunulan bölüm vurgulanır. */
export function NavLinks({ links }: { links: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto text-sm">
      {links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-4 py-2 font-medium ${
              active ? "border-white bg-white/10 text-white" : "border-transparent text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
