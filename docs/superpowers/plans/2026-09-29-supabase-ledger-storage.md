# 가계부 Supabase 저장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여행별 가계부를 Supabase에 동작 한 건씩 저장하고, 지출마다 버전으로 충돌을 막는다.

**Architecture:** 서버 함수 여섯 개가 사람 추가·지출 저장·지출 삭제·수령 기록·수령 취소·예산 변경을 각각 한 트랜잭션으로 처리한다. 앱은 가계부의 바꾸기 전/후를 순수 함수 `ledgerOps`로 동작 목록으로 바꿔 `LedgerRepository.apply`에 보낸다. 지출 화면(`persist`)과 챗봇(적용·되돌리기)이 같은 함수를 쓴다. 실행 앱은 Supabase 구현, 테스트 앱은 기기 구현을 쓴다.

**Tech Stack:** Angular 21, `@supabase/supabase-js` 2, PostgreSQL 17, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-09-29-supabase-ledger-storage-design.md`

## Global Constraints

- 기기 가계부(`tc.trips.v1.ledger.*`)는 옮기지 않고 한 번 지운다. 표시 키는 `tc.trips.v1.ledgerMigrated = 'server'`. 테스트 앱은 지우지 않는다.
- 권한은 `owns_trip(trip_id)`(여행 마이그레이션에 있음)로만 판단한다. 표 권한은 `authenticated`에만 준다.
- 충돌 `P0409`, 대상 없음·남의 여행 `P0404`, 분담 합계 불일치 `P0422`, 비로그인 `28000`.
- 오류는 기존 `TripConflictError`·`TripSaveError`(`features/trips/data/trip-data-client.ts`)로 바꾼다.
- 원격 적용은 사용자 확인 후.
- 커밋 규칙은 `CLAUDE.md`, 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. 파일 줄바꿈은 기존 방식을 유지한다(Windows Python 텍스트 모드·sed -i 금지, 바이트 단위로 쓴다).

## Review Focus

1. **남의 여행 id로 동작 호출:** 모든 함수가 `P0404`로 거절하고 아무 행도 바꾸지 않아야 한다. → Task 1 SQL 검사.
2. **같은 지출을 두 곳에서 수정:** 뒤쪽은 `P0409`, 앞쪽 변경이 남아야 한다. → Task 1 SQL, Task 4 저장소 테스트.
3. **분담 합계가 금액과 다른 지출:** 서버가 `P0422`로 거절하고 지출·분담이 바뀌지 않아야 한다. → Task 1 SQL.
4. **챗봇 적용 사이에 지출 화면에서 가계부가 바뀜:** 챗봇이 서버에서 다시 읽은 가계부와 `before`를 비교해 거절해야 한다. → Task 6 테스트.
5. **처음 여는 여행의 가계부:** 서버에 '나'가 없으면 만들고 한 번만 만든다. → Task 4 테스트.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `supabase/migrations/20260929000002_ledger_tables.sql` (새) | 표 5개, RLS, 권한, 함수 6개 |
| `supabase/tests/ledger.local.sql` (새) | 로컬 PostgreSQL 검사 |
| `app/.../expenses/util/ledger-ops.ts` (새) | `LedgerOp`, `ledgerOps(before, after)`, `applyOp(ledger, op)` |
| `app/.../expenses/data/ledger-repository.ts` (새) | `LedgerRepository`, `LEDGER_REPOSITORY` |
| `app/.../expenses/data/local-ledger-repository.ts` (새) | 기기 구현(기존 `LocalLedger` 대체) |
| `app/.../expenses/data/ledger-rows.ts` (새) | 행 → `Ledger` 변환 |
| `app/.../expenses/data/supabase-ledger-repository.ts` (새) | 서버 구현, 버전 기억, '나' 보장 |
| `app/.../expenses/data/legacy-ledger-cleanup.ts` (새) | 기기 가계부 한 번 지우기 |
| `app/.../expenses/data/local-ledger.ts` (삭제) | `LocalLedgerRepository`로 대체 |
| `app/.../expenses/feature/expenses/expenses.ts` (수정) | 비동기 읽기·`persist` |
| `app/.../travel-chat/data/travel-chat-store.ts` (+spec) (수정) | 비동기 가계부, `applyDraft`·`undo` 비동기 |
| `app/.../travel-chat/feature/chat/chat.ts`, `chat-sheet/chat-sheet.ts` (수정) | `await` |
| `app/src/app/app.config.ts` (수정) | 제공자 선택, 정리 |

---

### Task 1: 가계부 마이그레이션과 로컬 검사

**Files:** Create `supabase/migrations/20260929000002_ledger_tables.sql`, `supabase/tests/ledger.local.sql`

**Interfaces — Produces:** 함수 `add_ledger_person(p_trip_id text, p_person jsonb)`, `save_expense(p_trip_id text, p_expense jsonb, p_base_version integer) returns integer`, `delete_expense(p_trip_id text, p_expense_id text, p_base_version integer)`, `add_receipt(p_trip_id text, p_receipt jsonb)`, `cancel_receipt(p_trip_id text, p_receipt_id text, p_reason text)`, `set_budget(p_trip_id text, p_budget integer)`. JSON은 앱 모델 필드(camelCase: `paidBy`, `linkId`, `personId`, `from`, `to`).

- [ ] **Step 1: 검사 스크립트를 먼저 쓴다** — `supabase/tests/ledger.local.sql`: `save-trip.local.sql`과 같은 스텁(auth 스키마·역할)을 두고 세 마이그레이션(`20260917000000`, `20260929000000`, `20260929000001`)과 새 마이그레이션을 `\ir`로 적용한다. A 계정이 `save_trip`으로 여행 `t1`을 만든 뒤 다음을 차례로 `select 'label', ...`로 찍는다(`\set ON_ERROR_STOP 0`).
  - `add_ledger_person('t1', {"id":"self","name":"나"})`, `{"id":"p2","name":"민지"}` → `ledger_people` 2행
  - `save_expense('t1', {id:e1, title:저녁, date:2026-10-10, category:food, amount:30000, paidBy:self, splits:[{self,15000},{p2,15000}], memo:'', linkId:null, personal:false}, 0)` → 1
  - 같은 id로 base 0 → `P0409`(conflict)
  - 분담 합계 29000 → `split_mismatch`(P0422), 이후 `expenses.amount`는 30000 그대로
  - base 1로 금액 40000·분담 20000/20000 → 2
  - `delete_expense('t1','e1',1)` → `P0409`, `delete_expense('t1','e1',2)` → 성공, 지출 0행·분담 0행
  - `add_receipt('t1', {id:r1, from:p2, to:self, amount:5000})`, `cancel_receipt('t1','r1','실수')` → 취소 사유 '실수'
  - `set_budget('t1', 100000)` → 100000, `set_budget('t1', null)` → null
  - B 계정: `save_expense('t1', ..., 0)` → `P0404`, `set_budget('t1', 1)` → `P0404`, `select count(*) from expenses` → 0
  - 비로그인: `set_budget('t1', 1)` → `authentication_required`
- [ ] **Step 2: 마이그레이션 없이 실행해 실패 확인** — 빈 마이그레이션 파일로 `\ir`가 통과하게 두고 검사 셸(아래)을 돌린다. Expected: 첫 기대부터 MISSING.
- [ ] **Step 3: 마이그레이션 작성**

```sql
-- 가계부를 여행별로 저장한다. 설계: docs/superpowers/specs/2026-09-29-supabase-ledger-storage-design.md
-- 동작 한 건씩 저장해 친구 공동 편집에서 동시 추가가 막히지 않게 한다.

