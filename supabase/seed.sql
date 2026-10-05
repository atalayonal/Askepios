-- Başlangıç verisi: "LERRA YIL SONU 2026" fiyat listesindeki 11 otel.
-- Her otelde listedeki gibi üç oda tipi var: Single (1 kişi), Double (2 kişi), Triple (3 kişi).
-- Fiyat gecelik oda fiyatıdır; odada daha az kişi kalsa da aynı oda fiyatı geçerlidir.
-- Fiyatlar 1 Eylül 2026'dan yıl sonuna kadar geçerli. Para birimi listede yazmıyor; şimdilik EUR varsayıldı.
-- Fiyatlar şimdilik genel fiyat olarak girildi (clinic_id boş).

begin;

with h as (
  insert into public.hotels (name, city) values ('Bricks Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 63), (2, 63), (3, 87)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('ADM Grand', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 63), (2, 63), (3, 78)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('La Quinta Basin Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 67), (2, 72), (3, 92)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('Martinenz Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 67), (2, 67), (3, 87)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('Glorious Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 63), (2, 63), (3, 85)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('Sorisso Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 69), (2, 69), (3, 88)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('Büyük Hamit Hotel', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 65), (2, 65), (3, 95)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('Holiday Inn Topkapı', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 78), (2, 78), (3, 98)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('Ramada Golden Horn', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 64), (2, 64), (3, 94)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('Ramada Florya', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 57), (2, 62), (3, 92)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

with h as (
  insert into public.hotels (name, city) values ('Business Life Bakırköy', 'İstanbul') returning id
), r as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select h.id, t.name_tr, t.name_en, t.max_occupancy
  from h, (values ('Single Oda', 'Single Room', 1), ('Double Oda', 'Double Room', 2), ('Triple Oda', 'Triple Room', 3))
    as t(name_tr, name_en, max_occupancy)
  returning id, max_occupancy
)
insert into public.room_rates (room_type_id, occupancy, price, currency, valid_from, valid_to)
select r.id, o.occupancy, p.price, 'EUR', '2026-09-01', '2026-12-31'
from r
join (values (1, 48), (2, 48), (3, 68)) as p(max_occupancy, price) on p.max_occupancy = r.max_occupancy
cross join generate_series(1, r.max_occupancy) as o(occupancy);

commit;
