# 사용자별 AI 사용 횟수 제한 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 일정 짜기·챗봇·영수증 인식을 사용자마다 하루 5·30·10회로 제한하고, 내 한도 초과와 앱 전체 무료 한도 소진을 구분해 알린다.

**Architecture:** Supabase에 `ai_usage`·`ai_quota_overrides` 표와 service_role 전용 `consume_ai_quota`/`refund_ai_quota` 함수를 둔다. 세 Edge Function handler는 입력 검증 뒤 한 번을 차감하고, 모델이 실패하면 되돌리며, 성공 응답에 남은 횟수를 싣는다. 앱은 새 오류 코드를 문장으로 바꾸고, 남은 횟수가 3 이하일 때 기능 근처에 보인다.

**Tech Stack:** PostgreSQL 17(plpgsql), Supabase Edge Functions(Deno), Angular 21 zoneless + signals, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-ai-usage-limit-design.md`

## Global Constraints

- 한도: `plan` 5, `chat` 30, `receipt` 10. 환경변수 `AI_LIMIT_PLAN`·`AI_LIMIT_CHAT`·`AI_LIMIT_RECEIPT`가 0 이상의 정수면 덮는다.
- 날짜 경계: `(now() at time zone 'Asia/Seoul')::date`.
- `kind`는 `'plan' | 'chat' | 'receipt'`만.
- 두 표는 RLS를 켜고 `anon`·`authenticated`에 아무 권한도 주지 않는다. 두 함수는 `security definer`, `set search_path = ''`, 실행 권한은 `service_role`에만.
- 내 한도 초과: HTTP 429 `{ error: 'user_limit', limit }`. 앱 전체 한도: HTTP 429 `{ error: 'quota_exceeded' }`. 한도 확인 자체가 실패: HTTP 503 `{ error: 'server_unavailable' }`.
- 문구(그대로 쓴다):
  - `user_limit`: `오늘 {기능}{을/를} {limit}번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.` 기능 표기: plan `AI 일정 만들기를`, chat `챗봇 질문을`, receipt `사진 읽기를`.
  - `quota_exceeded`: `오늘 AI 무료 사용량이 모두 소진됐어요. 오후 5시쯤 다시 쓸 수 있어요.` (영수증은 뒤에 ` 지금은 직접 입력해 주세요.`를 붙인다)
  - 남은 횟수(3 이하일 때만): `오늘 {n}번 남음`
- 커밋 메시지는 CLAUDE.md 규칙(`type(scope): 제목`, 한국어 본문, `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`).
- 원격 DB 적용·함수 배포는 사용자 확인 뒤(Task 8).

## Review Focus

1. **마지막 한 번을 두 요청이 동시에 쓰는 경우:** 하나만 성공하고 하나는 `user_limit`. → `consume_ai_quota`를 `insert … on conflict do update … where count < limit returning` 한 문장으로 쓴다(Task 1). 로컬 검사는 순차만 확인하므로 리뷰에서 문장 구조를 본다.
2. **모델이 실패했는데 횟수가 줄어드는 경우:** 되돌려야 한다. → Task 3·4·5의 되돌림 테스트.
3. **잘못된 입력·너무 큰 사진으로 횟수가 줄어드는 경우:** 줄지 않아야 한다. → Task 3·4·5의 입력 오류 테스트.
4. **예외 한도 0인 사용자:** 첫 요청부터 막힌다. → Task 1 SQL 검사.
5. **서버가 한도를 환경변수로 바꿨는데 앱 문구가 옛 숫자를 쓰는 경우:** 문구는 응답의 `limit`을 쓴다. → Task 6 제공자 테스트.

---

## 파일 구조

- Create `supabase/migrations/20260929000004_ai_usage.sql` — 표·함수·권한.
- Create `supabase/tests/ai-usage.local.sql` — 로컬 PostgreSQL 검사.
- Create `supabase/functions/_shared/quota.ts` — `UserLimitError`, `quotaDeps`, `limitFromEnv`. 세 함수가 공유한다.
- Modify `supabase/functions/{ai-plan,ai-chat,receipt-scan}/handler.ts` — deps에 `consumeQuota`/`refundQuota`, 흐름·오류.
- Modify `supabase/functions/{ai-plan,ai-chat,receipt-scan}/index.ts` — `quotaDeps(admin, kind, limitFromEnv(...))`.
- Create `app/src/app/core/ai-quota.ts` — 남은 횟수 신호, 문구 함수.
- Modify `app/src/app/features/auth/data/auth-store.ts` — `callFunction`이 오류 본문을 담은 `FunctionError`를 던진다.
- Create `app/src/app/features/auth/data/function-error.ts`.
- Modify 세 제공자와 세 화면(`ai-plan-flow.html`, `chat-thread`, `receipt-scan.html`).

---

### Task 1: DB 표와 한도 함수

**Files:**
- Create: `supabase/migrations/20260929000004_ai_usage.sql`
- Create: `supabase/tests/ai-usage.local.sql`

**Interfaces:**
- Produces: `consume_ai_quota(p_user uuid, p_kind text, p_default_limit integer) returns integer`(남은 횟수, 초과 시 SQLSTATE `P0429`, detail = 적용 한도), `refund_ai_quota(p_user uuid, p_kind text) returns void`.

- [ ] **Step 1: 로컬 검사 작성**

`supabase/tests/ai-usage.local.sql`:

```sql
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
```

- [ ] **Step 2: 실패 확인**

Run:
```bash
P="/c/Program Files/PostgreSQL/17/bin/psql.exe"; export PGPASSWORD=postgres
"$P" -U postgres -h localhost -q -c "drop database if exists tc_check" -c "create database tc_check"
"$P" -U postgres -h localhost -d tc_check -f supabase/tests/ai-usage.local.sql 2>&1 | tail -3
```
Expected: `No such file or directory` (마이그레이션 없음).

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/20260929000004_ai_usage.sql`:

