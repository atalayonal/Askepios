"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { changePassword, type PasswordState } from "./actions";

export function PasswordForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <label className="block">
        <span className="text-sm font-medium">{t.auth.newPassword}</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={10} className="input mt-1" />
        <span className="mt-1 block text-xs text-muted">{t.auth.passwordRules}</span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.auth.newPasswordRepeat}</span>
        <input name="repeat" type="password" autoComplete="new-password" required minLength={10} className="input mt-1" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {t.common.save}
      </button>
    </form>
  );
}
