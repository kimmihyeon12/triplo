-- 로컬 PostgreSQL에서 공지·문의 권한과 함수를 확인한다. Supabase의 auth 스키마를 흉내 낸다.
-- 실행: psql -U postgres -h localhost -c 'drop database if exists tc_support' -c 'create database tc_support'
--       psql -U postgres -h localhost -d tc_support -f supabase/tests/support.local.sql
-- 각 줄의 t 값 끝 괄호가 기대값이다.
\set ON_ERROR_STOP 1
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
-- Supabase는 새 함수에 authenticated 실행 권한을 기본으로 준다. 같은 조건에서 회수를 확인한다.
alter default privileges in schema public grant execute on functions to authenticated;
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', '{"travel_nickname":"관리자"}'),
  ('22222222-2222-2222-2222-222222222222', '{"travel_nickname":"민지"}'),
  ('33333333-3333-3333-3333-333333333333', '{"travel_nickname":"준호"}');
\ir ../migrations/20260930000002_profiles_role.sql
\ir ../migrations/20261001000000_support.sql
\ir ../migrations/20261001100000_inquiry_read_seen_at.sql
\ir ../migrations/20261007000000_support_hardening.sql
insert into public.profiles values ('11111111-1111-1111-1111-111111111111', 'admin');
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

-- 관리자 A: 공지 초안·발행, 빈 제목 거절
set role authenticated;
set request.jwt.claim.sub = :'A';
select 'A save draft (t)' as t, admin_save_notice(null, '첫 공지', '본문') is not null;
select 'A blank title (P0400)' as t, admin_save_notice(null, '   ', '본문');
select 'A save second draft (t)' as t, admin_save_notice(null, '둘째', '두 번째 본문') is not null;
select admin_set_notice_published(id, true) from notices where title = '첫 공지';
select 'A sees 2 notices (2)' as t, count(*) from notices;

-- 사용자 B: 발행된 것만 보이고, 표에 직접 못 쓰고, 관리자 함수 못 부름
set request.jwt.claim.sub = :'B';
select 'B sees published only (1)' as t, count(*) from notices;
-- 표에 직접 쓰기: permission denied 기대
insert into notices (title, body) values ('몰래', '몰래');
select 'B admin_save (42501)' as t, admin_save_notice(null, '몰래', '몰래');
select mark_notices_read();
select 'B unread after read (0)' as t, count(*) from notices n where not exists (select 1 from notice_reads r where r.notice_id = n.id and r.user_id = auth.uid());

-- 발행 취소하면 사용자 목록에서 사라진다
set request.jwt.claim.sub = :'A';
select admin_set_notice_published(id, false) from notices where title = '첫 공지';
set request.jwt.claim.sub = :'B';
select 'B after unpublish (0)' as t, count(*) from notices;

-- 문의: B가 보내고 C는 못 봄, 닉네임은 서버가 채움
select 'B send (t)' as t, send_inquiry('bug', '  지도가 안 떠요  ', 'v0.10.2', 'test-agent') is not null;
select 'B too long (P0400)' as t, send_inquiry('bug', repeat('가', 1001), 'v', 'ua');
select 'B nickname and trimmed (민지|지도가 안 떠요)' as t, sender_nickname, body from inquiries;
-- 자기 문의 상태 직접 변경: permission denied 기대
update inquiries set status = 'answered';
set request.jwt.claim.sub = :'C';
select 'C sees none (0)' as t, count(*) from inquiries;
reset role;
select id as qid from inquiries limit 1 \gset
set role authenticated;
select 'C mark B inquiry read (P0404)' as t, mark_inquiry_read(:'qid');

