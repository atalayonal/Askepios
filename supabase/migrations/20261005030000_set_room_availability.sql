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
