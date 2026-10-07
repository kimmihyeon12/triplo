-- 로컬 PostgreSQL에서 AI 호출 기록 표와 관리자 사용량 집계를 확인한다. Supabase의 auth·storage 스키마를 흉내 낸다.
-- 실행: psql -U postgres -h localhost -c 'drop database if exists tc_usage' -c 'create database tc_usage'
--       psql -U postgres -h localhost -d tc_usage -f supabase/tests/admin-usage.local.sql
-- 각 줄의 t 값 끝 괄호가 기대값이다. pg_cron이 없어 정리 일정 파일(20261007200001)은 쓰지 않는다.
\set ON_ERROR_STOP 1
create schema auth;
create schema storage;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}', last_sign_in_at timestamptz);
create table storage.objects (id uuid primary key default gen_random_uuid(), metadata jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
-- 역할은 클러스터 전체에 남는다. 앞서 만든 역할에도 Supabase처럼 RLS 우회를 준다.
alter role service_role bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', '{}', now() - interval '1 day'),
  ('22222222-2222-2222-2222-222222222222', '{}', now() - interval '40 days'),
  ('33333333-3333-3333-3333-333333333333', '{}', null);
insert into storage.objects (metadata) values ('{"size": 1000}'), ('{"size": 234}'), (null);
\ir ../migrations/20260930000002_profiles_role.sql
\ir ../migrations/20261007200000_admin_usage.sql
insert into public.profiles values ('11111111-1111-1111-1111-111111111111', 'admin');
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

-- 서버 함수(service_role)가 기록한다. 오늘 3줄(1줄 실패), 지난달 1줄.
set role service_role;
insert into public.ai_calls (kind, model, ok, input_tokens, output_tokens) values
  ('chat', 'gemini-3.5-flash-lite', true, 100, 50),
  ('chat', 'gemini-3.5-flash-lite', false, 0, 0),
  ('plan', 'gemini-3.5-flash-lite', true, 400, 300);
insert into public.ai_calls (at, kind, model, ok, input_tokens, output_tokens) values
  (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' - interval '2 days', 'chat', 'gemini-3.5-flash-lite', true, 9999, 9999);
-- 잘못된 기능·음수 토큰은 check 위반으로 거절
insert into public.ai_calls (kind, model, ok) values ('other', 'm', true);
insert into public.ai_calls (kind, model, ok, input_tokens) values ('chat', 'm', true, -1);
reset role;

-- 일반 사용자 B: 표를 읽지 못하고 집계 함수도 거절
set role authenticated;
set request.jwt.claim.sub = :'B';
select 'B reads ai_calls (permission denied)' as t, count(*) from public.ai_calls;
select 'B summary (42501)' as t, public.admin_usage_summary();

-- 관리자 A
set request.jwt.claim.sub = :'A';
select 'A day requests (3)' as t, (public.admin_usage_summary() -> 'gemini' ->> 'dayRequests')::int;
select 'A day failed (1)' as t, (public.admin_usage_summary() -> 'gemini' ->> 'dayFailed')::int;
select 'A month chat requests (2)' as t, (m ->> 'requests')::int
  from jsonb_array_elements(public.admin_usage_summary() -> 'gemini' -> 'month') m where m ->> 'kind' = 'chat';
select 'A month chat input excludes last month (100)' as t, (m ->> 'inputTokens')::int
  from jsonb_array_elements(public.admin_usage_summary() -> 'gemini' -> 'month') m where m ->> 'kind' = 'chat';
select 'A month plan output (300)' as t, (m ->> 'outputTokens')::int
  from jsonb_array_elements(public.admin_usage_summary() -> 'gemini' -> 'month') m where m ->> 'kind' = 'plan';
select 'A storage bytes (1234)' as t, (public.admin_usage_summary() -> 'supabase' ->> 'storageBytes')::bigint;
select 'A active users 30d (1)' as t, (public.admin_usage_summary() -> 'supabase' ->> 'activeUsers30d')::int;
select 'A db bytes positive (t)' as t, (public.admin_usage_summary() -> 'supabase' ->> 'dbBytes')::bigint > 0;
select 'A day start is LA midnight (t)' as t,
  (public.admin_usage_summary() -> 'gemini' ->> 'dayStart')::timestamptz
    = date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
select 'A reads ai_calls directly (permission denied)' as t, count(*) from public.ai_calls;

-- 비로그인
set request.jwt.claim.sub = '';
select 'no user summary (42501)' as t, public.admin_usage_summary();
reset role;
set role anon;
select 'anon summary (permission denied)' as t, public.admin_usage_summary();
reset role;
