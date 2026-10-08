import { CircleCheck, CircleX, Ban } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { changeStatus } from "@/app/(app)/admin/rezervasyonlar/actions";

/** Rezervasyon detayının en üstündeki karar alanı: bekleyen talepte büyük Onayla / Reddet düğmeleri. */
export function DecisionPanel({ reservationId, status, t }: { reservationId: string; status: string; t: Dictionary }) {
  if (status !== "PENDING" && status !== "CONFIRMED") return null;
  const pending = status === "PENDING";

  return (
    <section className={`rounded-xl border-2 p-5 ${pending ? "border-amber bg-amber-soft" : "border-line bg-white"}`}>
      <ActionForm action={changeStatus.bind(null, reservationId)} className="space-y-4">
        <>
          <div>
            <h2 className="text-lg font-bold">{pending ? t.ui.decisionTitle : t.ui.cancelTitle}</h2>
            <p className="text-sm text-foreground/75">{pending ? t.ui.decisionIntro : t.ui.cancelIntro}</p>
          </div>
          <label className="block">
            <span className="text-sm font-medium">{t.reservations.statusNote}</span>
            <textarea name="note" rows={2} className="input mt-1" placeholder={t.ui.notePlaceholder} />
          </label>
          <div className="flex flex-wrap gap-3">
            {pending && (
              <>
                <SubmitButton name="status" value="CONFIRMED" className="btn-success px-6 py-3 text-base">
                  <CircleCheck aria-hidden className="h-5 w-5" />
                  {t.ui.confirmRequest}
                </SubmitButton>
                <SubmitButton name="status" value="REJECTED" className="btn-danger px-6 py-3 text-base">
                  <CircleX aria-hidden className="h-5 w-5" />
                  {t.ui.rejectRequest}
                </SubmitButton>
              </>
            )}
            <SubmitButton name="status" value="CANCELLED" className={pending ? "btn-secondary ml-auto" : "btn-danger"}>
              <Ban aria-hidden className="h-4 w-4" />
              {t.reservations.actionLabels.CANCELLED}
            </SubmitButton>
          </div>
        </>
      </ActionForm>
    </section>
  );
}

/** Listelerde bekleyen talep için küçük Onayla / Reddet düğmeleri. */
export function QuickDecision({ reservationId, t }: { reservationId: string; t: Dictionary }) {
  return (
    <ActionForm action={changeStatus.bind(null, reservationId)} className="flex flex-wrap gap-2">
      <>
        <SubmitButton name="status" value="CONFIRMED" className="btn-success px-3 py-1.5">
          <CircleCheck aria-hidden className="h-4 w-4" />
          {t.ui.confirmShort}
        </SubmitButton>
        <SubmitButton name="status" value="REJECTED" className="btn-danger px-3 py-1.5">
          <CircleX aria-hidden className="h-4 w-4" />
          {t.ui.rejectShort}
        </SubmitButton>
      </>
    </ActionForm>
  );
}