-- 관리자 답변 → 답변 완료, B에게 새 답변, B가 읽고 다시 답하면 다시 새 답변
set request.jwt.claim.sub = :'A';
select 'A reply (t)' as t, admin_reply_inquiry(:'qid', '확인했어요') is not null;
select 'A status answered (answered)' as t, status from inquiries;
select 'A blank reply (P0400)' as t, admin_reply_inquiry(:'qid', '  ');
set request.jwt.claim.sub = :'B';
select 'B sees reply (1)' as t, count(*) from inquiry_replies;
select mark_inquiry_read(:'qid');
select 'B answer read set (t)' as t, answer_read_at is not null from inquiries;
select pg_sleep(0.01);
set request.jwt.claim.sub = :'A';
select admin_reply_inquiry(:'qid', '추가 안내');
set request.jwt.claim.sub = :'B';
select 'B new reply after read (t)' as t, max(r.created_at) > max(i.answer_read_at) from inquiries i join inquiry_replies r on r.inquiry_id = i.id;
-- 화면에 첫 답변만 보였는데 그사이 둘째 답변이 달렸다. 본 데까지만 읽음으로 남는다.
select min(created_at) as first_reply from inquiry_replies \gset
select mark_inquiry_read(:'qid', :'first_reply');
select 'B unseen reply stays new (t)' as t, max(r.created_at) > max(i.answer_read_at) from inquiries i join inquiry_replies r on r.inquiry_id = i.id;
select 'B read never moves back (t)' as t, max(answer_read_at) >= :'first_reply'::timestamptz from inquiries;
-- 옛 앱(시각 없이 부름)도 그대로 동작한다.
select mark_inquiry_read(:'qid');
select 'B old client marks all read (t)' as t, max(r.created_at) <= max(i.answer_read_at) from inquiries i join inquiry_replies r on r.inquiry_id = i.id;
-- 미래 시각을 보내도 지금보다 뒤로 기록하지 않는다.
select mark_inquiry_read(:'qid', now() + interval '1 day');
select 'B future seen clamped (t)' as t, max(answer_read_at) <= now() + interval '1 second' from inquiries;
set request.jwt.claim.sub = :'C';
select 'C sees no replies (0)' as t, count(*) from inquiry_replies;
set request.jwt.claim.sub = :'A';
select admin_set_inquiry_status(:'qid', 'reading');
select 'A status reading (reading)' as t, status from inquiries;
select 'A delete missing notice (P0404)' as t, admin_delete_notice('99999999-9999-9999-9999-999999999999');

-- 내부 도우미는 로그인한 사람도 직접 부르지 못한다
set request.jwt.claim.sub = :'C';
select 'C require_admin (permission denied)' as t, require_admin();
select 'C clean_text (permission denied)' as t, clean_text('x', 10);

-- 문의는 1시간에 5건까지. 다른 사람의 한도에는 영향이 없다
select send_inquiry('etc', '문의 ' || n, 'v', 'ua') from generate_series(1, 5) n;
select 'C sixth inquiry (P0429)' as t, send_inquiry('etc', '여섯째', 'v', 'ua');
select 'C kept five (5)' as t, count(*) from inquiries;
set request.jwt.claim.sub = :'B';
select 'B still sends (t)' as t, send_inquiry('bug', '다른 사람', 'v', 'ua') is not null;
reset role;
update inquiries set created_at = now() - interval '61 minutes' where user_id = :'C';
set role authenticated;
set request.jwt.claim.sub = :'C';
select 'C sends after an hour (t)' as t, send_inquiry('etc', '한 시간 뒤', 'v', 'ua') is not null;

-- 로그인하지 않은 사람
set role anon;
set request.jwt.claim.sub = '';
select 'anon notices (denied)' as t, count(*) from notices;
select 'anon send (denied)' as t, send_inquiry('bug', 'x', 'v', 'ua');

-- 탈퇴하면 함께 지워진다
reset role;
delete from auth.users where id = :'B';
select 'after delete B inquiries (0)' as t, count(*) from inquiries where user_id = :'B';
select 'after delete B replies (0)' as t, count(*) from inquiry_replies;
select 'after delete B reads (0)' as t, count(*) from notice_reads;
