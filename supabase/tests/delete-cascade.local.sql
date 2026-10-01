-- 로컬 PostgreSQL에서 지출이 있는 여행 삭제·회원탈퇴의 연쇄 삭제를 확인한다(2026-10-01).
-- 분담(expense_splits)·지출이 가계부 사람(ledger_people)보다 늦게 지워지면 외래 키 검사에 걸려
-- 여행 삭제와 회원탈퇴가 실패했다. 행이 지워지는 순서에 따라 나타나므로 실패를 낸 순서를 그대로 쓴다.
-- 수정(20261001130000) 없이 돌리면 1번의 delete_trip에서 외래 키 오류가 난다.
-- 실행: psql -U postgres -h localhost -c 'drop database if exists tc_cascade' -c 'create database tc_cascade'
--       psql -U postgres -h localhost -d tc_cascade -f supabase/tests/delete-cascade.local.sql
\set ON_ERROR_STOP 1
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth, extensions to anon, authenticated;
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', '{"travel_nickname":"주인"}'),
  ('22222222-2222-2222-2222-222222222222', '{"travel_nickname":"민지"}');
\ir ../migrations/20260917000000_create_trip_tables.sql
\ir ../migrations/20260929000000_trip_version_and_save.sql
\ir ../migrations/20260929000001_trip_grants.sql
\ir ../migrations/20260929000002_ledger_tables.sql
\ir ../migrations/20260929000003_remove_ledger_person.sql
\ir ../migrations/20260929000005_trip_members.sql
\ir ../migrations/20260929000006_drop_redundant_split_fkey.sql
\ir ../migrations/20260929000007_preview_my_role.sql
\ir ../migrations/20261001130000_ledger_fk_deferred.sql
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

-- A가 함께 쓰는 여행을 만들고 B가 합류해 일정을 고친 뒤 지출을 남긴다(실패를 낸 순서).
set role authenticated;
set request.jwt.claim.sub = :'A';
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select add_ledger_person('t1', '{"id":"self","name":"나"}'::jsonb);
select create_trip_invite('t1') as code \gset
set request.jwt.claim.sub = :'B';
select join_trip(:'code');
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 1);
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 2);
select save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":1000,"paidBy":"self","splits":[{"personId":"self","amount":1000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0);
select save_expense('t1', '{"id":"e2","title":"선물","date":"2026-10-10","category":"shopping","amount":500,"paidBy":"self","splits":[{"personId":"self","amount":500}],"memo":"","linkId":null,"personal":true}'::jsonb, 0);

-- 1. 주인이 지출이 있는 여행을 지운다
set request.jwt.claim.sub = :'A';
select delete_trip('t1');
reset role;
select 't1 gone (0)' as t, count(*) from trips where id = 't1';
select 't1 expenses gone (0)' as t, count(*) from expenses where trip_id = 't1';
select 't1 people gone (0)' as t, count(*) from ledger_people where trip_id = 't1';

-- 2. 지출에 쓰인 사람은 지금처럼 지울 수 없다(검사는 트랜잭션 끝에 한다)
set role authenticated;
set request.jwt.claim.sub = :'A';
select save_trip('{"id":"t2","title":"속초","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select add_ledger_person('t2', '{"id":"self","name":"나"}'::jsonb);
select save_expense('t2', '{"id":"e3","title":"점심","date":"2026-10-10","category":"food","amount":500,"paidBy":"self","splits":[{"personId":"self","amount":500}],"memo":"","linkId":null,"personal":false}'::jsonb, 0);
reset role;
begin;
delete from ledger_people where trip_id = 't2' and id = 'self';
commit;
select 'used person delete rolled back (1)' as t, count(*) from ledger_people where trip_id = 't2' and id = 'self';

-- 3. 회원탈퇴: 계정을 지우면 지출이 있는 여행도 함께 지워진다
delete from auth.users where id = :'A';
select 'account delete removes trips (0)' as t, count(*) from trips;
select 'account delete removes expenses (0)' as t, count(*) from expenses;
