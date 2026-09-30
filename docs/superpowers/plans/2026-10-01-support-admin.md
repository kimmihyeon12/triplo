# 공지·문의 서버 저장과 관리자 관리 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공지·문의를 Supabase에 저장하고, 관리자가 `/admin`에서 공지를 쓰고 발행하며 문의에 답하게 한다.

**Architecture:** 쓰기는 모두 `security definer` 서버 함수로만 하고 읽기는 RLS가 걸린 표에서 직접 한다. 사용자 화면은 기존 `SupportRepository` 인터페이스의 서버 구현으로 갈아 끼우고, 관리자 화면은 `features/admin/`에 새 데이터 계층과 네 화면을 둔다. Supabase 호출은 작은 데이터 클라이언트 뒤에 두어 가짜로 단위 테스트한다.

**Tech Stack:** Angular 21(Zoneless, Signals), `@supabase/supabase-js`, PostgreSQL 17(RLS·enum·security definer), Vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-10-01-support-admin-design.md](../specs/2026-10-01-support-admin-design.md)

## Global Constraints

- 표에 직접 쓰는 권한·정책을 두지 않는다. `anon`은 모든 권한을 거두고 `authenticated`에는 `select`만 준다. 함수 실행 권한은 `authenticated`만.
- 관리자 함수는 안에서 `public.is_admin()`이 아니면 `raise exception ... using errcode = '42501'`.
- 오류 코드: 길이·값 `P0400`, 없는 대상 `P0404`, 권한 `42501`.
- 길이: 공지 제목 1~100자, 공지 본문 1~5000자, 문의 1~1000자(`INQUIRY_BODY_MAX`), 답변 1~2000자, 앱 버전 ≤40자, 기기 정보 ≤300자.
- 보낸 사람 닉네임은 서버가 `auth.users.raw_user_meta_data ->> 'travel_nickname'`에서 채운다. 이메일은 쓰지 않는다.
- 마이그레이션 파일: `supabase/migrations/20261001000000_support.sql`.
- 실행 앱은 서버 구현, 테스트 앱(`environment.isTest`)·디자인 미리보기(`environment.designPreview`)는 기존 `LocalSupportRepository`.
- 실행 앱은 계정별 기기 문의 열쇠(`${environment.storageKey}.support.` 접두어)를 지운다. 서버로 옮기지 않는다.
- 커밋 메시지 `<type>(<scope>): <subject>`, 앱은 `app`, 서버·문서는 scope 생략. 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 명령 위치: 앱 명령은 `app/`, SQL은 저장소 루트. 로컬 DB는 `"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost` (비밀번호 `postgres`).
- 운영 적용·배포는 각 단계 직전에 사용자 확인.

## Review Focus

1. 답변이 달린 뒤 사용자가 문의를 열어 읽고, 관리자가 다시 답하면 "새 답변"이 다시 세어져야 한다 (Task 2 테스트).
2. 발행했던 공지를 발행 취소하면 사용자 목록·안 읽음 개수에서 사라져야 한다 (Task 1 SQL, Task 2 테스트).
3. 공지 제목·본문이 공백만이면 서버가 `P0400`으로 거절하고, 관리자 폼은 저장을 잠근다 (Task 1 SQL, Task 4 테스트).
4. 계정을 지우면 그 사람의 문의·답변·읽음 기록이 함께 지워져 탈퇴가 실패하지 않는다 (Task 1 SQL: `on delete cascade` 확인).
5. 관리자 화면에서 권한이 사라진 뒤 함수가 `42501`을 돌려주면 안내하고 내 정보로 보낸다 (Task 3 테스트).

---

### Task 1: 마이그레이션과 로컬 SQL 검증

**Files:**
- Create: `supabase/migrations/20261001000000_support.sql`
- Create: `supabase/tests/support.local.sql`

**Interfaces:**
- Produces (DB): 표 `notices`·`notice_reads`·`inquiries`·`inquiry_replies`, enum `notice_status`·`inquiry_kind`·`inquiry_status`, 함수 `send_inquiry(p_kind inquiry_kind, p_body text, p_app_version text, p_user_agent text) returns uuid`, `mark_inquiry_read(p_id uuid) returns void`, `mark_notices_read() returns void`, `admin_save_notice(p_id uuid, p_title text, p_body text) returns uuid`, `admin_set_notice_published(p_id uuid, p_published boolean) returns void`, `admin_delete_notice(p_id uuid) returns void`, `admin_reply_inquiry(p_id uuid, p_body text) returns uuid`, `admin_set_inquiry_status(p_id uuid, p_status inquiry_status) returns void`.

- [ ] **Step 1: 검증 스크립트 작성** (`supabase/tests/support.local.sql`)

```sql
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
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', '{"travel_nickname":"관리자"}'),
  ('22222222-2222-2222-2222-222222222222', '{"travel_nickname":"민지"}'),
  ('33333333-3333-3333-3333-333333333333', '{"travel_nickname":"준호"}');
\ir ../migrations/20260930000002_profiles_role.sql
\ir ../migrations/20261001000000_support.sql
insert into public.profiles values ('11111111-1111-1111-1111-111111111111', 'admin');
\set ON_ERROR_STOP 0
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

-- 관리자 A: 공지 초안·발행, 빈 제목 거절
set role authenticated;
set request.jwt.claim.sub = :'A';
select 'A save draft (uuid)' as t, admin_save_notice(null, '첫 공지', '본문') is not null;
select 'A blank title (P0400)' as t, admin_save_notice(null, '   ', '본문');
select 'A save second draft (uuid)' as t, admin_save_notice(null, '둘째', '두 번째 본문') is not null;
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
select 'B send (uuid)' as t, send_inquiry('bug', '  지도가 안 떠요  ', 'v0.10.2', 'test-agent') is not null;
select 'B too long (P0400)' as t, send_inquiry('bug', repeat('가', 1001), 'v', 'ua');
select 'B nickname and trimmed (민지|지도가 안 떠요)' as t, sender_nickname, body from inquiries;
-- 자기 문의 상태 직접 변경: permission denied 기대
update inquiries set status = 'answered';
set request.jwt.claim.sub = :'C';
select 'C sees none (0)' as t, count(*) from inquiries;
select 'C mark others read (P0404)' as t, mark_inquiry_read(id) from inquiries;

-- 관리자 답변 → 답변 완료, B에게 새 답변, B가 읽고 다시 답하면 다시 새 답변
set request.jwt.claim.sub = :'A';
select 'A reply (uuid)' as t, admin_reply_inquiry((select id from inquiries limit 1), '확인했어요') is not null;
select 'A status answered (answered)' as t, status from inquiries;
set request.jwt.claim.sub = :'B';
select 'B sees reply (1)' as t, count(*) from inquiry_replies;
select mark_inquiry_read(id) from inquiries;
select 'B answer read set (t)' as t, answer_read_at is not null from inquiries;
set request.jwt.claim.sub = :'A';
select pg_sleep(0.01);
select admin_reply_inquiry((select id from inquiries limit 1), '추가 안내');
set request.jwt.claim.sub = :'B';
select 'B new reply after read (t)' as t, max(r.created_at) > max(i.answer_read_at) from inquiries i join inquiry_replies r on r.inquiry_id = i.id;
set request.jwt.claim.sub = :'A';
select admin_set_inquiry_status((select id from inquiries limit 1), 'reading');
select 'A status reading (reading)' as t, status from inquiries;

-- 로그인하지 않은 사람
set role anon;
set request.jwt.claim.sub = '';
select 'anon notices (denied)' as t, count(*) from notices;
select 'anon send (denied)' as t, send_inquiry('bug', 'x', 'v', 'ua');

-- 탈퇴하면 함께 지워진다
reset role;
delete from auth.users where id = :'B';
select 'after delete B inquiries (0)' as t, count(*) from inquiries;
select 'after delete B reads (0)' as t, count(*) from notice_reads;
```

- [ ] **Step 2: 실패 확인** — 저장소 루트에서
  `psql -U postgres -h localhost -c "drop database if exists tc_support" -c "create database tc_support"` 후 `psql -U postgres -h localhost -d tc_support -f supabase/tests/support.local.sql`
  Expected: `\ir ../migrations/20261001000000_support.sql`에서 파일 없음 오류로 중단.

