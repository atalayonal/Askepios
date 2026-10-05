-- Admin, kullanıcıyı geçici şifreyle oluşturur; kullanıcı ilk girişte şifresini değiştirmek zorundadır.
alter table public.profiles add column must_change_password boolean not null default true;

-- Kullanıcı sadece kendi şifre değiştirme bayrağını kapatabilir.
create or replace function public.mark_password_changed() returns void
language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

revoke execute on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated;
