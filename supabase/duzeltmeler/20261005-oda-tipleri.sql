-- Kurulumu 5 Ekim 2026'dan önce yapılmış bir projede tek seferlik düzeltme.
-- Her oteldeki tek "Standart Oda"yı, fiyat listesindeki gibi üç oda tipine böler:
-- Single Oda (1 kişi), Double Oda (2 kişi), Triple Oda (3 kişi).
-- Eski odanın kişi sayısına göre fiyatları yeni odalara taşınır; odada daha az kişi kalsa da
-- o odanın fiyatı geçerlidir. Tekrar çalıştırılırsa bir şey değiştirmez.

begin;

-- Single ve Triple odaları ekle, fiyatlarını eski odanın 1 ve 3 kişilik fiyatından al.
with eski as (
  select rt.id, rt.hotel_id
  from public.room_types rt
  where rt.name_tr = 'Standart Oda'
), yeni as (
  insert into public.room_types (hotel_id, name_tr, name_en, max_occupancy)
  select e.hotel_id, t.name_tr, t.name_en, t.max_occupancy
  from eski e, (values ('Single Oda', 'Single Room', 1), ('Triple Oda', 'Triple Room', 3)) as t(name_tr, name_en, max_occupancy)
  returning id, hotel_id, max_occupancy
)
insert into public.room_rates (room_type_id, clinic_id, occupancy, price, currency, valid_from, valid_to)
select y.id, rr.clinic_id, o.occupancy, rr.price, rr.currency, rr.valid_from, rr.valid_to
from yeni y
join eski e on e.hotel_id = y.hotel_id
join public.room_rates rr on rr.room_type_id = e.id and rr.occupancy = y.max_occupancy
cross join generate_series(1, y.max_occupancy) as o(occupancy);

-- Eski odayı Double yap: 1 kişilik fiyatı 2 kişilik fiyata eşitle, 3 kişilik fiyatı sil.
update public.room_rates r1
set price = r2.price
from public.room_rates r2, public.room_types rt
where rt.name_tr = 'Standart Oda'
  and r1.room_type_id = rt.id and r1.occupancy = 1
  and r2.room_type_id = rt.id and r2.occupancy = 2
  and r2.clinic_id is not distinct from r1.clinic_id
  and r2.valid_from = r1.valid_from;

delete from public.room_rates r
using public.room_types rt
where rt.name_tr = 'Standart Oda' and r.room_type_id = rt.id and r.occupancy > 2;

update public.room_types
set name_tr = 'Double Oda', name_en = 'Double Room', max_occupancy = 2
where name_tr = 'Standart Oda';

commit;
