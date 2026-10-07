# 채팅 기록 서버 저장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 대화를 기기 localStorage 대신 본인만 읽는 Supabase 표에 남겨, 기기를 바꿔도 대화가 이어지게 한다.

**Architecture:** 메시지 한 줄을 `chat_messages` 행 하나로 저장하고, 쓰기는 `security definer` 함수(`append_chat_message`·`import_chat_threads`·`clear_chat`)로만 한다. 앱의 `ChatHistoryStore`는 대화 전체를 덮어쓰는 `save` 대신 새 줄만 넘기는 `append`로 바뀐다. 운영 빌드는 `SupabaseChatHistory`를, 테스트 빌드는 지금의 `LocalChatHistory`를 쓴다. 기기에 남은 대화는 그 계정으로 처음 읽거나 쓸 때 한 번 서버로 옮긴다.

**Tech Stack:** PostgreSQL 17(Supabase), Angular 21, NgRx Signals, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-10-07-chat-history-server-design.md`

## Global Constraints

- 대화는 본인만 본다. 여행 멤버라도 남의 대화를 읽을 수 없다.
- 대화마다(계정 × 여행, 목록 대화는 여행 null) 최근 200줄만 남긴다.
- 본문 4,000자, 부가 정보(`extra`) 64KB(`octet_length(extra::text) <= 65536`), 옮기기 전체 2MB(2,000,000바이트) 상한. 넘으면 `P0400`.
- 여행 대화는 `is_trip_member(trip_id)`일 때만 남긴다. 아니면 `42501`. 비로그인은 `42501`.
- 기기 기록은 서버에 같은 대화가 없을 때만 옮기고, 성공하면 기기 사본을 지운다. 실패하면 남긴다.
- 저장·불러오기 실패는 대화를 막지 않는다. 화면 대화가 원본이다.
- 테스트 빌드(`environment.isTest`)와 미리보기(`environment.designPreview`)는 기기 저장을 유지한다.
- 목록 대화의 기기·옮기기 키는 `__list__`다(`LocalChatHistory`의 `LIST_KEY`와 같다).
- 커밋 메시지는 저장소 CLAUDE.md 규칙(`<type>(<scope>): <subject>`, 한국어, 마침표 없음)과 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 줄을 따른다.
- 파일을 Python으로 고칠 때는 `newline=''`로 원래 줄 끝을 유지한다.

## Review Focus

1. 옮기기가 끝나기 전에 사용자가 말을 보내면, 서버에 그 대화가 생겨 기기 기록이 건너뛰어진다 → `append`도 옮기기를 기다린다(Task 3 테스트).
2. 같은 기기에서 계정을 바꾸면 각 계정의 기기 기록이 그 계정으로만 옮겨져야 한다 → 옮기기 기억을 계정 id별로 둔다(Task 3 테스트).
3. 기기 기록에 지워진 여행·나간 여행·깨진 줄이 섞여 있어도 나머지는 옮겨져야 한다 → SQL 테스트(Task 1).
4. 네트워크가 끊겨 불러오기가 실패해도 대화 화면은 빈 대화로 열린다 → Task 3 테스트.
5. 같은 메시지를 두 번 보내도(재시도) 한 줄만 남는다 → SQL 테스트(Task 1).

---

### Task 1: `chat_messages` 표와 서버 함수

**Files:**
- Create: `supabase/migrations/20261007100000_chat_messages.sql`
- Create: `supabase/tests/chat-messages.local.sql`

**Interfaces:**
- Produces (DB):
  - 표 `public.chat_messages(user_id uuid, id text, trip_id text null, role text, kind text null, text text, extra jsonb, at timestamptz, created_at timestamptz)`, 기본 키 `(user_id, id)`.
  - `append_chat_message(p_trip_id text, p_message jsonb) returns void`
  - `import_chat_threads(p_threads jsonb) returns integer` (옮긴 줄 수)
  - `clear_chat(p_trip_id text) returns void`
  - `p_message` 형식: `{"id": text, "role": "user"|"assistant"|"system", "kind": text|null, "text": text, "at": ISO 시각, "extra": object}`
  - `p_threads` 형식: `{"<tripId 또는 __list__>": [p_message, ...]}`

- [ ] **Step 1: 실패하는 로컬 SQL 테스트 작성**

`supabase/tests/chat-messages.local.sql`:

```sql
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
```

- [ ] **Step 2: 실패 확인**

Run (Git Bash, 저장소 루트):
```bash
P="/c/Program Files/PostgreSQL/17/bin/psql.exe"; export PGPASSWORD=postgres
"$P" -U postgres -h localhost -q -c 'drop database if exists tc_chat' -c 'create database tc_chat'
"$P" -U postgres -h localhost -d tc_chat -f supabase/tests/chat-messages.local.sql
```
Expected: `\ir ../migrations/20261007100000_chat_messages.sql`에서 파일이 없다는 오류로 멈춘다.

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/20261007100000_chat_messages.sql`:

