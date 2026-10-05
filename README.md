# Askepios Rezervasyon

Askepios'un kliniklere otel ve oda sunduğu, kliniklerin rezervasyon talebi oluşturduğu kapalı web sistemi.

## Yapı

- **Uygulama:** Next.js (App Router, TypeScript, Tailwind CSS). Admin paneli ve klinik arayüzü aynı uygulamada.
- **Veritabanı, giriş, görseller:** Supabase (PostgreSQL + Auth + Storage).
- **Klinik izolasyonu:** PostgreSQL Row Level Security. Kurallar `supabase/migrations/` içinde.
- **İş kuralları:** Rezervasyon talebi ve durum değişikliği veritabanı fonksiyonlarıyla yapılır
  (`create_reservation_request`, `change_reservation_status`); müsaitlik, fiyat ve yetki kontrolleri oradadır.

## Klasörler

| Klasör | İçerik |
|---|---|
| `src/app` | Sayfalar |
| `src/lib/supabase` | Sunucu ve tarayıcı Supabase istemcileri |
| `supabase/migrations` | Veritabanı şeması, RLS kuralları, iş kuralı fonksiyonları |
| `supabase/seed.sql` | Başlangıç verisi (11 otel ve fiyatları) |
| `tests/db` | Veritabanı kurallarının otomatik testleri |

## İlk kurulum

Supabase ve Vercel kurulumu için: [docs/KURULUM.md](docs/KURULUM.md)

## Yerelde çalıştırma

```bash
npm ci
cp .env.example .env.local   # Supabase bilgilerini doldurun
npm run dev
```

## Testler

Testler PostgreSQL 16'ya bağlanır, her çalıştırmada geçici bir veritabanı kurar ve siler.

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:54329/postgres npm test
```

`supabase/tests/supabase-shim.sql`, Supabase'in hazır sağladığı `auth` şemasını ve rolleri sadece testler için taklit eder.

## Kontroller

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Kullanıcılar

- Açık kayıt yoktur. Klinik kullanıcılarını admin, **Klinikler** sayfasından oluşturur; sistem geçici bir şifre üretir ve bir kez gösterir. Kullanıcı ilk girişte kendi şifresini belirler.
- İlk Askepios yöneticisi [docs/KURULUM.md](docs/KURULUM.md) adımlarıyla ya da komut satırından oluşturulur:

```bash
node --env-file=.env.local scripts/create-admin.mjs ad@askepios.com "Ad Soyad"
```
