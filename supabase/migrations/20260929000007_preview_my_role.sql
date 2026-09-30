-- 초대 미리보기에 '지금 로그인한 사람의 역할'을 싣는다(2026-09-29).
-- 로그아웃한 뒤 [로그인하고 함께하기]를 누르면 Google·카카오가 이 브라우저의 마지막
-- 계정(여행을 만든 사람)으로 묻지 않고 로그인해, 주인이 자기 여행에 '합류'하고
-- 초대받은 사람은 들어오지 못했다. 합류 화면이 이 값으로 이미 멤버인지 알린다.
create or replace function public.preview_trip_invite(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_trip text := public.invite_trip(p_code);
begin
  return (
    select jsonb_build_object(
      -- 지금 로그인한 사람의 역할. 로그인 전이거나 멤버가 아니면 null.
      -- 여행을 만든 사람이 자기 링크로 '합류'하지 않게 합류 화면이 보고 막는다.
      'myRole', (select m.role from public.trip_members m
                  where m.trip_id = t.id and m.user_id = (select auth.uid())),
      'title', t.title,
      'startDate', t.start_date,
      'endDate', t.end_date,
      'ownerNickname', (select m.nickname from public.trip_members m
                         where m.trip_id = t.id and m.role = 'owner'),
      'regions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'order', r."order")
                                            order by r."order")
                             from public.trip_regions r where r.trip_id = t.id), '[]'::jsonb),
      'stops', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'kind', s.kind, 'date', s.date,
                                                             'order', s."order", 'fixedTime', s.fixed_time,
                                                             'regionId', s.region_id)
                                          order by s.date nulls last, s."order")
                           from public.trip_stops s where s.trip_id = t.id and not s.excluded), '[]'::jsonb),
      'stays', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'checkIn', a.check_in,
                                                             'checkOut', a.check_out)
                                          order by a.check_in)
                           from public.accommodation_stays a where a.trip_id = t.id), '[]'::jsonb))
      from public.trips t where t.id = v_trip);
end;
$$;
