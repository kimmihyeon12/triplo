-- 로컬 PostgreSQL에서 회원탈퇴 전 여행 넘기기와 탈퇴 요약을 확인한다(2026-10-01, 사용자 결정 A안).
-- 함께 쓰는 여행의 주인이 탈퇴하면 가장 먼저 합류한 멤버가 주인이 되고, 혼자 쓰던 여행만 지워진다.
-- 실행: psql -U postgres -h localhost -c 'drop database if exists tc_deletion' -c 'create database tc_deletion'
--       psql -U postgres -h localhost -d tc_deletion -f supabase/tests/account-deletion.local.sql
\set ON_ERROR_STOP 1
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema public, auth, extensions to anon, authenticated;
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', '{"travel_nickname":"주인"}'),
  ('22222222-2222-2222-2222-222222222222', '{"travel_nickname":"민지"}'),
  ('33333333-3333-3333-3333-333333333333', '{"travel_nickname":"준호"}');
\ir ../migrations/20260917000000_create_trip_tables.sql
\ir ../migrations/20260929000000_trip_version_and_save.sql
\ir ../migrations/20260929000001_trip_grants.sql
\ir ../migrations/20260929000002_ledger_tables.sql
\ir ../migrations/20260929000003_remove_ledger_person.sql
\ir ../migrations/20260929000005_trip_members.sql
\ir ../migrations/20260929000006_drop_redundant_split_fkey.sql
\ir ../migrations/20260929000007_preview_my_role.sql
\ir ../migrations/20261001130000_ledger_fk_deferred.sql
\ir ../migrations/20261001140000_account_deletion_handover.sql
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

-- A는 혼자 쓰는 여행 solo와 함께 쓰는 여행 shared를 가진다. B가 먼저, C가 나중에 합류한다.
set role authenticated;
set request.jwt.claim.sub = :'A';
select save_trip('{"id":"solo","title":"혼자","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select save_trip('{"id":"shared","title":"함께","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select add_ledger_person('shared', '{"id":"self","name":"나"}'::jsonb);
select create_trip_invite('shared') as code \gset
set request.jwt.claim.sub = :'B';
select join_trip(:'code');
select save_expense('shared', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":1000,"paidBy":"self","splits":[{"personId":"self","amount":1000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0);
select pg_sleep(0.01);
set request.jwt.claim.sub = :'C';
select join_trip(:'code');

-- 탈퇴 확인 화면에 보일 요약: 지울 여행 1개, 넘길 여행 1개
set request.jwt.claim.sub = :'A';
select 'summary (1 1)' as t, s->>'deleteTrips', s->>'handOverTrips' from (select account_deletion_summary() s) x;
set request.jwt.claim.sub = :'B';
select 'B summary (0 0)' as t, s->>'deleteTrips', s->>'handOverTrips' from (select account_deletion_summary() s) x;

-- 앱 사용자는 넘기기 함수를 부를 수 없다(탈퇴 함수가 서비스 권한으로만 부른다)
set request.jwt.claim.sub = :'B';
select 'B hand over A (denied)' as t, hand_over_trips(:'A');
reset role;

-- 탈퇴: 넘긴 뒤 계정을 지운다
select 'handed over (1)' as t, hand_over_trips(:'A');
delete from auth.users where id = :'A';
select 'solo deleted (0)' as t, count(*) from trips where id = 'solo';
select 'shared kept (1)' as t, count(*) from trips where id = 'shared';
select 'new owner is first joiner B (t)' as t, owner_id = :'B' from trips where id = 'shared';
select 'B role owner (owner)' as t, role from trip_members where trip_id = 'shared' and user_id = :'B';
select 'C still editor (editor)' as t, role from trip_members where trip_id = 'shared' and user_id = :'C';
select 'expense kept (1)' as t, count(*) from expenses where trip_id = 'shared';

-- 새 주인 B는 여행을 고칠 수 있다
set role authenticated;
set request.jwt.claim.sub = :'B';
select 'B can save (2)' as t, save_trip('{"id":"shared","title":"함께(넘겨받음)","regions":[],"stops":[],"stays":[]}'::jsonb, 1);
