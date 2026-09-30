-- 로컬 PostgreSQL에서 정산 수령 기록의 잔액 검사와 중복 요청 처리를 확인한다(감리 P1-04).
-- 실행: psql -U postgres -h localhost -c 'create database tc_receipt'
--       psql -U postgres -h localhost -d tc_receipt -f supabase/tests/receipt.local.sql
-- 동시 요청은 이 파일 뒤에 두 세션에서 add_receipt를 함께 불러 확인한다(DATABASE.md 참고).
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
grant usage on schema public, auth, extensions to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111');
\ir ../migrations/20260917000000_create_trip_tables.sql
\ir ../migrations/20260929000000_trip_version_and_save.sql
\ir ../migrations/20260929000001_trip_grants.sql
\ir ../migrations/20260929000002_ledger_tables.sql
\ir ../migrations/20260929000003_remove_ledger_person.sql
\ir ../migrations/20260929000004_ai_usage.sql
\ir ../migrations/20260929000005_trip_members.sql
\ir ../migrations/20260929000006_drop_redundant_split_fkey.sql
\ir ../migrations/20260929000007_preview_my_role.sql
\ir ../migrations/20260930000000_receipt_balance_guard.sql
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select add_ledger_person('t1', '{"id":"self","name":"나"}'::jsonb);
select add_ledger_person('t1', '{"id":"p2","name":"민지"}'::jsonb);
-- 내가 20,000원을 내고 반씩 나눴다: 민지가 나에게 10,000원을 줘야 한다.
select save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":20000,"paidBy":"self","splits":[{"personId":"self","amount":10000},{"personId":"p2","amount":10000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0);
\set ON_ERROR_STOP 0
select 'over balance rejected' as t, add_receipt('t1', '{"id":"r0","from":"p2","to":"self","amount":10001}'::jsonb);
select 'reverse direction rejected' as t, add_receipt('t1', '{"id":"r9","from":"self","to":"p2","amount":1000}'::jsonb);
\set ON_ERROR_STOP 1
select 'partial ok' as t, add_receipt('t1', '{"id":"r1","from":"p2","to":"self","amount":4000}'::jsonb);
select 'same id retried is ignored' as t, add_receipt('t1', '{"id":"r1","from":"p2","to":"self","amount":4000}'::jsonb);
select 'rest ok' as t, add_receipt('t1', '{"id":"r2","from":"p2","to":"self","amount":6000}'::jsonb);
\set ON_ERROR_STOP 0
select 'nothing left rejected' as t, add_receipt('t1', '{"id":"r3","from":"p2","to":"self","amount":1}'::jsonb);
\set ON_ERROR_STOP 1
select 'receipts' as t, count(*) as n, sum(amount) as total from settlement_receipts;
select cancel_receipt('t1', 'r2', '잘못 눌렀어요');
select 'after cancel ok' as t, add_receipt('t1', '{"id":"r4","from":"p2","to":"self","amount":6000}'::jsonb);
\set ON_ERROR_STOP 0
-- 잔액 계산은 add_receipt 안에서만 쓴다. 로그인한 사람이 직접 부르지 못한다.
select 'direct balance call rejected' as t, public.ledger_balance('t1', 'self');
\set ON_ERROR_STOP 1
reset role;
select 'balances' as t, public.ledger_balance('t1','self') as self, public.ledger_balance('t1','p2') as p2;
-- 동시 요청 확인을 위해 수령 기록을 비운다.
delete from settlement_receipts;