```sql
-- AI 대화 기록을 서버에 남긴다(2026-10-07). 본인만 읽고, 쓰기는 아래 함수로만 한다.
-- 메시지 한 줄이 행 하나다. 메시지는 만든 뒤 고치지 않으므로 두 기기가 같은 대화에 써도 서로 덮지 않는다.
-- 대화는 (계정, 여행)으로 나뉜다. 여행 목록에서 연 대화는 trip_id가 null이다.
create table public.chat_messages (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  trip_id text references public.trips (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  kind text check (kind is null or kind in ('explore', 'draft', 'reference', 'outside', 'refusal')),
  text text not null check (char_length(text) <= 4000),
  extra jsonb not null default '{}' check (jsonb_typeof(extra) = 'object' and octet_length(extra::text) <= 65536),
  at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index chat_messages_thread_idx on public.chat_messages (user_id, trip_id, at desc);

alter table public.chat_messages enable row level security;
create policy chat_messages_read_own on public.chat_messages for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.chat_messages from public, anon, authenticated;
grant select on public.chat_messages to authenticated;

-- 한 줄을 검사해 넣는다. 같은 id가 있으면 무시하고 false. 형식이 틀리면 P0400.
create function public.insert_chat_message(p_user uuid, p_trip_id text, p_message jsonb) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare v_at timestamptz; v_extra jsonb := coalesce(p_message -> 'extra', '{}'::jsonb);
begin
  if jsonb_typeof(p_message) is distinct from 'object'
     or jsonb_typeof(p_message -> 'id') is distinct from 'string'
     or jsonb_typeof(p_message -> 'text') is distinct from 'string'
     or coalesce(p_message ->> 'role', '') not in ('user', 'assistant', 'system')
     or char_length(p_message ->> 'text') > 4000
     or jsonb_typeof(v_extra) is distinct from 'object'
     or octet_length(v_extra::text) > 65536 then
    raise exception 'invalid_message' using errcode = 'P0400';
  end if;
  begin
    v_at := (p_message ->> 'at')::timestamptz;
  exception when others then
    raise exception 'invalid_message' using errcode = 'P0400';
  end;
  if v_at is null then raise exception 'invalid_message' using errcode = 'P0400'; end if;
  insert into public.chat_messages (user_id, id, trip_id, role, kind, text, extra, at)
  values (p_user, p_message ->> 'id', p_trip_id, p_message ->> 'role', nullif(p_message ->> 'kind', ''),
          p_message ->> 'text', v_extra, v_at)
  on conflict (user_id, id) do nothing;
  return found;
exception when check_violation then
  raise exception 'invalid_message' using errcode = 'P0400';
end;
$$;

-- 그 대화의 최근 200줄 밖을 지운다.
create function public.trim_chat_thread(p_user uuid, p_trip_id text) returns void
  language sql security definer set search_path = '' as $$
  delete from public.chat_messages
   where ctid in (
     select ctid from public.chat_messages
      where user_id = p_user and trip_id is not distinct from p_trip_id
      order by at desc, id desc
      offset 200
   );
$$;

-- 여행 대화를 남길 수 있는지. 여행이 없거나 멤버가 아니면 false.
create function public.can_chat_in(p_trip_id text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select p_trip_id is null or public.is_trip_member(p_trip_id);
$$;

create function public.append_chat_message(p_trip_id text, p_message jsonb) returns void
  language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if not public.can_chat_in(p_trip_id) then raise exception 'not_member' using errcode = '42501'; end if;
  perform public.insert_chat_message(v_user, p_trip_id, p_message);
  perform public.trim_chat_thread(v_user, p_trip_id);
end;
$$;

-- 기기 기록 옮기기. 서버에 이미 있는 대화, 남길 수 없는 여행의 대화, 깨진 줄은 건너뛴다.
create function public.import_chat_threads(p_threads jsonb) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_key text; v_messages jsonb; v_trip text; v_message jsonb; v_count integer := 0; v_len integer;
begin
  if v_user is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if jsonb_typeof(p_threads) is distinct from 'object' or octet_length(p_threads::text) > 2000000 then
    raise exception 'invalid_threads' using errcode = 'P0400';
  end if;
  for v_key, v_messages in select key, value from jsonb_each(p_threads) loop
    v_trip := nullif(v_key, '__list__');
    continue when jsonb_typeof(v_messages) is distinct from 'array';
    continue when not public.can_chat_in(v_trip);
    continue when exists (select 1 from public.chat_messages
                           where user_id = v_user and trip_id is not distinct from v_trip);
    v_len := jsonb_array_length(v_messages);
    for v_message in select value from jsonb_array_elements(v_messages) with ordinality e(value, n)
                      where n > v_len - 200 loop
      begin
        if public.insert_chat_message(v_user, v_trip, v_message) then v_count := v_count + 1; end if;
      exception when sqlstate 'P0400' then
        null;
      end;
    end loop;
  end loop;
  return v_count;
end;
$$;

create function public.clear_chat(p_trip_id text) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  delete from public.chat_messages where user_id = auth.uid() and trip_id is not distinct from p_trip_id;
end;
$$;

revoke execute on function
  public.insert_chat_message(uuid, text, jsonb), public.trim_chat_thread(uuid, text), public.can_chat_in(text),
  public.append_chat_message(text, jsonb), public.import_chat_threads(jsonb), public.clear_chat(text)
  from public, anon, authenticated;
grant execute on function
  public.append_chat_message(text, jsonb), public.import_chat_threads(jsonb), public.clear_chat(text)
  to authenticated;
```

- [ ] **Step 4: 테스트 통과 확인**

