-- 로컬 PostgreSQL에서 알림 내역(2026-10-06)을 확인한다. Supabase의 auth 스키마를 흉내 낸다.
-- 실행: psql -U postgres -h localhost -c 'drop database if exists tc_inbox' -c 'create database tc_inbox'
--       psql -U postgres -h localhost -d tc_inbox -f supabase/tests/notification-inbox.local.sql
-- 각 줄의 t 값 끝 괄호가 기대값이다.
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
\ir ../migrations/20260930000002_profiles_role.sql
\ir ../migrations/20261001000000_support.sql
\ir ../migrations/20261001120000_push_notifications.sql
\ir ../migrations/20261001150000_push_service_role_grants.sql
\ir ../migrations/20261006120000_notification_inbox.sql
insert into public.profiles values ('33333333-3333-3333-3333-333333333333', 'admin');
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

-- A가 여행을 만들고 B가 합류한다. A의 내역에 참여 알림이 남는다(푸시 구독이 없어도).
set role authenticated;
set request.jwt.claim.sub = :'A';
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select add_ledger_person('t1', '{"id":"self","name":"나"}'::jsonb);
select create_trip_invite('t1') as code \gset
set request.jwt.claim.sub = :'B';
select join_trip(:'code');
reset role;
select 'join in A inbox without push (1)' as t, count(*) from notification_inbox where user_id = :'A' and kind = 'join' and read_at is null;

-- B가 일정을 두 번 고치면 A의 내역에도 한 번만
set role authenticated;
set request.jwt.claim.sub = :'B';
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 1);
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 2);
reset role;
select 'trip edit grouped in inbox (1)' as t, count(*) from notification_inbox where user_id = :'A' and kind = 'trip';

-- A가 '함께 편집 소식'을 끄면 그 뒤 가계부 변경은 내역에 남지 않는다(푸시 대기열에는 쌓인다)
set role authenticated;
set request.jwt.claim.sub = :'A';
select save_notification_settings(true, true, false);
set request.jwt.claim.sub = :'B';
select save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":1000,"paidBy":"self","splits":[{"personId":"self","amount":1000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0);
reset role;
select 'ledger skipped in inbox when off (0)' as t, count(*) from notification_inbox where user_id = :'A' and kind = 'ledger';
select 'ledger still queued for push (1)' as t, count(*) from notification_outbox where user_id = :'A' and kind = 'ledger';

-- 공지를 발행하면 공지 알림을 켠 사람마다 내역이 생긴다. B가 공지를 끄면 B에게는 없다.
set role authenticated;
set request.jwt.claim.sub = :'B';
select save_notification_settings(true, false, true);
set request.jwt.claim.sub = :'C';
select admin_save_notice(null, '점검 안내', '본문') as nid \gset
select admin_set_notice_published(:'nid', true);
select admin_set_notice_published(:'nid', true);
reset role;
select 'notice to A once (1)' as t, count(*) from notification_inbox where user_id = :'A' and kind = 'notice' and body = '점검 안내';
select 'notice not to B who turned off (0)' as t, count(*) from notification_inbox where user_id = :'B' and kind = 'notice';
select 'notice to C (1)' as t, count(*) from notification_inbox where user_id = :'C' and kind = 'notice';
select 'notice push broadcast once (1)' as t, count(*) from notification_outbox where broadcast and kind = 'notice';

-- 본인 내역만 보이고, 읽음 표시는 본인 것만 바뀐다
set role authenticated;
set request.jwt.claim.sub = :'A';
select 'A sees only own (t)' as t, bool_and(user_id = :'A') and count(*) = 3 from notification_inbox;
select mark_notifications_read();
select 'A unread after mark (0)' as t, count(*) from notification_inbox where read_at is null;
\echo 'A cannot write inbox (denied):'
insert into notification_inbox (user_id, kind, title, body, url) values (:'A', 'trip', 'x', 'y', '/');
set request.jwt.claim.sub = :'C';
select 'C sees A rows (0)' as t, count(*) from notification_inbox where user_id = :'A';
reset role;
select 'C still unread (1)' as t, count(*) from notification_inbox where user_id = :'C' and read_at is null;
set role anon;
set request.jwt.claim.sub = '';
select 'anon reads inbox (denied)' as t, count(*) from notification_inbox;
select 'anon marks read (denied)' as t, mark_notifications_read();
reset role;

-- 계정을 지우면 그 사람 내역도 지워진다(여행이 없는 관리자 C로 확인한다)
delete from auth.users where id = :'C';
select 'after delete C inbox (0)' as t, count(*) from notification_inbox where user_id = :'C';
