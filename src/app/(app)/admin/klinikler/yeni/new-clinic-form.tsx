"use client";

import Link from "next/link";
import { startTransition, useActionState, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { CopyLink } from "@/components/copy-link";
import { createClinic, type NewClinicState } from "../actions";

/** Yeni klinik formu; kayıttan sonra formun yerine sonuç ve (gerekirse) elle iletilecek bağlantı görünür. */
export function NewClinicForm({ t, children }: { t: Dictionary; children: ReactNode }) {
  const [state, action, pending] = useActionState<NewClinicState, FormData>(createClinic, {});

  if (state.clinicId) {
    return (
      <div className="card max-w-2xl space-y-4 p-6">
        <h2 className="text-lg font-bold text-success">{t.admin.clinicCreated}</h2>
        <p className="text-sm">{state.message}</p>
        {state.link && <CopyLink link={state.link} label={t.admin.copy} copiedLabel={t.admin.copied} />}
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={`/admin/klinikler/${state.clinicId}`} className="btn-primary">
            {t.admin.goToClinic}
          </Link>
          <Link href="/admin/klinikler" className="btn-secondary">
            {t.admin.clinicsTitle}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="max-w-2xl space-y-6"
      onSubmit={(e) => {
        // Hata durumunda girilen bilgiler silinmesin diye form kendiliğinden sıfırlanmaz.
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {children}
      <button type="submit" disabled={pending} className="btn-primary">
        {t.admin.createClinic}
      </button>
    </form>
  );
}
