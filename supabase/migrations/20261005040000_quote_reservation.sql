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
