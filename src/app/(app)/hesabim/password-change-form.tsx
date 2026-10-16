"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { updateOwnPassword, type ChangePasswordState } from "./actions";

export function PasswordChangeForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(updateOwnPassword, {});

  return (
    <form action={action} className="space-y-3" key={state.message}>
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-md bg-sky px-3 py-2 text-sm text-navy">
          {state.message}
        </p>
      )}
      <label className="block">
        <span className="text-sm font-medium">{t.account.currentPassword}</span>
        <input name="current" type="password" autoComplete="current-password" required className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.auth.newPassword}</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={10} className="input mt-1" />
        <span className="mt-1 block text-xs text-muted">{t.auth.passwordRules}</span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.auth.newPasswordRepeat}</span>
        <input name="repeat" type="password" autoComplete="new-password" required minLength={10} className="input mt-1" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary">
        {t.account.changePassword}
      </button>
    </form>
  );
}
