-- 로컬 PostgreSQL에서 AI 사용 횟수 함수를 확인한다.
-- 실행: psql -U postgres -h localhost -c 'create database tc_check'
--       psql -U postgres -h localhost -d tc_check -f supabase/tests/ai-usage.local.sql
\set ON_ERROR_STOP 1
create schema auth;
create table auth.users (id uuid primary key);
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
\ir ../migrations/20260929000004_ai_usage.sql
\set ON_ERROR_STOP 0
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
set role service_role;
select 'A plan 1 (1 left)' as t, consume_ai_quota(:A, 'plan', 2);
select 'A plan 2 (0 left)' as t, consume_ai_quota(:A, 'plan', 2);
select 'A plan 3 (user_limit)' as t, consume_ai_quota(:A, 'plan', 2);
select 'B plan 1 (1 left)' as t, consume_ai_quota(:B, 'plan', 2);
select 'A chat 1 (1 left)' as t, consume_ai_quota(:A, 'chat', 2);
select refund_ai_quota(:A, 'plan');
select 'A plan after refund (0 left)' as t, consume_ai_quota(:A, 'plan', 2);
select refund_ai_quota(:A, 'chat');
select refund_ai_quota(:A, 'chat');
select refund_ai_quota(:B, 'receipt');
reset role;
insert into ai_usage values (:A, (now() at time zone 'Asia/Seoul')::date - 1, 'receipt', 9);
insert into ai_quota_overrides values (:B, 'plan', 0), (:A, 'chat', 5);
set role service_role;
select 'A receipt today (9 left)' as t, consume_ai_quota(:A, 'receipt', 10);
select 'B plan override 0 (user_limit)' as t, consume_ai_quota(:B, 'plan', 2);
select 'A chat override 5 (4 left)' as t, consume_ai_quota(:A, 'chat', 2);
select 'bad kind (check)' as t, consume_ai_quota(:A, 'other', 2);
reset role;
select 'rows' as t, user_id, day = (now() at time zone 'Asia/Seoul')::date as today, kind, count
  from ai_usage order by user_id, day, kind;
set role authenticated;
select 'auth consume (denied)' as t, consume_ai_quota(:A, 'plan', 99);
select 'auth read (denied)' as t, count(*) from ai_usage;
set role anon;
select 'anon refund (denied)' as t, refund_ai_quota(:A, 'plan');
