-- 여행 데이터를 계정별로 저장한다.
-- 앱 모델(app/src/app/features/trips/model/trip.ts)을 그대로 옮긴 것이며
-- 컬럼 이름은 SQL 관례에 따라 snake_case로 적고 앱 경계에서 변환한다.
--
-- 계정을 지우면 그 사람의 여행도 함께 지운다(2026-09-17 사용자 결정).
-- delete-account 함수가 auth.users 행을 실제로 지우므로
-- on delete cascade가 없으면 외래 키 위반으로 탈퇴가 실패한다.

create type stop_kind as enum ('place', 'meal', 'break', 'buffer');
create type reservation_state as enum ('unknown', 'reserved', 'not_reserved');
create type location_status as enum ('unverified', 'verified');
create type trip_status as enum ('draft');

create table trips (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  start_date date,
  end_date date,
  status trip_status not null default 'draft',
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_owner_updated_idx on trips (owner_id, updated_at desc);

-- 지역·장소·숙소는 여행에 딸린다. 여행을 지우면 함께 사라진다.
create table trip_regions (
  id uuid primary key,
  trip_id uuid not null references trips (id) on delete cascade,
  name text not null,
  "order" integer not null
);

create index trip_regions_trip_idx on trip_regions (trip_id);

create table trip_stops (
  id uuid primary key,
  trip_id uuid not null references trips (id) on delete cascade,
  -- 지역을 지워도 장소는 남기고 연결만 끊는다. 앱 모델의 regionId도 null을 허용한다.
  region_id uuid references trip_regions (id) on delete set null,
  kind stop_kind not null,
  name text not null,
  address text not null default '',
  -- null이면 아직 어느 날짜에도 배치하지 않은 상태다.
  date date,
  "order" integer not null,
  stay_minutes integer,
  memo text not null default '',
  -- 'HH:mm' 형식의 고정 시각. time 타입을 쓰면 초가 붙어 앱 형식과 어긋난다.
  fixed_time text,
  excluded boolean not null default false,
  location_status location_status not null default 'unverified',
  -- 확인된 좌표만 넣는다. 추정 좌표는 만들지 않는다.
  lat double precision,
  lng double precision,
  place_provider text,
  place_id text,
  place_url text,
  -- 계획 금액(원). null은 미정이며 0원과 구분한다.
  estimated_cost integer,
  constraint trip_stops_fixed_time_format check (fixed_time is null or fixed_time ~ '^\d{2}:\d{2}$'),
  constraint trip_stops_location_pair check ((lat is null) = (lng is null)),
  constraint trip_stops_cost_not_negative check (estimated_cost is null or estimated_cost >= 0)
);

create index trip_stops_trip_idx on trip_stops (trip_id);

create table accommodation_stays (
  id uuid primary key,
  trip_id uuid not null references trips (id) on delete cascade,
  region_id uuid references trip_regions (id) on delete set null,
  name text not null,
  address text not null default '',
  check_in date not null,
  -- 숙박 밤은 [check_in, check_out)이므로 체크아웃이 체크인보다 앞설 수 없다.
  check_out date not null,
  check_in_time text,
  check_out_time text,
  day_order integer,
  reservation reservation_state not null default 'unknown',
  memo text not null default '',
  location_status location_status not null default 'unverified',
  lat double precision,
  lng double precision,
  place_provider text,
  place_id text,
  place_url text,
  -- 숙박 전체 예상 금액(원).
  estimated_cost integer,
  constraint stays_check_out_after_check_in check (check_out >= check_in),
  constraint stays_check_in_time_format check (check_in_time is null or check_in_time ~ '^\d{2}:\d{2}$'),
  constraint stays_check_out_time_format check (check_out_time is null or check_out_time ~ '^\d{2}:\d{2}$'),
  constraint stays_location_pair check ((lat is null) = (lng is null)),
  constraint stays_cost_not_negative check (estimated_cost is null or estimated_cost >= 0)
);

create index accommodation_stays_trip_idx on accommodation_stays (trip_id);

-- 접근 제어: 본인 여행만 읽고 쓴다.
alter table trips enable row level security;
alter table trip_regions enable row level security;
alter table trip_stops enable row level security;
alter table accommodation_stays enable row level security;

create policy trips_owner_all on trips
  for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 딸린 표는 여행의 주인을 따라간다.
-- 여행 소유 검사를 함수로 묶어 세 표에서 같은 규칙을 쓴다.
create function owns_trip(target uuid) returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.trips
    where id = target and owner_id = (select auth.uid())
  );
$$;

create policy trip_regions_owner_all on trip_regions
  for all
  using (owns_trip(trip_id))
  with check (owns_trip(trip_id));

create policy trip_stops_owner_all on trip_stops
  for all
  using (owns_trip(trip_id))
  with check (owns_trip(trip_id));

create policy accommodation_stays_owner_all on accommodation_stays
  for all
  using (owns_trip(trip_id))
  with check (owns_trip(trip_id));
