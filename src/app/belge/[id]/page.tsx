import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/server";
import { dictionaries, locales, type Locale } from "@/i18n/dictionaries";
import { PrintButton } from "./print-button";
import { VoucherDocument, type Hotel } from "./voucher-document";

export const metadata = { title: "Voucher · Asklepios" };

/**
 * Onaylı rezervasyonun onay belgesi (voucher). Klinik hastaya iletir; tarayıcıdan PDF olarak kaydedilir.
 * Fiyat ve kimlik numaraları belgeye konmaz. Belge dili ?dil=tr|en ile seçilir.
 */
export default async function VoucherPage({ params, searchParams }: PageProps<"/belge/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { dil } = await searchParams;
  const locale: Locale = locales.includes(dil as Locale) ? (dil as Locale) : await getLocale();
  const t = dictionaries[locale];
  const supabase = await createClient();

  // RLS: klinik sadece kendi rezervasyonunu görür.
  const { data: r } = await supabase
    .from("reservations")
    .select(
      "id, reference, hotel_name, room_name, check_in, check_out, guest_count, status, hotel_confirmation_no, hotels(address, district, city), clinics(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const { data: guests } = await supabase
    .from("reservation_guests")
    .select("position, full_name, nationality")
    .eq("reservation_id", id)
    .order("position");

  const back = `${user.role === "admin" ? "/admin" : "/klinik"}/rezervasyonlar/${r.id}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link href={back} className="back-link">
          ← {t.voucher.back}
        </Link>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">{t.voucher.language}:</span>
          {locales.map((l) => (
            <Link
              key={l}
              href={`/belge/${r.id}?dil=${l}`}
              className={`rounded-md px-2 py-1 uppercase ${l === locale ? "bg-navy font-semibold text-white" : "hover:bg-sky"}`}
            >
              {l}
            </Link>
          ))}
        </div>
        {r.status === "CONFIRMED" && <PrintButton label={t.voucher.print} />}
      </div>
      {r.status === "CONFIRMED" && <p className="mb-4 text-xs text-muted print:hidden">{t.voucher.printHint}</p>}

      {r.status !== "CONFIRMED" ? (
        <p className="card p-6 text-sm">{t.voucher.notConfirmed}</p>
      ) : (
        <VoucherDocument
          r={r}
          hotel={r.hotels as unknown as Hotel | null}
          clinicName={(r.clinics as unknown as { name: string } | null)?.name}
          guests={guests ?? []}
          t={t}
          locale={locale}
          issuedAt={new Date().toISOString().slice(0, 10)}
          contact={[process.env.ASKEPIOS_CONTACT_EMAIL, process.env.ASKEPIOS_CONTACT_WHATSAPP].filter(Boolean).join(" · ")}
        />
      )}
    </main>
  );
}
