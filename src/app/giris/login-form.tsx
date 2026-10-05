"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { login, type LoginState } from "./actions";

export function LoginForm({ t, notice }: { t: Dictionary; notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      {(state.error || notice) && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error ?? notice}
        </p>
      )}
      <label className="block">
        <span className="text-sm font-medium">{t.auth.email}</span>
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.auth.password}</span>
        <input name="password" type="password" autoComplete="current-password" required className="input mt-1" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {t.auth.login}
      </button>
    </form>
  );
}
