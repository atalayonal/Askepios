-- Askepios: Supabase SQL Editor'a yapıştırılacak kurulum dosyası (sadece boş bir projede, bir kez).
-- Bu dosya otomatik üretilir: npm run db:bundle

-- ===== supabase/migrations/20261005000000_init.sql
-- Askepios rezervasyon sistemi: başlangıç şeması.
-- Klinik izolasyonu Row Level Security (RLS) ile veritabanında uygulanır;
-- rezervasyon oluşturma ve durum değiştirme yalnızca aşağıdaki fonksiyonlar üzerinden yapılır.

create extension if not exists btree_gist;

create type public.app_role as enum ('admin', 'clinic_user');
create type public.reservation_status as enum ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- klinikler ve kullanıcılar

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null,
  clinic_id uuid references public.clinics (id) on delete restrict,
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_clinic check (
    (role = 'admin' and clinic_id is null) or (role = 'clinic_user' and clinic_id is not null)
  )
);
create index on public.profiles (clinic_id);

-- Oturumdaki kullanıcının rolü ve kliniği. RLS politikaları bunları kullanır.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.my_clinic_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.clinic_id
  from public.profiles p
  join public.clinics c on c.id = p.clinic_id
  where p.id = auth.uid() and p.role = 'clinic_user' and p.is_active and c.is_active;
$$;

-- ---------------------------------------------------------------- oteller ve odalar

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  city text not null default '',
  district text not null default '',
  address text not null default '',
  description_tr text not null default '',
  description_en text not null default '',
  stars smallint check (stars between 1 and 5),
  website text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Otelin iletişim bilgileri sadece Askepios içindir; klinikler Askepios ile iletişime geçer.
create table public.hotel_contacts (
  hotel_id uuid primary key references public.hotels (id) on delete cascade,
  contact_person text,
  phone text,
  email text,
  whatsapp text,
  internal_notes text not null default '',
  updated_at timestamptz not null default now()
);

create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete restrict,
  name_tr text not null check (length(trim(name_tr)) > 0),
  name_en text not null default '',
  description_tr text not null default '',
  description_en text not null default '',
  max_occupancy smallint not null default 3 check (max_occupancy between 1 and 10),
  bed_info text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.room_types (hotel_id);

-- Görseller Supabase Storage'da tutulur; burada sadece yol ve sıra bilgisi var.
-- room_type_id boşsa görsel otelin genel görselidir.
create table public.hotel_images (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  room_type_id uuid references public.room_types (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.hotel_images (hotel_id, sort_order);

-- Hangi klinik hangi otelde rezervasyon talebi oluşturabilir ("anlaşmalı otel").
create table public.clinic_hotel_access (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clinic_id, hotel_id)
);
create index on public.clinic_hotel_access (hotel_id);

-- ---------------------------------------------------------------- fiyatlar ve müsaitlik

-- Gecelik oda fiyatı, kişi sayısına göre (1 = single, 2 = double, 3 = triple).
-- clinic_id boşsa genel fiyattır; doluysa o kliniğe özel fiyattır ve genel fiyatın önüne geçer.
-- valid_from ve valid_to dahildir (gece tarihleri).
create table public.room_rates (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.room_types (id) on delete cascade,
  clinic_id uuid references public.clinics (id) on delete cascade,
  occupancy smallint not null check (occupancy between 1 and 10),
  price numeric(10, 2) not null check (price >= 0),
  currency char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  valid_from date not null,
  valid_to date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_rates_period check (valid_to >= valid_from),
  constraint room_rates_no_overlap exclude using gist (
    room_type_id with =,
    (coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    occupancy with =,
    daterange(valid_from, valid_to, '[]') with &&
  )
);

-- Oda varsayılan olarak müsaittir; admin sadece müsait olmayan tarih aralıklarını girer.
create table public.room_closures (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.room_types (id) on delete cascade,
  date_from date not null,
  date_to date not null,
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint room_closures_period check (date_to >= date_from)
);
create index on public.room_closures using gist (room_type_id, daterange(date_from, date_to, '[]'));

-- ---------------------------------------------------------------- rezervasyonlar

create sequence public.reservation_number_seq;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique
    default ('ASK-' || lpad(nextval('public.reservation_number_seq')::text, 6, '0')),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  hotel_id uuid not null references public.hotels (id) on delete restrict,
  room_type_id uuid not null references public.room_types (id) on delete restrict,
  check_in date not null,
  check_out date not null,
  guest_count smallint not null check (guest_count between 1 and 10),
  -- Talep anındaki bilgilerin kopyası: otel/oda/fiyat sonradan değişse de rezervasyon değişmez.
  hotel_name text not null,
  room_name text not null,
  price_breakdown jsonb not null,
  total_price numeric(12, 2) not null check (total_price >= 0),
  currency char(3) not null,
  clinic_notes text not null default '',
  status public.reservation_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_dates check (check_out > check_in)
);
create index on public.reservations (clinic_id, created_at desc);
create index on public.reservations (status, check_in);

create table public.reservation_guests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  position smallint not null,
  full_name text not null check (length(trim(full_name)) > 0),
  nationality text not null default '',
  phone text not null default '',
  unique (reservation_id, position)
);

create table public.reservation_status_history (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  from_status public.reservation_status,
  to_status public.reservation_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text not null default '',
  changed_at timestamptz not null default now()
);
create index on public.reservation_status_history (reservation_id, changed_at);