- [ ] **Step 3: 마이그레이션 작성** (`supabase/migrations/20261001000000_support.sql`)

```sql
-- 공지·문의 서버 저장(2026-10-01). 쓰기는 모두 서버 함수로만 하고 표에는 읽기만 연다.
-- 초안 공지와 남의 문의는 RLS가 막고, 관리자 쓰기는 함수 안의 is_admin()이 막는다.
-- 설계: docs/superpowers/specs/2026-10-01-support-admin-design.md

create type notice_status as enum ('draft', 'published');
create type inquiry_kind as enum ('bug', 'idea', 'account', 'etc');
create type inquiry_status as enum ('open', 'reading', 'answered');

create table notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 5000),
  status notice_status not null default 'draft',
  -- 배포 자동 공지용 칸. 2026-10-01에는 쓰지 않는다.
  generated boolean not null default false,
  release_tag text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table notice_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  notice_id uuid not null references notices (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sender_nickname text not null default '',
  kind inquiry_kind not null,
  body text not null check (char_length(body) between 1 and 1000),
  status inquiry_status not null default 'open',
  app_version text not null default '' check (char_length(app_version) <= 40),
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  -- 사용자가 답변을 확인한 시각. 이보다 나중 답변이 있으면 새 답변이다.
  answer_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inquiry_replies (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries (id) on delete cascade,
  author_role app_role not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index inquiries_user_idx on inquiries (user_id, created_at desc);
create index inquiry_replies_inquiry_idx on inquiry_replies (inquiry_id, created_at);

alter table notices enable row level security;
alter table notice_reads enable row level security;
alter table inquiries enable row level security;
alter table inquiry_replies enable row level security;

create policy notices_select on notices for select to authenticated
  using (status = 'published' or (select public.is_admin()));
create policy notice_reads_select_own on notice_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy inquiries_select on inquiries for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy inquiry_replies_select on inquiry_replies for select to authenticated
  using (exists (
    select 1 from public.inquiries i
    where i.id = inquiry_id and (i.user_id = (select auth.uid()) or (select public.is_admin()))
  ));

revoke all on public.notices, public.notice_reads, public.inquiries, public.inquiry_replies from anon, authenticated;
grant select on public.notices, public.notice_reads, public.inquiries, public.inquiry_replies to authenticated;

-- 관리자 확인. 모든 관리자 함수의 첫 줄이다.
create function public.require_admin() returns void
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
end;
$$;

-- 앞뒤 공백을 지우고 길이를 본다. 비었거나 길면 P0400.
create function public.clean_text(p_text text, p_max integer) returns text
  language plpgsql immutable set search_path = '' as $$
declare v text := btrim(coalesce(p_text, ''));
begin
  if char_length(v) = 0 or char_length(v) > p_max then
    raise exception 'invalid_length' using errcode = 'P0400';
  end if;
  return v;
end;
$$;

create function public.send_inquiry(p_kind public.inquiry_kind, p_body text, p_app_version text, p_user_agent text)
  returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'auth_required' using errcode = '42501'; end if;
  insert into public.inquiries (user_id, sender_nickname, kind, body, app_version, user_agent)
  select v_user, coalesce(u.raw_user_meta_data ->> 'travel_nickname', ''), p_kind,
         public.clean_text(p_body, 1000), left(coalesce(p_app_version, ''), 40), left(coalesce(p_user_agent, ''), 300)
    from auth.users u where u.id = v_user
  returning id into v_id;
  return v_id;
end;
$$;

create function public.mark_inquiry_read(p_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  update public.inquiries set answer_read_at = now()
   where id = p_id and user_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end;
$$;

create function public.mark_notices_read() returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  insert into public.notice_reads (user_id, notice_id)
  select auth.uid(), n.id from public.notices n where n.status = 'published'
  on conflict do nothing;
end;
$$;

create function public.admin_save_notice(p_id uuid, p_title text, p_body text) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.require_admin();
  if p_id is null then
    insert into public.notices (title, body)
    values (public.clean_text(p_title, 100), public.clean_text(p_body, 5000))
    returning id into v_id;
  else
    update public.notices
       set title = public.clean_text(p_title, 100), body = public.clean_text(p_body, 5000), updated_at = now()
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  end if;
  return v_id;
end;
$$;

create function public.admin_set_notice_published(p_id uuid, p_published boolean) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.notices
     set status = case when p_published then 'published'::public.notice_status else 'draft' end,
         published_at = case when p_published then now() else null end,
         updated_at = now()
   where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end;
$$;

create function public.admin_delete_notice(p_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  delete from public.notices where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end;
$$;

create function public.admin_reply_inquiry(p_id uuid, p_body text) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.require_admin();
  update public.inquiries set status = 'answered', updated_at = now() where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  insert into public.inquiry_replies (inquiry_id, author_role, body)
  values (p_id, 'admin', public.clean_text(p_body, 2000)) returning id into v_id;
  return v_id;
end;
$$;

create function public.admin_set_inquiry_status(p_id uuid, p_status public.inquiry_status) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.inquiries set status = p_status, updated_at = now() where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end;
$$;

revoke execute on function
  public.require_admin(), public.clean_text(text, integer),
  public.send_inquiry(public.inquiry_kind, text, text, text), public.mark_inquiry_read(uuid), public.mark_notices_read(),
  public.admin_save_notice(uuid, text, text), public.admin_set_notice_published(uuid, boolean), public.admin_delete_notice(uuid),
  public.admin_reply_inquiry(uuid, text), public.admin_set_inquiry_status(uuid, public.inquiry_status)
  from public, anon;
grant execute on function
  public.send_inquiry(public.inquiry_kind, text, text, text), public.mark_inquiry_read(uuid), public.mark_notices_read(),
  public.admin_save_notice(uuid, text, text), public.admin_set_notice_published(uuid, boolean), public.admin_delete_notice(uuid),
  public.admin_reply_inquiry(uuid, text), public.admin_set_inquiry_status(uuid, public.inquiry_status)
  to authenticated;
```

- [ ] **Step 4: 통과 확인** — Step 2 명령을 다시 실행한다. Expected: 각 행의 결과가 `t` 값 괄호 안 기대값과 같다(`denied`는 `permission denied`, 코드 기대는 해당 SQLSTATE 오류 메시지). 기대와 다르면 원인을 고친다. 출력은 `.superpowers/support-sql.log`에 남긴다.

- [ ] **Step 5: 커밋**
```bash
git add supabase/migrations/20261001000000_support.sql supabase/tests/support.local.sql
git commit -m "feat: 공지·문의 표와 사용자·관리자 서버 함수를 둔다"
```

### Task 2: 사용자 쪽 서버 저장소

**Files:**
- Create: `app/src/app/features/support/data/support-rows.ts`
- Create: `app/src/app/features/support/data/support-data-client.ts`
- Create: `app/src/app/features/support/data/supabase-support-repository.ts`
- Create: `app/src/app/features/support/data/local-support-cleanup.ts`
- Test: `app/src/app/features/support/data/supabase-support-repository.spec.ts`, `app/src/app/features/support/data/local-support-cleanup.spec.ts`
- Modify: `app/src/app/app.config.ts:164-171`

