-- Havalimanı transferi: klinik talebe geliş ve/veya dönüş transferi ekleyebilir.
-- Transfer fiyatı sistemde tutulmaz; Asklepios transferi ayarlayıp kliniğe ayrıca bildirir.
-- reservations.transfer: {"arrival": {"airport": "IST", "at": "2026-11-03T14:30", "flight": "TK1234"}, "departure": {...}}
-- Geliş için uçağın inişi, dönüş için kalkışı yazılır. Uçuş numarası isteğe bağlıdır.

alter table public.reservations add column transfer jsonb not null default '{}';

-- Transfer bilgisindeki ilk hatanın kodu; sorun yoksa null.
create or replace function public.transfer_error(p jsonb) returns text
language plpgsql immutable as $$
declare
  k text;
  leg jsonb;
begin
  if jsonb_typeof(p) <> 'object' then
    return 'invalid_transfer';
  end if;
  for k, leg in select * from jsonb_each(p) loop
    if k not in ('arrival', 'departure') or jsonb_typeof(leg) <> 'object' then
      return 'invalid_transfer';
    end if;
    if coalesce(leg ->> 'airport', '') !~ '^[A-Z]{3}$' then
      return 'transfer_airport_required';
    end if;
    if coalesce(leg ->> 'at', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
      return 'transfer_time_required';
    end if;
    begin
      perform (leg ->> 'at')::timestamp;
    exception when others then
      return 'transfer_time_required';
    end;
    if coalesce(leg ->> 'flight', '') !~ '^[A-Z0-9 ]{0,10}$' then
      return 'invalid_flight_no';
    end if;
  end loop;
  return null;
end;
$$;

-- Sadece bilinen alanlar saklanır.
create or replace function public.clean_transfer(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object('airport', leg ->> 'airport', 'at', leg ->> 'at', 'flight', coalesce(leg ->> 'flight', ''))), '{}')
  from jsonb_each(p) as e(k, leg);
$$;

drop function public.create_reservation_request(uuid, date, date, jsonb, text, boolean);

create or replace function public.create_reservation_request(
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests jsonb,
  p_notes text default '',
  p_consent boolean default false,
  p_transfer jsonb default '{}'
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
  v_transfer_error text;
begin
  if v_clinic_id is null then
    raise exception 'not_clinic_user' using errcode = '42501';
  end if;

  -- Satır kilidi: aynı oda tipine aynı anda gelen talepler kontenjanı sırayla kontrol eder.
  select * into v_room from public.room_types where id = p_room_type_id and is_active for update;
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
  v_transfer_error := public.transfer_error(coalesce(p_transfer, '{}'));
  if v_transfer_error is not null then
    raise exception '%', v_transfer_error using errcode = '22023';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'consent_required' using errcode = '22023';
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
    hotel_name, room_name, price_breakdown, total_price, currency, clinic_notes, guest_consent_at, transfer
  ) values (
    v_clinic_id, auth.uid(), v_hotel.id, v_room.id, p_check_in, p_check_out, v_guest_count,
    v_hotel.name, v_room.name_tr, v_breakdown, v_total, v_currency, coalesce(trim(p_notes), ''), now(),
    public.clean_transfer(coalesce(p_transfer, '{}'))
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

revoke execute on function public.create_reservation_request(uuid, date, date, jsonb, text, boolean, jsonb) from public, anon;
grant execute on function public.create_reservation_request(uuid, date, date, jsonb, text, boolean, jsonb) to authenticated;
