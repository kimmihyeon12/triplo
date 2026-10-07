-- 로컬 PostgreSQL에서 채팅 기록 표·함수를 확인한다. Supabase의 auth 스키마를 흉내 낸다.
-- 실행: psql -U postgres -h localhost -c 'drop database if exists tc_chat' -c 'create database tc_chat'
--       psql -U postgres -h localhost -d tc_chat -f supabase/tests/chat-messages.local.sql
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
-- Supabase는 새 함수에 authenticated 실행 권한을 기본으로 준다.
alter default privileges in schema public grant execute on functions to authenticated;
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
\ir ../migrations/20261007100000_chat_messages.sql
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

set role authenticated;
set request.jwt.claim.sub = :'A';
select save_trip('{"id":"t1","title":"강릉","regions":[{"id":"r1","name":"강릉시","order":0}],"stops":[],"stays":[]}'::jsonb, 0);

-- 남기기: 목록 대화와 여행 대화, 같은 id는 한 줄
select append_chat_message(null, '{"id":"m1","role":"user","kind":null,"text":"안녕","at":"2026-10-07T00:00:00Z","extra":{}}');
select append_chat_message('t1', '{"id":"m2","role":"assistant","kind":"explore","text":"추천","at":"2026-10-07T00:00:01Z","extra":{"chips":["더 보기"]}}');
select append_chat_message('t1', '{"id":"m2","role":"assistant","kind":"explore","text":"추천","at":"2026-10-07T00:00:01Z","extra":{"chips":["더 보기"]}}');
select 'A rows (2)' as t, count(*) from chat_messages;
select 'A trip chips (더 보기)' as t, extra->'chips'->>0 from chat_messages where id = 'm2';
-- 형식 오류
select 'bad role (P0400)' as t, append_chat_message(null, '{"id":"x","role":"bot","text":"a","at":"2026-10-07T00:00:00Z","extra":{}}');
select 'long text (P0400)' as t, append_chat_message(null, jsonb_build_object('id','x','role','user','text',repeat('가',4001),'at','2026-10-07T00:00:00Z','extra','{}'::jsonb));
select 'big extra (P0400)' as t, append_chat_message(null, jsonb_build_object('id','x','role','user','text','a','at','2026-10-07T00:00:00Z','extra',jsonb_build_object('pad',repeat('a',70000))));
select 'no id (P0400)' as t, append_chat_message(null, '{"role":"user","text":"a","at":"2026-10-07T00:00:00Z","extra":{}}');
-- 표에 직접 쓰기: permission denied 기대
insert into chat_messages (user_id, id, role, text, at) values (:'A', 'direct', 'user', 'x', now());

-- 200줄 자르기: 목록 대화에 205줄을 더 남기면 최근 200줄만 남는다
select append_chat_message(null, jsonb_build_object('id','n'||n,'role','user','kind',null,'text','줄 '||n,'at',('2026-10-08T00:00:00Z'::timestamptz + n * interval '1 second'),'extra','{}'::jsonb)) from generate_series(1, 205) n;
select 'list kept (200)' as t, count(*) from chat_messages where trip_id is null;
select 'oldest dropped (0)' as t, count(*) from chat_messages where id in ('m1', 'n1', 'n5');
select 'trip untouched (1)' as t, count(*) from chat_messages where trip_id = 't1';

-- 다른 사람: A의 대화가 보이지 않고, 멤버가 아닌 여행에 남길 수 없다
set request.jwt.claim.sub = :'B';
select 'B sees none (0)' as t, count(*) from chat_messages;
select 'B not member (42501)' as t, append_chat_message('t1', '{"id":"b1","role":"user","text":"몰래","at":"2026-10-07T00:00:00Z","extra":{}}');
select 'B missing trip (42501)' as t, append_chat_message('nope', '{"id":"b1","role":"user","text":"a","at":"2026-10-07T00:00:00Z","extra":{}}');
select 'B clear A trip (0 rows touched)' as t, clear_chat('t1');

-- 옮기기: 목록 대화는 들어가고, 멤버 아닌 여행·없는 여행은 건너뛰고, 깨진 줄은 버린다
select 'B import (2)' as t, import_chat_threads('{
  "__list__": [
    {"id":"i1","role":"user","kind":null,"text":"예전 질문","at":"2026-10-01T00:00:00Z","extra":{}},
    {"id":"i2","role":"bot","text":"깨진 줄","at":"2026-10-01T00:00:01Z","extra":{}},
    {"id":"i3","role":"assistant","kind":"explore","text":"예전 답","at":"2026-10-01T00:00:02Z","extra":{}}
  ],
  "t1": [{"id":"i4","role":"user","text":"남의 여행","at":"2026-10-01T00:00:00Z","extra":{}}],
  "gone": [{"id":"i5","role":"user","text":"지운 여행","at":"2026-10-01T00:00:00Z","extra":{}}]
}');
select 'B rows after import (2)' as t, count(*) from chat_messages;
-- 서버에 이미 있는 대화는 건너뛴다
select 'B import again (0)' as t, import_chat_threads('{"__list__":[{"id":"i9","role":"user","text":"또","at":"2026-10-02T00:00:00Z","extra":{}}]}');
select 'B import too big (P0400)' as t, import_chat_threads(jsonb_build_object('__list__', jsonb_build_array(jsonb_build_object('id','x','role','user','text',repeat('a',2000001),'at','2026-10-01T00:00:00Z','extra','{}'::jsonb))));

-- 지우기
set request.jwt.claim.sub = :'A';
select clear_chat(null);
select 'A list cleared (0)' as t, count(*) from chat_messages where trip_id is null;
select 'A trip kept (1)' as t, count(*) from chat_messages where trip_id = 't1';

-- 내부 도우미는 직접 부를 수 없다
select 'helper denied (permission denied)' as t, insert_chat_message(:'A', null, '{}'::jsonb);

-- 로그인하지 않은 사람
set role anon;
set request.jwt.claim.sub = '';
select 'anon read (denied)' as t, count(*) from chat_messages;
select 'anon append (denied)' as t, append_chat_message(null, '{"id":"z","role":"user","text":"a","at":"2026-10-07T00:00:00Z","extra":{}}');

-- 여행을 지우면 그 대화가, 탈퇴하면 모든 대화가 지워진다
reset role;
delete from trips where id = 't1';
select 'after trip delete (0)' as t, count(*) from chat_messages where trip_id = 't1';
delete from auth.users where id = :'B';
select 'after B delete (0)' as t, count(*) from chat_messages where user_id = :'B';