**Interfaces:**
- Consumes: Task 1 표·함수 이름.
- Produces:
```ts
// support-rows.ts
export interface NoticeRow { id: string; title: string; body: string; status: 'draft' | 'published'; generated: boolean; release_tag: string; created_at: string; published_at: string | null; }
export interface ReplyRow { id: string; body: string; author_role: 'user' | 'admin'; created_at: string; }
export interface InquiryRow { id: string; user_id: string; sender_nickname: string; kind: InquiryKind; body: string; status: InquiryStatus; app_version: string; user_agent: string; answer_read_at: string | null; created_at: string; inquiry_replies: ReplyRow[]; }
export function toNotice(row: NoticeRow): Notice;
export function toInquiry(row: InquiryRow): Inquiry;   // readAt: 마지막 답변이 answer_read_at 이후면 null
export function hasNewAnswer(row: InquiryRow): boolean;
// support-data-client.ts
export interface SupportDataClient {
  publishedNotices(): Promise<NoticeRow[]>;
  readNoticeIds(): Promise<string[]>;
  myInquiries(): Promise<InquiryRow[]>;
  call(fn: string, args?: Record<string, unknown>): Promise<unknown>;
}
export class SupportError extends Error {}
export function supabaseSupportDataClient(client: () => Promise<SupabaseClient>): SupportDataClient;
// supabase-support-repository.ts
export class SupabaseSupportRepository implements SupportRepository { constructor(client: SupportDataClient, appVersion: string, userAgent: () => string) }
// local-support-cleanup.ts
export function clearLocalSupport(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>, prefix: string): number;
```

- [ ] **Step 1: 실패하는 테스트 작성** (`supabase-support-repository.spec.ts`)

```ts
import { describe, expect, it, vi } from 'vitest';
import { SupabaseSupportRepository } from './supabase-support-repository';
import type { SupportDataClient } from './support-data-client';
import type { InquiryRow, NoticeRow } from './support-rows';

const notice = (id: string, published: string): NoticeRow => ({
  id, title: id, body: '본문', status: 'published', generated: false, release_tag: '', created_at: published, published_at: published,
});
const inquiry = (id: string, extra: Partial<InquiryRow> = {}): InquiryRow => ({
  id, user_id: 'u', sender_nickname: '민지', kind: 'bug', body: '안 돼요', status: 'open', app_version: 'v', user_agent: 'ua',
  answer_read_at: null, created_at: '2026-10-01T00:00:00Z', inquiry_replies: [], ...extra,
});
function fake(over: Partial<SupportDataClient> = {}): SupportDataClient {
  return {
    publishedNotices: async () => [notice('n2', '2026-10-02T00:00:00Z'), notice('n1', '2026-10-01T00:00:00Z')],
    readNoticeIds: async () => ['n1'],
    myInquiries: async () => [],
    call: vi.fn(async () => 'new-id'),
    ...over,
  };
}
const repo = (client: SupportDataClient) => new SupabaseSupportRepository(client, 'v0.10.3', () => 'test-agent');

describe('SupabaseSupportRepository', () => {
  it('운영자에게 전달한다', () => {
    expect(repo(fake()).delivers).toBe(true);
  });
  it('안 읽은 공지를 읽음 기록으로 센다', async () => {
    const r = repo(fake());
    expect(await r.unreadNoticeIds()).toEqual(['n2']);
    expect(await r.unreadNoticeCount()).toBe(1);
  });
  it('공지를 읽으면 서버 함수를 부른다', async () => {
    const client = fake();
    await repo(client).markNoticesRead();
    expect(client.call).toHaveBeenCalledWith('mark_notices_read', undefined);
  });
  it('문의를 앱 버전·기기 정보와 함께 보내고 방금 만든 문의를 돌려준다', async () => {
    const client = fake({ myInquiries: async () => [inquiry('new-id')] });
    const sent = await repo(client).sendInquiry('bug', '안 돼요');
    expect(client.call).toHaveBeenCalledWith('send_inquiry', { p_kind: 'bug', p_body: '안 돼요', p_app_version: 'v0.10.3', p_user_agent: 'test-agent' });
    expect(sent).toMatchObject({ id: 'new-id', kind: 'bug', status: 'open' });
  });
  it('답변이 확인 뒤에 새로 달리면 다시 새 답변으로 센다', async () => {
    const replied = (at: string) => ({ id: at, body: '답', author_role: 'admin' as const, created_at: at });
    const client = fake({ myInquiries: async () => [
      inquiry('a', { status: 'answered', inquiry_replies: [replied('2026-10-01T01:00:00Z')], answer_read_at: '2026-10-01T02:00:00Z' }),
      inquiry('b', { status: 'answered', inquiry_replies: [replied('2026-10-01T01:00:00Z'), replied('2026-10-01T03:00:00Z')], answer_read_at: '2026-10-01T02:00:00Z' }),
      inquiry('c', { status: 'answered', inquiry_replies: [replied('2026-10-01T01:00:00Z')] }),
    ] });
    const r = repo(client);
    expect(await r.unansweredReadCount()).toBe(2);
    const list = await r.inquiries();
    expect(list.find((i) => i.id === 'a')!.readAt).toBe('2026-10-01T02:00:00Z');
    expect(list.find((i) => i.id === 'b')!.readAt).toBeNull();
  });
  it('문의를 최신순으로 돌려주고 답변을 시간순으로 붙인다', async () => {
    const client = fake({ myInquiries: async () => [
      inquiry('old', { created_at: '2026-09-30T00:00:00Z' }),
      inquiry('new', { created_at: '2026-10-01T00:00:00Z', inquiry_replies: [
        { id: 'r2', body: '둘', author_role: 'admin', created_at: '2026-10-01T02:00:00Z' },
        { id: 'r1', body: '하나', author_role: 'admin', created_at: '2026-10-01T01:00:00Z' },
      ] }),
    ] });
    const list = await repo(client).inquiries();
    expect(list.map((i) => i.id)).toEqual(['new', 'old']);
    expect(list[0]!.replies.map((r) => r.body)).toEqual(['하나', '둘']);
  });
});
```

`local-support-cleanup.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clearLocalSupport } from './local-support-cleanup';

it('계정별 기기 문의만 지우고 다른 기록은 둔다', () => {
  const data = new Map([['tc.trips.v1.support.u1', '{}'], ['tc.trips.v1.support.guest', '{}'], ['tc.trips.v1.chat.u1', '{}'], ['other', '1']]);
  const storage = {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => { data.delete(k); },
  };
  expect(clearLocalSupport(storage, 'tc.trips.v1')).toBe(2);
  expect([...data.keys()]).toEqual(['tc.trips.v1.chat.u1', 'other']);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/features/support/data` → 모듈 없음으로 FAIL.

- [ ] **Step 3: 구현**

`support-rows.ts`:
```ts
import type { Inquiry, InquiryKind, InquiryStatus, Notice } from '../model/support';

export interface NoticeRow { id: string; title: string; body: string; status: 'draft' | 'published'; generated: boolean; release_tag: string; created_at: string; published_at: string | null; }
export interface ReplyRow { id: string; body: string; author_role: 'user' | 'admin'; created_at: string; }
export interface InquiryRow {
  id: string; user_id: string; sender_nickname: string; kind: InquiryKind; body: string; status: InquiryStatus;
  app_version: string; user_agent: string; answer_read_at: string | null; created_at: string; inquiry_replies: ReplyRow[];
}

export function toNotice(row: NoticeRow): Notice {
  return {
    id: row.id, title: row.title, body: row.body, status: row.status, generated: row.generated,
    releaseTag: row.release_tag, createdAt: row.created_at, publishedAt: row.published_at,
  };
}

const byTime = (a: ReplyRow, b: ReplyRow) => a.created_at.localeCompare(b.created_at);

/** 마지막 답변이 사용자가 확인한 시각보다 나중이면 새 답변이다. 관리자가 다시 답하면 다시 새 답변이 된다. */
export function hasNewAnswer(row: InquiryRow): boolean {
  const last = [...row.inquiry_replies].sort(byTime).at(-1);
  return !!last && (!row.answer_read_at || last.created_at > row.answer_read_at);
}

export function toInquiry(row: InquiryRow): Inquiry {
  return {
    id: row.id, kind: row.kind, body: row.body, status: row.status, createdAt: row.created_at,
    appVersion: row.app_version, userAgent: row.user_agent,
    replies: [...row.inquiry_replies].sort(byTime).map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at })),
    // 화면은 readAt이 없으면 새 답변으로 본다. 새 답변이 있으면 확인 시각을 비워 둔다.
    readAt: hasNewAnswer(row) ? null : row.answer_read_at,
  };
}
```

