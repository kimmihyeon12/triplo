-- 로컬 PostgreSQL에서 가계부 저장 함수를 확인한다. Supabase의 auth 스키마를 흉내 낸다.
-- 실행: psql -U postgres -h localhost -c 'create database tc_check'
--       psql -U postgres -h localhost -d tc_check -f supabase/tests/ledger.local.sql
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
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
\ir ../migrations/20260917000000_create_trip_tables.sql
\ir ../migrations/20260929000000_trip_version_and_save.sql
\ir ../migrations/20260929000001_trip_grants.sql
\ir ../migrations/20260929000002_ledger_tables.sql
\ir ../migrations/20260929000003_remove_ledger_person.sql
\ir ../migrations/20260929000005_trip_members.sql
\ir ../migrations/20260929000006_drop_redundant_split_fkey.sql
\ir ../migrations/20260929000007_preview_my_role.sql
\ir ../migrations/20260930000000_receipt_balance_guard.sql
\set ON_ERROR_STOP 0
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select add_ledger_person('t1', '{"id":"self","name":"나"}'::jsonb);
select add_ledger_person('t1', '{"id":"p2","name":"민지"}'::jsonb);
select 'people' as t, count(*) from ledger_people;
select 'e1 new' as t, save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":30000,"paidBy":"self","splits":[{"personId":"self","amount":15000},{"personId":"p2","amount":15000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0) as v;
select 'e1 dup' as t, save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":30000,"paidBy":"self","splits":[{"personId":"self","amount":30000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0);
select 'e1 mismatch' as t, save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":30000,"paidBy":"self","splits":[{"personId":"self","amount":14000},{"personId":"p2","amount":15000}],"memo":"","linkId":null,"personal":false}'::jsonb, 1);
select 'after mismatch' as t, amount, version, (select count(*) from expense_splits) splits from expenses;
select 'e1 update' as t, save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":40000,"paidBy":"self","splits":[{"personId":"self","amount":20000},{"personId":"p2","amount":20000}],"memo":"","linkId":null,"personal":false}'::jsonb, 1) as v;
select 'e1 stale delete' as t, delete_expense('t1', 'e1', 1);
select 'e1 delete' as t, delete_expense('t1', 'e1', 2);
select 'after delete' as t, (select count(*) from expenses) exp, (select count(*) from expense_splits) splits;
-- 수령은 남은 빚 안에서만 기록된다(20260930 마이그레이션). 민지가 5,000원을 빚지게 둔다.
select 'e2 for receipt' as t, save_expense('t1', '{"id":"e2","title":"커피","date":"2026-10-10","category":"cafe","amount":10000,"paidBy":"self","splits":[{"personId":"self","amount":5000},{"personId":"p2","amount":5000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0) as v;
select add_receipt('t1', '{"id":"r1","from":"p2","to":"self","amount":5000}'::jsonb);
select cancel_receipt('t1', 'r1', '실수');
select 'receipt' as t, amount, cancelled_reason from settlement_receipts;
select set_budget('t1', 100000);
select 'budget set' as t, budget from trip_ledgers;
select set_budget('t1', null);
select 'budget cleared' as t, coalesce(budget::text, 'null') from trip_ledgers;
select add_ledger_person('t1', '{"id":"p3","name":"준호"}'::jsonb);
select 'remove used' as t, remove_ledger_person('t1', 'p2');
select 'remove self' as t, remove_ledger_person('t1', 'self');
select 'remove p3' as t, remove_ledger_person('t1', 'p3');
select 'people after remove' as t, string_agg(id, ',' order by "order") from ledger_people;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'B remove' as t, remove_ledger_person('t1', 'self');
select 'B save' as t, save_expense('t1', '{"id":"e9","title":"x","date":"2026-10-10","category":"food","amount":1000,"paidBy":"self","splits":[{"personId":"self","amount":1000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0);
select 'B budget' as t, set_budget('t1', 1);
select 'B sees' as t, (select count(*) from expenses) + (select count(*) from ledger_people) + (select count(*) from settlement_receipts) as rows;
set request.jwt.claim.sub = '';
select 'anon' as t, set_budget('t1', 1);
