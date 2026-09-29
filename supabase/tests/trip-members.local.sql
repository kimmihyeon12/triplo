-- 로컬 PostgreSQL에서 여행 멤버·초대 권한을 확인한다. Supabase의 auth 스키마를 흉내 낸다.
-- 실행: psql -U postgres -h localhost -c 'create database tc_check'
--       psql -U postgres -h localhost -d tc_check -f supabase/tests/trip-members.local.sql
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
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

-- 주인 A가 여행과 지출을 만든다.
set role authenticated;
set request.jwt.claim.sub = :'A';
select 'A save t1 (1)' as t, save_trip('{"id":"t1","title":"강릉","regions":[{"id":"r1","name":"강릉시","order":0}],"stops":[{"id":"s1","kind":"place","name":"경포대","address":"강릉시 경포로","regionId":"r1","date":"2026-10-10","order":0,"memo":"비밀 메모","excluded":false},{"id":"s2","kind":"place","name":"뺀 곳","regionId":"r1","date":null,"order":1,"excluded":true}],"stays":[{"id":"h1","name":"호텔","regionId":"r1","checkIn":"2026-10-10","checkOut":"2026-10-11","reservation":"reserved","memo":"예약번호 123"}]}'::jsonb, 0);
select 'A owner row (owner 주인)' as t, role, nickname from trip_members where trip_id = 't1';
select add_ledger_person('t1', '{"id":"self","name":"나"}'::jsonb);
select 'A shared e1 (1)' as t, save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":1000,"paidBy":"self","splits":[{"personId":"self","amount":1000}],"memo":"","linkId":null,"personal":false}'::jsonb, 0);
select 'A personal e2 (1)' as t, save_expense('t1', '{"id":"e2","title":"선물","date":"2026-10-10","category":"shopping","amount":500,"paidBy":"self","splits":[{"personId":"self","amount":500}],"memo":"","linkId":null,"personal":true}'::jsonb, 0);
select create_trip_invite('t1') as code \gset
select 'code shape (t)' as t, :'code' ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$';

-- 로그인 전(anon) 미리보기: 민감 정보가 없다.
set role anon;
set request.jwt.claim.sub = '';
select 'anon preview title (강릉)' as t, preview_trip_invite(:'code')->>'title';
select 'anon preview owner (주인)' as t, preview_trip_invite(:'code')->>'ownerNickname';
select 'anon preview stops (1 경포대)' as t, jsonb_array_length(p->'stops'), p->'stops'->0->>'name' from (select preview_trip_invite(:'code') p) x;
select 'anon preview leaks (f)' as t, preview_trip_invite(:'code')::text ~ '(비밀 메모|예약번호|경포로|reserved|memo|address|tripId|budget)';
select 'anon preview bad code (invite_invalid)' as t, preview_trip_invite('AAAA-AAAA');
select 'anon trips (denied)' as t, count(*) from trips;
select 'anon save_trip (denied)' as t, save_trip('{"id":"x"}'::jsonb, 0);
select 'anon join (denied)' as t, join_trip(:'code');

-- 친구 B: 합류 전에는 아무것도 안 보이고, 소문자·하이픈 코드로 합류한다.
set role authenticated;
set request.jwt.claim.sub = :'B';
select 'B trips before join (0)' as t, count(*) from trips;
select 'B join (t1)' as t, join_trip(lower(substr(:'code', 1, 4) || '-' || substr(:'code', 5)));
select 'B join again (t1)' as t, join_trip(:'code');
select 'B trips (1)' as t, count(*) from trips;
select 'B members (2)' as t, count(*) from trip_members where trip_id = 't1';
select 'B ledger person added (민지)' as t, name from ledger_people where trip_id = 't1' and id = 'member-' || :'B';
select 'B sees expenses (e1 only)' as t, string_agg(id, ',') from expenses;
select 'B sees splits (1)' as t, count(*) from expense_splits;
select 'B edits trip (2)' as t, save_trip('{"id":"t1","title":"강릉 함께","regions":[{"id":"r1","name":"강릉시","order":0}],"stops":[],"stays":[]}'::jsonb, 1);
select 'B personal e3 (1)' as t, save_expense('t1', '{"id":"e3","title":"커피","date":"2026-10-10","category":"food","amount":300,"paidBy":"self","splits":[{"personId":"self","amount":300}],"memo":"","linkId":null,"personal":true}'::jsonb, 0);
select 'B edits A personal e2 (not_found)' as t, save_expense('t1', '{"id":"e2","title":"x","date":"2026-10-10","category":"shopping","amount":500,"paidBy":"self","splits":[{"personId":"self","amount":500}],"memo":"","linkId":null,"personal":true}'::jsonb, 1);
select 'B deletes A personal e2 (not_found)' as t, delete_expense('t1', 'e2', 1);
select 'B makes e1 personal (not_found)' as t, save_expense('t1', '{"id":"e1","title":"저녁","date":"2026-10-10","category":"food","amount":1000,"paidBy":"self","splits":[{"personId":"self","amount":1000}],"memo":"","linkId":null,"personal":true}'::jsonb, 1);
select 'B edits shared e1 (2)' as t, save_expense('t1', '{"id":"e1","title":"저녁 함께","date":"2026-10-10","category":"food","amount":1000,"paidBy":"self","splits":[{"personId":"self","amount":1000}],"memo":"","linkId":null,"personal":false}'::jsonb, 1);
select 'B delete_trip (not_found)' as t, delete_trip('t1');
select 'B create invite (not_found)' as t, create_trip_invite('t1');
select 'B remove A (not_found)' as t, remove_trip_member('t1', :'A');
select 'B sees invites (0)' as t, count(*) from trip_invites;
insert into trip_stops (id, trip_id, kind, name, "order") values ('zz', 't1', 'place', 'x', 9);
update trips set title = 'hack' where id = 't1';
delete from expenses where id = 'e1';
insert into trip_members values ('t1', :'C', 'editor', 'x', now());

