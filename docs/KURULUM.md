# Kurulum: Supabase ve Vercel

Bu adımlar bir kez yapılır. Hepsi ücretsiz planlarla çalışır; canlıya çıkarken ücretli planlara geçilir.

## 1. Supabase projesi

1. [supabase.com](https://supabase.com) → **New project**.
   - Region: **Central EU (Frankfurt)**
   - Database password: güçlü bir şifre; bir yere not edin, kimseyle paylaşmayın.
2. Proje açılınca sol menüden **SQL Editor** → **New query**.
3. Depodaki [`supabase/kurulum.sql`](../supabase/kurulum.sql) dosyasının tamamını kopyalayıp yapıştırın → **Run**.
   "Success" görmelisiniz. Bu, bütün tabloları, güvenlik kurallarını ve 11 oteli kurar.
4. **Authentication → Sign In / Providers** → **Allow new users to sign up** seçeneğini **kapatın**.
   Sistem kapalıdır; kullanıcıları sadece Asklepios oluşturur.

## 2. İlk yönetici hesabı

1. **Authentication → Users → Add user → Create new user**
   - E-posta ve bir şifre girin, **Auto Confirm User** işaretli olsun.
2. Oluşan kullanıcının satırındaki **UID** değerini kopyalayın.
3. **SQL Editor**'da aşağıdakini kendi bilgilerinizle çalıştırın:

```sql
insert into public.profiles (id, full_name, role, must_change_password)
values ('BURAYA-UID', 'Ad Soyad', 'admin', false);
```

Diğer yöneticiler aynı şekilde eklenir. Klinik kullanıcıları ise uygulamanın içinden, **Klinikler → Yeni klinik ekle** sayfasından oluşturulur (bkz. 5. bölüm).

## 3. Vercel

1. [vercel.com](https://vercel.com) → GitHub hesabınızla giriş → **Add New → Project** → `Askepios` deposunu seçin → **Import**.
2. **Environment Variables** bölümüne şunları ekleyin (anahtarlar Supabase → **Project Settings → API Keys** sayfasında; adres aşağıda):

| Ad | Değer |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, `https://xxxx.supabase.co` biçiminde. Supabase'de üstteki **Connect** düğmesinde ya da **Project Settings → Data API** sayfasında yazar. Bulamazsanız **Project Settings → General**'daki **Project ID**'yi `https://PROJECT-ID.supabase.co` içine koyun. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Publishable** anahtar (eski adıyla `anon public`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** anahtar (eski adıyla `service_role`). Gizlidir; başka hiçbir yere yazmayın. |
| `ASKEPIOS_CONTACT_EMAIL` | Kliniklerin yazacağı Asklepios e-postası |
| `ASKEPIOS_CONTACT_WHATSAPP` | Asklepios WhatsApp numarası, ülke koduyla sadece rakam (`905xxxxxxxxx`) |
| `ASKEPIOS_LEGAL_NAME` | KVKK aydınlatma metninde veri sorumlusu olarak yazacak şirket unvanı (ör. `Asklepios Sağlık Turizmi Ltd. Şti.`) |

3. **Deploy**. Birkaç dakika sonra `askepios-xxxx.vercel.app` gibi bir adres verilir.
4. Supabase → **Authentication → URL Configuration** → **Site URL** alanına bu adresi yazın.

## 4. E-posta (rezervasyon bildirimleri ve şifre bağlantıları)

1. [resend.com](https://resend.com) hesabı açın, alan adınızı (`askepios.com`) doğrulayın.
2. Vercel'e şunları ekleyin: `RESEND_API_KEY`, `EMAIL_FROM` (ör. `Asklepios <bildirim@askepios.com>`),
   `ADMIN_NOTIFY_EMAILS` (virgülle ayrılmış yönetici adresleri), `APP_URL` (sitenin adresi, ör. `https://askepios.vercel.app`).

Bu değişkenler yoksa sistem e-posta göndermeden çalışmaya devam eder. `APP_URL` e-postalardaki bağlantıların
adresidir; e-posta kurulmamış olsa da tanımlanmalıdır, yoksa bağlantılar Vercel'in geçici dağıtım adresine gider.

## 5. Klinik kullanıcıları ve şifreler

- Yönetici **Klinikler → Yeni klinik ekle** sayfasında klinik bilgilerini ve giriş yapacak kişinin e-postasını girer.
  Kullanıcı adı yerine e-posta kullanılır. Şifreyi yönetici belirlemez.
- Kayıtta kullanıcıya tek kullanımlık bir **şifre belirleme bağlantısı** gider. Kullanıcı bağlantıyı açar,
  **Devam et**'e basar ve kendi şifresini belirler. Düz şifre hiçbir yere yazılmaz ve e-postayla yollanmaz.
- E-posta kurulu değilse ya da gönderilemezse bağlantı yöneticiye ekranda gösterilir; **Kopyala** ile alıp
  kullanıcıya WhatsApp ya da e-postayla iletebilir. Klinik sayfasındaki **Şifre bağlantısı gönder** yeni bağlantı üretir.
- Giriş sayfasında **Şifremi unuttum**, giriş yaptıktan sonra sağ üstteki isimden açılan **Hesabım** sayfasında
  **Şifre değiştir** bölümü vardır.
- E-postalar Supabase'in kendi e-posta servisinden değil Resend'den gider; Supabase'de SMTP ya da e-posta şablonu
  ayarı gerekmez.
- Bağlantının geçerlilik süresi Supabase → **Authentication → Sign In / Providers → Email → Email OTP Expiration**
  ayarıdır (varsayılan 1 saat). Bağlantıyı WhatsApp'tan ileteceksiniz bunu **86400** (24 saat) yapmanız önerilir.

## 6. KVKK ve kimlik bilgileri

- Klinik, talep gönderirken misafirlere aydınlatma metnini ilettiğini işaretlemek zorundadır. Metin `/kvkk` adresindedir
  (`src/app/kvkk/page.tsx`). Bu bir taslaktır; canlıya çıkmadan önce bir hukukçuya kontrol ettirin.
- T.C. Kimlik No / pasaport no, doğum tarihi ve cinsiyet konaklamadan (ya da ret/iptalden) 30 gün sonra silinir.
  Silme işini Supabase'in **pg_cron** eklentisi her gece yapar; migration eklentiyi açar ve işi kurar.
  Kontrol: Supabase → **Integrations → Cron** altında `purge-guest-identity` görünmelidir.
- Supabase bölgesi Frankfurt'tur (yurt dışı). Aydınlatma metni bunu genel olarak belirtir; hukukçunuz KVKK m.9
  kapsamında ek bir işlem gerekip gerekmediğini değerlendirmelidir.

## Şema değişince

Yeni bir migration eklendiğinde `npm run db:bundle` ile `supabase/kurulum.sql` yenilenir.
Canlıdaki projeye sadece **yeni** migration dosyası SQL Editor'da çalıştırılır; `kurulum.sql` boş bir proje içindir.

`supabase/duzeltmeler/` altındaki dosyalar, daha önce kurulmuş canlı projeyi yeni başlangıç verisine uyduran tek seferlik
düzeltmelerdir; SQL Editor'da bir kez çalıştırılır. Boş bir projeye `kurulum.sql` ile kurulum yapıldıysa gerekmez.

`supabase/otel-icerigi.sql` otellerin tanıtım bilgilerini, özelliklerini ve `public/otel-gorselleri/` altındaki görselleri
veritabanına bağlar; `kurulum.sql` bunu içerir. Sadece boş alanları doldurur, panelden girilen bilgilere dokunmaz.
