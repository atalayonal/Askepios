-- Otel ve oda özellikleri (Wi-Fi, otopark, minibar vb.) ve oda büyüklüğü.
-- Özellikler sabit anahtarlarla tutulur (ör. 'wifi'); etiket ve simgeler uygulamada (src/lib/amenities.ts).
-- Yeni tablo yok; mevcut RLS politikaları bu sütunları da kapsar.

alter table public.hotels
  add column if not exists amenities text[] not null default '{}';

alter table public.room_types
  add column if not exists amenities text[] not null default '{}',
  add column if not exists size_m2 smallint check (size_m2 is null or size_m2 between 5 and 500);
