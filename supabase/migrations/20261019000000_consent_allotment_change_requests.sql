-- Yayına hazırlık:
-- 1) KVKK: talepte kliniğin aydınlatma/rıza onayı zorunlu; misafir kimlik bilgileri konaklamadan sonra silinir.
-- 2) Oda kontenjanı: oda tipinden aynı geceye en fazla kaç oda verilebileceği (boşsa takip edilmez).
-- 3) Otel onay numarası: onay belgesinde (voucher) görünür.
-- 4) Klinikten iptal / değişiklik talebi; bekleyen talebi klinik kendisi geri çekebilir.

-- ---------------------------------------------------------------- KVKK

alter table public.reservations add column guest_consent_at timestamptz;
alter table public.reservation_guests add column identity_purged_at timestamptz;

-- Konaklaması biteli p_days gün olan (ya da reddedilip iptal edilip p_days gün geçen) rezervasyonların
-- misafirlerinden T.C. Kimlik No / pasaport no, doğum tarihi ve cinsiyet silinir. Ad ve uyruk muhasebe için kalır.
create or replace function public.purge_guest_identity(p_days integer default 30) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  update public.reservation_guests g
  set id_number = '', birth_date = null, gender = '', identity_purged_at = now()
  from public.reservations r
  where r.id = g.reservation_id
    and g.identity_purged_at is null
    and (
      r.check_out < current_date - p_days
      or (r.status in ('REJECTED', 'CANCELLED') and r.updated_at < now() - make_interval(days => p_days))
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_guest_identity(integer) from public, anon, authenticated;

-- Supabase'de pg_cron varsa silme her gece 03:15'te (UTC) çalışır. Yoksa (ör. yerel test) atlanır.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-guest-identity', '15 3 * * *', 'select public.purge_guest_identity(30)');
  end if;
end
$$;

-- ---------------------------------------------------------------- oda kontenjanı

alter table public.room_types add column room_count smallint check (room_count between 1 and 500);
create index on public.reservations (room_type_id, check_in);

-- Aralıktaki her gecede kontenjanda yer var mı? Onaylılar her zaman, bekleyenler istenirse sayılır.
-- p_exclude: kendisi sayılmayacak rezervasyon (onaylanırken).
create or replace function public.room_has_capacity(
  p_room_type_id uuid, p_check_in date, p_check_out date, p_include_pending boolean, p_exclude uuid default null
)
returns boolean
language sql stable security definer set search_path = public as $$
  select rt.room_count is null or coalesce((
    select max(n) from (
      select count(*) as n
      from generate_series(p_check_in, p_check_out - 1, interval '1 day') as d
      join public.reservations r
        on r.room_type_id = p_room_type_id
       and r.check_in <= d::date and r.check_out > d::date
       and (r.status = 'CONFIRMED' or (p_include_pending and r.status = 'PENDING'))
       and r.id is distinct from p_exclude
      group by d
    ) nights
  ), 0) < rt.room_count
  from public.room_types rt
  where rt.id = p_room_type_id;
$$;

-- Müsaitlik: kapalı gece yok ve (kontenjan varsa) onaylı + bekleyen talepler kontenjanı doldurmamış.
create or replace function public.is_room_available(p_room_type_id uuid, p_check_in date, p_check_out date)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_check_out > p_check_in
    and not exists (
      select 1 from public.room_closures
      where room_type_id = p_room_type_id
        and daterange(date_from, date_to, '[]') && daterange(p_check_in, p_check_out, '[)')
    )
    and coalesce(public.room_has_capacity(p_room_type_id, p_check_in, p_check_out, true), false);
$$;

-- ---------------------------------------------------------------- otel onay numarası

alter table public.reservations add column hotel_confirmation_no text not null default '';

create or replace function public.set_hotel_confirmation_no(p_reservation_id uuid, p_value text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.reservations set hotel_confirmation_no = left(coalesce(trim(p_value), ''), 60) where id = p_reservation_id;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------- iptal / değişiklik talepleri

create table public.reservation_change_requests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  kind text not null check (kind in ('CANCEL', 'CHANGE')),
  message text not null default '',
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text not null default ''
);
create index on public.reservation_change_requests (reservation_id, created_at);
create index on public.reservation_change_requests (status, created_at);
-- Bir rezervasyonda aynı anda tek açık talep olur.
create unique index reservation_change_requests_one_open on public.reservation_change_requests (reservation_id) where status = 'OPEN';

alter table public.reservation_change_requests enable row level security;
grant select, insert, update, delete on public.reservation_change_requests to authenticated;

create policy admin_all on public.reservation_change_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy clinic_own on public.reservation_change_requests for select to authenticated
  using (exists (
    select 1 from public.reservations r
    where r.id = reservation_id and r.clinic_id = public.my_clinic_id()
  ));

-- Klinik, kendi bekleyen talebini geri çeker (iptal edilmiş olur).
create or replace function public.withdraw_reservation_request(p_reservation_id uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_clinic_id uuid := public.my_clinic_id();
  v_status public.reservation_status;
begin
  if v_clinic_id is null then
    raise exception 'not_clinic_user' using errcode = '42501';
  end if;
  select status into v_status from public.reservations
  where id = p_reservation_id and clinic_id = v_clinic_id
  for update;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'PENDING' then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  update public.reservations set status = 'CANCELLED' where id = p_reservation_id;
  insert into public.reservation_status_history (reservation_id, from_status, to_status, changed_by, note)
  values (p_reservation_id, 'PENDING', 'CANCELLED', auth.uid(), coalesce(trim(p_note), ''));
  update public.reservation_change_requests
  set status = 'RESOLVED', resolved_by = auth.uid(), resolved_at = now()
  where reservation_id = p_reservation_id and status = 'OPEN';
end;
$$;

-- Klinik, onaylı (ya da bekleyen) rezervasyonu için iptal veya değişiklik ister; Asklepios otelle görüşüp karar verir.
create or replace function public.request_reservation_change(p_reservation_id uuid, p_kind text, p_message text default '')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_clinic_id uuid := public.my_clinic_id();
  v_status public.reservation_status;
  v_message text := left(coalesce(trim(p_message), ''), 2000);
  v_id uuid;
begin
  if v_clinic_id is null then
    raise exception 'not_clinic_user' using errcode = '42501';
  end if;
  select status into v_status from public.reservations
  where id = p_reservation_id and clinic_id = v_clinic_id
  for update;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if p_kind not in ('CANCEL', 'CHANGE') then
    raise exception 'invalid_change_kind' using errcode = '22023';
  end if;
  if v_status not in ('PENDING', 'CONFIRMED') then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;
  if p_kind = 'CHANGE' and v_message = '' then
    raise exception 'change_message_required' using errcode = '22023';
  end if;
  if exists (select 1 from public.reservation_change_requests where reservation_id = p_reservation_id and status = 'OPEN') then
    raise exception 'change_request_open' using errcode = '23505';
  end if;

  insert into public.reservation_change_requests (reservation_id, kind, message, created_by)
  values (p_reservation_id, p_kind, v_message, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Admin, değişiklik talebini otelle hallettikten sonra kapatır.
create or replace function public.resolve_change_request(p_request_id uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.reservation_change_requests
  set status = 'RESOLVED', resolved_by = auth.uid(), resolved_at = now(), resolution_note = coalesce(trim(p_note), '')
  where id = p_request_id and status = 'OPEN';
  if not found then
    raise exception 'change_request_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Admin durum değişikliği: onaylarken kontenjan kontrol edilir; iptal/ret açık talepleri kapatır.
create or replace function public.change_reservation_status(
  p_reservation_id uuid,
  p_new_status public.reservation_status,
  p_note text default ''
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_res public.reservations;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  if not (
    (v_res.status = 'PENDING' and p_new_status in ('CONFIRMED', 'REJECTED', 'CANCELLED'))
    or (v_res.status = 'CONFIRMED' and p_new_status = 'CANCELLED')
  ) then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  if p_new_status = 'CONFIRMED' then
    -- Aynı oda tipine aynı anda iki onay gelirse ikincisi birincinin bitmesini bekler.
    perform 1 from public.room_types where id = v_res.room_type_id for update;
    if not public.room_has_capacity(v_res.room_type_id, v_res.check_in, v_res.check_out, false, v_res.id) then
      raise exception 'no_rooms_left' using errcode = 'P0001';
    end if;
  end if;

  update public.reservations set status = p_new_status where id = p_reservation_id;

  insert into public.reservation_status_history (reservation_id, from_status, to_status, changed_by, note)
  values (p_reservation_id, v_res.status, p_new_status, auth.uid(), coalesce(trim(p_note), ''));

  if p_new_status in ('REJECTED', 'CANCELLED') then
    update public.reservation_change_requests
    set status = 'RESOLVED', resolved_by = auth.uid(), resolved_at = now(), resolution_note = coalesce(trim(p_note), '')
    where reservation_id = p_reservation_id and status = 'OPEN';
  end if;
end;
$$;

-- ---------------------------------------------------------------- talep oluşturma: KVKK onayı ve kontenjan kilidi

drop function public.create_reservation_request(uuid, date, date, jsonb, text);

create or replace function public.create_reservation_request(
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests jsonb,
  p_notes text default '',
  p_consent boolean default false
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
    hotel_name, room_name, price_breakdown, total_price, currency, clinic_notes, guest_consent_at
  ) values (
    v_clinic_id, auth.uid(), v_hotel.id, v_room.id, p_check_in, p_check_out, v_guest_count,
    v_hotel.name, v_room.name_tr, v_breakdown, v_total, v_currency, coalesce(trim(p_notes), ''), now()
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

-- ---------------------------------------------------------------- yetkiler

revoke execute on function
  public.room_has_capacity(uuid, date, date, boolean, uuid),
  public.set_hotel_confirmation_no(uuid, text),
  public.withdraw_reservation_request(uuid, text),
  public.request_reservation_change(uuid, text, text),
  public.resolve_change_request(uuid, text),
  public.create_reservation_request(uuid, date, date, jsonb, text, boolean)
from public, anon;

grant execute on function
  public.set_hotel_confirmation_no(uuid, text),
  public.withdraw_reservation_request(uuid, text),
  public.request_reservation_change(uuid, text, text),
  public.resolve_change_request(uuid, text),
  public.create_reservation_request(uuid, date, date, jsonb, text, boolean)
to authenticated;