```sql
-- 사용자별 AI 하루 사용 횟수(2026-09-29).
-- 앱 전체가 Gemini 무료 한도(하루 500회)를 나눠 쓰므로 사용자마다 기능별 한도를 둔다.
-- 서버 함수만 세고 읽는다. 사용자는 표와 함수에 접근하지 못한다.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('plan', 'chat', 'receipt')),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

-- 특정 사용자의 한도를 바꿀 때 관리자가 SQL로 넣는다.
create table public.ai_quota_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('plan', 'chat', 'receipt')),
  daily_limit integer not null check (daily_limit >= 0),
  primary key (user_id, kind)
);

alter table public.ai_usage enable row level security;
alter table public.ai_quota_overrides enable row level security;
revoke all on public.ai_usage, public.ai_quota_overrides from public, anon, authenticated;

-- 오늘(한국 시간) 횟수를 하나 올리고 남은 횟수를 돌려준다.
-- 한도에 닿았으면 올리지 않고 P0429로 거절한다. 한 문장으로 올려
-- 동시에 마지막 한 번을 써도 한도를 넘지 않는다.
create function public.consume_ai_quota(p_user uuid, p_kind text, p_default_limit integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_limit integer;
  v_count integer;
begin
  select daily_limit into v_limit
    from public.ai_quota_overrides where user_id = p_user and kind = p_kind;
  v_limit := coalesce(v_limit, p_default_limit);
  insert into public.ai_usage as u (user_id, day, kind, count)
    select p_user, v_day, p_kind, 1 where v_limit > 0
  on conflict (user_id, day, kind) do update set count = u.count + 1 where u.count < v_limit
  returning u.count into v_count;
  if v_count is null then
    raise exception 'user_limit' using errcode = 'P0429', detail = v_limit::text;
  end if;
  return v_limit - v_count;
end;
$$;

-- 모델 호출이 실패했을 때 오늘 횟수를 하나 내린다. 0 아래로는 내리지 않는다.
create function public.refund_ai_quota(p_user uuid, p_kind text)
returns void
language sql security definer set search_path = '' as $$
  update public.ai_usage set count = count - 1
   where user_id = p_user and kind = p_kind
     and day = (now() at time zone 'Asia/Seoul')::date and count > 0;
$$;

revoke execute on function public.consume_ai_quota(uuid, text, integer), public.refund_ai_quota(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer), public.refund_ai_quota(uuid, text)
  to service_role;
```

- [ ] **Step 4: 통과 확인**

Step 2의 명령을 `| grep -E "left|user_limit|오류|ERROR|rows|denied|check" -A2` 로 다시 실행한다.
Expected:
- `A plan 1` 1, `A plan 2` 0, `A plan 3` `user_limit` 오류, `B plan 1` 1, `A chat 1` 1, refund 뒤 `A plan` 0.
- `A receipt today` 9(어제 9회는 오늘과 따로), `B plan override 0` `user_limit`, `A chat override 5` 4(되돌림 두 번 뒤에도 0 아래로 안 가서 1회 사용 → 한도 5에서 4).
- `bad kind` check 위반, `rows`에서 A chat count 1·A plan 2·A receipt 오늘 1·어제 9·B plan 1.
- `auth consume`·`auth read`·`anon refund` 모두 권한 거절.

그 뒤 `"$P" -U postgres -h localhost -q -c "drop database tc_check"`.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20260929000004_ai_usage.sql supabase/tests/ai-usage.local.sql
git commit -m "feat(app): AI 사용 횟수 표와 한도 함수를 추가한다" -m "사용자·날짜(한국 시간)·기능별 횟수를 서버에서만 세고, 한도에 닿으면 P0429로 거절한다. 예외 한도 표와 되돌리기 함수를 함께 둔다.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 서버 공용 한도 모듈

**Files:**
- Create: `supabase/functions/_shared/quota.ts`
- Test: `app/src/app/features/ai-planning/data/ai-quota-server.spec.ts`

**Interfaces:**
- Consumes: Task 1의 RPC 이름·인자·`P0429`/detail.
- Produces:
  - `type AiKind = 'plan' | 'chat' | 'receipt'`
  - `class UserLimitError extends Error { readonly limit: number }` (message `'user_limit'`)
  - `quotaDeps(client: RpcClient, kind: AiKind, defaultLimit: number): { consumeQuota(userId: string): Promise<number>; refundQuota(userId: string): Promise<void> }` — RPC 오류가 `P0429`가 아니면 `Error('quota_check_failed')`.
  - `limitFromEnv(value: string | undefined, fallback: number): number`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  limitFromEnv,
  quotaDeps,
  UserLimitError,
} from '../../../../../../supabase/functions/_shared/quota';

function client(result: { data: unknown; error: { code?: string; details?: string } | null }) {
  return { rpc: vi.fn(async () => result) };
}

describe('quotaDeps', () => {
  it('남은 횟수를 돌려주고 기능·기본 한도를 함께 보낸다', async () => {
    const c = client({ data: 4, error: null });
    expect(await quotaDeps(c, 'plan', 5).consumeQuota('u1')).toBe(4);
    expect(c.rpc).toHaveBeenCalledWith('consume_ai_quota', { p_user: 'u1', p_kind: 'plan', p_default_limit: 5 });
  });

  it('P0429면 서버가 적용한 한도를 담아 UserLimitError를 던진다', async () => {
    const c = client({ data: null, error: { code: 'P0429', details: '7' } });
    const error = await quotaDeps(c, 'chat', 30).consumeQuota('u1').catch((e) => e);
    expect(error).toBeInstanceOf(UserLimitError);
    expect(error.message).toBe('user_limit');
    expect(error.limit).toBe(7);
  });

  it('그 밖의 오류는 quota_check_failed', async () => {
    const c = client({ data: null, error: { code: '42501' } });
    await expect(quotaDeps(c, 'receipt', 10).consumeQuota('u1')).rejects.toThrow('quota_check_failed');
  });

  it('되돌리기는 refund_ai_quota를 부른다', async () => {
    const c = client({ data: null, error: null });
    await quotaDeps(c, 'receipt', 10).refundQuota('u1');
    expect(c.rpc).toHaveBeenCalledWith('refund_ai_quota', { p_user: 'u1', p_kind: 'receipt' });
  });
});