`support-data-client.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InquiryRow, NoticeRow } from './support-rows';

/** Supabase 호출을 이 좁은 창구 뒤에 둔다. 저장소 로직은 가짜로 테스트한다. */
export interface SupportDataClient {
  publishedNotices(): Promise<NoticeRow[]>;
  readNoticeIds(): Promise<string[]>;
  myInquiries(): Promise<InquiryRow[]>;
  call(fn: string, args?: Record<string, unknown>): Promise<unknown>;
}

export class SupportError extends Error {}

/** 서버 오류 코드: P0400 길이·값, P0404 없는 대상, 42501 권한 없음. */
export function toSupportError(error: { code?: string } | null): SupportError {
  if (error?.code === 'P0400') return new SupportError('입력 길이를 확인해 주세요.');
  if (error?.code === 'P0404') return new SupportError('이미 지워졌거나 볼 수 없는 항목이에요.');
  if (error?.code === '42501') return new SupportError('권한이 없어요. 다시 로그인해 주세요.');
  return new SupportError('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
}

const NOTICE_COLUMNS = 'id, title, body, status, generated, release_tag, created_at, published_at';
export const INQUIRY_COLUMNS =
  'id, user_id, sender_nickname, kind, body, status, app_version, user_agent, answer_read_at, created_at, inquiry_replies(id, body, author_role, created_at)';

export function supabaseSupportDataClient(client: () => Promise<SupabaseClient>): SupportDataClient {
  return {
    async publishedNotices() {
      // RLS가 발행된 것만 내려 주지만, 관리자도 사용자 화면에서는 발행된 것만 본다.
      const { data, error } = await (await client()).from('notices').select(NOTICE_COLUMNS).eq('status', 'published').order('published_at', { ascending: false });
      if (error) throw toSupportError(error);
      return (data ?? []) as NoticeRow[];
    },
    async readNoticeIds() {
      const { data, error } = await (await client()).from('notice_reads').select('notice_id');
      if (error) throw toSupportError(error);
      return (data ?? []).map((r) => (r as { notice_id: string }).notice_id);
    },
    async myInquiries() {
      const db = await client();
      const { data: auth } = await db.auth.getUser();
      // 관리자도 사용자 화면에서는 자기 문의만 본다. RLS만 믿으면 관리자에게 전체가 보인다.
      const { data, error } = await db.from('inquiries').select(INQUIRY_COLUMNS).eq('user_id', auth.user?.id ?? '');
      if (error) throw toSupportError(error);
      return (data ?? []) as InquiryRow[];
    },
    async call(fn, args) {
      const { data, error } = await (await client()).rpc(fn, args);
      if (error) throw toSupportError(error);
      return data;
    },
  };
}
```

`supabase-support-repository.ts`:
```ts
import type { Inquiry, InquiryKind, Notice } from '../model/support';
import type { SupportDataClient } from './support-data-client';
import type { SupportRepository } from './support-repository';
import { hasNewAnswer, toInquiry, toNotice } from './support-rows';

/** 공지·문의를 Supabase에 저장한다(2026-10-01). 쓰기는 서버 함수로만 한다. */
export class SupabaseSupportRepository implements SupportRepository {
  readonly delivers = true;
  constructor(
    private readonly client: SupportDataClient,
    private readonly appVersion: string,
    private readonly userAgent: () => string,
  ) {}

  async notices(): Promise<Notice[]> {
    return (await this.client.publishedNotices()).map(toNotice);
  }

  async unreadNoticeIds(): Promise<string[]> {
    const [notices, read] = await Promise.all([this.client.publishedNotices(), this.client.readNoticeIds()]);
    const seen = new Set(read);
    return notices.filter((n) => !seen.has(n.id)).map((n) => n.id);
  }

  async unreadNoticeCount(): Promise<number> {
    return (await this.unreadNoticeIds()).length;
  }

  async markNoticesRead(): Promise<void> {
    await this.client.call('mark_notices_read', undefined);
  }

  async inquiries(): Promise<Inquiry[]> {
    const rows = await this.client.myInquiries();
    return rows.map(toInquiry).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async unansweredReadCount(): Promise<number> {
    return (await this.client.myInquiries()).filter(hasNewAnswer).length;
  }

  async sendInquiry(kind: InquiryKind, body: string): Promise<Inquiry> {
    const id = (await this.client.call('send_inquiry', {
      p_kind: kind, p_body: body, p_app_version: this.appVersion, p_user_agent: this.userAgent(),
    })) as string;
    const sent = (await this.inquiries()).find((i) => i.id === id);
    if (!sent) throw new Error('보낸 문의를 다시 읽지 못했어요.');
    return sent;
  }

  async markInquiryRead(id: string): Promise<void> {
    await this.client.call('mark_inquiry_read', { p_id: id });
  }
}
```

`local-support-cleanup.ts`:
```ts
/**
 * 실행 앱이 문의를 서버에 저장하면서 기기에 남은 계정별 문의를 지운다(2026-10-01 사용자 결정: 옮기지 않는다).
 * 그 문의는 운영자에게 간 적이 없다. 지운 개수를 돌려준다.
 */
export function clearLocalSupport(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>, prefix: string): number {
  const target = `${prefix}.support.`;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(target)) keys.push(key);
  }
  keys.forEach((k) => storage.removeItem(k));
  return keys.length;
}
```

`app.config.ts`의 `SUPPORT_REPOSITORY` 제공자를 바꾼다:
```ts
    {
      provide: SUPPORT_REPOSITORY,
      useFactory: () => {
        // 실행 앱은 서버에 저장한다(2026-10-01). 테스트 앱과 미리보기는 기기 저장을 쓴다.
        if (environment.isTest || environment.designPreview)
          return new LocalSupportRepository(new SafeLocalStorage(), accountKey('support'));
        try {
          clearLocalSupport(localStorage, environment.storageKey);
        } catch {
          // 저장소 접근이 막힌 브라우저에서도 앱은 뜬다.
        }
        const auth = inject(AuthStore);
        return new SupabaseSupportRepository(
          supabaseSupportDataClient(() => auth.dataClient()),
          APP_VERSION.name,
          () => (typeof navigator === 'undefined' ? '' : navigator.userAgent),
        );
      },
    },
```
필요한 import(`clearLocalSupport`, `SupabaseSupportRepository`, `supabaseSupportDataClient`, `APP_VERSION`)를 추가한다. `accountKey('support')`는 테스트·미리보기 분기에서만 부른다.

- [ ] **Step 4: 통과 확인** — `npx vitest run src/app/features/support` PASS, `npx ng build` 오류 0, `npm run lint` PASS.

- [ ] **Step 5: 커밋**
```bash
git add app/src/app/features/support/data app/src/app/app.config.ts
git commit -m "feat(app): 공지·문의를 서버에 저장하고 기기의 옛 문의를 지운다"
```

### Task 3: 관리자 데이터 계층

**Files:**
- Create: `app/src/app/features/admin/model/admin-support.ts`
- Create: `app/src/app/features/admin/data/admin-support.ts`
- Test: `app/src/app/features/admin/data/admin-support.spec.ts`

**Interfaces:**
- Consumes: Task 2 `NoticeRow`, `InquiryRow`, `toNotice`, `toInquiry`, `hasNewAnswer`, `toSupportError`, `SupportError`, `INQUIRY_COLUMNS`.
- Produces:
```ts
// model/admin-support.ts
export interface AdminInquiry extends Inquiry { senderNickname: string }
export const NOTICE_TITLE_MAX = 100; export const NOTICE_BODY_MAX = 5000; export const REPLY_BODY_MAX = 2000;
// data/admin-support.ts
export interface AdminSupportClient {
  notices(): Promise<NoticeRow[]>;              // 초안 포함, updated 최신순
  inquiries(): Promise<InquiryRow[]>;           // 전체
  call(fn: string, args: Record<string, unknown>): Promise<unknown>;
}
export const ADMIN_SUPPORT_CLIENT: InjectionToken<AdminSupportClient>;
@Injectable({ providedIn: 'root' }) export class AdminSupport {
  notices(): Promise<Notice[]>;
  notice(id: string): Promise<Notice | null>;
  saveNotice(id: string | null, title: string, body: string): Promise<string>;
  setPublished(id: string, published: boolean): Promise<void>;
  deleteNotice(id: string): Promise<void>;
  inquiries(): Promise<AdminInquiry[]>;          // 접수됨 먼저, 그다음 최신순
  inquiry(id: string): Promise<AdminInquiry | null>;
  reply(id: string, body: string): Promise<void>;
  setStatus(id: string, status: InquiryStatus): Promise<void>;
}
export function isAdminDenied(error: unknown): boolean;  // 42501에서 온 SupportError
```

