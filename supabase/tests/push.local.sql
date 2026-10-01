-- 로컬 PostgreSQL에서 알림 쌓기·구독·설정 권한을 확인한다. Supabase의 auth 스키마를 흉내 낸다.
-- 실행: psql -U postgres -h localhost -c 'drop database if exists tc_push' -c 'create database tc_push'
--       psql -U postgres -h localhost -d tc_push -f supabase/tests/push.local.sql
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
insert into public.profiles values ('33333333-3333-3333-3333-333333333333', 'admin');
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

-- A가 여행을 만든다. 혼자라 알림이 없다.
set role authenticated;
set request.jwt.claim.sub = :'A';
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select add_ledger_person('t1', '{"id":"self","name":"나"}'::jsonb);
select create_trip_invite('t1') as code \gset
reset role;
select 'solo trip queues nothing (0)' as t, count(*) from notification_outbox;

-- B가 합류하면 A에게 참여 알림
set role authenticated;
set request.jwt.claim.sub = :'B';
select join_trip(:'code');
reset role;
select 'join to A (t)' as t, count(*) = 1 from notification_outbox where user_id = :'A' and kind = 'join' and body = '민지님이 「강릉」에 참여했어요';
select 'join not to B (0)' as t, count(*) from notification_outbox where user_id = :'B';

-- B가 일정을 두 번 고치면 A에게 한 번만, 고친 B에게는 없다
set role authenticated;
set request.jwt.claim.sub = :'B';
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 1);
select save_trip('{"id":"t1","title":"강릉","regions":[],"stops":[],"stays":[]}'::jsonb, 2);
reset role;
select 'trip edit grouped to A (1)' as t, count(*) from notification_outbox where user_id = :'A' and kind = 'trip';
select 'trip edit body (민지님이 「강릉」 일정을 고쳤어요)' as t, body from notification_outbox where user_id = :'A' and kind = 'trip';
select 'trip edit not to B (0)' as t, count(*) from notification_outbox where user_id = :'B' and kind = 'trip';

-- B의 공유 지출은 A에게, 개인 지출은 알리지 않는다
set role authenticated;
set request.jwt.claim.sub = :'B';
select save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":1000,"paidBy":"self","splits":[{"personId":"self","amount":1000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0);
reset role;
select 'ledger to A (1)' as t, count(*) from notification_outbox where user_id = :'A' and kind = 'ledger';
delete from notification_outbox where kind = 'ledger';
set role authenticated;
set request.jwt.claim.sub = :'B';
select save_expense('t1', '{"id":"e2","title":"선물","date":"2026-10-10","category":"shopping","amount":500,"paidBy":"self","splits":[{"personId":"self","amount":500}],"memo":"","linkId":null,"personal":true}'::jsonb, 0);
reset role;
select 'personal expense queues nothing (0)' as t, count(*) from notification_outbox where kind = 'ledger';

-- 문의 답변은 문의한 사람에게, 공지 발행은 모두에게(한 번만)
set role authenticated;
set request.jwt.claim.sub = :'B';
select send_inquiry('bug', E'지도가 안 떠요\n자세한 내용', 'v', 'ua') as qid \gset
set request.jwt.claim.sub = :'C';
select admin_reply_inquiry(:'qid', '확인했어요');
select admin_save_notice(null, '점검 안내', '본문') as nid \gset
select admin_set_notice_published(:'nid', true);
select admin_set_notice_published(:'nid', true);
reset role;
select 'reply to B (지도가 안 떠요)' as t, body from notification_outbox where user_id = :'B' and kind = 'reply';
select 'notice broadcast once (1)' as t, count(*) from notification_outbox where broadcast and kind = 'notice';

-- 여행을 지우면 연쇄로 지워지는 지출 때문에 알림이 생기지 않는다
delete from notification_outbox;
set role authenticated;
set request.jwt.claim.sub = :'A';
select delete_trip('t1');
reset role;
select 'delete trip queues nothing (0)' as t, count(*) from notification_outbox;

-- 구독·설정은 본인만, outbox는 앱 사용자가 읽지 못한다
set role authenticated;
set request.jwt.claim.sub = :'B';
select save_push_subscription('https://push.example/abc', 'key', 'auth', 'ua');
select save_notification_settings(true, false, true);
select 'B sees own sub (1)' as t, count(*) from push_subscriptions;
select 'B settings (t f t)' as t, replies, notices, together from notification_settings;
select 'bad endpoint (P0400)' as t, save_push_subscription('http://x', 'k', 'a', 'u');
select 'B reads outbox (denied)' as t, count(*) from notification_outbox;
select 'B queues directly (denied)' as t, queue_notification(:'A', 'trip', 'x', 'y', '/', '');
set request.jwt.claim.sub = :'C';
select 'C sees B sub (0)' as t, count(*) from push_subscriptions;
select delete_push_subscription('https://push.example/abc');
reset role;
select 'C cannot delete B sub (1)' as t, count(*) from push_subscriptions;
set role anon;
set request.jwt.claim.sub = '';
select 'anon save sub (denied)' as t, save_push_subscription('https://push.example/z', 'k', 'a', 'u');
reset role;

-- 계정을 지우면 구독·설정이 함께 지워진다
delete from auth.users where id = :'B';
select 'after delete B subs (0)' as t, count(*) from push_subscriptions;
select 'after delete B settings (0)' as t, count(*) from notification_settings;
