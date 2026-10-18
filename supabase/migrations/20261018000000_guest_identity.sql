-- Misafirden otel girişinde (Kimlik Bildirim Sistemi) istenen bilgiler zorunlu olur:
-- uyruk (ISO ülke kodu), T.C. vatandaşı için T.C. Kimlik No, diğerleri için pasaport no, doğum tarihi ve cinsiyet.
-- Eski rezervasyonların misafirlerinde bu alanlar boş kalabilir; kural yeni talepler için create_reservation_request'te uygulanır.

alter table public.reservation_guests add column id_number text not null default '';
alter table public.reservation_guests add column birth_date date;
alter table public.reservation_guests add column gender text not null default '' check (gender in ('', 'F', 'M'));

-- T.C. Kimlik No algoritma kontrolü (11 hane, ilk hane 0 değil, 10. ve 11. hane kontrol haneleri).
create or replace function public.is_valid_tckn(p text) returns boolean
language plpgsql immutable as $$
declare
  d int[];
begin
  if p is null or p !~ '^[1-9][0-9]{10}$' then
    return false;
  end if;
  select array_agg(substr(p, i, 1)::int order by i) into d from generate_series(1, 11) i;
  return d[10] = (((d[1] + d[3] + d[5] + d[7] + d[9]) * 7 - (d[2] + d[4] + d[6] + d[8])) % 10 + 10) % 10
     and d[11] = (d[1] + d[2] + d[3] + d[4] + d[5] + d[6] + d[7] + d[8] + d[9] + d[10]) % 10;
end;
$$;

-- Bir misafirin kimlik bilgilerindeki ilk hatanın kodu; sorun yoksa null.
create or replace function public.guest_identity_error(g jsonb) returns text
language plpgsql stable as $$
declare
  v_nationality text := upper(trim(coalesce(g ->> 'nationality', '')));
  v_id text := upper(regexp_replace(coalesce(g ->> 'id_number', ''), '\s', '', 'g'));
  v_birth date;
begin
  if v_nationality !~ '^[A-Z]{2}$' then
    return 'guest_nationality_required';
  end if;
  if v_id = '' then
    return 'guest_id_required';
  end if;
  if v_nationality = 'TR' and not public.is_valid_tckn(v_id) then
    return 'invalid_tckn';
  end if;
  if v_nationality <> 'TR' and v_id !~ '^[A-Z0-9]{5,20}$' then
    return 'invalid_passport';
  end if;
  begin
    v_birth := (g ->> 'birth_date')::date;
  exception when others then
    return 'invalid_birth_date';
  end;
  if v_birth is null or v_birth > current_date or v_birth < date '1900-01-01' then
    return 'invalid_birth_date';
  end if;
  if coalesce(g ->> 'gender', '') not in ('F', 'M') then
    return 'guest_gender_required';
  end if;
  return null;
end;
$$;

create or replace function public.create_reservation_request(
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests jsonb,
  p_notes text default ''
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_clinic_id uuid := public.my_clinic_id();
  v_room public.room_types;
  v_hotel public.hotels;
  v_guest_count smallint;
  v_breakdown jsonb;
  v_total numeric;
  v_currencies integer;
  v_currency char(3);
  v_missing integer;
  v_id uuid;
  v_guest_error text;
begin
  if v_clinic_id is null then
    raise exception 'not_clinic_user' using errcode = '42501';
  end if;

  select * into v_room from public.room_types where id = p_room_type_id and is_active;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  select * into v_hotel from public.hotels where id = v_room.hotel_id and is_active;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.clinic_hotel_access where clinic_id = v_clinic_id and hotel_id = v_hotel.id
  ) then
    raise exception 'hotel_not_partnered' using errcode = '42501';
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  if p_check_in < current_date then
    raise exception 'check_in_in_past' using errcode = '22023';
  end if;
  if p_check_out - p_check_in > 60 then
    raise exception 'stay_too_long' using errcode = '22023';
  end if;

  if p_guests is null or jsonb_typeof(p_guests) <> 'array' then
    raise exception 'invalid_guests' using errcode = '22023';
  end if;
  v_guest_count := jsonb_array_length(p_guests);
  if v_guest_count < 1 or v_guest_count > v_room.max_occupancy then
    raise exception 'invalid_guest_count' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_guests) g
    where length(trim(coalesce(g ->> 'full_name', ''))) = 0
  ) then
    raise exception 'guest_name_required' using errcode = '22023';
  end if;
  select e into v_guest_error
  from jsonb_array_elements(p_guests) g, public.guest_identity_error(g) e
  where e is not null
  limit 1;
  if v_guest_error is not null then
    raise exception '%', v_guest_error using errcode = '22023';
  end if;

  if not public.is_room_available(v_room.id, p_check_in, p_check_out) then
    raise exception 'room_unavailable' using errcode = 'P0001';
  end if;

  select
    count(*) filter (where price is null),
    count(distinct currency),
    min(currency),
    sum(price),
    jsonb_agg(jsonb_build_object('night', night, 'price', price) order by night)
  into v_missing, v_currencies, v_currency, v_total, v_breakdown
  from public.stay_prices(v_room.id, v_clinic_id, v_guest_count, p_check_in, p_check_out);

  if v_missing > 0 or v_currencies <> 1 then
    raise exception 'price_not_available' using errcode = 'P0001';
  end if;

  insert into public.reservations (
    clinic_id, created_by, hotel_id, room_type_id, check_in, check_out, guest_count,
    hotel_name, room_name, price_breakdown, total_price, currency, clinic_notes
  ) values (
    v_clinic_id, auth.uid(), v_hotel.id, v_room.id, p_check_in, p_check_out, v_guest_count,
    v_hotel.name, v_room.name_tr, v_breakdown, v_total, v_currency, coalesce(trim(p_notes), '')
  ) returning id into v_id;

  insert into public.reservation_guests (reservation_id, position, full_name, nationality, phone, id_number, birth_date, gender)
  select v_id, ord::smallint, trim(g ->> 'full_name'),
         upper(trim(g ->> 'nationality')), coalesce(trim(g ->> 'phone'), ''),
         upper(regexp_replace(g ->> 'id_number', '\s', '', 'g')), (g ->> 'birth_date')::date, g ->> 'gender'
  from jsonb_array_elements(p_guests) with ordinality as t(g, ord);

  insert into public.reservation_status_history (reservation_id, from_status, to_status, changed_by)
  values (v_id, null, 'PENDING', auth.uid());

  return v_id;
end;
$$;