-- Askepios'un iç notları; klinik göremez.
create table public.reservation_admin_notes (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index on public.reservation_admin_notes (reservation_id, created_at);

create trigger set_updated_at before update on public.clinics for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.hotels for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.hotel_contacts for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.room_types for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.room_rates for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reservations for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- iş kuralları

-- Giriş ve çıkış arasındaki her gece müsait mi? (çıkış günü gece sayılmaz)
create or replace function public.is_room_available(p_room_type_id uuid, p_check_in date, p_check_out date)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_check_out > p_check_in and not exists (
    select 1 from public.room_closures
    where room_type_id = p_room_type_id
      and daterange(date_from, date_to, '[]') && daterange(p_check_in, p_check_out, '[)')
  );
$$;

-- Her gece için fiyat; kliniğe özel fiyat varsa o, yoksa genel fiyat.
-- Fiyatı olmayan gece için price boş döner.
create or replace function public.stay_prices(
  p_room_type_id uuid, p_clinic_id uuid, p_occupancy smallint, p_check_in date, p_check_out date
)
returns table (night date, price numeric, currency char(3))
language sql stable security definer set search_path = public as $$
  select d::date as night, r.price, r.currency
  from generate_series(p_check_in, p_check_out - 1, interval '1 day') as d
  left join lateral (
    select rr.price, rr.currency
    from public.room_rates rr
    where rr.room_type_id = p_room_type_id
      and rr.occupancy = p_occupancy
      and d::date between rr.valid_from and rr.valid_to
      and (rr.clinic_id = p_clinic_id or rr.clinic_id is null)
    order by rr.clinic_id nulls last
    limit 1
  ) r on true
  order by d;
$$;

-- Klinik kullanıcısının rezervasyon talebi. Bütün kontroller burada, sunucuda yapılır;
-- klinik bilgisi istemciden değil oturumdan alınır.
-- p_guests: [{"full_name": "...", "nationality": "...", "phone": "..."}, ...]
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

  insert into public.reservation_guests (reservation_id, position, full_name, nationality, phone)
  select v_id, ord::smallint, trim(g ->> 'full_name'),
         coalesce(trim(g ->> 'nationality'), ''), coalesce(trim(g ->> 'phone'), '')
  from jsonb_array_elements(p_guests) with ordinality as t(g, ord);

  insert into public.reservation_status_history (reservation_id, from_status, to_status, changed_by)
  values (v_id, null, 'PENDING', auth.uid());

  return v_id;
end;
$$;

-- Admin durum değişikliği. İzin verilen geçişler:
-- PENDING -> CONFIRMED | REJECTED | CANCELLED, CONFIRMED -> CANCELLED
create or replace function public.change_reservation_status(
  p_reservation_id uuid,
  p_new_status public.reservation_status,
  p_note text default ''
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current public.reservation_status;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select status into v_current from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  if not (
    (v_current = 'PENDING' and p_new_status in ('CONFIRMED', 'REJECTED', 'CANCELLED'))
    or (v_current = 'CONFIRMED' and p_new_status = 'CANCELLED')
  ) then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  update public.reservations set status = p_new_status where id = p_reservation_id;

  insert into public.reservation_status_history (reservation_id, from_status, to_status, changed_by, note)
  values (p_reservation_id, v_current, p_new_status, auth.uid(), coalesce(trim(p_note), ''));
end;
$$;

-- ---------------------------------------------------------------- yetkiler ve RLS

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on function
  public.is_admin(),
  public.my_clinic_id(),
  public.is_room_available(uuid, date, date),
  public.create_reservation_request(uuid, date, date, jsonb, text),
  public.change_reservation_status(uuid, public.reservation_status, text)
to authenticated;

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.hotels enable row level security;
alter table public.hotel_contacts enable row level security;
alter table public.room_types enable row level security;
alter table public.hotel_images enable row level security;
alter table public.clinic_hotel_access enable row level security;
alter table public.room_rates enable row level security;
alter table public.room_closures enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_guests enable row level security;
alter table public.reservation_status_history enable row level security;
alter table public.reservation_admin_notes enable row level security;

-- Admin her tabloda her şeyi yapabilir.
create policy admin_all on public.clinics for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.hotels for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.hotel_contacts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.room_types for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.hotel_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.clinic_hotel_access for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.room_rates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.room_closures for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_select on public.reservations for select to authenticated using (public.is_admin());
create policy admin_select on public.reservation_guests for select to authenticated using (public.is_admin());
create policy admin_select on public.reservation_status_history for select to authenticated using (public.is_admin());
create policy admin_all on public.reservation_admin_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Klinik kullanıcısı: sadece okuma, sadece kendi kliniğine ait olanlar.
create policy clinic_own on public.clinics for select to authenticated
  using (id = public.my_clinic_id());

create policy self_read on public.profiles for select to authenticated
  using (id = auth.uid());

-- Aktif oteller, odalar ve görseller tüm kliniklere görünür (anlaşmasız oteller dahil).
create policy clinic_read_active on public.hotels for select to authenticated
  using (public.my_clinic_id() is not null and is_active);

create policy clinic_read_active on public.room_types for select to authenticated
  using (
    public.my_clinic_id() is not null and is_active
    and exists (select 1 from public.hotels h where h.id = hotel_id and h.is_active)
  );

create policy clinic_read_active on public.hotel_images for select to authenticated
  using (
    public.my_clinic_id() is not null
    and exists (select 1 from public.hotels h where h.id = hotel_id and h.is_active)
  );

create policy clinic_own on public.clinic_hotel_access for select to authenticated
  using (clinic_id = public.my_clinic_id());

-- Fiyatları ve müsaitliği sadece anlaşmalı otellerde, sadece genel ya da kendi fiyatını görür.
create policy clinic_partnered on public.room_rates for select to authenticated
  using (
    (clinic_id is null or clinic_id = public.my_clinic_id())
    and exists (
      select 1 from public.room_types rt
      join public.clinic_hotel_access a on a.hotel_id = rt.hotel_id
      where rt.id = room_type_id and a.clinic_id = public.my_clinic_id()
    )
  );

create policy clinic_partnered on public.room_closures for select to authenticated
  using (
    exists (
      select 1 from public.room_types rt
      join public.clinic_hotel_access a on a.hotel_id = rt.hotel_id
      where rt.id = room_type_id and a.clinic_id = public.my_clinic_id()
    )
  );

create policy clinic_own on public.reservations for select to authenticated
  using (clinic_id = public.my_clinic_id());

create policy clinic_own on public.reservation_guests for select to authenticated
  using (exists (
    select 1 from public.reservations r
    where r.id = reservation_id and r.clinic_id = public.my_clinic_id()
  ));

create policy clinic_own on public.reservation_status_history for select to authenticated
  using (exists (
    select 1 from public.reservations r
    where r.id = reservation_id and r.clinic_id = public.my_clinic_id()
  ));


-- ===== supabase/migrations/20261005010000_must_change_password.sql
-- Admin, kullanıcıyı geçici şifreyle oluşturur; kullanıcı ilk girişte şifresini değiştirmek zorundadır.
alter table public.profiles add column must_change_password boolean not null default true;

-- Kullanıcı sadece kendi şifre değiştirme bayrağını kapatabilir.
create or replace function public.mark_password_changed() returns void
language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

revoke execute on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated;


-- ===== supabase/migrations/20261005020000_hotel_images_storage.sql
-- Otel ve oda görselleri için özel (public olmayan) depolama alanı.
-- Görselleri sadece giriş yapmış admin ve aktif klinik kullanıcıları görebilir; sadece admin yükler/siler.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hotel-images', 'hotel-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy hotel_images_read on storage.objects for select to authenticated
  using (bucket_id = 'hotel-images' and (public.is_admin() or public.my_clinic_id() is not null));

create policy hotel_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'hotel-images' and public.is_admin());

create policy hotel_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'hotel-images' and public.is_admin());

create policy hotel_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'hotel-images' and public.is_admin());