Step 2와 같은 명령을 `-v VERBOSITY=verbose`를 붙여 다시 돌린다.
Expected: 모든 `t` 줄의 값이 괄호 안 기대값과 같다. 오류 줄은 `P0400`(형식 4건·옮기기 크기 1건), `42501`(B 2건, anon 1건, 직접 insert), `permission denied`(도우미)만 나온다. `B clear A trip` 줄은 오류 없이 빈 값이다. 확인 후 `drop database tc_chat`.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20261007100000_chat_messages.sql supabase/tests/chat-messages.local.sql
git commit -m "feat: 채팅 기록을 본인만 읽는 chat_messages 표와 서버 함수로 저장한다"
```

---

### Task 2: 저장소 인터페이스를 `append`로 바꾸기

**Files:**
- Modify: `app/src/app/features/travel-chat/data/chat-history.ts`
- Modify: `app/src/app/features/travel-chat/data/travel-chat-store.ts:422` (`push`의 저장 호출)
- Test: `app/src/app/features/travel-chat/data/chat-history.spec.ts`, `app/src/app/features/travel-chat/data/travel-chat-store.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ChatHistoryStore {
    load(tripId: string | null): Promise<readonly ChatMessage[]>;
    append(tripId: string | null, message: ChatMessage): Promise<void>;
    clear(tripId: string | null): Promise<void>;
  }
  /** 기기에 남은 대화 묶음. 서버로 옮길 때 쓴다. 열쇠는 여행 id, 목록 대화는 '__list__'. */
  export interface DeviceChatThreads {
    exportThreads(): Record<string, readonly ChatMessage[]>;
    forget(): void;
  }
  export class LocalChatHistory implements ChatHistoryStore, DeviceChatThreads { ... }
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`chat-history.spec.ts`의 기존 테스트에서 `history.save(null, [said('A의 비밀 여행')])`를 `history.append(null, said('A의 비밀 여행'))`로, `history.save(null, [said('B의 대화')])`를 `history.append(null, said('B의 대화'))`로 바꾸고 아래 테스트를 `describe` 안에 더한다.

```ts
  it('한 줄씩 덧붙이고 대화마다 최근 200줄만 남긴다', async () => {
    const history = new LocalChatHistory(memory(), 'tc.chat.a');
    for (let i = 0; i < 205; i++) await history.append('t1', said(`줄 ${i}`));
    await history.append(null, said('목록'));
    const trip = await history.load('t1');
    expect(trip).toHaveLength(200);
    expect(trip[0]!.text).toBe('줄 5');
    expect((await history.load(null)).map((m) => m.text)).toEqual(['목록']);
  });

  it('기기 대화를 열쇠별로 내보내고 forget하면 모두 지운다', async () => {
    const storage = memory();
    const history = new LocalChatHistory(storage, 'tc.chat.a');
    await history.append(null, said('목록'));
    await history.append('t1', said('여행'));
    expect(Object.keys(history.exportThreads()).sort()).toEqual(['__list__', 't1']);
    history.forget();
    expect(storage.map.has('tc.chat.a')).toBe(false);
    expect(history.exportThreads()).toEqual({});
  });
```

`travel-chat-store.spec.ts`에서 `memoryStorage`를 쓰는 기존 테스트는 그대로 둔다. 아래 테스트를 파일 끝에 더한다(`setup`은 이미 있는 함수이며 `CHAT_HISTORY`를 `LocalChatHistory`로 준다. 이 테스트는 가짜 저장소를 직접 넘기기 위해 `Injector`를 새로 만든다).

```ts
describe('TravelChatStore 대화 저장', () => {
  it('새 말풍선 한 줄만 저장소에 덧붙인다', async () => {
    const appended: { tripId: string | null; text: string }[] = [];
    const history: ChatHistoryStore = {
      load: async () => [],
      append: async (tripId, message) => void appended.push({ tripId, text: message.text }),
      clear: async () => undefined,
    };
    const injector = Injector.create({
      providers: [
        { provide: CHAT_PROVIDER, useValue: fakeChat() },
        { provide: PLACE_SEARCH, useValue: fakeSearch() },
        { provide: CHAT_HISTORY, useValue: history },
        TravelChatStore,
        { provide: LEDGER_REPOSITORY, useValue: fakeLedger().repo },
      ],
    });
    const store = runInInjectionContext(injector, () => injector.get(TravelChatStore));
    store.open('list', null);
    store.notifyTripSaved('t1');
    store.notifyTripSaved('t2');
    expect(appended).toEqual([
      { tripId: null, text: '여행에 담았어요. 일정을 확인해 보세요.' },
      { tripId: null, text: '여행에 담았어요. 일정을 확인해 보세요.' },
    ]);
  });
});
```

`travel-chat-store.spec.ts`의 import에 `type ChatHistoryStore`를 더한다: `import { CHAT_HISTORY, LocalChatHistory, type ChatHistoryStore, type KeyValueStorage } from './chat-history';`

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/features/travel-chat/data/chat-history.spec.ts src/app/features/travel-chat/data/travel-chat-store.spec.ts`
Expected: FAIL — `history.append is not a function`, `exportThreads`가 없음, 타입 오류.

- [ ] **Step 3: 구현**

`chat-history.ts`:
- 인터페이스의 `save(...)`를 `append(tripId: string | null, message: ChatMessage): Promise<void>;`로 바꾸고 주석을 "새 줄만 받는다. 화면 상태가 원본이다."로 고친다. 파일 머리 주석의 "지금은 기기에만 저장하고 서버로 보내지 않는다 … 13-B에서 서버 구현으로 갈아 끼울 때" 문단을 "운영 빌드는 서버 구현(`SupabaseChatHistory`), 테스트 빌드와 미리보기는 이 기기 구현을 쓴다."로 바꾼다.
- `DeviceChatThreads` 인터페이스를 위 Interfaces 그대로 더한다.
- `LocalChatHistory`의 `save`를 지우고 아래를 더한다.

```ts
  async append(tripId: string | null, message: ChatMessage): Promise<void> {
    const threads = this.read();
    const key = tripId ?? LIST_KEY;
    threads[key] = [...(threads[key] ?? []), message].slice(-MAX_MESSAGES);
    this.write(threads);
  }

  exportThreads(): Record<string, readonly ChatMessage[]> {
    return this.read();
  }

  forget(): void {
    try {
      this.storage.removeItem(this.storageKey);
    } catch {
      // 저장소 접근이 막혀도 대화는 이어진다.
    }
  }
