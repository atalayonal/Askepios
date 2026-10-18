import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { requestChange, withdrawRequest } from "@/app/(app)/klinik/actions";
import { resolveChangeRequest } from "@/app/(app)/admin/rezervasyonlar/actions";

export type ChangeRequest = {
  id: string;
  kind: string;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string;
};

export const CHANGE_REQUEST_COLUMNS = "id, kind, message, status, created_at, resolved_at, resolution_note";

function dateTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(
    new Date(iso),
  );
}

/** Rezervasyonun iptal / değişiklik talepleri ve sonuçları; klinik ve admin aynı listeyi görür. */
export function ChangeRequestList({ requests, t, locale }: { requests: ChangeRequest[]; t: Dictionary; locale: Locale }) {
  if (!requests.length) return null;
  return (
    <section className="card p-5">
      <h2 className="mb-3 font-semibold">{t.changes.title}</h2>
      <ul className="space-y-3 text-sm">
        {requests.map((r) => (
          <li key={r.id} className="rounded-md border border-line px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t.changes.kinds[r.kind] ?? r.kind}</span>
              <span className={`badge ${r.status === "OPEN" ? "bg-amber-soft text-amber-800" : "bg-success-soft text-success"}`}>
                {t.changes.statusLabels[r.status] ?? r.status}
              </span>
              <span className="text-xs text-muted">{dateTime(r.created_at, locale)}</span>
            </div>
            {r.message && <p className="mt-1 whitespace-pre-line text-foreground/85">{r.message}</p>}
            {r.status === "RESOLVED" && r.resolution_note && (
              <p className="mt-2 whitespace-pre-line border-l-2 border-success pl-2 text-foreground/85">
                {r.resolution_note}
                {r.resolved_at && <span className="block text-xs text-muted">{dateTime(r.resolved_at, locale)}</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Klinik tarafı: bekleyen talep geri çekilebilir; bekleyen ya da onaylı rezervasyon için
 * (açık talep yoksa) iptal / değişiklik istenebilir.
 */
export function ClinicChangePanel({ reservationId, status, hasOpen, t }: { reservationId: string; status: string; hasOpen: boolean; t: Dictionary }) {
  if (status !== "PENDING" && status !== "CONFIRMED") return null;
  // Bekleyen talep iptal için geri çekilir; onaylıda iptal Asklepios'a sorulur.
  const kinds = status === "PENDING" ? ["CHANGE"] : ["CANCEL", "CHANGE"];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {status === "PENDING" && (
        <section className="card p-5">
          <h2 className="font-semibold">{t.changes.withdrawTitle}</h2>
          <p className="mb-3 text-sm text-muted">{t.changes.withdrawIntro}</p>
          <ActionForm action={withdrawRequest.bind(null, reservationId)} className="space-y-2">
            <>
              <label className="block">
                <span className="text-sm font-medium">{t.changes.reasonOptional}</span>
                <input name="note" maxLength={500} className="input mt-1" />
              </label>
              <SubmitButton className="btn-danger">{t.changes.withdraw}</SubmitButton>
            </>
          </ActionForm>
        </section>
      )}
      {!hasOpen && (
        <section className="card p-5">
          <h2 className="font-semibold">{t.changes.requestTitle}</h2>
          <p className="mb-3 text-sm text-muted">{t.changes.requestIntro}</p>
          <ActionForm action={requestChange.bind(null, reservationId)} className="space-y-2" resetOnSuccess>
            <>
              {kinds.length > 1 ? (
                <label className="block">
                  <span className="text-sm font-medium">{t.changes.kind}</span>
                  <select name="kind" className="input mt-1">
                    {kinds.map((k) => (
                      <option key={k} value={k}>
                        {t.changes.kinds[k]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="kind" value={kinds[0]} />
              )}
              <label className="block">
                <span className="text-sm font-medium">{t.changes.message}</span>
                <textarea name="message" rows={3} maxLength={2000} placeholder={t.changes.messagePlaceholder} className="input mt-1" />
              </label>
              <SubmitButton className="btn-primary">{t.changes.send}</SubmitButton>
            </>
          </ActionForm>
        </section>
      )}
    </div>
  );
}

/** Admin tarafı: açık talep en üstte görünür; değişiklik talebi yapılanı yazarak kapatılır. */
export function AdminChangeRequest({ request, reservationId, t }: { request: ChangeRequest; reservationId: string; t: Dictionary }) {
  return (
    <section className="rounded-xl border-2 border-amber bg-amber-soft p-5">
      <h2 className="text-lg font-bold">
        {t.changes.adminTitle}: {t.changes.kinds[request.kind] ?? request.kind}
      </h2>
      {request.message && <p className="mt-1 whitespace-pre-line text-sm">{request.message}</p>}
      <p className="mt-2 text-sm text-foreground/75">{request.kind === "CANCEL" ? t.changes.adminCancelHint : t.changes.adminChangeHint}</p>
      <ActionForm action={resolveChangeRequest.bind(null, request.id, reservationId)} className="mt-3 space-y-2">
        <>
          <label className="block">
            <span className="text-sm font-medium">{t.changes.resolutionNote}</span>
            <textarea name="note" rows={2} className="input mt-1" />
          </label>
          <SubmitButton className="btn-secondary">{t.changes.resolve}</SubmitButton>
        </>
      </ActionForm>
    </section>
  );
}