-- ===== supabase/migrations/20261005030000_set_room_availability.sql
-- Admin, seçtiği odalar için bir tarih aralığını müsait ya da kapalı yapar.
-- Mevcut kapalı aralıklar gerekirse bölünür; sonuçta aralıktaki her gece istenen durumda olur.
create or replace function public.set_room_availability(
  p_room_type_ids uuid[],
  p_from date,
  p_to date,
  p_available boolean,
  p_note text default ''
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.room_closures;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  if p_to - p_from > 366 then
    raise exception 'range_too_long' using errcode = '22023';
  end if;

  for c in
    select * from public.room_closures
    where room_type_id = any (p_room_type_ids)
      and daterange(date_from, date_to, '[]') && daterange(p_from, p_to, '[]')
    for update
  loop
    delete from public.room_closures where id = c.id;
    if c.date_from < p_from then
      insert into public.room_closures (room_type_id, date_from, date_to, note, created_by)
      values (c.room_type_id, c.date_from, p_from - 1, c.note, c.created_by);
    end if;
    if c.date_to > p_to then
      insert into public.room_closures (room_type_id, date_from, date_to, note, created_by)
      values (c.room_type_id, p_to + 1, c.date_to, c.note, c.created_by);
    end if;
  end loop;

  if not p_available then
    insert into public.room_closures (room_type_id, date_from, date_to, note, created_by)
    select id, p_from, p_to, coalesce(trim(p_note), ''), auth.uid()
    from public.room_types
    where id = any (p_room_type_ids);
  end if;
end;
$$;

revoke execute on function public.set_room_availability(uuid[], date, date, boolean, text) from public, anon;
grant execute on function public.set_room_availability(uuid[], date, date, boolean, text) to authenticated;


-- ===== supabase/migrations/20261005040000_quote_reservation.sql
-- Klinik, talep göndermeden önce seçtiği oda ve tarihler için müsaitliği ve fiyatı görür.
-- create_reservation_request ile aynı kuralları uygular ama kayıt oluşturmaz.
create or replace function public.quote_reservation(
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count smallint
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_clinic_id uuid := public.my_clinic_id();
  v_room public.room_types;
  v_nights jsonb;
  v_total numeric;
  v_missing integer;
  v_currencies integer;
  v_currency char(3);
begin
  if v_clinic_id is null then
    raise exception 'not_clinic_user' using errcode = '42501';
  end if;

  select rt.* into v_room
  from public.room_types rt
  join public.hotels h on h.id = rt.hotel_id and h.is_active
  where rt.id = p_room_type_id and rt.is_active;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.clinic_hotel_access where clinic_id = v_clinic_id and hotel_id = v_room.hotel_id
  ) then
    raise exception 'hotel_not_partnered' using errcode = '42501';
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    return jsonb_build_object('ok', false, 'reason', 'invalid_dates');
  end if;
  if p_check_in < current_date then
    return jsonb_build_object('ok', false, 'reason', 'check_in_in_past');
  end if;
  if p_check_out - p_check_in > 60 then
    return jsonb_build_object('ok', false, 'reason', 'stay_too_long');
  end if;
  if p_guest_count is null or p_guest_count < 1 or p_guest_count > v_room.max_occupancy then
    return jsonb_build_object('ok', false, 'reason', 'invalid_guest_count');
  end if;
  if not public.is_room_available(v_room.id, p_check_in, p_check_out) then
    return jsonb_build_object('ok', false, 'reason', 'room_unavailable');
  end if;

  select
    count(*) filter (where price is null),
    count(distinct currency),
    min(currency),
    sum(price),
    jsonb_agg(jsonb_build_object('night', night, 'price', price) order by night)
  into v_missing, v_currencies, v_currency, v_total, v_nights
  from public.stay_prices(v_room.id, v_clinic_id, p_guest_count, p_check_in, p_check_out);

  if v_missing > 0 or v_currencies <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'price_not_available');
  end if;

  return jsonb_build_object('ok', true, 'nights', v_nights, 'total', v_total, 'currency', v_currency);
end;
$$;

revoke execute on function public.quote_reservation(uuid, date, date, smallint) from public, anon;
grant execute on function public.quote_reservation(uuid, date, date, smallint) to authenticated;


-- ===== supabase/migrations/20261008000000_hotel_features.sql
-- Otel ve oda özellikleri (Wi-Fi, otopark, minibar vb.) ve oda büyüklüğü.
-- Özellikler sabit anahtarlarla tutulur (ör. 'wifi'); etiket ve simgeler uygulamada (src/lib/amenities.ts).
-- Yeni tablo yok; mevcut RLS politikaları bu sütunları da kapsar.

alter table public.hotels
  add column if not exists amenities text[] not null default '{}';

alter table public.room_types
  add column if not exists amenities text[] not null default '{}',
  add column if not exists size_m2 smallint check (size_m2 is null or size_m2 between 5 and 500);


-- ===== supabase/seed.sql
-- Başlangıç verisi: "LERRA YIL SONU 2026" fiyat listesindeki 11 otel.
-- Her otelde listedeki gibi üç oda tipi var: Single (1 kişi), Double (2 kişi), Triple (3 kişi).
-- Fiyat gecelik oda fiyatıdır; odada daha az kişi kalsa da aynı oda fiyatı geçerlidir.
-- Fiyatlar 1 Eylül 2026'dan yıl sonuna kadar geçerli. Para birimi listede yazmıyor; şimdilik EUR varsayıldı.
-- Fiyatlar şimdilik genel fiyat olarak girildi (clinic_id boş).



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




-- ===== supabase/otel-icerigi.sql
-- Otellerin tanıtım bilgileri, özellikleri ve görselleri (8 Ekim 2026'da otellerin kendi siteleri ve
-- rezervasyon sitelerinden derlendi). Yıldız ve oda büyüklükleri doğrulanmadıysa boş bırakıldı.
-- Sadece boş alanları doldurur: panelden girilmiş bir bilgi varsa ona dokunmaz. Tekrar çalıştırılabilir.

update public.hotels h set
  district = case when h.district = '' then v.district else h.district end,
  address = case when h.address = '' then v.address else h.address end,
  stars = coalesce(h.stars, v.stars),
  website = coalesce(nullif(h.website, ''), v.website),
  description_tr = case when h.description_tr = '' then v.description_tr else h.description_tr end,
  description_en = case when h.description_en = '' then v.description_en else h.description_en end,
  amenities = case when h.amenities = '{}' then v.amenities else h.amenities end
