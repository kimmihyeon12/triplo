-- 로컬 PostgreSQL에서 save_trip 동작을 확인한다. Supabase의 auth 스키마를 흉내 낸다.
-- 실행: psql -U postgres -h localhost -c 'create database tc_check'
--       psql -U postgres -h localhost -d tc_check -f supabase/tests/save-trip.local.sql
-- 기대: A new 1 / A stale conflict / 제약 위반 전체 되돌림 / A update 2 / B sees 0 / B steal 23505 / anon authentication_required
\set ON_ERROR_STOP 1
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
\ir ../migrations/20260917000000_create_trip_tables.sql
\ir ../migrations/20260929000000_trip_version_and_save.sql
\ir ../migrations/20260929000001_trip_grants.sql
\set ON_ERROR_STOP 0
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'A new' as t, save_trip('{"id":"t1","title":"강릉","startDate":"2026-10-10","endDate":null,"regions":[{"id":"t1:region:0","name":"강릉시","order":0,"regionCode":"51150"}],"stops":[{"id":"s1","kind":"meal","name":"순두부","address":"","regionId":"t1:region:0","date":"2026-10-10","order":0,"stayMinutes":60,"memo":"","fixedTime":"12:30","excluded":false,"locationStatus":"verified","location":{"lat":37.7,"lng":128.9},"placeRef":{"provider":"kakao","id":"99","url":null},"estimatedCost":12000}],"stays":[{"id":"a1","name":"숙소","address":"","regionId":null,"checkIn":"2026-10-10","checkOut":"2026-10-11","checkInTime":null,"checkOutTime":null,"dayOrder":null,"reservation":"unknown","memo":"","locationStatus":"unverified","location":null,"placeRef":null}]}'::jsonb, 0) as v;
select 'A stale' as t, save_trip('{"id":"t1","title":"x","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select 'A bad time rollback' as t, save_trip('{"id":"t1","title":"y","regions":[],"stops":[{"id":"s9","kind":"place","name":"n","order":0,"fixedTime":"9시","excluded":false}],"stays":[]}'::jsonb, 1);
select 'after rollback' as t, title, version, (select count(*) from trip_stops) stops, (select count(*) from accommodation_stays) stays, (select region_code from trip_regions) rc from trips;
select 'A update' as t, save_trip('{"id":"t1","title":"강릉2","regions":[],"stops":[],"stays":[]}'::jsonb, 1) as v;
select 'after update' as t, title, version, (select count(*) from trip_stops) stops, (select count(*) from trip_regions) regions from trips;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'B sees' as t, count(*) from trips;
select 'B steal' as t, save_trip('{"id":"t1","title":"탈취","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select 'B steal v2' as t, save_trip('{"id":"t1","title":"탈취","regions":[],"stops":[],"stays":[]}'::jsonb, 2);
delete from trips where id = 't1';
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'A still' as t, title, version from trips;
set request.jwt.claim.sub = '';
select 'anon' as t, save_trip('{"id":"t2","title":"x","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