-- 주인 A: B의 개인 지출은 보이지 않고, 주인은 스스로 빠질 수 없다.
set request.jwt.claim.sub = :'A';
select 'A sees e3 (0)' as t, count(*) from expenses where id = 'e3';
select 'A title (강릉 함께)' as t, title from trips where id = 't1';
select 'A leave (rule)' as t, leave_trip('t1');
select 'A remove self (rule)' as t, remove_trip_member('t1', :'A');
select 'A remove B' as t, remove_trip_member('t1', :'B');

-- 빠진 B는 곧바로 막힌다. B가 쓴 지출은 남는다.
set request.jwt.claim.sub = :'B';
select 'removed B trips (0)' as t, count(*) from trips;
select 'removed B save_trip (not_found)' as t, save_trip('{"id":"t1","title":"x","regions":[],"stops":[],"stays":[]}'::jsonb, 2);
select 'removed B ledger (not_found)' as t, set_budget('t1', 1);
reset role;
select 'e3 kept (1)' as t, count(*) from expenses where id = 'e3';

-- 취소·만료된 링크는 같은 오류다.
set role authenticated;
set request.jwt.claim.sub = :'A';
select revoke_trip_invite('t1');
set request.jwt.claim.sub = :'C';
select 'C join revoked (invite_invalid)' as t, join_trip(:'code');
set request.jwt.claim.sub = :'A';
select create_trip_invite('t1') as code2 \gset
select 'A new code differs (t)' as t, :'code' <> :'code2';
reset role;
update trip_invites set expires_at = now() - interval '1 second';
set role anon;
set request.jwt.claim.sub = '';
select 'expired preview (invite_invalid)' as t, preview_trip_invite(:'code2');

-- 모르는 사람 C는 같은 id로 저장해도 남의 여행을 건드리지 못한다. 멤버가 되면 나갈 수 있다.
set role authenticated;
set request.jwt.claim.sub = :'C';
select 'C save t1 (not_found)' as t, save_trip('{"id":"t1","title":"x","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
set request.jwt.claim.sub = :'A';
select create_trip_invite('t1') as code3 \gset
set request.jwt.claim.sub = :'C';
select 'C join (t1)' as t, join_trip(:'code3');
select 'C leave' as t, leave_trip('t1');
select 'C trips after leave (0)' as t, count(*) from trips;
select 'C leave again (not_found)' as t, leave_trip('t1');

-- 분담은 지출과 같은 여행에만 달린다. 주인만 여행을 지운다.
set request.jwt.claim.sub = :'A';
select 'A save t2 (1)' as t, save_trip('{"id":"t2","title":"속초","regions":[],"stops":[],"stays":[]}'::jsonb, 0);
select add_ledger_person('t2', '{"id":"p9","name":"다른 여행 사람"}'::jsonb);
reset role;
-- 사람은 t2에 있지만 지출 e1은 t1의 것이라 expense_splits_expense_trip_fkey 위반이어야 한다.
insert into expense_splits (expense_id, trip_id, person_id, amount) values ('e1', 't2', 'p9', 1);
set role authenticated;
set request.jwt.claim.sub = :'A';
select 'A delete t2' as t, delete_trip('t2');
select 'A trips (t1)' as t, string_agg(id, ',') from trips;