describe('limitFromEnv', () => {
  it('0 이상의 정수만 받고 아니면 기본값', () => {
    expect(limitFromEnv('12', 5)).toBe(12);
    expect(limitFromEnv('0', 5)).toBe(0);
    expect(limitFromEnv(undefined, 5)).toBe(5);
    expect(limitFromEnv('', 5)).toBe(5);
    expect(limitFromEnv('-1', 5)).toBe(5);
    expect(limitFromEnv('2.5', 5)).toBe(5);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/features/ai-planning/data/ai-quota-server.spec.ts`
Expected: FAIL `Cannot find module '…/_shared/quota'`

- [ ] **Step 3: 구현**

`supabase/functions/_shared/quota.ts`:

```ts
/**
 * AI 서버 함수가 함께 쓰는 사용자별 하루 한도.
 * 표와 함수는 service_role만 쓸 수 있어, 서버 함수의 관리 클라이언트로 부른다.
 */
export type AiKind = 'plan' | 'chat' | 'receipt';

/** 오늘 이 기능을 한도만큼 썼다. limit은 서버가 실제로 적용한 한도다. */
export class UserLimitError extends Error {
  constructor(readonly limit: number) {
    super('user_limit');
  }
}

interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string; details?: string } | null }>;
}

export function quotaDeps(client: RpcClient, kind: AiKind, defaultLimit: number) {
  return {
    /** 한 번을 차감하고 남은 횟수를 돌려준다. */
    async consumeQuota(userId: string): Promise<number> {
      const { data, error } = await client.rpc('consume_ai_quota', {
        p_user: userId,
        p_kind: kind,
        p_default_limit: defaultLimit,
      });
      if (error?.code === 'P0429') throw new UserLimitError(Number(error.details) || defaultLimit);
      if (error) throw new Error('quota_check_failed');
      return Number(data);
    },
    /** 모델 호출이 실패했을 때 차감한 한 번을 돌려준다. */
    async refundQuota(userId: string): Promise<void> {
      await client.rpc('refund_ai_quota', { p_user: userId, p_kind: kind });
    },
  };
}

/** 환경변수의 한도. 0 이상의 정수가 아니면 기본값을 쓴다. */
export function limitFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}
```

- [ ] **Step 4: 통과 확인** — 같은 명령. Expected: 5 passed.

- [ ] **Step 5: 커밋**

```bash
git add supabase/functions/_shared/quota.ts app/src/app/features/ai-planning/data/ai-quota-server.spec.ts
git commit -m "feat(app): AI 서버 함수의 공용 한도 모듈을 둔다" -m "한도 함수 호출, 한도 초과 오류(적용 한도 포함), 환경변수 한도 읽기를 한곳에 둔다.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: ai-plan에 한도 적용

**Files:**
- Modify: `supabase/functions/ai-plan/handler.ts`
- Modify: `supabase/functions/ai-plan/index.ts`
- Test: `app/src/app/features/ai-planning/data/ai-plan-handler.spec.ts`

**Interfaces:**
- Consumes: Task 2 `quotaDeps`, `limitFromEnv`, `UserLimitError`.
- Produces: `AiPlanDeps`에 `consumeQuota(userId: string): Promise<number>; refundQuota(userId: string): Promise<void>`. 200 본문 `{ content, remaining }`, 429 `{ error: 'user_limit', limit }`, 503 `{ error: 'server_unavailable' }`.

- [ ] **Step 1: 실패하는 테스트**

`setup()`에 한도 가짜를 넣는다(기존 테스트가 계속 돌도록 기본값은 성공):

```ts
function setup(
  overrides: {
    getUser?: (token: string) => Promise<{ id: string } | null>;
    callModel?: (prompt: { system: string; user: string }) => Promise<string>;
    consumeQuota?: (userId: string) => Promise<number>;
  } = {},
) {
  const callModel = overrides.callModel ?? vi.fn(async () => JSON.stringify({ items: [] }));
  const consumeQuota = vi.fn(overrides.consumeQuota ?? (async () => 4));
  const refundQuota = vi.fn(async () => {});
  return {
    callModel,
    consumeQuota,
    refundQuota,
    handler: createAiPlanHandler({
      getUser: overrides.getUser ?? (async () => ({ id: 'u1' })),
      callModel,
      consumeQuota,
      refundQuota,
    }),
  };
}
```

파일 끝 `describe` 안에 추가:

```ts
  it('성공하면 한 번을 차감하고 남은 횟수를 함께 돌려준다', async () => {
    const { handler, consumeQuota } = setup();
    const res = await handler(post(BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).remaining).toBe(4);
    expect(consumeQuota).toHaveBeenCalledWith('u1');
  });

  it('내 한도를 넘으면 모델을 부르지 않고 429 user_limit과 한도를 돌려준다', async () => {
    const { handler, callModel } = setup({
      consumeQuota: async () => {
        throw new UserLimitError(5);
      },
    });
    const res = await handler(post(BODY));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'user_limit', limit: 5 });
    expect(callModel).not.toHaveBeenCalled();
  });

  it('입력이 잘못되면 차감하지 않는다', async () => {
    const { handler, consumeQuota } = setup();
    expect((await handler(post({ ...BODY, regions: [] }))).status).toBe(400);
    expect(consumeQuota).not.toHaveBeenCalled();
  });

  it('모델이 실패하면 차감한 한 번을 되돌린다', async () => {
    for (const message of ['quota_exceeded', 'model_error_500']) {
      const { handler, refundQuota } = setup({
        callModel: async () => {
          throw new Error(message);
        },
      });
      await handler(post(BODY));
      expect(refundQuota).toHaveBeenCalledWith('u1');
    }
  });

  it('한도 확인이 실패하면 503 server_unavailable이고 모델을 부르지 않는다', async () => {
    const { handler, callModel, refundQuota } = setup({
      consumeQuota: async () => {
        throw new Error('quota_check_failed');
      },
    });
    const res = await handler(post(BODY));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'server_unavailable' });
    expect(callModel).not.toHaveBeenCalled();
    expect(refundQuota).not.toHaveBeenCalled();
  });
```

