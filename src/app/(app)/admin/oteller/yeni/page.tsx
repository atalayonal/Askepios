import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n/server";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { HotelFields } from "../components";
import { createHotel } from "../actions";

export default async function NewHotelPage() {
  await requireAdmin();
  const t = await getDictionary();
  const locale = await getLocale();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/oteller" className="back-link">
        ← {t.hotels.title}
      </Link>
      <div>
        <h1 className="page-title">{t.hotels.newHotel}</h1>
        <p className="mt-1 text-sm text-muted">{t.hotels.newHotelIntro}</p>
      </div>
      <section className="card p-6">
        <ActionForm action={createHotel} className="space-y-4">
          <>
            <>
              <HotelFields t={t} locale={locale} />
              <SubmitButton className="btn-primary">{t.hotels.saveAndContinue}</SubmitButton>
            </>
          </>
        </ActionForm>
      </section>
    </div>
  );
}