- [ ] **Step 1: 실패하는 테스트 작성** (`admin-support.spec.ts`)

```ts
import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_SUPPORT_CLIENT, AdminSupport, isAdminDenied, type AdminSupportClient } from './admin-support';
import { SupportError, toSupportError } from '../../support/data/support-data-client';
import type { InquiryRow, NoticeRow } from '../../support/data/support-rows';

const n = (id: string, status: 'draft' | 'published'): NoticeRow => ({ id, title: id, body: 'b', status, generated: false, release_tag: '', created_at: '2026-10-01T00:00:00Z', published_at: status === 'published' ? '2026-10-01T00:00:00Z' : null });
const q = (id: string, status: InquiryRow['status'], created: string): InquiryRow => ({ id, user_id: 'u', sender_nickname: '민지', kind: 'bug', body: 'b', status, app_version: 'v', user_agent: 'ua', answer_read_at: null, created_at: created, inquiry_replies: [] });

function setup(client: Partial<AdminSupportClient> = {}): { support: AdminSupport; call: ReturnType<typeof vi.fn> } {
  const call = vi.fn(async () => 'id-1');
  const injector = Injector.create({ providers: [
    { provide: ADMIN_SUPPORT_CLIENT, useValue: { notices: async () => [n('d', 'draft'), n('p', 'published')], inquiries: async () => [], call, ...client } },
    AdminSupport,
  ] });
  return { support: runInInjectionContext(injector, () => injector.get(AdminSupport)), call };
}

describe('AdminSupport', () => {
  it('초안까지 공지를 돌려준다', async () => {
    expect((await setup().support.notices()).map((x) => x.status)).toEqual(['draft', 'published']);
  });
  it('공지 저장·발행·삭제는 관리자 함수를 부른다', async () => {
    const { support, call } = setup();
    expect(await support.saveNotice(null, ' 제목 ', ' 본문 ')).toBe('id-1');
    await support.setPublished('p', false);
    await support.deleteNotice('p');
    expect(call.mock.calls).toEqual([
      ['admin_save_notice', { p_id: null, p_title: '제목', p_body: '본문' }],
      ['admin_set_notice_published', { p_id: 'p', p_published: false }],
      ['admin_delete_notice', { p_id: 'p' }],
    ]);
  });
  it('문의는 접수됨을 먼저, 그다음 최신순으로 보여 주고 닉네임을 붙인다', async () => {
    const { support } = setup({ inquiries: async () => [
      q('answered', 'answered', '2026-10-03T00:00:00Z'), q('open-old', 'open', '2026-10-01T00:00:00Z'), q('open-new', 'open', '2026-10-02T00:00:00Z'),
    ] });
    const list = await support.inquiries();
    expect(list.map((i) => i.id)).toEqual(['open-new', 'open-old', 'answered']);
    expect(list[0]!.senderNickname).toBe('민지');
  });
  it('답변과 상태 변경은 관리자 함수를 부른다', async () => {
    const { support, call } = setup();
    await support.reply('q1', '  확인했어요 ');
    await support.setStatus('q1', 'reading');
    expect(call.mock.calls).toEqual([
      ['admin_reply_inquiry', { p_id: 'q1', p_body: '확인했어요' }],
      ['admin_set_inquiry_status', { p_id: 'q1', p_status: 'reading' }],
    ]);
  });
  it('권한이 사라진 오류를 가려낸다', () => {
    expect(isAdminDenied(toSupportError({ code: '42501' }))).toBe(true);
    expect(isAdminDenied(toSupportError({ code: 'P0400' }))).toBe(false);
    expect(isAdminDenied(new SupportError('x'))).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/features/admin/data/admin-support.spec.ts` FAIL(모듈 없음).

- [ ] **Step 3: 구현**

`toSupportError`가 권한 오류를 구분할 수 있게 `support-data-client.ts`에 코드 칸을 더한다:
```ts
export class SupportError extends Error {
  constructor(message: string, readonly code = '') { super(message); }
}
// toSupportError의 42501 분기: return new SupportError('권한이 없어요. 다시 로그인해 주세요.', '42501');
```

`model/admin-support.ts`:
```ts
import type { Inquiry } from '../../support/model/support';

/** 관리자가 보는 문의. 보낸 사람은 서버가 채운 닉네임으로만 보인다. 이메일은 쓰지 않는다. */
export interface AdminInquiry extends Inquiry {
  senderNickname: string;
}

export const NOTICE_TITLE_MAX = 100;
export const NOTICE_BODY_MAX = 5000;
export const REPLY_BODY_MAX = 2000;
```

`data/admin-support.ts`:
```ts
import { inject, Injectable, InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthStore } from '../../auth/data/auth-store';
import { INQUIRY_COLUMNS, SupportError, toSupportError } from '../../support/data/support-data-client';
import { toInquiry, toNotice, type InquiryRow, type NoticeRow } from '../../support/data/support-rows';
import type { InquiryStatus, Notice } from '../../support/model/support';
import type { AdminInquiry } from '../model/admin-support';

export interface AdminSupportClient {
  notices(): Promise<NoticeRow[]>;
  inquiries(): Promise<InquiryRow[]>;
  call(fn: string, args: Record<string, unknown>): Promise<unknown>;
}

export function supabaseAdminSupportClient(client: () => Promise<SupabaseClient>): AdminSupportClient {
  return {
    async notices() {
      const { data, error } = await (await client()).from('notices').select('id, title, body, status, generated, release_tag, created_at, published_at').order('updated_at', { ascending: false });
      if (error) throw toSupportError(error);
      return (data ?? []) as NoticeRow[];
    },
    async inquiries() {
      const { data, error } = await (await client()).from('inquiries').select(INQUIRY_COLUMNS).order('created_at', { ascending: false });
      if (error) throw toSupportError(error);
      return (data ?? []) as InquiryRow[];
    },
    async call(fn, args) {
      const { data, error } = await (await client()).rpc(fn, args);
      if (error) throw toSupportError(error);
      return data;
    },
  };
}

export const ADMIN_SUPPORT_CLIENT = new InjectionToken<AdminSupportClient>('ADMIN_SUPPORT_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const auth = inject(AuthStore);
    return supabaseAdminSupportClient(() => auth.dataClient());
  },
});

/** 관리자 권한이 사라져 서버가 거절했는지. 화면은 안내 후 내 정보로 보낸다. */
export function isAdminDenied(error: unknown): boolean {
  return error instanceof SupportError && error.code === '42501';
}

const STATUS_ORDER: Record<InquiryStatus, number> = { open: 0, reading: 1, answered: 2 };

@Injectable({ providedIn: 'root' })
export class AdminSupport {
  private readonly client = inject(ADMIN_SUPPORT_CLIENT);

  async notices(): Promise<Notice[]> {
    return (await this.client.notices()).map(toNotice);
  }
  async notice(id: string): Promise<Notice | null> {
    return (await this.notices()).find((x) => x.id === id) ?? null;
  }
  async saveNotice(id: string | null, title: string, body: string): Promise<string> {
    return (await this.client.call('admin_save_notice', { p_id: id, p_title: title.trim(), p_body: body.trim() })) as string;
  }
  async setPublished(id: string, published: boolean): Promise<void> {
    await this.client.call('admin_set_notice_published', { p_id: id, p_published: published });
  }
  async deleteNotice(id: string): Promise<void> {
    await this.client.call('admin_delete_notice', { p_id: id });
  }
  async inquiries(): Promise<AdminInquiry[]> {
    return (await this.client.inquiries())
      .map((row) => ({ ...toInquiry(row), senderNickname: row.sender_nickname }))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
  }
  async inquiry(id: string): Promise<AdminInquiry | null> {
    return (await this.inquiries()).find((x) => x.id === id) ?? null;
  }
  async reply(id: string, body: string): Promise<void> {
    await this.client.call('admin_reply_inquiry', { p_id: id, p_body: body.trim() });
  }
  async setStatus(id: string, status: InquiryStatus): Promise<void> {
    await this.client.call('admin_set_inquiry_status', { p_id: id, p_status: status });
  }
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run src/app/features/admin src/app/features/support` PASS, `npm run lint`(경계: admin → support의 data·model import는 허용, feature import 금지) PASS.