```

`travel-chat-store.ts`의 `push`:

```ts
    const messages = [...this.messages(), message];
    patchState(this.state, { messages });
    void this.history.append(this.trip()?.id ?? null, message).catch(() => undefined);
```

- [ ] **Step 4: 통과 확인**

Run: `cd app && npx vitest run src/app/features/travel-chat && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS, 타입 오류 없음. `save(`를 부르는 다른 곳이 남았다면 `grep -rn "history.save\|\.save(null\|CHAT_HISTORY" app/src app/e2e`로 찾아 `append`로 고친다.

- [ ] **Step 5: 커밋**

```bash
git add app/src/app/features/travel-chat/data/
git commit -m "refactor(app): 대화 저장소가 대화 전체 대신 새 줄만 받도록 바꾼다"
```

---

### Task 3: `SupabaseChatHistory`와 기기 기록 옮기기

**Files:**
- Create: `app/src/app/features/travel-chat/data/chat-data-client.ts`
- Create: `app/src/app/features/travel-chat/data/supabase-chat-history.ts`
- Test: `app/src/app/features/travel-chat/data/supabase-chat-history.spec.ts`

**Interfaces:**
- Consumes: `ChatHistoryStore`, `DeviceChatThreads` (Task 2), DB 함수 (Task 1)
- Produces:
  ```ts
  // chat-data-client.ts
  export interface ChatRow { id: string; role: string; kind: string | null; text: string; extra: Record<string, unknown>; at: string; }
  export interface ChatDataClient {
    /** 그 대화의 최근 limit줄을 오래된 것부터. */
    thread(tripId: string | null, limit: number): Promise<ChatRow[]>;
    call(fn: 'append_chat_message' | 'import_chat_threads' | 'clear_chat', args: Record<string, unknown>): Promise<unknown>;
  }
  export function supabaseChatDataClient(client: () => Promise<SupabaseClient>): ChatDataClient;
  export function toChatRow(message: ChatMessage): { id: string; role: string; kind: string | null; text: string; at: string; extra: Record<string, unknown> };
  export function fromChatRow(row: ChatRow): ChatMessage | null;
  // supabase-chat-history.ts
  export class SupabaseChatHistory implements ChatHistoryStore {
    constructor(data: ChatDataClient, device: DeviceChatThreads, userId: () => string | null);
  }
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`supabase-chat-history.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../model/chat';
import type { DeviceChatThreads } from './chat-history';
import { fromChatRow, toChatRow, type ChatDataClient, type ChatRow } from './chat-data-client';
import { SupabaseChatHistory } from './supabase-chat-history';

const message = (id: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id, role: 'assistant', kind: 'explore', text: `말 ${id}`, reference: null, draft: null, chips: [], at: '2026-10-07T00:00:00.000Z', ...extra,
});

function fakeData(rows: ChatRow[] = []) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  let fail = false;
  const data: ChatDataClient = {
    thread: vi.fn(async () => { if (fail) throw new Error('offline'); return rows; }),
    call: vi.fn(async (fn, args) => { calls.push({ fn, args }); if (fail) throw new Error('offline'); return 0; }),
  };
  return { data, calls, failNext: () => { fail = true; }, recover: () => { fail = false; } };
}

function fakeDevice(threads: Record<string, readonly ChatMessage[]> = {}) {
  const device: DeviceChatThreads & { forgotten: number } = {
    forgotten: 0,
    exportThreads: () => threads,
    forget() { this.forgotten += 1; },
  };
  return device;
}

describe('chat row 변환', () => {
  it('부가 정보를 extra로 묶었다가 그대로 되살린다', () => {
    const original = message('m1', { chips: ['더 보기'], localLink: '/trips/t1', localLinkLabel: '여행 보기', copyText: '복사' });
    const row = toChatRow(original);
    expect(row.extra).toEqual({ reference: null, draft: null, chips: ['더 보기'], localLink: '/trips/t1', localLinkLabel: '여행 보기', copyText: '복사' });
    expect(fromChatRow({ ...row, extra: row.extra })).toEqual(original);
  });

  it('형식이 틀린 줄은 버린다', () => {
    expect(fromChatRow({ id: 'x', role: 'bot', kind: null, text: 'a', extra: {}, at: '2026-10-07T00:00:00Z' })).toBeNull();
  });
});

