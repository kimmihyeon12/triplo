-- 로컬 PostgreSQL에서 배포 공지 초안 함수를 확인한다. Supabase의 auth 스키마를 흉내 낸다.
-- 실행: psql -U postgres -h localhost -c 'drop database if exists tc_release' -c 'create database tc_release'
--       psql -U postgres -h localhost -d tc_release -f supabase/tests/release-notice.local.sql
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
insert into auth.users values ('11111111-1111-1111-1111-111111111111', '{}');
\ir ../migrations/20260930000002_profiles_role.sql
\ir ../migrations/20261001000000_support.sql
\ir ../migrations/20261001100000_inquiry_read_seen_at.sql
\ir ../migrations/20261001110000_release_notice_draft.sql
insert into public.profiles values ('11111111-1111-1111-1111-111111111111', 'admin');
\set ON_ERROR_STOP 0

-- 배포 담당(데이터베이스 소유자)이 초안을 만든다. 같은 태그는 한 번만 생긴다.
select 'first draft (t)' as t, release_notice_draft('v0.10.4', ' 이번 업데이트 ', '- 고친 점') is not null;
select 'same tag again (t)' as t, release_notice_draft('v0.10.4', '다른 제목', '다른 본문') is null;
select 'one draft (1)' as t, count(*) from notices where release_tag = 'v0.10.4';
select 'is draft generated trimmed (draft|t|이번 업데이트)' as t, status, generated, title from notices where release_tag = 'v0.10.4';
select 'blank tag (P0400)' as t, release_notice_draft('  ', '제목', '본문');
select 'blank body (P0400)' as t, release_notice_draft('v0.10.5', '제목', '  ');
-- 관리자가 직접 쓴 공지는 태그가 같아도 막지 않는다(자동 초안만 한 번).
insert into notices (title, body, release_tag) values ('직접 쓴 공지', '본문', 'v0.10.4');
select 'manual same tag ok (2)' as t, count(*) from notices where release_tag = 'v0.10.4';

-- 앱 사용자는 부를 수 없다. 관리자도 앱에서는 부르지 않는다.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'admin via app (denied)' as t, release_notice_draft('v0.10.6', '제목', '본문');
set role anon;
select 'anon (denied)' as t, release_notice_draft('v0.10.6', '제목', '본문');
reset role;
select 'none for v0.10.6 (0)' as t, count(*) from notices where release_tag = 'v0.10.6';