- [ ] **Step 5: 커밋**
```bash
git add app/src/app/features/admin app/src/app/features/support/data/support-data-client.ts
git commit -m "feat(app): 관리자 공지·문의 데이터 계층을 둔다"
```

### Task 4: 관리자 공지 화면

**Files:**
- Create: `app/src/app/features/admin/feature/admin-notices/admin-notices.{ts,html}`
- Create: `app/src/app/features/admin/feature/admin-notice-form/admin-notice-form.{ts,html}`
- Create: `app/src/app/features/admin/util/admin-form.ts`, Test: `app/src/app/features/admin/util/admin-form.spec.ts`
- Modify: `app/src/app/features/admin/admin.routes.ts`, `app/src/app/features/admin/feature/admin-home/admin-home.html`

**Interfaces:**
- Consumes: Task 3 `AdminSupport`, `isAdminDenied`, `NOTICE_TITLE_MAX`, `NOTICE_BODY_MAX`.
- Produces: `export function noticeFormError(title: string, body: string): string | null` (admin-form.ts), 라우트 `/admin/notices`, `/admin/notices/new`, `/admin/notices/:id`.

- [ ] **Step 1: 실패하는 테스트 작성** (`admin-form.spec.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { noticeFormError, replyFormError } from './admin-form';

describe('관리자 폼 검사', () => {
  it('공지 제목·본문이 비었거나 길면 저장을 막는다', () => {
    expect(noticeFormError('   ', '본문')).toBe('제목을 입력해 주세요.');
    expect(noticeFormError('제목', '  ')).toBe('본문을 입력해 주세요.');
    expect(noticeFormError('가'.repeat(101), '본문')).toBe('제목은 100자까지 쓸 수 있어요.');
    expect(noticeFormError('제목', '가'.repeat(5001))).toBe('본문은 5000자까지 쓸 수 있어요.');
    expect(noticeFormError(' 제목 ', ' 본문 ')).toBeNull();
  });
  it('답변이 비었거나 길면 막는다', () => {
    expect(replyFormError('  ')).toBe('답변을 입력해 주세요.');
    expect(replyFormError('가'.repeat(2001))).toBe('답변은 2000자까지 쓸 수 있어요.');
    expect(replyFormError('확인했어요')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** — FAIL(모듈 없음).

- [ ] **Step 3: 구현**

`admin-form.ts`:
```ts
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX, REPLY_BODY_MAX } from '../model/admin-support';

/** 서버 clean_text와 같은 규칙. 앞뒤 공백을 빼고 센다. */
export function noticeFormError(title: string, body: string): string | null {
  const t = title.trim(), b = body.trim();
  if (!t) return '제목을 입력해 주세요.';
  if (t.length > NOTICE_TITLE_MAX) return `제목은 ${NOTICE_TITLE_MAX}자까지 쓸 수 있어요.`;
  if (!b) return '본문을 입력해 주세요.';
  if (b.length > NOTICE_BODY_MAX) return `본문은 ${NOTICE_BODY_MAX}자까지 쓸 수 있어요.`;
  return null;
}

export function replyFormError(body: string): string | null {
  const b = body.trim();
  if (!b) return '답변을 입력해 주세요.';
  if (b.length > REPLY_BODY_MAX) return `답변은 ${REPLY_BODY_MAX}자까지 쓸 수 있어요.`;
  return null;
}
```

라우트(`admin.routes.ts`) — `ADMIN_ROUTES`를 자식 라우트로 늘린다. 각 경로에 `canActivate: [requireAdmin]`:
```ts
export const ADMIN_ROUTES: Routes = [
  { path: '', canActivate: [requireAdmin], loadComponent: () => import('./feature/admin-home/admin-home').then((m) => m.AdminHome), title: '관리자' },
  { path: 'notices', canActivate: [requireAdmin], loadComponent: () => import('./feature/admin-notices/admin-notices').then((m) => m.AdminNotices), title: '공지 관리' },
  { path: 'notices/new', canActivate: [requireAdmin], loadComponent: () => import('./feature/admin-notice-form/admin-notice-form').then((m) => m.AdminNoticeForm), title: '새 공지' },
  { path: 'notices/:id', canActivate: [requireAdmin], loadComponent: () => import('./feature/admin-notice-form/admin-notice-form').then((m) => m.AdminNoticeForm), title: '공지 수정' },
  { path: 'inquiries', canActivate: [requireAdmin], loadComponent: () => import('./feature/admin-inquiries/admin-inquiries').then((m) => m.AdminInquiries), title: '문의 관리' },
  { path: 'inquiries/:id', canActivate: [requireAdmin], loadComponent: () => import('./feature/admin-inquiry/admin-inquiry').then((m) => m.AdminInquiryPage), title: '문의 상세' },
];
```
(문의 두 화면은 Task 5에서 만든다. Task 4에서는 문의 두 줄을 넣지 않고, Task 5에서 추가한다.)

`admin-home.html`: "준비 중" 두 `li`를 링크로 바꾼다. 줄 모양은 내 정보의 `go-admin` 링크와 같다.
```html
    <li class="border-b border-border">
      <a class="flex min-h-12 items-center gap-3 px-4 py-3 text-14 text-ink no-underline" routerLink="/admin/notices" data-testid="admin-notices">
        <span class="flex size-5 flex-none items-center justify-center text-ink-3"><app-icon name="megaphone" [size]="18" /></span>
        <span class="flex-1">공지 관리</span>
        <span class="flex size-4 flex-none items-center justify-center text-border-strong"><app-icon name="chevron-right" [size]="16" /></span>
      </a>
    </li>
    <li>
      <a class="flex min-h-12 items-center gap-3 px-4 py-3 text-14 text-ink no-underline" routerLink="/admin/inquiries" data-testid="admin-inquiries">
        <span class="flex size-5 flex-none items-center justify-center text-ink-3"><app-icon name="mail" [size]="18" /></span>
        <span class="flex-1">문의 관리</span>
        <span class="flex size-4 flex-none items-center justify-center text-border-strong"><app-icon name="chevron-right" [size]="16" /></span>
      </a>
    </li>
