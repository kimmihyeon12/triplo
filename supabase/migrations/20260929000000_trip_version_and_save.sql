-- 저장 충돌을 막는 버전과, 여행 전체를 한 트랜잭션으로 저장하는 함수.
-- 설계: docs/superpowers/specs/2026-09-29-supabase-trip-storage-design.md

-- 저장이 성공할 때마다 1 오른다. 앱은 불러온 버전을 함께 보낸다.
alter table trips add column version integer not null default 0;

-- 통계가 지역을 세는 표준 지역 코드. 앱 모델의 regionCode다.
alter table trip_regions add column region_code text;

-- 여행 하나를 통째로 저장한다. 앱 모델(camelCase JSON)을 그대로 받는다.
-- security invoker라 RLS가 그대로 걸린다. 다른 사람의 여행은 보이지 않으므로
-- 같은 id로 저장하면 새 여행으로 넣으려다 기본 키 중복(23505)으로 실패한다.
create function save_trip(p_trip jsonb, p_base_version integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id text := p_trip->>'id';
  v_current integer;
  v_next integer;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select version into v_current from public.trips where id = v_id for update;

  if not found then
    if p_base_version <> 0 then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    insert into public.trips (id, owner_id, title, start_date, end_date, status,
                              schema_version, created_at, updated_at, version)
    values (v_id, v_uid, p_trip->>'title',
            (p_trip->>'startDate')::date, (p_trip->>'endDate')::date, 'draft',
            coalesce((p_trip->>'schemaVersion')::smallint, 1),
            coalesce((p_trip->>'createdAt')::timestamptz, now()),
            coalesce((p_trip->>'updatedAt')::timestamptz, now()), 1);
    v_next := 1;
  else
    if v_current <> p_base_version then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    v_next := v_current + 1;
    update public.trips
       set title = p_trip->>'title',
           start_date = (p_trip->>'startDate')::date,
           end_date = (p_trip->>'endDate')::date,
           updated_at = coalesce((p_trip->>'updatedAt')::timestamptz, now()),
           version = v_next
     where id = v_id;
  end if;

  -- 딸린 표는 지우고 다시 넣는다. 지역을 먼저 넣어야 장소·숙소의 region_id가 맞는다.
  delete from public.trip_stops where trip_id = v_id;
  delete from public.accommodation_stays where trip_id = v_id;
  delete from public.trip_regions where trip_id = v_id;

  insert into public.trip_regions (id, trip_id, name, "order", region_code)
  select r->>'id', v_id, r->>'name', (r->>'order')::integer, r->>'regionCode'
    from jsonb_array_elements(coalesce(p_trip->'regions', '[]'::jsonb)) as r;

  insert into public.trip_stops (id, trip_id, region_id, kind, name, address, date, "order",
                                 stay_minutes, memo, fixed_time, excluded, location_status,
                                 lat, lng, place_provider, place_id, place_url, estimated_cost)
  select s->>'id', v_id, s->>'regionId', (s->>'kind')::public.stop_kind, s->>'name',
         coalesce(s->>'address', ''), (s->>'date')::date, (s->>'order')::integer,
         (s->>'stayMinutes')::integer, coalesce(s->>'memo', ''), s->>'fixedTime',
         coalesce((s->>'excluded')::boolean, false),
         coalesce(s->>'locationStatus', 'unverified')::public.location_status,
         (s->'location'->>'lat')::double precision, (s->'location'->>'lng')::double precision,
         s->'placeRef'->>'provider', s->'placeRef'->>'id', s->'placeRef'->>'url',
         (s->>'estimatedCost')::integer
    from jsonb_array_elements(coalesce(p_trip->'stops', '[]'::jsonb)) as s;

  insert into public.accommodation_stays (id, trip_id, region_id, name, address, check_in,
                                          check_out, check_in_time, check_out_time, day_order,
                                          reservation, memo, location_status, lat, lng,
                                          place_provider, place_id, place_url, estimated_cost)
  select a->>'id', v_id, a->>'regionId', a->>'name', coalesce(a->>'address', ''),
         (a->>'checkIn')::date, (a->>'checkOut')::date, a->>'checkInTime', a->>'checkOutTime',
         (a->>'dayOrder')::integer,
         coalesce(a->>'reservation', 'unknown')::public.reservation_state,
         coalesce(a->>'memo', ''),
         coalesce(a->>'locationStatus', 'unverified')::public.location_status,
         (a->'location'->>'lat')::double precision, (a->'location'->>'lng')::double precision,
         a->'placeRef'->>'provider', a->'placeRef'->>'id', a->'placeRef'->>'url',
         (a->>'estimatedCost')::integer
    from jsonb_array_elements(coalesce(p_trip->'stays', '[]'::jsonb)) as a;

  return v_next;
end;
$$;

-- 로그인한 사용자만 부른다.
revoke execute on function save_trip(jsonb, integer) from public, anon;
grant execute on function save_trip(jsonb, integer) to authenticated;