import에 `import { UserLimitError } from '../../../../../../supabase/functions/_shared/quota';` 추가.

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/features/ai-planning/data/ai-plan-handler.spec.ts`
Expected: 새 테스트 5개 FAIL(`remaining` undefined, 429 대신 500 등).

- [ ] **Step 3: handler 구현**

`AiPlanDeps`에 추가:

```ts
  /** 오늘 한 번을 차감하고 남은 횟수를 돌려준다. 한도를 넘으면 UserLimitError. */
  consumeQuota(userId: string): Promise<number>;
  /** 모델 호출이 실패했을 때 차감한 한 번을 돌려준다. */
  refundQuota(userId: string): Promise<void>;
```

`try` 블록의 입력 검증 뒤를 바꾼다:

```ts
      const input = validate(body);
      if (!input) return reply(400, { error: 'invalid_request' });

      // 검증을 통과한 요청만 센다. 모델이 실패하면 되돌려 실패한 요청은 세지 않는다.
      const remaining = await deps.consumeQuota(user.id);
      let content: string;
      try {
        content = await deps.callModel({ system: SYSTEM_PROMPT, user: buildUserPrompt(input) });
      } catch (error) {
        await deps.refundQuota(user.id).catch(() => {});
        throw error;
      }
      return reply(200, { content, remaining });
    } catch (error) {
      if (error instanceof UserLimitError)
        return reply(429, { error: 'user_limit', limit: error.limit });
      if (error instanceof Error && error.message === 'quota_check_failed')
        return reply(503, { error: 'server_unavailable' });
      // 하루 한도 초과는 사용자가 할 수 있는 일이 다르므로 따로 알린다.
      if (error instanceof Error && error.message === 'quota_exceeded')
        return reply(429, { error: 'quota_exceeded' });
      return reply(500, { error: 'generation_failed' });
    }