```
상단 안내 문구 "관리 기능은 서버 연결 뒤에 차례로 엽니다."는 지운다. `admin-home.ts`의 imports에 `RouterLink`를 더한다.

`admin-notices.ts`(목록): `AdminSupport.notices()`를 `signal`로 읽고, 불러오는 중·오류·빈 목록을 나눈다. 오류가 `isAdminDenied`면 `Router`로 `/account`에 보낸다.
```ts
@Component({ selector: 'app-admin-notices', templateUrl: './admin-notices.html', imports: [RouterLink, UiBadge, UiSpinner, IconComponent], changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminNotices {
  private readonly support = inject(AdminSupport);
  private readonly router = inject(Router);
  readonly notices = signal<Notice[] | null>(null);
  readonly error = signal<string | null>(null);
  constructor() { void this.load(); }
  async load(): Promise<void> {
    try { this.notices.set(await this.support.notices()); this.error.set(null); }
    catch (e) { if (isAdminDenied(e)) { void this.router.navigateByUrl('/account'); return; } this.error.set(e instanceof Error ? e.message : '불러오지 못했어요.'); }
  }
  day(iso: string | null): string { return iso ? formatKoreanDate(iso.slice(0, 10), { short: true }) : ''; }
}
```
템플릿: 사용자 공지 목록과 같은 `page` 래퍼, 위쪽에 `a[appButton] routerLink="/admin/notices/new" data-testid="admin-notice-new"`("새 공지"), 목록 `ul data-testid="admin-notice-list"`의 각 줄은 `routerLink="/admin/notices/{{id}}"` 링크로 제목, 배지(`tone="ok"` "발행됨" / `tone="warn"` "초안"), 날짜(발행일 또는 작성일)를 보인다. 빈 목록은 `data-testid="admin-notices-empty"` "아직 공지가 없어요."

`admin-notice-form.ts`(작성·수정): 라우트 `id`가 있으면 `notice(id)`로 채운다. 신호: `title`, `body`, `status`, `saving`, `confirmDelete`, `error`. `formError = computed(() => noticeFormError(title(), body()))`.
- 저장: `saveNotice(id, title, body)` → 새 공지면 `/admin/notices/{새 id}`로 `replaceUrl` 이동, 토스트 대신 폼 위 `appNotice` "저장했어요".
- 발행/발행 취소: 저장되지 않은 새 공지에서는 숨긴다. `setPublished(id, status !== 'published')` 뒤 다시 읽는다.
- 삭제: 첫 누름은 확인 문구와 "삭제" 버튼을 보이고(`data-testid="admin-notice-delete-confirm"`), 두 번째에 `deleteNotice` 후 `/admin/notices`.
- 모든 호출의 오류: `isAdminDenied`면 `/account`, 아니면 `error` 신호.
템플릿 입력: `input[appInput] data-testid="admin-notice-title" maxlength=100`, `textarea[appInput] data-testid="admin-notice-body" rows=10 maxlength=5000`, 글자 수 표시, `formError()`가 있으면 저장 버튼 `disabled`와 `p role="alert"`로 문구. 버튼 testid: `admin-notice-save`, `admin-notice-publish`(문구는 상태에 따라 "발행"/"발행 취소"), `admin-notice-delete`.

- [ ] **Step 4: 통과 확인** — `npx vitest run src/app/features/admin` PASS, `npx ng build` 오류 0, `npm run lint` PASS.

- [ ] **Step 5: 커밋**
```bash
git add app/src/app/features/admin
git commit -m "feat(app): 관리자 공지 목록과 작성·수정·발행 화면을 둔다"
```

### Task 5: 관리자 문의 화면

**Files:**
- Create: `app/src/app/features/admin/feature/admin-inquiries/admin-inquiries.{ts,html}`
- Create: `app/src/app/features/admin/feature/admin-inquiry/admin-inquiry.{ts,html}`
- Create: `app/src/app/features/admin/util/inquiry-filter.ts`, Test: `app/src/app/features/admin/util/inquiry-filter.spec.ts`
- Modify: `app/src/app/features/admin/admin.routes.ts` (Task 4의 문의 두 경로 추가)

**Interfaces:**
- Consumes: Task 3 `AdminSupport`, `AdminInquiry`, `isAdminDenied`; Task 4 `replyFormError`; `INQUIRY_KIND_LABEL`, `INQUIRY_STATUS_LABEL`(support model).
- Produces: `export type InquiryFilter = 'all' | InquiryStatus; export function filterInquiries(list: readonly AdminInquiry[], filter: InquiryFilter): AdminInquiry[]; export function openCount(list: readonly AdminInquiry[]): number` (inquiry-filter.ts).

- [ ] **Step 1: 실패하는 테스트 작성** (`inquiry-filter.spec.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { filterInquiries, openCount } from './inquiry-filter';
import type { AdminInquiry } from '../model/admin-support';

const q = (id: string, status: AdminInquiry['status']): AdminInquiry => ({
  id, kind: 'bug', body: 'b', status, createdAt: '2026-10-01T00:00:00Z', appVersion: 'v', userAgent: 'ua', replies: [], readAt: null, senderNickname: '민지',
});
const list = [q('a', 'open'), q('b', 'reading'), q('c', 'answered'), q('d', 'open')];

describe('문의 필터', () => {
  it('상태로 거르고 전체는 그대로 둔다', () => {
    expect(filterInquiries(list, 'all').map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(filterInquiries(list, 'open').map((i) => i.id)).toEqual(['a', 'd']);
    expect(filterInquiries(list, 'answered').map((i) => i.id)).toEqual(['c']);
  });
  it('접수됨 개수를 센다', () => {
    expect(openCount(list)).toBe(2);
  });
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현**

`inquiry-filter.ts`:
```ts
import type { InquiryStatus } from '../../support/model/support';
import type { AdminInquiry } from '../model/admin-support';

export type InquiryFilter = 'all' | InquiryStatus;

export function filterInquiries(list: readonly AdminInquiry[], filter: InquiryFilter): AdminInquiry[] {
  return filter === 'all' ? [...list] : list.filter((i) => i.status === filter);
}

export function openCount(list: readonly AdminInquiry[]): number {
  return list.filter((i) => i.status === 'open').length;
}
```

`admin-inquiries.ts`(목록): `inquiries` 신호, `filter = signal<InquiryFilter>('all')`, `shown = computed(() => filterInquiries(inquiries() ?? [], filter()))`. 필터는 칩 버튼 네 개(`data-testid="admin-inquiry-filter-{all|open|reading|answered}"`, 선택된 칩 `aria-pressed="true"`), 전체 칩 옆에 `접수됨 {{ openCount }}`. 각 줄(`routerLink="/admin/inquiries/{{id}}"`, `data-testid="admin-inquiry-{{id}}"`)은 종류 라벨, 상태 배지(접수됨 `warn`·확인 중 `neutral`·답변 완료 `ok`), 닉네임, 날짜, 본문 앞 60자(`line-clamp-2`). 빈 목록 `data-testid="admin-inquiries-empty"`. 오류·권한 처리는 Task 4 목록과 같다.

`admin-inquiry.ts`(상세): 라우트 `id`로 `inquiry(id)`를 읽는다. 없으면 `/admin/inquiries`로 이동한다. 화면:
- 머리: 종류 라벨, 상태 배지, 닉네임, 보낸 시각.
- 본문(`whitespace-pre-wrap`, `data-testid="admin-inquiry-body"`), 앱 버전·기기 정보(`text-12 text-ink-3`, `data-testid="admin-inquiry-device"`).
- 답변 기록(`data-testid="admin-inquiry-replies"`): 시간순, 각 답변 본문과 시각.
- 답변 입력: `textarea[appInput] data-testid="admin-reply-body" maxlength=2000`, `replyFormError`가 있으면 "답변 보내기"(`data-testid="admin-reply-send"`) 잠금. 보내면 다시 읽고 입력을 비운다.
- 상태 변경: "확인 중으로 표시"(`data-testid="admin-inquiry-reading"`, 상태가 `open`일 때만), "접수됨으로 되돌리기"(`reading`일 때만).
- 오류: `isAdminDenied`면 `/account`, 아니면 `appNotice tone="danger" role="alert"`.

`admin.routes.ts`에 Task 4 Step 3에 적은 문의 두 경로를 추가한다.

- [ ] **Step 4: 통과 확인** — `npx vitest run src/app/features/admin` PASS, `npx ng build` 오류 0, `npm run lint` PASS.

- [ ] **Step 5: 커밋**
```bash
git add app/src/app/features/admin
git commit -m "feat(app): 관리자 문의 목록·상세·답변 화면을 둔다"
```

### Task 6: e2e

**Files:**
- Modify: `app/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: Task 4·5 testid, 서버 경로 `rest/v1/notices`, `rest/v1/inquiries`, `rest/v1/rpc/admin_*`.

- [ ] **Step 1: 테스트 추가** (`admin.spec.ts` 끝)

```ts
/** 관리자 공지·문의 서버를 흉내 낸다. 호출된 함수와 인자를 기록한다. */
async function fakeAdminServer(page: Page) {
  const calls: { fn: string; body: unknown }[] = [];
  const notices = [{ id: 'n1', title: '점검 안내', body: '오늘 밤 점검', status: 'draft', generated: false, release_tag: '', created_at: '2026-10-01T00:00:00Z', published_at: null }];
  const inquiries = [{ id: 'q1', user_id: 'u', sender_nickname: '민지', kind: 'bug', body: '지도가 안 떠요', status: 'open', app_version: 'v0.10.2', user_agent: 'test-agent', answer_read_at: null, created_at: '2026-10-01T00:00:00Z', inquiry_replies: [] as unknown[] }];
  await answerIsAdmin(page, true);
  await page.route('**/rest/v1/notices*', (route) => route.fulfill({ json: notices }));
  await page.route('**/rest/v1/inquiries*', (route) => route.fulfill({ json: inquiries }));
  await page.route('**/rest/v1/rpc/admin_*', async (route) => {
    const fn = route.request().url().split('/rpc/')[1]!;
    const body = route.request().postDataJSON();
    calls.push({ fn, body });
    if (fn === 'admin_set_notice_published') notices[0]!.status = body.p_published ? 'published' : 'draft';
    if (fn === 'admin_reply_inquiry') { inquiries[0]!.status = 'answered'; inquiries[0]!.inquiry_replies.push({ id: 'r1', body: body.p_body, author_role: 'admin', created_at: '2026-10-01T01:00:00Z' }); }
    await route.fulfill({ json: fn === 'admin_save_notice' ? 'n1' : null });
  });
  return calls;
}

test('관리자는 공지를 고치고 발행한다', async ({ page }) => {
  const calls = await fakeAdminServer(page);
  await page.goto('/admin');
  await page.getByTestId('admin-notices').click();
  await expect(page.getByTestId('admin-notice-list')).toContainText('초안');
  await page.getByText('점검 안내').click();
  await page.getByTestId('admin-notice-title').fill('   ');
  await expect(page.getByTestId('admin-notice-save')).toBeDisabled();
  await page.getByTestId('admin-notice-title').fill('점검 안내(수정)');
  await page.getByTestId('admin-notice-save').click();
  await page.getByTestId('admin-notice-publish').click();
  await expect(page.getByTestId('admin-notice-publish')).toContainText('발행 취소');
  expect(calls.map((c) => c.fn)).toEqual(['admin_save_notice', 'admin_set_notice_published']);
  expect(calls[0]!.body).toMatchObject({ p_id: 'n1', p_title: '점검 안내(수정)' });
  await expectNoHorizontalScroll(page);
});

test('관리자는 문의를 보고 답한다', async ({ page }) => {
  const calls = await fakeAdminServer(page);
  await page.goto('/admin/inquiries');
  await expect(page.getByTestId('admin-inquiry-q1')).toContainText('민지');
  await page.getByTestId('admin-inquiry-filter-answered').click();
  await expect(page.getByTestId('admin-inquiry-q1')).toHaveCount(0);
  await page.getByTestId('admin-inquiry-filter-all').click();
  await page.getByTestId('admin-inquiry-q1').click();
  await expect(page.getByTestId('admin-inquiry-device')).toContainText('v0.10.2');
  await expect(page.getByTestId('admin-reply-send')).toBeDisabled();
  await page.getByTestId('admin-reply-body').fill('확인했어요. 고칠게요.');
  await page.getByTestId('admin-reply-send').click();
  await expect(page.getByTestId('admin-inquiry-replies')).toContainText('확인했어요. 고칠게요.');
  expect(calls).toEqual([{ fn: 'admin_reply_inquiry', body: { p_id: 'q1', p_body: '확인했어요. 고칠게요.' } }]);
  await expectNoHorizontalScroll(page);
});

test('일반 사용자는 관리자 하위 화면에도 들어가지 못한다', async ({ page }) => {
  await answerIsAdmin(page, false);
  await page.goto('/admin/inquiries/q1');
  await expect(page).toHaveURL(/\/account$/);
});

test('관리자 권한이 사라지면 내 정보로 돌아간다', async ({ page }) => {
  await answerIsAdmin(page, true);
  await page.route('**/rest/v1/notices*', (route) => route.fulfill({ status: 403, json: { code: '42501', message: 'admin_only' } }));
  await page.goto('/admin/notices');
  await expect(page).toHaveURL(/\/account$/);
});
```
기존 첫 테스트의 "준비 중" 확인 두 줄은 링크 확인으로 바꾼다:
```ts
  await expect(page.getByTestId('admin-notices')).toHaveAttribute('href', '/admin/notices');
  await expect(page.getByTestId('admin-inquiries')).toHaveAttribute('href', '/admin/inquiries');
```

- [ ] **Step 2: 실행** — `npx playwright test e2e/admin.spec.ts --reporter=line`. Expected: 데스크톱·360px 모두 통과. 실패하면 흉내 응답·화면 중 틀린 쪽을 고친다(화면이 설계와 다르면 화면을 고친다).

- [ ] **Step 3: 사용자 화면 회귀** — 테스트 앱은 기기 저장을 쓰므로 `npx playwright test e2e/account.spec.ts --reporter=line`과 공지·문의 e2e(`ls e2e | grep -iE 'notice|inquir|support'`)를 돌려 그대로인지 확인한다.

- [ ] **Step 4: 커밋**
```bash
git add app/e2e/admin.spec.ts
git commit -m "test(app): 관리자 공지 발행·문의 답변·권한 차단 e2e를 더한다"
```

### Task 7: 문서

**Files:** `docs/기획안-v0.1.md`(36절), `docs/architecture/DATABASE.md`, `docs/DEVELOPMENT.md`(고객 지원 행), `openspec/changes/plan-travel-companion-mvp/tasks.md`(14.8·14.9), `docs/README.md`

- [ ] **Step 1:** 기획안 36절 "관리자 화면" 소제목을 "(공지·문의 관리 구현)"으로 바꾸고, 구현 범위 문단 끝에 "2026-10-01: 공지·문의를 서버에 저장하고 관리자 공지 관리·문의 관리 화면을 만들었다. 배포 자동 공지 초안·푸시 알림·사용자 추가 답글은 후속이다. 기기에만 저장되던 옛 문의는 옮기지 않고 지운다."를 더한다. "표 구조 (미구현)"을 "표 구조"로 바꾸고 마이그레이션 파일명을 적는다.
- [ ] **Step 2:** `DATABASE.md`에 "공지·문의" 절을 더한다: 네 표의 칸·RLS 한 줄씩, 함수 표(누가·하는 일), 오류 코드, 로컬 확인 `supabase/tests/support.local.sql`.
- [ ] **Step 3:** `DEVELOPMENT.md` 고객 지원 행을 "공지·문의 서버 저장, 관리자 공지·문의 관리. 자동 공지 초안은 후속"으로 바꾼다. OpenSpec `tasks.md`의 14.8·14.9 관련 항목을 완료로 표시하고 검증 근거를 적는다. `docs/README.md` 개발·운영 기준 표에 `[공지·문의 관리 설계](superpowers/specs/2026-10-01-support-admin-design.md)`를 더한다.
- [ ] **Step 4:** `openspec validate --all --strict`(저장소 루트 `npm run spec:check`) PASS 확인 후 커밋.
```bash
git add docs openspec
git commit -m "docs: 공지·문의 서버 저장과 관리자 관리 화면 기록"
```

### Task 8: 전체 검증과 운영 적용 (사용자 확인 필요)

- [ ] **Step 1:** `npx vitest run`, `npx ng build`, `npm run lint`, `npx playwright test e2e/admin.spec.ts e2e/account.spec.ts --reporter=line` 결과를 기록한다.
- [ ] **Step 2 (확인 후):** `npx supabase db push --dry-run`으로 `20261001000000_support.sql` 하나만 적용되는지 보고 `npx supabase db push --yes`. 비로그인 요청으로 `rest/v1/notices`·`rest/v1/rpc/send_inquiry`가 `42501`로 거절되는지 확인한다.
- [ ] **Step 3 (확인 후):** develop 병합 → `app/RELEASE` v0.10.3 → master fast-forward → 태그 → push. 배포 사이트에서 버전 확인.
- [ ] **Step 4:** 관리자 계정으로 공지 초안 작성·발행, 일반 화면에서 공지가 보이는지, 문의를 보내고 관리자 화면에서 답한 뒤 사용자 화면에 새 답변이 뜨는지 한 번씩 확인하도록 사용자에게 요청하고 결과를 문서에 남긴다.