create table trip_ledgers (
  trip_id text primary key references trips (id) on delete cascade,
  budget integer,
  constraint trip_ledgers_budget_not_negative check (budget is null or budget >= 0)
);

-- '나'(self)가 여행마다 있으므로 id는 여행 안에서만 고유하다.
create table ledger_people (
  trip_id text not null references trips (id) on delete cascade,
  id text not null,
  name text not null,
  "order" integer not null,
  primary key (trip_id, id),
  constraint ledger_people_name check (btrim(name) <> '' and char_length(name) <= 40)
);

create table expenses (
  id text primary key,
  trip_id text not null references trips (id) on delete cascade,
  title text not null,
  date date not null,
  category text not null,
  amount integer not null,
  paid_by text not null,
  memo text not null default '',
  link_id text,
  personal boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  foreign key (trip_id, paid_by) references ledger_people (trip_id, id),
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_title check (btrim(title) <> '' and char_length(title) <= 100)
);
create index expenses_trip_idx on expenses (trip_id);

create table expense_splits (
  expense_id text not null references expenses (id) on delete cascade,
  trip_id text not null,
  person_id text not null,
  amount integer not null,
  primary key (expense_id, person_id),
  foreign key (trip_id, person_id) references ledger_people (trip_id, id),
  constraint expense_splits_amount check (amount >= 0)
);
create index expense_splits_trip_idx on expense_splits (trip_id);