```

파일 맨 위에 `import { UserLimitError } from '../_shared/quota.ts';`.

- [ ] **Step 4: index 연결**

`supabase/functions/ai-plan/index.ts`: import에 `import { limitFromEnv, quotaDeps } from '../_shared/quota.ts';`를 더하고, `createAiPlanHandler({` 안 `getUser` 앞에 한 줄을 넣는다.

```ts
    ...quotaDeps(admin, 'plan', limitFromEnv(Deno.env.get('AI_LIMIT_PLAN'), 5)),
```

- [ ] **Step 5: 통과 확인** — Step 2 명령. Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add supabase/functions/ai-plan app/src/app/features/ai-planning/data/ai-plan-handler.spec.ts
git commit -m "feat(app): AI 일정 만들기에 사용자별 하루 한도를 건다" -m "입력 검증 뒤 한 번을 차감하고, 모델이 실패하면 되돌린다. 한도를 넘으면 429 user_limit과 한도를, 성공하면 남은 횟수를 돌려준다.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ai-chat에 한도 적용

**Files:**
- Modify: `supabase/functions/ai-chat/handler.ts`
- Modify: `supabase/functions/ai-chat/index.ts`
- Test: `app/src/app/features/travel-chat/data/ai-chat-handler.spec.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: `ChatDeps`에 `consumeQuota`/`refundQuota`(Task 3과 같은 시그니처). 200 `{ content, remaining }`, 429 `user_limit`+`limit`, 503 `server_unavailable`.

- [ ] **Step 1: 실패하는 테스트**

기존 테스트의 `createAiChatHandler({getUser…,callModel})` 호출 세 곳은 한도 가짜가 없으면 타입 오류가 나므로, 파일 위에 도우미를 두고 모두 이것으로 바꾼다:

```ts
import { UserLimitError } from '../../../../../../supabase/functions/_shared/quota';
const quota = (consume: () => Promise<number> = async () => 29) => ({
  consumeQuota: vi.fn(consume),
  refundQuota: vi.fn(async () => {}),
});
```

기존 호출 예: `createAiChatHandler({getUser:async()=>({id:'u'}),callModel,...quota()})`.

새 테스트:

```ts
  it('counts one use after validation and returns what is left', async () => {
    const q = quota();
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel:async()=>JSON.stringify({kind:'explore',text:'어디로 갈까요?'}),...q});
    expect((await handler(post({...body,input:''}))).status).toBe(400);
    expect(q.consumeQuota).not.toHaveBeenCalled();
    const ok = await handler(post(body));
    expect((await ok.json()).remaining).toBe(29);
    expect(q.consumeQuota).toHaveBeenCalledWith('u');
  });
  it('refuses over the personal limit without calling the model', async () => {
    const callModel = vi.fn(async ()=>'{}');
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel,...quota(async()=>{throw new UserLimitError(30);})});
    const res = await handler(post(body));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({error:'user_limit',limit:30});
    expect(callModel).not.toHaveBeenCalled();
  });
  it('refunds when the model fails or returns unusable output', async () => {
    for (const callModel of [async()=>{throw new Error('quota_exceeded');}, async()=>'not json']) {
      const q = quota();
      await createAiChatHandler({getUser:async()=>({id:'u'}),callModel,...q})(post(body));
      expect(q.refundQuota).toHaveBeenCalledWith('u');
    }
  });
  it('fails closed when the quota check fails', async () => {
    const callModel = vi.fn(async ()=>'{}');
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel,...quota(async()=>{throw new Error('quota_check_failed');})});
    const res = await handler(post(body));
    expect(res.status).toBe(503);
    expect(callModel).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/features/travel-chat/data/ai-chat-handler.spec.ts`
Expected: 새 테스트 4개 FAIL.

- [ ] **Step 3: handler 구현**

`ChatDeps`에 `consumeQuota(userId: string): Promise<number>; refundQuota(userId: string): Promise<void>;`를 더하고, import에 `import { UserLimitError } from '../_shared/quota.ts';`.

`try` 블록을 바꾼다(사용자 id가 필요하므로 `getUser` 결과를 담는다):

```ts
    try {
      const user = await deps.getUser(token);
      if (!user) return reply(401,{error:'authentication_required'});
      const raw = await request.text();
      if (raw.length > 80000) return reply(400,{error:'invalid_request'});
      let input: object | null;
      try { input = validate(JSON.parse(raw)); } catch { input = null; }
      if (!input) return reply(400,{error:'invalid_request'});
      // 검증을 통과한 질문만 센다. 모델이 실패하거나 쓸 수 없는 답을 주면 되돌린다.
      const remaining = await deps.consumeQuota(user.id);
      let result;
      try {
        result = normalizeChatResponse(await deps.callModel({system:SYSTEM_PROMPT,user:JSON.stringify(input)}));
      } catch (error) {
        await deps.refundQuota(user.id).catch(()=>{});
        throw error;
      }
      return reply(200,{content:JSON.stringify(result),remaining});
    } catch (error) {
      if (error instanceof UserLimitError) return reply(429,{error:'user_limit',limit:error.limit});
      const code = error instanceof Error ? error.message : '';
      if (code === 'quota_check_failed') return reply(503,{error:'server_unavailable'});
      if (code === 'quota_exceeded') return reply(429,{error:code});
      if (code === 'server_unavailable') return reply(503,{error:code});
      if (code === 'model_timeout') return reply(504,{error:code});
      return reply(502,{error:'generation_failed'});
    }
```

- [ ] **Step 4: index 연결**

`supabase/functions/ai-chat/index.ts`: `import { limitFromEnv, quotaDeps } from '../_shared/quota.ts';`를 더하고 `createAiChatHandler({` 바로 뒤에:

```ts
  ...quotaDeps(admin,'chat',limitFromEnv(Deno.env.get('AI_LIMIT_CHAT'),30)),
```

- [ ] **Step 5: 통과 확인** — Step 2 명령. Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add supabase/functions/ai-chat app/src/app/features/travel-chat/data/ai-chat-handler.spec.ts
git commit -m "feat(app): 챗봇 질문에 사용자별 하루 한도를 건다" -m "검증을 통과한 질문만 세고, 모델이 실패하거나 쓸 수 없는 답을 주면 되돌린다.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: receipt-scan에 한도 적용

**Files:**
- Modify: `supabase/functions/receipt-scan/handler.ts`
- Modify: `supabase/functions/receipt-scan/index.ts`
- Test: `app/src/app/features/expenses/data/receipt-scan-handler.spec.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: `ReceiptScanDeps`에 `consumeQuota`/`refundQuota`. 200 `{ content, remaining }`, 429 `user_limit`+`limit`, 503 `server_unavailable`.

- [ ] **Step 1: 실패하는 테스트**

`setup()`을 Task 3과 같은 방식으로 바꾼다:

```ts
function setup(
  overrides: {
    getUser?: (token: string) => Promise<{ id: string } | null>;
    callModel?: (r: { system: string; image: string; mimeType: string }) => Promise<string>;
    consumeQuota?: (userId: string) => Promise<number>;
  } = {},
) {
  const callModel = overrides.callModel ?? vi.fn(async () => '{"store":"","total":0,"items":[]}');
  const consumeQuota = vi.fn(overrides.consumeQuota ?? (async () => 9));
  const refundQuota = vi.fn(async () => {});
  return {
    callModel,
    consumeQuota,
    refundQuota,
    handler: createReceiptScanHandler({
      getUser: overrides.getUser ?? (async () => ({ id: 'u1' })),
      callModel,
      consumeQuota,
      refundQuota,
    }),
  };
}
```

새 테스트(import에 `UserLimitError` 추가):

```ts
  it('성공하면 차감하고 남은 횟수를 돌려준다', async () => {
    const { handler, consumeQuota } = setup();
    const res = await handler(post(BODY));
    expect((await res.json()).remaining).toBe(9);
    expect(consumeQuota).toHaveBeenCalledWith('u1');
  });

  it('너무 큰 사진·잘못된 형식은 차감하지 않는다', async () => {
    const { handler, consumeQuota } = setup();
    expect((await handler(post({ ...BODY, image: 'A'.repeat(MAX_IMAGE_CHARS + 1) }))).status).toBe(413);
    expect((await handler(post({ ...BODY, mimeType: 'image/gif' }))).status).toBe(400);
    expect(consumeQuota).not.toHaveBeenCalled();
  });

  it('내 한도를 넘으면 사진을 읽지 않고 429 user_limit', async () => {
    const { handler, callModel } = setup({
      consumeQuota: async () => {
        throw new UserLimitError(10);
      },
    });
    const res = await handler(post(BODY));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'user_limit', limit: 10 });
    expect(callModel).not.toHaveBeenCalled();
  });

  it('모델이 실패하면 되돌린다', async () => {
    const { handler, refundQuota } = setup({
      callModel: async () => {
        throw new Error('quota_exceeded');
      },
    });
    expect((await handler(post(BODY))).status).toBe(429);
    expect(refundQuota).toHaveBeenCalledWith('u1');
  });

  it('한도 확인이 실패하면 503', async () => {
    const { handler, callModel } = setup({
      consumeQuota: async () => {
        throw new Error('quota_check_failed');
      },
    });
    expect((await handler(post(BODY))).status).toBe(503);
    expect(callModel).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/features/expenses/data/receipt-scan-handler.spec.ts`
Expected: 새 테스트 FAIL.

- [ ] **Step 3: handler 구현**

`ReceiptScanDeps`에 `consumeQuota(userId: string): Promise<number>; refundQuota(userId: string): Promise<void>;`, import `import { UserLimitError } from '../_shared/quota.ts';`. 검증 뒤를 바꾼다:

```ts
      const input = validate(body);
      if (!input) return reply(400, { error: 'invalid_request' });

      // 검증을 통과한 사진만 센다. 모델이 실패하면 되돌린다.
      const remaining = await deps.consumeQuota(user.id);
      let content: string;
      try {
        content = await deps.callModel({
          system: systemPrompt(input.highlighted),
          image: input.image,
          mimeType: input.mimeType,
        });
      } catch (error) {
        await deps.refundQuota(user.id).catch(() => {});
        throw error;
      }
      return reply(200, { content, remaining });
    } catch (error) {
      if (error instanceof UserLimitError)
        return reply(429, { error: 'user_limit', limit: error.limit });
      if (error instanceof Error && error.message === 'quota_check_failed')
        return reply(503, { error: 'server_unavailable' });
      if (error instanceof Error && error.message === 'quota_exceeded')
        return reply(429, { error: 'quota_exceeded' });
      return reply(500, { error: 'scan_failed' });
    }
```

- [ ] **Step 4: index 연결**

`supabase/functions/receipt-scan/index.ts`: import `limitFromEnv, quotaDeps`, `createReceiptScanHandler({` 뒤에:

```ts
    ...quotaDeps(admin, 'receipt', limitFromEnv(Deno.env.get('AI_LIMIT_RECEIPT'), 10)),
```

- [ ] **Step 5: 통과 확인** — Step 2 명령. Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add supabase/functions/receipt-scan app/src/app/features/expenses/data/receipt-scan-handler.spec.ts
git commit -m "feat(app): 사진 읽기에 사용자별 하루 한도를 건다" -m "검증을 통과한 사진만 세고 모델이 실패하면 되돌린다.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 앱의 오류 문구와 남은 횟수 신호

**Files:**
- Create: `app/src/app/features/auth/data/function-error.ts`
- Modify: `app/src/app/features/auth/data/auth-store.ts:265-277`
- Create: `app/src/app/core/ai-quota.ts`, `app/src/app/core/ai-quota.spec.ts`
- Modify: `app/src/app/features/ai-planning/data/edge-ai-provider.ts`, `app/src/app/features/travel-chat/data/edge-chat-provider.ts`, `app/src/app/features/expenses/data/edge-receipt-scanner.ts`
- Test: 세 제공자의 기존 spec(`edge-ai-provider.spec.ts`, `edge-chat-provider.spec.ts`)과 새 `edge-receipt-scanner.spec.ts`

**Interfaces:**
- Produces:
  - `class FunctionError extends Error { readonly body: Record<string, unknown> }` (message = 서버 오류 코드)
  - `AiQuota`(root 서비스): `readonly remaining: Signal<Partial<Record<AiKind, number>>>`, `record(kind: AiKind, remaining: unknown): void`, `hint(kind: AiKind): Signal<string | null>`
  - `aiLimitMessage(kind: AiKind, error: unknown): string | null` — `user_limit`·`quota_exceeded`이면 문장, 아니면 null.
  - 앱 쪽 `AiKind` 타입은 `core/ai-quota.ts`에 따로 둔다(서버 모듈을 앱 코드가 import하지 않는다).

- [ ] **Step 1: 실패하는 테스트 — 문구와 신호**

`app/src/app/core/ai-quota.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AiQuota, aiLimitMessage } from './ai-quota';
import { FunctionError } from '../features/auth/data/function-error';

describe('aiLimitMessage', () => {
  it('내 한도는 서버가 알려 준 한도로 문장을 만든다', () => {
    expect(aiLimitMessage('plan', new FunctionError('user_limit', { error: 'user_limit', limit: 7 }))).toBe(
      '오늘 AI 일정 만들기를 7번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.',
    );
    expect(aiLimitMessage('chat', new FunctionError('user_limit', { limit: 30 }))).toBe(
      '오늘 챗봇 질문을 30번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.',
    );
  });

  it('앱 전체 무료 한도는 초기화 시각을 알린다', () => {
    expect(aiLimitMessage('plan', new Error('quota_exceeded'))).toBe(
      '오늘 AI 무료 사용량이 모두 소진됐어요. 오후 5시쯤 다시 쓸 수 있어요.',
    );
    expect(aiLimitMessage('receipt', new Error('quota_exceeded'))).toBe(
      '오늘 AI 무료 사용량이 모두 소진됐어요. 오후 5시쯤 다시 쓸 수 있어요. 지금은 직접 입력해 주세요.',
    );
  });

  it('한도와 관계없는 오류는 null', () => {
    expect(aiLimitMessage('plan', new Error('invalid_request'))).toBeNull();
  });
});

describe('AiQuota', () => {
  it('남은 횟수가 3 이하일 때만 안내를 만든다', () => {
    const quota = new AiQuota();
    const hint = quota.hint('receipt');
    expect(hint()).toBeNull();
    quota.record('receipt', 4);
    expect(hint()).toBeNull();
    quota.record('receipt', 3);
    expect(hint()).toBe('오늘 3번 남음');
    quota.record('receipt', 'x');
    expect(hint()).toBe('오늘 3번 남음');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/core/ai-quota.spec.ts`
Expected: FAIL `Cannot find module './ai-quota'`.

- [ ] **Step 3: 구현**

`app/src/app/features/auth/data/function-error.ts`:

```ts
/** 서버 함수가 돌려준 오류. message는 서버가 정한 코드, body는 응답 본문 전체다. */
export class FunctionError extends Error {
  constructor(
    code: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
```

`auth-store.ts`의 `callFunction`에서 `if (parsed?.error) throw new Error(parsed.error);`를 다음으로 바꾸고 import한다:

```ts
      const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (typeof parsed?.['error'] === 'string') throw new FunctionError(parsed['error'], parsed);
```

`app/src/app/core/ai-quota.ts`:

```ts
import { computed, Injectable, signal, type Signal } from '@angular/core';

export type AiKind = 'plan' | 'chat' | 'receipt';

const LABEL: Record<AiKind, string> = {
  plan: 'AI 일정 만들기를',
  chat: '챗봇 질문을',
  receipt: '사진 읽기를',
};

/**
 * 서버가 알려 준 오늘 남은 AI 사용 횟수. 기능 근처에 거의 다 썼을 때만 보인다.
 * 서버가 한도를 정하므로 앱은 숫자를 가정하지 않고 응답을 그대로 쓴다.
 */
@Injectable({ providedIn: 'root' })
export class AiQuota {
  private readonly left = signal<Partial<Record<AiKind, number>>>({});
  readonly remaining = this.left.asReadonly();

  record(kind: AiKind, remaining: unknown): void {
    if (typeof remaining !== 'number' || !Number.isInteger(remaining) || remaining < 0) return;
    this.left.update((all) => ({ ...all, [kind]: remaining }));
  }

  hint(kind: AiKind): Signal<string | null> {
    return computed(() => {
      const n = this.left()[kind];
      return n !== undefined && n <= 3 ? `오늘 ${n}번 남음` : null;
    });
  }
}

/** 한도 오류를 사용자가 읽을 문장으로. 한도와 관계없는 오류는 null. */
export function aiLimitMessage(kind: AiKind, error: unknown): string | null {
  const code = error instanceof Error ? error.message : '';
  if (code === 'user_limit') {
    const body = (error as { body?: Record<string, unknown> }).body ?? {};
    const limit = typeof body['limit'] === 'number' ? body['limit'] : null;
    return limit === null
      ? `오늘 ${LABEL[kind]} 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.`
      : `오늘 ${LABEL[kind]} ${limit}번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.`;
  }
  if (code === 'quota_exceeded') {
    const base = '오늘 AI 무료 사용량이 모두 소진됐어요. 오후 5시쯤 다시 쓸 수 있어요.';
    return kind === 'receipt' ? `${base} 지금은 직접 입력해 주세요.` : base;
  }
  return null;
}
```

- [ ] **Step 4: 통과 확인** — Step 2 명령. Expected: 4 passed.

- [ ] **Step 5: 실패하는 테스트 — 제공자 세 곳**

`edge-ai-provider.spec.ts`의 `setup`에 `AiQuota`를 providers로 더하고(`[{ provide: AuthStore, useValue: auth }, AiQuota, EdgeAiProvider]`), 반환에 `quota: injector.get(AiQuota)`를 더한 뒤 추가:

```ts
  it('성공하면 남은 횟수를 기록한다', async () => {
    const { provider, quota } = setup({
      callFunction: vi.fn(async () => ({ content: '{"items":[]}', remaining: 2 })),
    });
    await provider.generate(REQUEST, new AbortController().signal);
    expect(quota.hint('plan')()).toBe('오늘 2번 남음');
  });

  it('내 한도 초과는 서버 한도로 알린다', async () => {
    const { provider } = setup({
      callFunction: vi.fn(async () => {
        throw new FunctionError('user_limit', { error: 'user_limit', limit: 5 });
      }),
    });
    await expect(provider.generate(REQUEST, new AbortController().signal)).rejects.toThrow(
      '오늘 AI 일정 만들기를 5번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.',
    );
  });
```

`edge-chat-provider.spec.ts`에 추가(providers에 `AiQuota` 추가):

```ts
  it('records what is left and explains the personal limit', async () => {
    const ok = vi.fn(async () => ({content: JSON.stringify({kind:'explore',text:'응답'}),remaining:1}));
    let injector = Injector.create({providers:[{provide:AuthStore,useValue:{available:()=>true,callFunction:ok}},AiQuota,EdgeChatProvider]});
    let provider = runInInjectionContext(injector,()=>injector.get(EdgeChatProvider));
    await provider.reply(request,new AbortController().signal);
    expect(injector.get(AiQuota).hint('chat')()).toBe('오늘 1번 남음');
    const limited = vi.fn(async () => { throw new FunctionError('user_limit',{limit:30}); });
    injector = Injector.create({providers:[{provide:AuthStore,useValue:{available:()=>true,callFunction:limited}},AiQuota,EdgeChatProvider]});
    provider = runInInjectionContext(injector,()=>injector.get(EdgeChatProvider));
    await expect(provider.reply(request,new AbortController().signal)).rejects.toThrow('오늘 챗봇 질문을 30번 모두 썼어요.');
  });
```

새 `app/src/app/features/expenses/data/edge-receipt-scanner.spec.ts`:

```ts
import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../auth/data/auth-store';
import { FunctionError } from '../../auth/data/function-error';
import { AiQuota } from '../../../core/ai-quota';
import { EdgeReceiptScanner } from './edge-receipt-scanner';

const IMAGE = { base64: 'aGVsbG8=', mimeType: 'image/jpeg', highlighted: false } as const;

function setup(callFunction: ReturnType<typeof vi.fn>) {
  const injector = Injector.create({
    providers: [
      { provide: AuthStore, useValue: { available: () => true, user: () => ({ id: 'u' }), callFunction } },
      AiQuota,
      EdgeReceiptScanner,
    ],
  });
  return {
    scanner: runInInjectionContext(injector, () => injector.get(EdgeReceiptScanner)),
    quota: injector.get(AiQuota),
  };
}

describe('EdgeReceiptScanner', () => {
  it('성공하면 남은 횟수를 기록한다', async () => {
    const { scanner, quota } = setup(
      vi.fn(async () => ({ content: '{"store":"","total":0,"items":[]}', remaining: 0 })),
    );
    await scanner.scan(IMAGE, new AbortController().signal);
    expect(quota.hint('receipt')()).toBe('오늘 0번 남음');
  });

  it('한도 오류를 문장으로 바꾼다', async () => {
    const limited = setup(vi.fn(async () => { throw new FunctionError('user_limit', { limit: 10 }); }));
    await expect(limited.scanner.scan(IMAGE, new AbortController().signal)).rejects.toThrow(
      '오늘 사진 읽기를 10번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.',
    );
    const global = setup(vi.fn(async () => { throw new Error('quota_exceeded'); }));
    await expect(global.scanner.scan(IMAGE, new AbortController().signal)).rejects.toThrow(
      '지금은 직접 입력해 주세요.',
    );
  });
});
```

(`ReceiptImage`의 실제 필드가 다르면 `receipt-scanner.ts`의 정의에 맞춘다. 위 필드는 `edge-receipt-scanner.ts`가 읽는 `base64`·`mimeType`·`highlighted`다.)

- [ ] **Step 6: 실패 확인**

Run: `cd app && npx vitest run src/app/features/ai-planning/data/edge-ai-provider.spec.ts src/app/features/travel-chat/data/edge-chat-provider.spec.ts src/app/features/expenses/data/edge-receipt-scanner.spec.ts`
Expected: 새 테스트 FAIL(힌트 null, 옛 문구).

- [ ] **Step 7: 제공자 구현**

세 제공자 모두 `private readonly quota = inject(AiQuota);`를 두고:

- `edge-ai-provider.ts`: `callFunction<{ content: string; remaining?: number }>` 결과에서 `this.quota.record('plan', remaining)`. `toUserError` 맨 앞에 `const limit = aiLimitMessage('plan', error); if (limit) return new Error(limit);`를 두고 기존 `case 'quota_exceeded'`는 지운다.
- `edge-chat-provider.ts`: 같은 방식으로 `record('chat', …)`. catch에서 `const limit = aiLimitMessage('chat', error); if (limit) throw new Error(limit);`를 messages 앞에 두고 messages의 `quota_exceeded` 항목은 지운다.
- `edge-receipt-scanner.ts`: `record('receipt', …)`, `toUserError` 맨 앞에 `aiLimitMessage('receipt', error)`, 기존 `case 'quota_exceeded'`는 지운다.

- [ ] **Step 8: 통과 확인** — Step 6 명령 + `npx vitest run`. Expected: 전부 PASS.

- [ ] **Step 9: 커밋**

```bash
git add app/src/app/core/ai-quota.ts app/src/app/core/ai-quota.spec.ts app/src/app/features/auth/data app/src/app/features/ai-planning/data app/src/app/features/travel-chat/data app/src/app/features/expenses/data
git commit -m "feat(app): AI 한도 오류를 구분해 알리고 남은 횟수를 기록한다" -m "서버 함수 오류 본문을 FunctionError로 전달해, 내 한도 초과는 서버가 적용한 한도로, 앱 전체 무료 한도 소진은 초기화 시각으로 알린다. 성공 응답의 남은 횟수를 AiQuota에 기록한다.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 남은 횟수 안내 표시

**Files:**
- Modify: `app/src/app/features/ai-planning/feature/ai-plan-flow/ai-plan-flow.ts`·`.html`(생성 버튼 `data-testid="ai-generate"` 줄 아래)
- Modify: `app/src/app/features/travel-chat/ui/chat-thread/chat-thread.ts`·`.html`(입력 form 위, `chat-limit-note` 옆), `app/src/app/features/travel-chat/feature/chat/chat.html`, `.../chat-sheet/chat-sheet.html`, 두 feature의 ts
- Modify: `app/src/app/features/expenses/ui/receipt-scan/receipt-scan.ts`·`.html`(`receipt-scan-run` 버튼 아래)

**Interfaces:**
- Consumes: Task 6 `AiQuota.hint(kind)`.

- [ ] **Step 1: 연결**

- `ai-plan-flow.ts`: `readonly aiHint = inject(AiQuota).hint('plan');`. html의 생성 버튼이 있는 `@case ('summary')` 줄 바로 아래(버튼 줄 밖)에:

```html
@if (aiHint(); as hint) {
  <p class="mt-2 text-12 text-ink-3" data-testid="ai-quota-hint">{{ hint }}</p>
}
```

  (버튼 줄 구조상 `@case` 안에 둘 수 없으면 버튼 줄을 감싼 요소 바로 뒤에 `@if (draft.phase() === 'summary' && aiHint(); as hint)`로 둔다.)

- `chat-thread.ts`: `readonly aiHint = input<string | null>(null);`. html에서 `chat-limit-note` 블록 뒤에:

```html
@if (aiHint(); as hint) {
  <p class="mb-2 text-12 leading-normal text-ink-3" data-testid="chat-quota-hint">{{ hint }}</p>
}
```

  `chat.ts`·`chat-sheet.ts`에 `readonly aiHint = inject(AiQuota).hint('chat');`, 두 html의 `<app-chat-thread` 속성에 `[aiHint]="aiHint()"`.

- `receipt-scan.ts`: `readonly aiHint = inject(AiQuota).hint('receipt');`. html `receipt-scan-run` 버튼을 감싼 줄 뒤에:

```html
@if (aiHint(); as hint) {
  <p class="text-12 text-ink-3" data-testid="receipt-quota-hint">{{ hint }}</p>
}
```

- [ ] **Step 2: 확인**

Run: `cd app && npx ng build && npx vitest run && npm run lint`
Expected: 빌드 성공, 단위 전부 PASS, lint는 기존 `image.ts` 한 줄 외 새 오류 없음.
Run: `npx playwright test ai-plan travel-chat receipt-scan --project=desktop --reporter=line`
Expected: 기존과 같은 결과(옛 지역 이름·영업정보 테스트의 기존 실패 외 새 실패 없음). 테스트 앱의 가짜 제공자는 남은 횟수를 주지 않으므로 안내가 보이지 않아야 한다.

- [ ] **Step 3: 커밋**

```bash
git add app/src/app/features/ai-planning/feature app/src/app/features/travel-chat app/src/app/features/expenses/ui/receipt-scan
git commit -m "feat(app): AI를 거의 다 쓰면 기능 옆에 남은 횟수를 보인다" -m "남은 횟수가 3 이하일 때만 일정 만들기 버튼·챗봇 입력창·사진 읽기 버튼 근처에 작게 알린다.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 원격 적용·배포·문서 (사용자 확인 필요)

- [ ] 사용자 확인 뒤 `npx supabase db push --linked --yes`(마이그레이션 `20260929000004`).
- [ ] `npx supabase functions deploy ai-plan ai-chat receipt-scan --project-ref wslqgfetdwcmqeztixvs`.
- [ ] 확인: 공개 키로 `ai_usage` select와 `consume_ai_quota` rpc가 `42501`. `npx supabase functions list`에서 세 함수 ACTIVE.
- [ ] 문서: `docs/AI-PLANNING.md` 무료 한도 절(사용자별 한도·되돌리기·환경변수·예외 한도 넣는 SQL 예), `docs/architecture/DATABASE.md`(두 표·두 함수·적용 현황), `docs/기획안-v0.1.md` 새 절 '39. AI 사용 횟수 제한', OpenSpec `tasks.md` 3.27 뒤에 완료 항목. 커밋 `docs: AI 사용 횟수 제한 적용과 결정을 적는다`.