describe('SupabaseChatHistory', () => {
  it('대화를 읽고, 새 줄과 지우기를 서버 함수로 보낸다', async () => {
    const { data, calls } = fakeData([toChatRow(message('m1')) as ChatRow]);
    const history = new SupabaseChatHistory(data, fakeDevice(), () => 'a');
    expect((await history.load('t1')).map((m) => m.id)).toEqual(['m1']);
    expect(data.thread).toHaveBeenCalledWith('t1', 200);
    await history.append('t1', message('m2'));
    await history.clear(null);
    expect(calls.map((c) => c.fn)).toEqual(['append_chat_message', 'clear_chat']);
    expect(calls[0]!.args).toEqual({ p_trip_id: 't1', p_message: toChatRow(message('m2')) });
    expect(calls[1]!.args).toEqual({ p_trip_id: null });
  });

  it('불러오기가 실패하면 빈 대화로 연다', async () => {
    const fake = fakeData();
    fake.failNext();
    const history = new SupabaseChatHistory(fake.data, fakeDevice(), () => 'a');
    await expect(history.load(null)).resolves.toEqual([]);
  });

  it('처음 읽기 전에 기기 기록을 한 번 옮기고 기기 사본을 지운다', async () => {
    const { data, calls } = fakeData();
    const device = fakeDevice({ __list__: [message('old')] });
    const history = new SupabaseChatHistory(data, device, () => 'a');
    await history.load(null);
    await history.load('t1');
    expect(calls.filter((c) => c.fn === 'import_chat_threads')).toEqual([
      { fn: 'import_chat_threads', args: { p_threads: { __list__: [toChatRow(message('old'))] } } },
    ]);
    expect(device.forgotten).toBe(1);
  });

  it('옮기기 전에 보낸 말은 옮기기가 끝난 뒤에 저장한다', async () => {
    const { data, calls } = fakeData();
    const history = new SupabaseChatHistory(data, fakeDevice({ __list__: [message('old')] }), () => 'a');
    await history.append(null, message('new'));
    expect(calls.map((c) => c.fn)).toEqual(['import_chat_threads', 'append_chat_message']);
  });

  it('옮기기가 실패하면 기기 사본을 남긴다', async () => {
    const fake = fakeData();
    const device = fakeDevice({ __list__: [message('old')] });
    fake.failNext();
    const history = new SupabaseChatHistory(fake.data, device, () => 'a');
    await history.load(null);
    expect(device.forgotten).toBe(0);
  });

  it('기기 기록이 없으면 옮기기를 부르지 않는다', async () => {
    const { data, calls } = fakeData();
    await new SupabaseChatHistory(data, fakeDevice(), () => 'a').load(null);
    expect(calls).toEqual([]);
  });

  it('계정이 바뀌면 그 계정의 기기 기록을 따로 옮긴다', async () => {
    const { data, calls } = fakeData();
    let user = 'a';
    const history = new SupabaseChatHistory(data, fakeDevice({ __list__: [message('old')] }), () => user);
    await history.load(null);
    user = 'b';
    await history.load(null);
    expect(calls.filter((c) => c.fn === 'import_chat_threads')).toHaveLength(2);
  });

  it('로그인하지 않았으면 읽기는 빈 대화, 쓰기는 하지 않는다', async () => {
    const { data, calls } = fakeData();
    const history = new SupabaseChatHistory(data, fakeDevice({ __list__: [message('old')] }), () => null);
    expect(await history.load(null)).toEqual([]);
    await history.append(null, message('m'));
    expect(calls).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/features/travel-chat/data/supabase-chat-history.spec.ts`
Expected: FAIL — `./chat-data-client` 모듈 없음.

- [ ] **Step 3: 구현**

`chat-data-client.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '../model/chat';

/** 서버 `chat_messages` 한 줄. 말풍선의 부가 정보는 extra에 묶는다. */
export interface ChatRow {
  id: string;
  role: string;
  kind: string | null;
  text: string;
  extra: Record<string, unknown>;
  at: string;
}

/** Supabase 호출을 이 좁은 창구 뒤에 둔다. 저장소 로직은 가짜로 테스트한다. */
export interface ChatDataClient {
  /** 그 대화의 최근 limit줄을 오래된 것부터. */
  thread(tripId: string | null, limit: number): Promise<ChatRow[]>;
  call(fn: 'append_chat_message' | 'import_chat_threads' | 'clear_chat', args: Record<string, unknown>): Promise<unknown>;
}

const ROLES = new Set(['user', 'assistant', 'system']);

export function toChatRow(message: ChatMessage): ChatRow {
  const { id, role, kind, text, at, reference, draft, chips, localLink, localLinkLabel, copyText } = message;
  const extra: Record<string, unknown> = { reference, draft, chips };
  if (localLink !== undefined) extra['localLink'] = localLink;
  if (localLinkLabel !== undefined) extra['localLinkLabel'] = localLinkLabel;
  if (copyText !== undefined) extra['copyText'] = copyText;
  return { id, role, kind, text, at, extra };
}

/** 형식이 틀린 줄은 null. 깨진 줄 하나가 대화 전체를 막지 않게 한다. */
export function fromChatRow(row: ChatRow): ChatMessage | null {
  if (typeof row.id !== 'string' || !ROLES.has(row.role) || typeof row.text !== 'string' || typeof row.at !== 'string') return null;
  const extra = row.extra ?? {};
  const message: Record<string, unknown> = {
    id: row.id,
    role: row.role,
    kind: row.kind ?? null,
    text: row.text,
    reference: extra['reference'] ?? null,
    draft: extra['draft'] ?? null,
    chips: Array.isArray(extra['chips']) ? extra['chips'] : [],
    at: new Date(row.at).toISOString(),
  };
  for (const key of ['localLink', 'localLinkLabel', 'copyText'] as const) {
    if (typeof extra[key] === 'string') message[key] = extra[key];
  }
  return message as unknown as ChatMessage;
}

export function supabaseChatDataClient(client: () => Promise<SupabaseClient>): ChatDataClient {
  return {
    async thread(tripId, limit) {
      let query = (await client())
        .from('chat_messages')
        .select('id, role, kind, text, extra, at')
        .order('at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
      query = tripId === null ? query.is('trip_id', null) : query.eq('trip_id', tripId);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as ChatRow[]).reverse();
    },
    async call(fn, args) {
      const { data, error } = await (await client()).rpc(fn, args);
      if (error) throw error;
      return data;
    },
  };
}
```

`fromChatRow`의 `at` 정규화는 서버가 `2026-10-07T00:00:00+00:00` 형식으로 돌려주므로 화면 비교를 위해 ISO로 맞추는 것이다. 테스트의 `toChatRow(message)`는 이미 ISO라 그대로 같다.

`supabase-chat-history.ts`:

```ts
import type { ChatMessage } from '../model/chat';
import type { ChatHistoryStore, DeviceChatThreads } from './chat-history';
import { fromChatRow, toChatRow, type ChatDataClient } from './chat-data-client';

/** 한 대화에서 읽는 최대 줄 수. 서버도 같은 수만 남긴다. */
const MAX_MESSAGES = 200;

/**
 * 서버에 남기는 대화 기록(2026-10-07). 본인만 읽는다.
 *
 * 그 계정으로 처음 읽거나 쓸 때 이 기기에 남은 대화를 한 번 서버로 옮긴다. 쓰기도 옮기기를
 * 기다린다. 먼저 쓰면 서버에 그 대화가 생겨 기기 기록이 건너뛰어지기 때문이다.
 * 실패는 대화를 막지 않는다. 화면 대화가 원본이다.
 */
export class SupabaseChatHistory implements ChatHistoryStore {
  private readonly imports = new Map<string, Promise<void>>();

  constructor(
    private readonly data: ChatDataClient,
    private readonly device: DeviceChatThreads,
    private readonly userId: () => string | null,
  ) {}

  async load(tripId: string | null): Promise<readonly ChatMessage[]> {
    if (!(await this.ready())) return [];
    try {
      const rows = await this.data.thread(tripId, MAX_MESSAGES);
      return rows.map(fromChatRow).filter((m): m is ChatMessage => m !== null);
    } catch {
      return [];
    }
  }

  async append(tripId: string | null, message: ChatMessage): Promise<void> {
    if (!(await this.ready())) return;
    await this.data.call('append_chat_message', { p_trip_id: tripId, p_message: toChatRow(message) });
  }

  async clear(tripId: string | null): Promise<void> {
    if (!(await this.ready())) return;
    await this.data.call('clear_chat', { p_trip_id: tripId });
  }

  /** 로그인했으면 그 계정의 옮기기를 마치고 true. */
  private async ready(): Promise<boolean> {
    const user = this.userId();
    if (!user) return false;
    let pending = this.imports.get(user);
    if (!pending) {
      pending = this.importDevice();
      this.imports.set(user, pending);
    }
    await pending;
    return true;
  }

  private async importDevice(): Promise<void> {
    const threads = this.device.exportThreads();
    const keys = Object.keys(threads).filter((k) => threads[k]!.length > 0);
    if (keys.length === 0) return;
    const payload = Object.fromEntries(keys.map((k) => [k, threads[k]!.map(toChatRow)]));
    try {
      await this.data.call('import_chat_threads', { p_threads: payload });
      this.device.forget();
    } catch {
      // 기기 사본을 남긴다. 다음에 앱을 열면 다시 옮긴다.
    }
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd app && npx vitest run src/app/features/travel-chat`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add app/src/app/features/travel-chat/data/chat-data-client.ts app/src/app/features/travel-chat/data/supabase-chat-history.ts app/src/app/features/travel-chat/data/supabase-chat-history.spec.ts
git commit -m "feat(app): 대화를 서버에 남기고 기기 대화를 처음 한 번 옮기는 저장소 추가"
```

---

### Task 4: 운영 빌드에 연결

**Files:**
- Modify: `app/src/app/features/travel-chat/travel-chat.ts` (공개 진입점)
- Modify: `app/src/app/app.config.ts:197-202` (`CHAT_HISTORY` 제공자)

**Interfaces:**
- Consumes: `SupabaseChatHistory`, `supabaseChatDataClient` (Task 3), `LocalChatHistory` (Task 2)

- [ ] **Step 1: 공개 진입점에 내보내기 추가**

`travel-chat.ts`의 `CHAT_HISTORY` 줄 아래에:

```ts
export { SupabaseChatHistory } from './data/supabase-chat-history';
export { supabaseChatDataClient } from './data/chat-data-client';
```

- [ ] **Step 2: 제공자 교체**

`app.config.ts`의 import를 `import { CHAT_HISTORY, LocalChatHistory, SupabaseChatHistory, supabaseChatDataClient } from './features/travel-chat/travel-chat';`로 바꾸고, 제공자를 아래로 바꾼다.

```ts
    // 대화 기록은 실행 앱에서 서버에 남기고 본인만 본다(2026-10-07). 기기에 남은 대화는
    // 그 계정으로 처음 열 때 서버로 옮긴다. 테스트 앱과 미리보기는 기기 저장을 쓴다.
    {
      provide: CHAT_HISTORY,
      useFactory: () => {
        const device = new LocalChatHistory(new SafeLocalStorage(), accountKey('chat'));
        if (environment.isTest || environment.designPreview) return device;
        const auth = inject(AuthStore);
        return new SupabaseChatHistory(
          supabaseChatDataClient(() => auth.dataClient()),
          device,
          () => auth.user()?.id ?? null,
        );
      },
    },
```

- [ ] **Step 3: 빌드·경계·단위 테스트 확인**

Run: `cd app && npm run lint && npx vitest run && npx ng build`
Expected: 경계 검사 통과, 단위 테스트 모두 PASS, 빌드 성공(초기 번들 예산 경고는 기존과 같은 수준).

- [ ] **Step 4: 커밋**

```bash
git add app/src/app/features/travel-chat/travel-chat.ts app/src/app/app.config.ts
git commit -m "feat(app): 실행 앱의 대화 기록을 서버 저장소로 바꾼다"
```

---

### Task 5: 문서·개인정보 처리방침·사용법

**Files:**
- Modify: `app/src/app/features/support/model/policy.ts:40,56`
- Modify: `app/src/app/features/guide/model/guide.ts` (`key: 'chat'` 항목의 `description`)
- Modify: `docs/기획안-v0.1.md` (35절 끝에 저장 위치 단락)
- Modify: `docs/architecture/DATABASE.md` (새 절 "채팅 기록 (2026-10-07)")
- Modify: `docs/architecture/ARCHITECTURE.md` (대화 기록 저장 위치 설명이 있는 곳)
- Create: `openspec/changes/store-chat-history/proposal.md`, `openspec/changes/store-chat-history/tasks.md`, `openspec/changes/store-chat-history/specs/chat-history/spec.md`
- Modify: `docs/README.md` (챗봇 캐릭터 절 아래 목록에 OpenSpec 링크)

- [ ] **Step 1: 처방침 문장 테스트 확인**

Run: `grep -rn "기기에만 저장" app/src app/e2e`
정책 문장을 검사하는 테스트가 있으면 Step 2의 새 문장으로 함께 고친다.

- [ ] **Step 2: 개인정보 처리방침 고치기**

`policy.ts` 40행 문장을 아래로 바꾼다.

```ts
        'AI 챗봇과 나눈 대화와 문의는 서버에 저장하며 본인만 볼 수 있습니다. 대화는 여행마다 최근 200개까지 남고, 대화 지우기나 탈퇴로 지울 수 있습니다.',
```

56행 문장을 아래로 바꾼다.

```ts
        '탈퇴하면 서버에 남은 대화·문의와 이 기기에 남은 설정을 함께 지웁니다. 그 밖의 기기 기록은 브라우저 저장소를 비우거나 앱을 지우면 사라집니다.',
```

- [ ] **Step 3: 사용법 고치기**

`guide.ts`의 `key: 'chat'` 항목 `description`을 아래로 바꾼다.

```ts
    description: '여행 친구 펭이에게 물어보세요. 추천을 확인 카드로 보여 주고, 담을지는 직접 정해요. 대화는 다른 기기에서도 이어져요.',
```

- [ ] **Step 4: 기획안·DB·아키텍처 문서**

`docs/기획안-v0.1.md` 35절의 마지막 단락 뒤에:

```markdown
대화 기록은 서버에 저장하며 본인만 본다(2026-10-07). 같은 여행의 멤버라도 다른 사람의 대화는 보이지 않는다. 대화는 여행마다(여행 목록에서 연 대화는 하나) 최근 200개만 남고, 다른 기기에서 같은 계정으로 열면 이어서 보인다. 기기에 남아 있던 대화는 처음 열 때 서버로 옮기고 기기 사본을 지운다. 설계: `docs/superpowers/specs/2026-10-07-chat-history-server-design.md`, 변경: `openspec/changes/store-chat-history/`.
```

`docs/architecture/DATABASE.md`의 "공지·문의 (2026-10-01)" 절 앞에 새 절:

```markdown
### 채팅 기록 (2026-10-07)

`chat_messages`: 계정·메시지 id(기본 키 둘), 여행(목록 대화는 null)·역할·종류·본문(4000자)·부가 정보 `extra`(확인 카드 초안·칩·링크, 64KB)·메시지 시각. 본인 행만 읽는다. `authenticated`에는 `select`만 준다. 여행을 지우거나 탈퇴하면 함께 지워진다. 여행에서 나가도 본인 대화는 남는다.

| 함수 | 누가 | 하는 일 |
| --- | --- | --- |
| `append_chat_message(trip_id, message)` | 로그인한 사람, 여행 대화면 그 여행 멤버 | 한 줄을 남긴다. 같은 id는 무시. 그 대화의 최근 200줄 밖은 지운다 |
| `import_chat_threads(threads)` → 옮긴 줄 수 | 로그인한 사람 | 기기 기록 옮기기. 서버에 이미 있는 대화·남길 수 없는 여행·깨진 줄은 건너뛴다. 대화마다 최근 200줄, 전체 2MB |
| `clear_chat(trip_id)` | 본인 | 그 대화를 지운다 |

내부 도우미 `insert_chat_message`·`trim_chat_thread`·`can_chat_in`은 직접 부를 수 없다. 오류 코드: 형식·크기 `P0400`, 비로그인·멤버 아님 `42501`. 로컬 확인: `supabase/tests/chat-messages.local.sql`.
```

`docs/architecture/ARCHITECTURE.md`에서 `grep -n "대화 기록\|LocalChatHistory\|CHAT_HISTORY" docs/architecture/ARCHITECTURE.md`로 찾은 저장 위치 설명을 "실행 앱은 `SupabaseChatHistory`(서버, 본인만), 테스트 앱·미리보기는 `LocalChatHistory`(기기)"로 고친다. 찾은 곳이 없으면 상태 수명 표의 대화 항목에 같은 문장을 더한다.

- [ ] **Step 5: OpenSpec 변경 만들기**

`openspec/changes/store-chat-history/proposal.md`:

```markdown
# 채팅 기록 서버 저장

AI 대화를 기기 대신 서버에 남겨 기기를 바꿔도 이어서 보게 한다(2026-10-07 사용자 요청). 기획안 35절의 '대화는 기기에만 저장' 결정을 바꾼다.

## 범위

- 서버 표 `chat_messages`(본인만 읽기, 쓰기는 `append_chat_message`·`import_chat_threads`·`clear_chat`로만).
- 대화마다 최근 200줄. 여행 삭제·탈퇴 시 함께 삭제.
- 기기에 남은 대화를 처음 한 번 옮기고 기기 사본을 지운다. 서버에 같은 대화가 있으면 서버 쪽을 남긴다.
- 개인정보 처리방침·사용법 문장.

## 범위 밖

- 여행 멤버끼리 대화 공유, 대화 검색, 관리자 열람, 실시간 동기화.

설계: `docs/superpowers/specs/2026-10-07-chat-history-server-design.md`. 마이그레이션 `20261007100000_chat_messages.sql`.
```

`openspec/changes/store-chat-history/specs/chat-history/spec.md`:

```markdown
## ADDED Requirements

### Requirement: 대화 기록 서버 저장
시스템은 AI 대화의 각 말풍선을 서버에 남기고 본인에게만 보여야 한다(SHALL). 같은 여행의 다른 멤버에게 보여서는 안 된다(SHALL NOT).

#### Scenario: 다른 기기에서 이어 보기
- **WHEN** 같은 계정으로 다른 기기에서 같은 여행의 대화를 연다
- **THEN** 앞서 나눈 대화가 시간 순서대로 보인다

#### Scenario: 대화 길이 제한
- **WHEN** 한 대화가 200줄을 넘는다
- **THEN** 가장 오래된 줄부터 지워 최근 200줄만 남긴다

### Requirement: 기기 대화 옮기기
시스템은 기기에 남은 대화를 그 계정으로 처음 열 때 서버로 옮기고 기기 사본을 지워야 한다(SHALL).

#### Scenario: 서버에 이미 대화가 있음
- **WHEN** 같은 여행의 대화가 서버에 이미 있다
- **THEN** 그 여행의 기기 대화는 옮기지 않는다

#### Scenario: 옮기기 실패
- **WHEN** 네트워크 오류로 옮기기가 실패한다
- **THEN** 기기 사본을 남기고 다음에 앱을 열 때 다시 옮긴다
```

`openspec/changes/store-chat-history/tasks.md`:

```markdown
# 작업

- [x] 1. 설계 합의와 문서(2026-10-07)
- [ ] 2. `chat_messages` 표·함수와 로컬 SQL 테스트
- [ ] 3. 저장소 인터페이스 `append` 전환
- [ ] 4. `SupabaseChatHistory`와 기기 기록 옮기기
- [ ] 5. 실행 앱 연결
- [ ] 6. 처리방침·사용법·문서
- [ ] 7. 전체 검증(단위·e2e·빌드)
- [ ] 8. 원격 마이그레이션 적용과 배포(사용자 확인 후), 두 기기에서 이어 보기 확인
```

구현이 끝난 항목은 이 작업의 마지막에 `[x]`와 검증 결과로 고친다.

`docs/README.md`의 "## 챗봇 캐릭터" 목록 끝(`- [AI 없는 미배치 날짜 배정]` 줄 아래)에:

```markdown
- [채팅 기록 서버 저장](../openspec/changes/store-chat-history/proposal.md): 본인만 보는 서버 대화 기록과 기기 기록 옮기기. [설계](superpowers/specs/2026-10-07-chat-history-server-design.md).
```

- [ ] **Step 6: 사용법 캡처 다시 만들기**

Run: `cd app && npx playwright test --config=playwright.capture.config.ts`
Expected: 캡처 테스트 통과. 바뀐 이미지가 있으면 함께 커밋한다.

- [ ] **Step 7: 커밋**

문서·처방침·사용법은 성격이 달라 두 번에 나눈다.

```bash
git add app/src/app/features/support/model/policy.ts app/src/app/features/guide/model/guide.ts app/public
git commit -m "feat(app): 처리방침과 사용법에 대화 서버 저장을 알린다"
git add docs openspec/changes/store-chat-history
git commit -m "docs: 채팅 기록 서버 저장 기획·DB·OpenSpec 기록"
```

(`app/public`에 바뀐 캡처가 없으면 그 경로는 빼고 커밋한다. 캡처 위치는 `playwright.capture.config.ts`의 출력 경로를 확인한다.)

---

### Task 6: 전체 검증

- [ ] **Step 1: 단위·경계·빌드**

Run: `cd app && npx vitest run && npm run lint && npx ng build`
Expected: 모두 통과.

- [ ] **Step 2: e2e**

Run: `cd app && npx playwright test --workers=2`
Expected: 대화 관련 e2e(`travel-chat.spec.ts`·`penguin-mascot.spec.ts`)를 포함해 통과. `itinerary-export.spec.ts`가 동시 실행 때 실패하면 그 파일만 단독으로 다시 돌려 통과하는지 확인한다(기존 불안정 테스트).

- [ ] **Step 3: SQL 테스트 다시 확인**

Task 1 Step 4의 명령으로 `chat-messages.local.sql`을 다시 돌린다. 기존 `trip-members.local.sql`도 돌려 여행 멤버 동작이 그대로인지 확인한다.

- [ ] **Step 4: OpenSpec 작업 표시**

`openspec/changes/store-chat-history/tasks.md`의 2~7을 `[x]`로 바꾸고 각 줄 끝에 실제 결과(예: "단위 N개 통과, e2e N개 통과")를 적는다. 8은 원격 적용 전이므로 그대로 둔다.

```bash
git add openspec/changes/store-chat-history/tasks.md
git commit -m "docs: 채팅 기록 서버 저장 검증 결과 기록"
```

- [ ] **Step 5: 원격 적용은 멈추고 확인받기**

원격 마이그레이션(`20261007000000_support_hardening.sql`, `20261007100000_chat_messages.sql`) 적용과 배포는 사용자 확인을 받은 뒤에 한다. 적용 순서는 DB 먼저, 프론트엔드 배포 다음이다. 프론트가 먼저 나가면 서버 함수가 없어 대화 저장이 실패한다(대화는 막히지 않는다).
