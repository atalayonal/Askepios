-- Başlangıç verisi: "LERRA YIL SONU 2026" fiyat listesindeki 11 otel.
-- Fiyatlar 1 Eylül 2026'dan yıl sonuna kadar geçerli, gecelik oda fiyatı, kişi sayısına göre.
-- Para birimi listede yazmıyor; şimdilik EUR varsayıldı.
-- Fiyatlar şimdilik genel fiyat olarak girildi (clinic_id boş).

begin;

with h as (
  insert into public.hotels (name, city) values ('Bricks Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 63), (2, 63), (3, 87)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('ADM Grand', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 63), (2, 63), (3, 78)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('La Quinta Basin Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 67), (2, 72), (3, 92)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('Martinenz Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 67), (2, 67), (3, 87)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('Glorious Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 63), (2, 63), (3, 85)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('Sorisso Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 69), (2, 69), (3, 88)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('Büyük Hamit Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 65), (2, 65), (3, 95)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('Holiday Inn Topkapı', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 78), (2, 78), (3, 98)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('Ramada Golden Horn', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 64), (2, 64), (3, 94)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('Ramada Florya', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 57), (2, 62), (3, 92)) as v(occupancy, price);

with h as (
  insert into public.hotels (name, city) values ('Business Life Bakırköy', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select id, 'Standart Oda', 'Standard Room', 3 from h returning id
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, v.occupancy, v.price, 'EUR', '2026-09-01', '2026-12-31'
from r, (values (1, 48), (2, 48), (3, 68)) as v(occupancy, price);

commit;
