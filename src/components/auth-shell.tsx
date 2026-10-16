import Image from "next/image";
import type { ReactNode } from "react";
import { LocaleSwitch } from "./locale-switch";

/** Giriş ve şifre sayfalarının ortak çerçevesi: logo, dil seçimi ve ortalanmış içerik. */
export async function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Image src="/logo.png" alt="Asklepios" width={794} height={132} priority className="h-8 w-auto" />
          <LocaleSwitch tone="light" />
        </div>
        {children}
        {footer}
      </div>
    </main>
  );
}
