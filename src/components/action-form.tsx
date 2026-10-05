"use client";

import { useActionState, type ReactNode } from "react";

export type ActionFormState = { error?: string; message?: string; password?: string };

/** Sunucu işlemi çalıştıran form; hata, başarı mesajı ve (varsa) bir kez gösterilecek geçici şifreyi gösterir. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionFormState, formData: FormData) => Promise<ActionFormState>;
  children: (pending: boolean) => ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className={className} key={resetOnSuccess && state.message ? state.message + (state.password ?? "") : undefined}>
      {state.error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.message && (
        <div role="status" className="mb-3 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <p>{state.message}</p>
          {state.password && <p className="mt-2 select-all font-mono text-base font-semibold tracking-wide">{state.password}</p>}
        </div>
      )}
      {children(pending)}
    </form>
  );
}
