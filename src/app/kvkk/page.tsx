import Image from "next/image";
import Link from "next/link";
import { getLocale } from "@/i18n/server";
import { LocaleSwitch } from "@/components/locale-switch";

export const metadata = { title: "KVKK · Asklepios" };

type Section = { title: string; body: string[] };

/**
 * Misafirlere iletilecek aydınlatma metni (KVKK m.10). Taslaktır: yayına almadan önce bir hukukçuya kontrol ettirin.
 * Veri sorumlusunun unvanı ASKEPIOS_LEGAL_NAME, iletişim adresi ASKEPIOS_CONTACT_EMAIL ortam değişkeninden gelir.
 */
function content(legalName: string, email: string): Record<"tr" | "en", { title: string; intro: string; sections: Section[] }> {
  return {
    tr: {
      title: "Kişisel verilerin işlenmesine ilişkin aydınlatma metni",
      intro: `Bu metin, anlaşmalı klinikler aracılığıyla otel rezervasyonu yapılan misafirler için 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesi uyarınca hazırlanmıştır.`,
      sections: [
        { title: "Veri sorumlusu", body: [`${legalName}${email ? ` (${email})` : ""}`] },
        {
          title: "İşlenen veriler",
          body: [
            "Kimlik: ad soyad, uyruk, T.C. Kimlik No ya da pasaport numarası, doğum tarihi, cinsiyet.",
            "İletişim: telefon numarası (verildiyse).",
            "Konaklama: otel, oda, giriş ve çıkış tarihleri, rezervasyon numarası.",
            "Sağlık bilginiz, tedaviniz ya da muayene bilgileriniz bu sistemde toplanmaz.",
          ],
        },
        {
          title: "İşleme amacı ve hukuki sebep",
          body: [
            "Verileriniz otel rezervasyonunuzun yapılması ve otel girişinizin gerçekleşmesi amacıyla işlenir.",
            "Hukuki sebepler: sizinle kurulan konaklama hizmetinin ifası için gerekli olması (KVKK m.5/2-c) ve konaklama tesislerinin 1774 sayılı Kimlik Bildirme Kanunu'ndan doğan bildirim yükümlülüğü (KVKK m.5/2-ç).",
          ],
        },
        {
          title: "Kimlere aktarılır",
          body: [
            "Rezervasyonun yapıldığı otele (giriş ve kimlik bildirimi için) ve rezervasyonu talep eden kliniğe.",
            "Veriler, hizmet aldığımız bulut altyapı sağlayıcılarının sunucularında saklanır. Sunucular yurt dışında ise aktarım KVKK m.9'daki şartlara uygun yapılır.",
          ],
        },
        { title: "Toplama yöntemi", body: ["Veriler, rezervasyon talebi sırasında kliniğiniz tarafından elektronik ortamda sisteme girilir."] },
        {
          title: "Saklama süresi",
          body: [
            "T.C. Kimlik No / pasaport numarası, doğum tarihi ve cinsiyet konaklamanızın bitiminden 30 gün sonra otomatik olarak silinir. Talep reddedilir ya da iptal edilirse de 30 gün sonra silinir.",
            "Ad soyad, uyruk ve konaklama bilgileri, muhasebe ve vergi mevzuatının öngördüğü süre boyunca saklanır.",
          ],
        },
        {
          title: "Haklarınız",
          body: [
            "KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini ya da silinmesini isteme, aktarıldığı üçüncü kişileri öğrenme ve itiraz etme haklarına sahipsiniz.",
            email ? `Başvurularınızı ${email} adresine iletebilirsiniz.` : "Başvurularınızı rezervasyonu yapan kliniğiniz aracılığıyla iletebilirsiniz.",
          ],
        },
      ],
    },
    en: {
      title: "Privacy notice on the processing of personal data",
      intro: "This notice is provided under Article 10 of the Turkish Personal Data Protection Law No. 6698 (KVKK) to guests whose hotel stay is booked through a partner clinic.",
      sections: [
        { title: "Data controller", body: [`${legalName}${email ? ` (${email})` : ""}`] },
        {
          title: "Data processed",
          body: [
            "Identity: full name, nationality, Turkish ID number or passport number, date of birth, gender.",
            "Contact: phone number (if given).",
            "Stay: hotel, room, check-in and check-out dates, reservation number.",
            "No health, treatment or examination information is collected in this system.",
          ],
        },
        {
          title: "Purpose and legal basis",
          body: [
            "Your data is processed to book your hotel stay and to complete your hotel check-in.",
            "Legal bases: it is necessary to perform the accommodation service (KVKK Art. 5/2-c) and for the hotel's legal duty to report guest identities under Identity Notification Law No. 1774 (KVKK Art. 5/2-ç).",
          ],
        },
        {
          title: "Who receives it",
          body: [
            "The hotel you stay at (for check-in and identity reporting) and the clinic that requested the booking.",
            "Data is stored on servers of our cloud infrastructure providers. Where servers are abroad, transfers follow KVKK Art. 9.",
          ],
        },
        { title: "How it is collected", body: ["Your clinic enters the data electronically when requesting the booking."] },
        {
          title: "Retention",
          body: [
            "ID or passport number, date of birth and gender are deleted automatically 30 days after your stay ends, or 30 days after a request is rejected or cancelled.",
            "Name, nationality and stay details are kept for the period required by accounting and tax law.",
          ],
        },
        {
          title: "Your rights",
          body: [
            "Under KVKK Art. 11 you may ask whether your data is processed, request information, correction or deletion, learn which third parties received it, and object.",
            email ? `Send requests to ${email}.` : "Send requests through the clinic that made your booking.",
          ],
        },
      ],
    },
  };
}

export default async function KvkkPage() {
  const locale = await getLocale();
  const c = content(process.env.ASKEPIOS_LEGAL_NAME || "Asklepios", process.env.ASKEPIOS_CONTACT_EMAIL ?? "")[locale];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/">
          <Image src="/logo.png" alt="Asklepios" width={794} height={132} priority className="h-8 w-auto" />
        </Link>
        <LocaleSwitch tone="light" />
      </div>
      <article className="card space-y-5 p-6">
        <h1 className="page-title">{c.title}</h1>
        <p className="text-sm text-foreground/80">{c.intro}</p>
        {c.sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-1 font-bold">{s.title}</h2>
            {s.body.map((line) => (
              <p key={line} className="text-sm leading-6 text-foreground/85">
                {line}
              </p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