from (values
  ('Bricks Hotel', 'Bahçelievler', 'Zafer Mah. Dumlupınar Cad. No:42 (E-5 yan yol), Yenibosna, 34197 Bahçelievler/İstanbul', 5, 'https://www.brickshotels.com/',
   'Bricks Hotel, Bahçelievler''in Yenibosna bölgesinde, E-5 yan yolu üzerinde yer alan bir iş ve kongre otelidir. CNR Expo ve İstanbul Fuar Merkezi''ne yaklaşık 2,5 km, İstanbul Havalimanı''na yaklaşık 40 km uzaklıktadır; İstanbul Havalimanı–Bakırköy otobüs hattının Kuleli Yenibosna durağı otele beş dakikalık yürüme mesafesindedir. Otelde iki restoran, teras restoran, kafe, toplantı salonları ile spa, Türk hamamı, sauna ve fitness merkezi bulunur.',
   'Bricks Hotel is a business and conference hotel in the Yenibosna area of Bahçelievler, on the E-5 service road. It is about 2.5 km from CNR Expo and the Istanbul Expo Center and roughly 40 km from Istanbul Airport; the Kuleli Yenibosna stop of the Istanbul Airport–Bakırköy shuttle bus is a five-minute walk away. Facilities include two restaurants, a terrace restaurant, a café, meeting rooms, a spa with Turkish bath and sauna, and a fitness centre.',
   array['wifi', 'parking', 'airport_shuttle', 'restaurant', 'room_service', 'reception_24h', 'fitness', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'family_rooms', 'accessible', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('ADM Grand', 'Bağcılar', 'Mahmutbey Mah. Taşocağı Yolu Cad. No:35, 34218 Bağcılar/İstanbul', 5, 'https://admgrandotel.com/',
   'ADM Grand Hotel, Bağcılar''ın Mahmutbey Mahallesi''nde, Başakşehir, İkitelli ve Mall of İstanbul çevresine yakın konumda 334 odalı bir şehir otelidir. İstanbul Havalimanı''na yaklaşık 35 km uzaklıktadır. Otelde Türk hamamı, sauna, buhar odası ve ısıtmalı kapalı havuz bulunan Santé Spa & Wellness merkezi, fitness salonu, iki restoran, toplantı ve düğün salonları ile ücretsiz kapalı otopark bulunur.',
   'ADM Grand Hotel is a 334-room city hotel in the Mahmutbey neighbourhood of Bağcılar, close to Başakşehir, İkitelli and Mall of Istanbul. It is about 35 km from Istanbul Airport. Facilities include the Santé Spa & Wellness centre with a Turkish bath, sauna, steam room and heated indoor pool, a fitness centre, two restaurants, meeting and wedding venues, and free covered parking.',
   array['wifi', 'parking', 'restaurant', 'reception_24h', 'fitness', 'pool', 'spa', 'sauna', 'hammam', 'elevator', 'accessible', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('La Quinta Basin Hotel', 'Bağcılar', '15 Temmuz Mah. Bahar Cad. No:61 (Basın Ekspres Yolu), 34212 Bağcılar/İstanbul', null, 'https://www.wyndhamhotels.com/laquinta/istanbul-turkiye/la-quinta-istanbul-gunesli/overview',
   'La Quinta by Wyndham İstanbul Güneşli, Bağcılar''da Basın Ekspres Yolu üzerinde, M9 metro hattına kısa yürüme mesafesinde yer alan 404 odalı bir oteldir. İstanbul Havalimanı''na 33 km, Sabiha Gökçen Havalimanı''na 63 km uzaklıkta olup İstanbul Fuar Merkezi ve CNR Expo''ya yakındır. Otelde kapalı havuz, sauna, Türk hamamı ve spa, fitness merkezi, restoranlar, balo salonu ve toplantı salonları ile ücretsiz otopark bulunur.',
   'La Quinta by Wyndham Istanbul Güneşli is a 404-room hotel on the Basın Ekspres road in Bağcılar, a short walk from the M9 metro line. It is 33 km from Istanbul Airport and 63 km from Sabiha Gökçen Airport, and close to the Istanbul Expo Center and CNR Expo. Facilities include an indoor pool, sauna, Turkish bath and spa, a fitness centre, restaurants, a ballroom with meeting rooms, and free parking.',
   array['wifi', 'parking', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'fitness', 'pool', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'accessible', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('Martinenz Hotel', 'Fatih', 'Mesihpaşa Mah. Koska Cad. No:4/1, Laleli, 34130 Fatih/İstanbul', 3, 'https://www.hotelmartinenz.com/',
   'Martinenz Hotel, Tarihi Yarımada''da Laleli''de, Koska Caddesi üzerinde yer alan 110 odalı bir şehir otelidir. 1990''da inşa edilen otel 2020''de tamamen yenilenmiştir; Kapalıçarşı ve tarihi alanlar yürüme mesafesindedir. Otelde 24 saat resepsiyon, restoran, ücretli oda servisi ve çamaşır hizmeti bulunur; otopark yoktur.',
   'Martinenz Hotel is a 110-room city hotel on Koska Street in Laleli, on Istanbul''s historic peninsula. Built in 1990 and fully renovated in 2020, it is within walking distance of the Grand Bazaar and the historic sites. The hotel has a 24-hour reception, a restaurant, paid room service and laundry; there is no parking.',
   array['wifi', 'restaurant', 'bar', 'room_service', 'reception_24h', 'elevator', 'non_smoking', 'laundry', 'concierge']::text[]),
  ('Glorious Hotel', 'Fatih', 'Ordu Cad. Yeşil Tulumba Sok. No:17, Laleli, 34130 Fatih/İstanbul', 4, 'https://www.glorioushotelistanbul.com/',
   'Glorious Hotel, Fatih''in Laleli semtinde, Ordu Caddesi''ne bağlı Yeşil Tulumba Sokak''ta yer alan 100 odalı bir oteldir. Kapalıçarşı yaklaşık 1 km, Sultanahmet ve Ayasofya yaklaşık 2–3 km uzaklıktadır; İstanbul Havalimanı ve Sabiha Gökçen Havalimanı''na uzaklığı yaklaşık 45 km''dir. Otelde restoran, bar, ısıtmalı kapalı havuz, hamam ve buhar odası bulunan spa ile toplantı salonu bulunur.',
   'Glorious Hotel is a 100-room hotel on Yeşil Tulumba Street off Ordu Avenue in Laleli, Fatih. The Grand Bazaar is about 1 km away and Sultanahmet and Hagia Sophia about 2–3 km; Istanbul Airport and Sabiha Gökçen Airport are each roughly 45 km away. The hotel has a restaurant, a bar, a spa with a heated indoor pool, Turkish bath and steam room, and a meeting room.',
   array['wifi', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'pool', 'spa', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('Sorisso Hotel', 'Fatih', 'Kemalpaşa Mah. Ordu Cad. No:60, Laleli, 34130 Fatih/İstanbul', 4, 'https://www.sorrisohotel.com/',
   'Sorriso Hotel, Fatih''in Laleli semtinde, Ordu Caddesi üzerinde yer alan dört yıldızlı bir oteldir. Aksaray tramvay durağına yaklaşık 100 m, Yenikapı metro ve Marmaray istasyonlarına yürüyerek 5 dakika uzaklıktadır; Kapalıçarşı yürüyerek yaklaşık 10, Sultanahmet yaklaşık 15 dakikadır. Otelde Türk ve dünya mutfağı sunan restoran, lobi bar ile sauna, buhar odası, jakuzi ve Türk hamamı bulunan spa merkezi vardır.',
   'Sorriso Hotel is a four-star hotel on Ordu Avenue in Laleli, Fatih. It is about 100 m from the Aksaray tram stop and a five-minute walk from the Yenikapı metro and Marmaray stations; the Grand Bazaar is about 10 minutes and Sultanahmet about 15 minutes away on foot. The hotel has a restaurant serving Turkish and international cuisine, a lobby bar, and a spa with sauna, steam room, jacuzzi and Turkish bath.',
   array['wifi', 'restaurant', 'bar', 'reception_24h', 'fitness', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'laundry', 'terrace', 'concierge']::text[]),
  ('Büyük Hamit Hotel', 'Fatih', 'Kemalpaşa Mah. Gençtürk Cad. No:72-74, 34134 Fatih/İstanbul', 4, 'https://www.hotelbuyukhamit.com/tr',
   'Büyük Hamit Hotel, Fatih''te Gençtürk Caddesi üzerinde yer alan dört yıldızlı bağımsız bir oteldir. Vezneciler metro istasyonuna 300 m, Laleli tramvay durağına 600 m uzaklıkta olup Çemberlitaş yaklaşık 1,5 km, Topkapı Sarayı yaklaşık 2,9 km mesafededir; İstanbul Havalimanı''na 41 km, Sabiha Gökçen Havalimanı''na 39 km uzaklıktadır. Otelde açık büfe kahvaltı sunulan restoran ve kafeterya bulunur, havaalanı transferi sağlanır; otopark yoktur.',
   'Büyük Hamit Hotel is an independent four-star hotel on Gençtürk Avenue in Fatih. It is 300 m from Vezneciler metro station and 600 m from the Laleli tram stop, about 1.5 km from Çemberlitaş and 2.9 km from Topkapı Palace; Istanbul Airport is 41 km and Sabiha Gökçen Airport 39 km away. The hotel has a restaurant serving a buffet breakfast and a cafeteria, and offers airport transfers; there is no parking.',
   array['wifi', 'airport_shuttle', 'restaurant', 'elevator', 'breakfast']::text[]),
  ('Holiday Inn Topkapı', 'Fatih', 'Topkapı Mah. Turgut Özal Millet Cad. No:189, Topkapı, Fatih/İstanbul', null, 'https://www.ihg.com/holidayinn/hotels/us/en/istanbul/istmc/hoteldetail',
   'Holiday Inn Istanbul City, Fatih''in Topkapı semtinde, Turgut Özal Millet Caddesi üzerinde, tarihi surların yakınında yer alan 203 odalı bir IHG otelidir. Pazartekke tramvay durağına yaklaşık 100 m uzaklıktadır; İstanbul Havalimanı yaklaşık 46 km mesafededir. Otelde açık havuz, spa (hamam, sauna, buhar odası), fitness salonu, restoran, bar, balo salonu ve toplantı salonları ile otopark bulunur.',
   'Holiday Inn Istanbul City is a 203-room IHG hotel on Turgut Özal Millet Avenue in Topkapı, Fatih, near the historic city walls. The Pazartekke tram stop is about 100 m away and Istanbul Airport about 46 km. Facilities include an outdoor pool, a spa with Turkish bath, sauna and steam room, a fitness room, a restaurant, a bar, a ballroom and meeting rooms, and on-site parking.',
   array['wifi', 'parking', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'fitness', 'pool', 'spa', 'sauna', 'hammam', 'elevator', 'non_smoking', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('Ramada Golden Horn', 'Beyoğlu', 'Sütlüce Mah. İmrahor Cad. No:12, 34445 Beyoğlu/İstanbul', null, 'https://www.wyndhamhotels.com/ramada/istanbul-turkiye/ramada-istanbul-golden-horn/overview',
   'Ramada by Wyndham Istanbul Golden Horn, Beyoğlu''nun Sütlüce semtinde, Haliç kıyısında ve Haliç Kongre Merkezi''nin yakınında yer alan 112 odalı bir oteldir. İstanbul Havalimanı''na yaklaşık 35–37 km uzaklıktadır. Otelde iki restoran ve bar, Türk hamamı, sauna, buhar odası ve jakuzi bulunan spa ile 300 kişilik balo salonu ve toplantı salonları vardır.',
   'Ramada by Wyndham Istanbul Golden Horn is a 112-room hotel in Sütlüce, Beyoğlu, on the Golden Horn and near the Haliç Congress Center. Istanbul Airport is about 35–37 km away. The hotel has two restaurants and a bar, a spa with Turkish bath, sauna, steam room and hot tub, a ballroom for 300 guests and meeting rooms.',
   array['wifi', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'laundry', 'meeting_rooms', 'concierge']::text[]),
  ('Ramada Florya', 'Küçükçekmece', 'Beşyol Mah. Birlik Cad. No:10, Florya, 34295 Küçükçekmece/İstanbul', 4, 'https://www.wyndhamhotels.com/ramada/istanbul-turkiye/ramada-istanbul-florya/overview',
   'Ramada by Wyndham Istanbul Florya, Küçükçekmece''nin Beşyol Mahallesi''nde, eski Atatürk Havalimanı''nın yanında yer alan 90 odalı bir oteldir. Florya Plajı''na yaklaşık 2 km, İstanbul Akvaryum''a 3 km, İstanbul Havalimanı''na yaklaşık 43 km uzaklıktadır. Otelde restoran, bar, spa, sauna, Türk hamamı, fitness salonu ve iki toplantı salonu bulunur.',
   'Ramada by Wyndham Istanbul Florya is a 90-room hotel in the Beşyol neighbourhood of Küçükçekmece, next to the former Atatürk Airport. It is about 2 km from Florya beach, 3 km from Istanbul Aquarium and about 43 km from Istanbul Airport. The hotel has a restaurant, a bar, a spa with sauna and Turkish bath, a fitness centre and two meeting rooms.',
   array['wifi', 'parking', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'fitness', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'accessible', 'laundry', 'meeting_rooms', 'concierge']::text[]),
  ('Business Life Bakırköy', 'Bakırköy', 'Sakızağacı Mah. Havlucular Sok. No:3, 34142 Bakırköy/İstanbul', 3, null,
   'Business Life Hotel & SPA Bakırköy, Bakırköy''ün Sakızağacı Mahallesi''nde yer alan 45 odalı bir şehir otelidir. Marmaray Yenimahalle istasyonuna ve Veliefendi Hipodromu''na yaklaşık 1 km, Bakırköy merkezine yaklaşık 1 km, Ataköy Marina''ya yaklaşık 2 km, İstanbul Havalimanı''na yaklaşık 50 km uzaklıktadır. Otelde 24 saat resepsiyon, açık büfe kahvaltı ile hamam, sauna, buhar odası ve masaj hizmetleri sunan spa bulunur; otelin kendi otoparkı yoktur.',
   'Business Life Hotel & SPA Bakırköy is a 45-room city hotel in the Sakızağacı neighbourhood of Bakırköy. It is about 1 km from Marmaray Yenimahalle station, Veliefendi Hippodrome and Bakırköy centre, about 2 km from Ataköy Marina and about 50 km from Istanbul Airport. The hotel has a 24-hour reception, a buffet breakfast and a spa with Turkish bath, sauna, steam room and massage; it has no parking of its own.',
   array['wifi', 'airport_shuttle', 'bar', 'room_service', 'reception_24h', 'fitness', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'meeting_rooms']::text[])
) as v(name, district, address, stars, website, description_tr, description_en, amenities)
where h.name = v.name;

update public.room_types rt set
  bed_info = case when rt.bed_info = '' then coalesce(v.bed_info, '') else rt.bed_info end,
  size_m2 = coalesce(rt.size_m2, v.size_m2::smallint),
  amenities = case when rt.amenities = '{}' then v.amenities else rt.amenities end
from (values
  ('Bricks Hotel', 'Single Oda', '2 tek kişilik yatak (ayrı single oda yok; Superior Twin oda tek kişi kullanımı)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'soundproof', 'heating', 'wardrobe', 'fridge', 'city_view', 'slippers']::text[]),
  ('Bricks Hotel', 'Double Oda', '1 king yatak (Superior King oda)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'soundproof', 'heating', 'wardrobe', 'fridge', 'city_view', 'slippers']::text[]),
  ('Bricks Hotel', 'Triple Oda', 'Ayrı üç kişilik oda yok; Family Suite: iki yatak odası ve iki banyo (çift kişilik + iki tek kişilik yatak)', 56, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'soundproof', 'heating', 'wardrobe', 'fridge', 'city_view', 'slippers']::text[]),
  ('ADM Grand', 'Single Oda', '1 queen yatak (ayrı single oda yok; tek yataklı standart oda)', null, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'bathtub', 'phone', 'soundproof', 'wardrobe', 'slippers']::text[]),
  ('ADM Grand', 'Double Oda', '1 king yatak (King Room)', 43, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'bathtub', 'phone', 'soundproof', 'wardrobe', 'slippers']::text[]),
  ('ADM Grand', 'Triple Oda', '2 tek kişilik yatak (Standard Twin oda, 3 kişiye kadar ilan ediliyor; ayrı üç kişilik oda doğrulanamadı)', 31, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'bathtub', 'phone', 'soundproof', 'wardrobe', 'slippers']::text[]),
  ('La Quinta Basin Hotel', 'Single Oda', '1 king yatak (ayrı single oda yok; Superior King oda tek kişi kullanımı, 26–28 m²)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'wardrobe', 'slippers']::text[]),
  ('La Quinta Basin Hotel', 'Double Oda', '1 king yatak (Superior King oda, 26–28 m²) veya 2 tek kişilik yatak (Deluxe King/Twin, 30–32 m²)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'wardrobe', 'slippers']::text[]),
  ('La Quinta Basin Hotel', 'Triple Oda', 'Deluxe Triple oda (28–32 m²): 3 tek kişilik yatak veya 1 çift + 1 tek kişilik yatak', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'wardrobe', 'slippers']::text[]),
  ('Martinenz Hotel', 'Single Oda', '2 tek kişilik yatak (ayrı single oda yok; Standart Twin oda tek kişi kullanımı)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'shower', 'phone', 'wardrobe', 'city_view', 'slippers']::text[]),
  ('Martinenz Hotel', 'Double Oda', '1 çift kişilik (French) yatak (Standart French oda)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'shower', 'phone', 'wardrobe', 'city_view', 'slippers']::text[]),
  ('Martinenz Hotel', 'Triple Oda', '3 tek kişilik yatak (Standart Triple oda)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'shower', 'phone', 'wardrobe', 'city_view', 'slippers']::text[]),
  ('Glorious Hotel', 'Single Oda', 'Standart Single oda; yatak tipi belirtilmemiş (fotoğrafta 1 çift kişilik yatak)', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'heating', 'slippers']::text[]),
  ('Glorious Hotel', 'Double Oda', '1 çift kişilik veya 2 tek kişilik yatak (Standart Double/Twin oda)', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'heating', 'slippers']::text[]),
  ('Glorious Hotel', 'Triple Oda', '1 çift kişilik + 1 tek kişilik yatak (Standart Triple oda)', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'heating', 'slippers']::text[]),
  ('Sorisso Hotel', 'Single Oda', 'Standart Single oda, 1 kişilik; yatak tipi belirtilmemiş', 18, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Sorisso Hotel', 'Double Oda', '1 çift kişilik yatak (Standart Double oda)', 22, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Sorisso Hotel', 'Triple Oda', '1 çift kişilik + 1 tek kişilik yatak (Standart Triple oda)', 25, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Büyük Hamit Hotel', 'Single Oda', '1 çift kişilik (French) yatak (ayrı single oda yok; Standard Double oda tek kişi kullanımı)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'wardrobe', 'fridge', 'city_view']::text[]),
  ('Büyük Hamit Hotel', 'Double Oda', '1 çift kişilik (French) yatak (Standard Double) veya 2 tek kişilik yatak (Standard Twin)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'wardrobe', 'fridge', 'city_view']::text[]),
  ('Büyük Hamit Hotel', 'Triple Oda', '2 tek + 1 tek kişilik yatak veya 1 çift + 1 tek kişilik yatak (Classic Triple oda)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'wardrobe', 'fridge', 'city_view']::text[]),
  ('Holiday Inn Topkapı', 'Single Oda', '1 büyük yatak (ayrı single oda yok; standart oda tek kişi kullanımı)', null, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Holiday Inn Topkapı', 'Double Oda', '1 queen/king yatak veya 2 tek kişilik yatak (standart oda)', null, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Holiday Inn Topkapı', 'Triple Oda', 'Ayrı üç kişilik oda doğrulanamadı; iki büyük yataklı oda kullanılıyor', null, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Ramada Golden Horn', 'Single Oda', '1 king yatak (ayrı single oda yok; Standart King oda tek kişi kullanımı)', 27, array['ac', 'wifi', 'tv', 'minibar', 'coffee_machine', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'heating', 'wardrobe', 'slippers']::text[]),
  ('Ramada Golden Horn', 'Double Oda', '1 king yatak (Standart King) veya 2 tek kişilik yatak (Standart Twin)', 27, array['ac', 'wifi', 'tv', 'minibar', 'coffee_machine', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'heating', 'wardrobe', 'slippers']::text[]),
  ('Ramada Golden Horn', 'Triple Oda', '3 tek kişilik yatak (Triple oda)', 28, array['ac', 'wifi', 'tv', 'minibar', 'coffee_machine', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'heating', 'wardrobe', 'slippers']::text[]),
  ('Ramada Florya', 'Single Oda', '1 çift kişilik yatak (ayrı single oda yok; standart oda tek kişi kullanımı)', 23, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'phone']::text[]),
  ('Ramada Florya', 'Double Oda', '1 çift kişilik yatak (standart oda)', 23, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'phone']::text[]),
  ('Ramada Florya', 'Triple Oda', '1 çift kişilik + 1 tek kişilik yatak', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'phone']::text[]),
  ('Business Life Bakırköy', 'Single Oda', 'Economy Single oda (1 kişilik); yatak tipi belirtilmemiş', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'slippers']::text[]),
  ('Business Life Bakırköy', 'Double Oda', '1 çift kişilik yatak (Standart oda; Ekonomik çift kişilik oda 14 m²)', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'slippers']::text[]),
  ('Business Life Bakırköy', 'Triple Oda', 'Standart oda (3 kişilik): çift kişilik yatak + ek yatak/kanepe; üçüncü yatak tipi doğrulanamadı', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'slippers']::text[])
) as v(hotel_name, room_name, bed_info, size_m2, amenities)
join public.hotels h on h.name = v.hotel_name
where rt.hotel_id = h.id and rt.name_tr = v.room_name;

-- Uygulamayla gelen otel ve oda görselleri (public/otel-gorselleri). Görsel zaten kayıtlıysa tekrar eklenmez.
-- Otel veya oda adı bulunamazsa o satır atlanır. Otelin/odanın zaten kapak görseli varsa yenisi kapak yapılmaz.
insert into public.hotel_images (hotel_id, room_type_id, storage_path, sort_order, is_cover)
select h.id, rt.id, v.path, v.sort_order + 100,
  v.is_cover and not exists (
    select 1 from public.hotel_images e
    where e.hotel_id = h.id and e.is_cover and e.room_type_id is not distinct from rt.id
  )
from (values
  ('Bricks Hotel', null, '/otel-gorselleri/bricks-hotel/otel-dis-cephe.webp', 0, true),
  ('Bricks Hotel', null, '/otel-gorselleri/bricks-hotel/otel-dis-cephe-2.webp', 1, false),
  ('Bricks Hotel', null, '/otel-gorselleri/bricks-hotel/otel-lobi.webp', 2, false),
  ('Bricks Hotel', null, '/otel-gorselleri/bricks-hotel/otel-restoran.webp', 3, false),
  ('Bricks Hotel', 'Single Oda', '/otel-gorselleri/bricks-hotel/oda-single.webp', 0, true),
  ('Bricks Hotel', 'Double Oda', '/otel-gorselleri/bricks-hotel/oda-double.webp', 0, true),
  ('Bricks Hotel', 'Double Oda', '/otel-gorselleri/bricks-hotel/oda-double-2.webp', 1, false),
  ('Bricks Hotel', 'Triple Oda', '/otel-gorselleri/bricks-hotel/oda-triple.webp', 0, true),
  ('ADM Grand', null, '/otel-gorselleri/adm-grand/otel-dis-cephe.webp', 0, true),
  ('ADM Grand', null, '/otel-gorselleri/adm-grand/otel-lobi.webp', 1, false),
  ('ADM Grand', null, '/otel-gorselleri/adm-grand/otel-havuz.webp', 2, false),
  ('ADM Grand', null, '/otel-gorselleri/adm-grand/otel-restoran.webp', 3, false),
  ('ADM Grand', 'Single Oda', '/otel-gorselleri/adm-grand/oda-single.webp', 0, true),
  ('ADM Grand', 'Double Oda', '/otel-gorselleri/adm-grand/oda-double.webp', 0, true),
  ('ADM Grand', 'Double Oda', '/otel-gorselleri/adm-grand/oda-double-2.webp', 1, false),
  ('ADM Grand', 'Triple Oda', '/otel-gorselleri/adm-grand/oda-triple.webp', 0, true),
  ('La Quinta Basin Hotel', null, '/otel-gorselleri/la-quinta-basin/otel-dis-cephe.webp', 0, true),
  ('La Quinta Basin Hotel', null, '/otel-gorselleri/la-quinta-basin/otel-lobi.webp', 1, false),
  ('La Quinta Basin Hotel', null, '/otel-gorselleri/la-quinta-basin/otel-lobi-2.webp', 2, false),
  ('La Quinta Basin Hotel', null, '/otel-gorselleri/la-quinta-basin/otel-restoran.webp', 3, false),
  ('La Quinta Basin Hotel', 'Single Oda', '/otel-gorselleri/la-quinta-basin/oda-single.webp', 0, true),
  ('La Quinta Basin Hotel', 'Double Oda', '/otel-gorselleri/la-quinta-basin/oda-double.webp', 0, true),
  ('La Quinta Basin Hotel', 'Double Oda', '/otel-gorselleri/la-quinta-basin/oda-double-2.webp', 1, false),
  ('La Quinta Basin Hotel', 'Triple Oda', '/otel-gorselleri/la-quinta-basin/oda-triple.webp', 0, true),
  ('La Quinta Basin Hotel', 'Triple Oda', '/otel-gorselleri/la-quinta-basin/oda-triple-2.webp', 1, false),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-dis-cephe.webp', 0, true),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-dis-cephe-2.webp', 1, false),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-lobi.webp', 2, false),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-lobi-2.webp', 3, false),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-restoran.webp', 4, false),
  ('Martinenz Hotel', 'Single Oda', '/otel-gorselleri/martinenz-hotel/oda-single.webp', 0, true),
  ('Martinenz Hotel', 'Double Oda', '/otel-gorselleri/martinenz-hotel/oda-double.webp', 0, true),
  ('Martinenz Hotel', 'Double Oda', '/otel-gorselleri/martinenz-hotel/oda-double-2.webp', 1, false),
  ('Martinenz Hotel', 'Triple Oda', '/otel-gorselleri/martinenz-hotel/oda-triple.webp', 0, true),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-dis-cephe.webp', 0, true),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-dis-cephe-2.webp', 1, false),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-lobi.webp', 2, false),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-lobi-2.webp', 3, false),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-havuz.webp', 4, false),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-restoran.webp', 5, false),
  ('Glorious Hotel', 'Single Oda', '/otel-gorselleri/glorious-hotel/oda-single.webp', 0, true),
  ('Glorious Hotel', 'Double Oda', '/otel-gorselleri/glorious-hotel/oda-double.webp', 0, true),
  ('Glorious Hotel', 'Double Oda', '/otel-gorselleri/glorious-hotel/oda-double-2.webp', 1, false),
  ('Glorious Hotel', 'Triple Oda', '/otel-gorselleri/glorious-hotel/oda-triple.webp', 0, true),
  ('Glorious Hotel', 'Triple Oda', '/otel-gorselleri/glorious-hotel/oda-triple-2.webp', 1, false),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-dis-cephe.webp', 0, true),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-lobi.webp', 1, false),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-lobi-2.webp', 2, false),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-teras.webp', 3, false),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-restoran.webp', 4, false),
  ('Sorisso Hotel', 'Single Oda', '/otel-gorselleri/sorisso-hotel/oda-single.webp', 0, true),
  ('Sorisso Hotel', 'Double Oda', '/otel-gorselleri/sorisso-hotel/oda-double.webp', 0, true),
  ('Sorisso Hotel', 'Double Oda', '/otel-gorselleri/sorisso-hotel/oda-double-2.webp', 1, false),
  ('Sorisso Hotel', 'Triple Oda', '/otel-gorselleri/sorisso-hotel/oda-triple.webp', 0, true),
  ('Sorisso Hotel', 'Triple Oda', '/otel-gorselleri/sorisso-hotel/oda-triple-2.webp', 1, false),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-dis-cephe.webp', 0, true),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-dis-cephe-2.webp', 1, false),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-lobi.webp', 2, false),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-lobi-2.webp', 3, false),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-restoran.webp', 4, false),
  ('Büyük Hamit Hotel', 'Single Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-single.webp', 0, true),
  ('Büyük Hamit Hotel', 'Double Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-double.webp', 0, true),
  ('Büyük Hamit Hotel', 'Double Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-double-2.webp', 1, false),
  ('Büyük Hamit Hotel', 'Triple Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-triple.webp', 0, true),
  ('Büyük Hamit Hotel', 'Triple Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-triple-2.webp', 1, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-dis-cephe.webp', 0, true),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-dis-cephe-2.webp', 1, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-lobi.webp', 2, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-lobi-2.webp', 3, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-havuz.webp', 4, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-restoran.webp', 5, false),
  ('Holiday Inn Topkapı', 'Single Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-single.webp', 0, true),
  ('Holiday Inn Topkapı', 'Double Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-double.webp', 0, true),
  ('Holiday Inn Topkapı', 'Double Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-double-2.webp', 1, false),
  ('Holiday Inn Topkapı', 'Triple Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-triple.webp', 0, true),
  ('Holiday Inn Topkapı', 'Triple Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-triple-2.webp', 1, false),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-dis-cephe.webp', 0, true),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-dis-cephe-2.webp', 1, false),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-lobi.webp', 2, false),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-lobi-2.webp', 3, false),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-restoran.webp', 4, false),
  ('Ramada Golden Horn', 'Single Oda', '/otel-gorselleri/ramada-golden-horn/oda-single.webp', 0, true),
  ('Ramada Golden Horn', 'Double Oda', '/otel-gorselleri/ramada-golden-horn/oda-double.webp', 0, true),
  ('Ramada Golden Horn', 'Double Oda', '/otel-gorselleri/ramada-golden-horn/oda-double-2.webp', 1, false),
  ('Ramada Golden Horn', 'Triple Oda', '/otel-gorselleri/ramada-golden-horn/oda-triple.webp', 0, true),
  ('Ramada Florya', null, '/otel-gorselleri/ramada-florya/otel-dis-cephe.webp', 0, true),
  ('Ramada Florya', null, '/otel-gorselleri/ramada-florya/otel-dis-cephe-2.webp', 1, false),
  ('Ramada Florya', null, '/otel-gorselleri/ramada-florya/otel-lobi.webp', 2, false),
  ('Ramada Florya', null, '/otel-gorselleri/ramada-florya/otel-restoran.webp', 3, false),
  ('Ramada Florya', 'Single Oda', '/otel-gorselleri/ramada-florya/oda-single.webp', 0, true),
  ('Ramada Florya', 'Double Oda', '/otel-gorselleri/ramada-florya/oda-double.webp', 0, true),
  ('Ramada Florya', 'Triple Oda', '/otel-gorselleri/ramada-florya/oda-triple.webp', 0, true),
  ('Business Life Bakırköy', null, '/otel-gorselleri/business-life-bakirkoy/otel-dis-cephe.webp', 0, true),
  ('Business Life Bakırköy', null, '/otel-gorselleri/business-life-bakirkoy/otel-dis-cephe-2.webp', 1, false),
  ('Business Life Bakırköy', null, '/otel-gorselleri/business-life-bakirkoy/otel-lobi.webp', 2, false),
  ('Business Life Bakırköy', null, '/otel-gorselleri/business-life-bakirkoy/otel-restoran.webp', 3, false),
  ('Business Life Bakırköy', 'Single Oda', '/otel-gorselleri/business-life-bakirkoy/oda-single.webp', 0, true),
  ('Business Life Bakırköy', 'Double Oda', '/otel-gorselleri/business-life-bakirkoy/oda-double.webp', 0, true),
  ('Business Life Bakırköy', 'Double Oda', '/otel-gorselleri/business-life-bakirkoy/oda-double-2.webp', 1, false),
  ('Business Life Bakırköy', 'Triple Oda', '/otel-gorselleri/business-life-bakirkoy/oda-triple.webp', 0, true),
  ('Business Life Bakırköy', 'Triple Oda', '/otel-gorselleri/business-life-bakirkoy/oda-triple-2.webp', 1, false)
) as v(hotel_name, room_name, path, sort_order, is_cover)
join public.hotels h on h.name = v.hotel_name
left join public.room_types rt on rt.hotel_id = h.id and rt.name_tr = v.room_name
where (v.room_name is null or rt.id is not null)
  and not exists (select 1 from public.hotel_images e where e.storage_path = v.path);

