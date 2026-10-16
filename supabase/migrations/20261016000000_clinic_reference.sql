-- Rezervasyon referansı kliniğe özel olur: klinik kodu + kliniğin kendi sıra numarası (ör. LERRA-0001).
-- Klinik kodu admin tarafından klinik sayfasında değiştirilebilir; boş bırakılırsa addan türetilir.
-- Önceki biçim (ASK-000003) tüm klinikler için ortak bir sayaç kullanıyordu; yeni kliniğin ilk talebi 0003 görünüyordu.
-- Misafir adı referansa konmaz: referans e-posta konularında ve bildirimlerde geçer.

-- Klinik adından kısa kod: Türkçe harfler sadeleştirilir, adın ilk kelimesi alınır (en fazla 6 harf).
-- İlk kelime 3 harften kısaysa (ör. "Dr.") bütün addan ilk 6 harf alınır. Ör. "Lerra Clinic" → LERRA.
create or replace function public.clinic_code_from_name(p_name text) returns text
language plpgsql immutable as $$
declare
  v_plain text := upper(translate(coalesce(p_name, ''), 'çğıöşüÇĞİÖŞÜâîûÂÎÛ', 'cgiosuCGIOSUaiuAIU'));
  v_word text := substring(v_plain from '[A-Z0-9]+');
begin
  if length(v_word) >= 3 then
    return left(v_word, 6);
  end if;
  return coalesce(nullif(left(regexp_replace(v_plain, '[^A-Z0-9]', '', 'g'), 6), ''), 'KLINIK');
end;
$$;

-- Kodu boş bırakılan kliniğe adından kod verilir; başka klinikte varsa sonuna sayı eklenir.
create or replace function public.set_clinic_code() returns trigger
language plpgsql as $$
declare
  v_base text;
  v_code text;
  v_n int := 1;
begin
  if new.code is null or trim(new.code) = '' then
    v_base := public.clinic_code_from_name(new.name);
    v_code := v_base;
    while exists (select 1 from public.clinics where code = v_code and id <> new.id) loop
      v_n := v_n + 1;
      v_code := left(v_base, 6) || v_n;
    end loop;
    new.code := v_code;
  else
    new.code := upper(trim(new.code));
  end if;
  return new;
end;
$$;

alter table public.clinics add column code text;
alter table public.clinics add column reservation_count integer not null default 0;

create trigger set_code before insert or update of code, name on public.clinics
  for each row when (new.code is null or trim(new.code) = '' or new.code <> upper(trim(new.code)))
  execute function public.set_clinic_code();

-- Mevcut kliniklere kod ver (tetikleyici boş kodu doldurur).
update public.clinics set code = null where code is null;

alter table public.clinics alter column code set not null;
alter table public.clinics add constraint clinics_code_format check (code ~ '^[A-Z0-9]{2,10}$');
alter table public.clinics add constraint clinics_code_unique unique (code);

-- Mevcut rezervasyonları kendi kliniği içinde, oluşturulma sırasıyla yeniden numaralandır.
alter table public.reservations alter column reference drop default;

with numbered as (
  select r.id, c.code, row_number() over (partition by r.clinic_id order by r.created_at, r.id) as n
  from public.reservations r
  join public.clinics c on c.id = r.clinic_id
)
update public.reservations r
set reference = numbered.code || '-' || lpad(numbered.n::text, 4, '0')
from numbered
where numbered.id = r.id;

update public.clinics c
set reservation_count = coalesce((select count(*) from public.reservations r where r.clinic_id = c.id), 0);

drop sequence public.reservation_number_seq;

-- Yeni rezervasyonun referansı: kliniğin sayacı satır kilidiyle artırılır, aynı anda gelen iki talep aynı numarayı alamaz.
-- Klinik kullanıcısı clinics tablosunu güncelleyemediği için fonksiyon tablo sahibinin yetkisiyle çalışır.
create or replace function public.set_reservation_reference() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_count integer;
begin
  update public.clinics
  set reservation_count = reservation_count + 1
  where id = new.clinic_id
  returning code, reservation_count into v_code, v_count;

  new.reference := v_code || '-' || lpad(v_count::text, 4, '0');
  return new;
end;
$$;

revoke execute on function public.set_reservation_reference() from public, anon, authenticated;

create trigger set_reference before insert on public.reservations
  for each row execute function public.set_reservation_reference();
