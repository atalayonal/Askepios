"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { requestPasswordLink, type ForgotState } from "./actions";

export function ForgotForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordLink, {});

  if (state.sent) {
    return (
      <p role="status" className="rounded-md bg-sky px-3 py-2 text-sm text-navy">
        {t.auth.forgotSent}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <label className="block">
        <span className="text-sm font-medium">{t.auth.email}</span>
        <input name="email" type="email" autoComplete="email" required className="input mt-1" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {t.auth.sendLink}
      </button>
    </form>
  );
}