-- 취소해도 행은 남긴다. 취소 사유가 있으면 정산에서 뺀다.
create table settlement_receipts (
  id text primary key,
  trip_id text not null references trips (id) on delete cascade,
  from_person text not null,
  to_person text not null,
  amount integer not null,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  foreign key (trip_id, from_person) references ledger_people (trip_id, id),
  foreign key (trip_id, to_person) references ledger_people (trip_id, id),
  constraint receipts_amount_positive check (amount > 0),
  constraint receipts_people_differ check (from_person <> to_person),
  constraint receipts_reason check (cancelled_reason is null or btrim(cancelled_reason) <> '')
);
create index settlement_receipts_trip_idx on settlement_receipts (trip_id);

alter table trip_ledgers enable row level security;
alter table ledger_people enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table settlement_receipts enable row level security;

create policy trip_ledgers_owner_all on trip_ledgers for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));
create policy ledger_people_owner_all on ledger_people for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));
create policy expenses_owner_all on expenses for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));
create policy expense_splits_owner_all on expense_splits for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));
create policy settlement_receipts_owner_all on settlement_receipts for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));

grant select, insert, update, delete
  on public.trip_ledgers, public.ledger_people, public.expenses,
     public.expense_splits, public.settlement_receipts
  to authenticated;

-- 모든 함수의 입구. 로그인과 여행 소유를 확인한다.
create function ledger_guard(p_trip_id text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.owns_trip(p_trip_id) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
end;
$$;

create function add_ledger_person(p_trip_id text, p_person jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ledger_guard(p_trip_id);
  insert into public.ledger_people (trip_id, id, name, "order")
  values (p_trip_id, p_person->>'id', btrim(p_person->>'name'),
          coalesce((select max("order") + 1 from public.ledger_people where trip_id = p_trip_id), 0))
  on conflict (trip_id, id) do update set name = excluded.name;
end;
$$;

create function save_expense(p_trip_id text, p_expense jsonb, p_base_version integer) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_id text := p_expense->>'id';
  v_current integer;
  v_trip text;
  v_next integer;
  v_amount integer := (p_expense->>'amount')::integer;
  v_personal boolean := coalesce((p_expense->>'personal')::boolean, false);
begin
  perform public.ledger_guard(p_trip_id);
  select version, trip_id into v_current, v_trip from public.expenses where id = v_id for update;
  if not found then
    if p_base_version <> 0 then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    insert into public.expenses (id, trip_id, title, date, category, amount, paid_by, memo, link_id, personal, version)
    values (v_id, p_trip_id, btrim(p_expense->>'title'), (p_expense->>'date')::date, p_expense->>'category',
            v_amount, p_expense->>'paidBy', coalesce(p_expense->>'memo', ''), p_expense->>'linkId', v_personal, 1);
    v_next := 1;
  else
    if v_trip <> p_trip_id then
      raise exception 'not_found' using errcode = 'P0404';
    end if;
    if v_current <> p_base_version then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    v_next := v_current + 1;
    update public.expenses
       set title = btrim(p_expense->>'title'), date = (p_expense->>'date')::date,
           category = p_expense->>'category', amount = v_amount, paid_by = p_expense->>'paidBy',
           memo = coalesce(p_expense->>'memo', ''), link_id = p_expense->>'linkId',
           personal = v_personal, version = v_next
     where id = v_id;
  end if;

  delete from public.expense_splits where expense_id = v_id;
  insert into public.expense_splits (expense_id, trip_id, person_id, amount)
  select v_id, p_trip_id, s->>'personId', (s->>'amount')::integer
    from jsonb_array_elements(coalesce(p_expense->'splits', '[]'::jsonb)) as s;

  if not v_personal and (
       (select count(*) from public.expense_splits where expense_id = v_id) = 0
       or (select sum(amount) from public.expense_splits where expense_id = v_id) <> v_amount) then
    raise exception 'split_mismatch' using errcode = 'P0422';
  end if;
  return v_next;
end;
$$;

create function delete_expense(p_trip_id text, p_expense_id text, p_base_version integer) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_current integer;
begin
  perform public.ledger_guard(p_trip_id);
  select version into v_current from public.expenses
   where id = p_expense_id and trip_id = p_trip_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  if v_current <> p_base_version then
    raise exception 'conflict' using errcode = 'P0409';
  end if;
  delete from public.expenses where id = p_expense_id;
end;
$$;

create function add_receipt(p_trip_id text, p_receipt jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ledger_guard(p_trip_id);
  insert into public.settlement_receipts (id, trip_id, from_person, to_person, amount)
  values (p_receipt->>'id', p_trip_id, p_receipt->>'from', p_receipt->>'to', (p_receipt->>'amount')::integer);
end;
$$;

create function cancel_receipt(p_trip_id text, p_receipt_id text, p_reason text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ledger_guard(p_trip_id);
  update public.settlement_receipts
     set cancelled_reason = coalesce(cancelled_reason, btrim(p_reason))
   where id = p_receipt_id and trip_id = p_trip_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
end;
$$;

create function set_budget(p_trip_id text, p_budget integer) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ledger_guard(p_trip_id);
  insert into public.trip_ledgers (trip_id, budget) values (p_trip_id, p_budget)
  on conflict (trip_id) do update set budget = excluded.budget;
end;
$$;

revoke execute on function ledger_guard(text), add_ledger_person(text, jsonb),
  save_expense(text, jsonb, integer), delete_expense(text, text, integer),
  add_receipt(text, jsonb), cancel_receipt(text, text, text), set_budget(text, integer)
  from public, anon;
grant execute on function ledger_guard(text), add_ledger_person(text, jsonb),
  save_expense(text, jsonb, integer), delete_expense(text, text, integer),
  add_receipt(text, jsonb), cancel_receipt(text, text, text), set_budget(text, integer)
  to authenticated;
```

- [ ] **Step 4: 검사 통과 확인** — 검사 셸(`sqlcheck`처럼 DB를 새로 만들고 `ledger.local.sql`을 실행해 기대 문자열을 모두 grep)을 돌린다. Expected: 모든 기대 충족.
- [ ] **Step 5: 커밋** — `feat(app): 가계부 표와 동작별 저장 함수를 추가한다`

---

### Task 2: 가계부 동작과 차이 계산

**Files:** Create `app/src/app/features/expenses/util/ledger-ops.ts`, test `ledger-ops.spec.ts`

**Interfaces — Produces:**
```ts
export type LedgerOp =
  | { kind: 'addPerson'; person: ExpensePerson }
  | { kind: 'saveExpense'; expense: Expense; isNew: boolean }
  | { kind: 'deleteExpense'; id: string }
  | { kind: 'addReceipt'; receipt: SettlementReceipt }
  | { kind: 'cancelReceipt'; id: string; reason: string }
  | { kind: 'setBudget'; budget: number | null };
export function ledgerOps(before: Ledger, after: Ledger): LedgerOp[];
export function applyOp(ledger: Ledger, op: LedgerOp): Ledger;
```

- [ ] **Step 1: 실패하는 테스트**
  - 사람 추가·이름 변경 → `addPerson`
  - 지출 추가 → `saveExpense isNew true`, 내용 변경 → `isNew false`, 사라짐 → `deleteExpense`
  - 수령 추가 → `addReceipt`, `cancelledReason`이 null에서 값으로 → `cancelReceipt`
  - 예산 변경 → `setBudget`
  - 같으면 빈 배열, 순서는 사람 → 예산 → 지출 저장 → 지출 삭제 → 수령
  - `ledgerOps(a, b)`를 `applyOp`로 `a`에 차례로 적용하면 `b`와 같다(사람·지출·수령·예산 모두 바뀐 경우)
  - 되돌리기 방향 `ledgerOps(after, before)`: 추가된 지출은 `deleteExpense`가 된다
- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/features/expenses/util/ledger-ops.spec.ts`
- [ ] **Step 3: 구현** — 비교는 `JSON.stringify`로 한다(가계부 행 변환이 같은 모양을 만들기 때문). 사람·수령 삭제는 앱에 없는 동작이라 만들지 않는다.
- [ ] **Step 4: 통과 확인**, **Step 5: 커밋** — `feat(app): 가계부 전/후 차이를 저장 동작 목록으로 바꾼다`

---

### Task 3: 저장소 창구와 기기 구현, 기기 정리

**Files:** Create `expenses/data/ledger-repository.ts`, `local-ledger-repository.ts` (+spec), `legacy-ledger-cleanup.ts` (+spec)

**Interfaces — Produces:**
```ts
export interface LedgerRepository {
  read(tripId: string): Promise<Ledger>;
  apply(tripId: string, ops: readonly LedgerOp[]): Promise<void>;
}
export const LEDGER_REPOSITORY = new InjectionToken<LedgerRepository>('LEDGER_REPOSITORY');
export class LocalLedgerRepository implements LedgerRepository { constructor(storage: KeyValueStorage, prefix: string) }
export function clearLegacyLocalLedgers(storage: ListableStorage, prefix: string): boolean  // 표시 `${prefix}.ledgerMigrated`
```
- `LocalLedgerRepository.read`는 지금의 `LocalLedger.read`와 같다('나'만 있는 빈 가계부, 손상 시 오류). `apply`는 `ops.reduce(applyOp)` 결과를 `validateLedger`로 검사한 뒤 저장한다(오류면 `TripSaveError(메시지)`).
- [ ] 테스트 → 실패 → 구현 → 통과 → 커밋 `feat(app): 가계부 저장소 창구와 기기 구현을 둔다`

---

### Task 4: Supabase 가계부 저장소

**Files:** Create `expenses/data/ledger-rows.ts`, `supabase-ledger-repository.ts` (+spec)

**Interfaces:**
- Consumes: `LedgerOp`, `applyOp` (Task 2), `LedgerRepository` (Task 3), `TripConflictError`·`TripSaveError`.
- Produces:
```ts
export interface LedgerRows { budget: number | null; people: PersonRow[]; expenses: ExpenseRow[]; receipts: ReceiptRow[] }
export function ledgerFromRows(rows: LedgerRows): Ledger;
export interface LedgerDataClient { read(tripId): Promise<LedgerRows>; call(fn: string, args: Record<string, unknown>): Promise<unknown> }
export function supabaseLedgerDataClient(client: () => Promise<SupabaseClient>): LedgerDataClient;
export class SupabaseLedgerRepository implements LedgerRepository { constructor(data: LedgerDataClient) }
```
- `read`는 네 표를 따로 읽는다(`trip_ledgers` maybeSingle, `ledger_people` order, `expenses` + `expense_splits(*)`, `settlement_receipts` created_at 순). '나'가 없으면 `add_ledger_person`으로 만든 뒤 넣어 돌려준다. 지출 버전을 기억한다(오르기만).
- `apply`는 동작마다 함수를 차례로 부른다. `saveExpense`는 새 지출이면 0, 아니면 기억한 버전을 보내고 돌려받은 버전을 기억한다. 오류 코드 `P0409` → `TripConflictError`, `P0422` → `TripSaveError('분담 금액 합계가 실제 지출과 일치해야 합니다.')`, 그 밖은 `TripSaveError()`.
- [ ] **테스트(가짜 데이터 클라이언트):** 행 변환 왕복, '나' 없으면 한 번만 만든다, 수정은 기억한 버전을 보낸다, 삭제 버전, 충돌 오류 변환, 늦게 온 읽기가 버전을 낮추지 않는다.
- [ ] 실패 → 구현 → 통과 → 커밋 `feat(app): Supabase 가계부 저장소를 추가한다`

---

### Task 5: 지출 화면과 제공자 연결

**Files:** Modify `expenses/feature/expenses/expenses.ts`, `app.config.ts`; Delete `expenses/data/local-ledger.ts`

- `repository = inject(LEDGER_REPOSITORY)`. 초기화 효과는 `this.repository.read(id)`를 기다려 `ledger`를 채우고, 실패하면 `blocked`와 오류를 둔다(요청 순서가 바뀌면 이전 결과는 버린다).
- `persist(next): Promise<boolean>` — `validateLedger(next)` 오류면 표시하고 false. `ledgerOps(this.ledger(), next)`를 `apply`한다. 성공하면 `ledger.set(next)`. `TripConflictError`면 가계부를 다시 읽고 오류 표시. 그 밖은 오류 표시하고 false.
- 호출하는 곳(사람 추가, 사진 저장, 지출 저장·삭제, 수령 기록·전체 수령·취소)은 `void this.persist(x).then((ok) => { if (ok) 뒷일 })`로 바꾼다.
- `app.config.ts`: `LEDGER_REPOSITORY`를 테스트·미리보기는 `LocalLedgerRepository(new SafeLocalStorage(), environment.storageKey)`, 실행 앱은 `clearLegacyLocalLedgers` 뒤 `SupabaseLedgerRepository(supabaseLedgerDataClient(() => auth.dataClient()))`.
- [ ] 빌드, 단위 테스트, e2e `expenses-route`·`receipt-scan` 통과 → 커밋 `feat(app): 지출 화면이 가계부를 동작 단위로 저장한다`

---

### Task 6: 챗봇 가계부

**Files:** Modify `travel-chat/data/travel-chat-store.ts` (+spec), `feature/chat/chat.ts`, `feature/chat-sheet/chat-sheet.ts`

- `ledger = inject(LEDGER_REPOSITORY)`. 명령 만들 때 `await this.ledger.read(trip.id)`.
- `applyDraft(draft): Promise<Trip | null>` — 가계부 변경이 있으면 `await read`와 `before`를 JSON 비교해 다르면 '가계부가 변경되었어요' 오류, 같으면 `apply(ledgerOps(before, after))`.
- `undo(): Promise<Trip | null>` — 같은 방식으로 `ledgerOps(undo.after, undo.before)`.
- 두 화면의 호출에 `await`. spec의 가짜 가계부를 `{ read: async, apply: async (ops) => saved = ops.reduce(applyOp, saved) }`로 바꾸고 `applyDraft`·`undo` 호출에 `await`.
- [ ] 테스트(기존 두 가계부 테스트 갱신 + 적용 사이 변경 거절) → 통과 → e2e `travel-chat` 회귀(영업정보 1건은 기존 실패) → 커밋 `feat(app): 챗봇이 가계부를 동작 단위로 저장한다`

---

### Task 7: 원격 적용과 문서 (사용자 확인 필요)

- [ ] 사용자 확인 후 `npx supabase db push --linked --yes`, 비로그인 거절(`42501`) 확인.
- [ ] 문서: `DATABASE.md`(가계부 표·함수·적용 현황), `DEVELOPMENT.md`, `기획안-v0.1.md` 38절, OpenSpec `tasks.md`. 커밋 `docs: 가계부 Supabase 저장 적용과 결정을 적는다`
