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
