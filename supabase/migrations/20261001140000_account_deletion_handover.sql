-- 회원탈퇴 전 함께 쓰는 여행 넘기기(2026-10-01 사용자 결정, A안).
-- 지금까지는 주인이 탈퇴하면 여행이 통째로 지워져 함께 편집하던 사람의 일정·지출도 사라졌다.
-- 탈퇴 직전에 내가 주인인 여행 중 다른 멤버가 있는 것은 가장 먼저 합류한 멤버를 주인으로 바꾼다.
-- 혼자 쓰던 여행만 계정과 함께 지워진다. 가계부의 'self'(원래 주인 몫)는 기록 그대로 남긴다.

-- 탈퇴 함수(delete-account, 서비스 권한)만 부른다. 앱 사용자는 부를 수 없다.
create function public.hand_over_trips(p_user uuid) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  v_trip record;
  v_next uuid;
  v_count integer := 0;
begin
  for v_trip in select id from public.trips where owner_id = p_user loop
    select user_id into v_next
      from public.trip_members
     where trip_id = v_trip.id and user_id <> p_user
     order by joined_at, user_id
     limit 1;
    if v_next is null then continue; end if;
    update public.trips set owner_id = v_next where id = v_trip.id;
    update public.trip_members set role = 'owner' where trip_id = v_trip.id and user_id = v_next;
    delete from public.trip_members where trip_id = v_trip.id and user_id = p_user;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 탈퇴 확인 화면에 보일 요약. 지울 여행(혼자 쓰는 것)과 넘길 여행(멤버가 있는 것)의 수.
create function public.account_deletion_summary() returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'deleteTrips', count(*) filter (where not shared),
    'handOverTrips', count(*) filter (where shared)
  )
  from (
    select exists (
      select 1 from public.trip_members m where m.trip_id = t.id and m.user_id <> t.owner_id
    ) as shared
    from public.trips t
    where t.owner_id = auth.uid()
  ) x
$$;

revoke execute on function public.hand_over_trips(uuid), public.account_deletion_summary() from public, anon, authenticated;
grant execute on function public.account_deletion_summary() to authenticated;
grant execute on function public.hand_over_trips(uuid) to service_role;
