"use client";

import { useActionState, type ReactNode } from "react";
import { CopyLink } from "./copy-link";

export type ActionFormState = { error?: string; message?: string; link?: string };

/**
 * Sunucu işlemi çalıştıran form; hata, başarı mesajı ve (varsa) yöneticinin kullanıcıya kendisi ileteceği
 * şifre belirleme bağlantısını gösterir.
 * Sunucu bileşenlerinden kullanıldığı için children fonksiyon olamaz; gönderim durumu için SubmitButton kullanın.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  copyLabels,
}: {
  action: (prev: ActionFormState, formData: FormData) => Promise<ActionFormState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  copyLabels?: { copy: string; copied: string };
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className={className} key={resetOnSuccess && state.message ? state.message + (state.link ?? "") : undefined}>
      {state.error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.message && (
        <div role="status" className="mb-3 rounded-md bg-sky px-3 py-2 text-sm text-navy">
          <p>{state.message}</p>
          {state.link && <CopyLink link={state.link} label={copyLabels?.copy} copiedLabel={copyLabels?.copied} />}
        </div>
      )}
      {children}
    </form>
  );
}
