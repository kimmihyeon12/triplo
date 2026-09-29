# 여행 Supabase 저장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 사용자의 여행을 Supabase에 저장하고, 버전으로 저장 충돌을 막는다.

**Architecture:** 서버 함수 `save_trip`이 여행 JSON 전체를 버전 확인과 함께 한 트랜잭션으로 저장한다. 앱은 `TripRepository` 인터페이스의 새 구현 `SupabaseTripRepository`를 실행 앱에만 연결하고, 테스트 앱은 기존 기기 저장소를 계속 쓴다. 저장소는 Supabase 호출을 좁은 `TripDataClient` 인터페이스 뒤에 두어 순수 로직만 단위 테스트한다.

**Tech Stack:** Angular 21(Zoneless, NgRx Signals), `@supabase/supabase-js` 2, PostgreSQL 17(Supabase), Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-09-29-supabase-trip-storage-design.md`

## Global Constraints

- 범위는 여행(정보·지역·장소·숙소)만. 가계부·초대·문의·채팅 기록은 건드리지 않는다.
- 기기 여행은 옮기지 않고 지운다(`tc.trips.v1`, `tc.trips.v1.ledger.*`). 테스트 앱은 지우지 않는다.
- 오프라인 동기화·실시간 반영은 만들지 않는다.
- 충돌은 SQLSTATE `P0409`로 거절하고, 앱은 입력을 남긴 채 알린다.
- 테스트 앱(`environment.isTest`)은 `LocalStorageTripRepository`를 그대로 쓴다. e2e가 외부 서버 없이 돈다.
- 원격 DB 적용(`npx supabase db push`, 프로젝트 `wslqgfetdwcmqeztixvs`)은 사용자 확인 후에만 한다.
- 커밋 메시지는 `CLAUDE.md` 규칙(`type(scope): 제목`, 한국어 본문)을 따르고 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`을 붙인다.
- 파일 줄바꿈은 기존 파일의 방식(CRLF/LF)을 유지한다. Windows Python 텍스트 모드로 쓰지 않는다.

**스펙과 달라진 점:** 스펙은 기존 마이그레이션을 그대로 둔다고 했으나, AI 일정 담기가 `요청ID:region:0` 같은 UUID가 아닌 id를 쓴다(`features/trips/util/ai-selection.ts:33`). 기존 마이그레이션은 원격에 적용된 적이 없으므로(DATABASE.md 적용 현황) id 칸을 `text`로 고쳐 쓴다.

## Review Focus

1. **남의 여행 id로 저장:** 다른 계정이 가진 id로 `save_trip`을 부르면 RLS로 행이 안 보여 새 여행으로 넣으려다 기본 키 중복으로 실패해야 한다. 실패는 충돌이 아닌 일반 저장 실패로 보여야 한다. → Task 3 테스트(`23505`는 `TripSaveError`)와 Task 8 SQL 확인.
2. **새 여행을 두 탭에서 동시에 처음 저장:** 둘 다 base 0으로 보내면 뒤쪽은 기본 키 중복 또는 충돌로 거절되어야 하고 데이터가 섞이면 안 된다. → Task 8 SQL 확인.
3. **저장 중 로그아웃·계정 전환:** 이전 계정의 대기 저장이 새 계정 목록에 나타나면 안 된다. → Task 7 테스트(`changeSession` 호출).
4. **충돌 뒤 새로 불러오기:** 대기 중이던 초안을 버리고 서버본과 새 버전을 받아야 한다. 새로 불러온 뒤 저장은 성공해야 한다. → Task 3·5 테스트.
5. **목록 읽기 실패:** 빈 목록으로 보이지 않고 오류와 다시 시도가 보여야 한다. 기존 `listState === 'error'` 화면이 이미 있으므로 저장소가 오류를 던지기만 하면 된다. → Task 3 테스트(`list`가 오류를 던짐).

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `supabase/migrations/20260917000000_create_trip_tables.sql` (수정) | id·참조 칸을 `uuid`에서 `text`로 |
| `supabase/migrations/20260929000000_trip_version_and_save.sql` (새) | `version`, `region_code`, `save_trip` |
| `app/src/app/features/trips/data/trip-rows.ts` (새) | DB 행 ↔ `Trip` 변환(순수 함수) |
| `app/src/app/features/trips/data/trip-data-client.ts` (새) | `TripDataClient` 인터페이스, `TripConflictError`, `TripSaveError`, Supabase 어댑터 |
| `app/src/app/features/trips/data/supabase-trip-repository.ts` (새) | `TripRepository` 구현, 버전 기억, 기기 데이터 정리 |
| `app/src/app/features/trips/data/legacy-local-cleanup.ts` (새) | 기기 여행·가계부 한 번 지우기 |
| `app/src/app/features/trips/data/pending-draft-registry.ts` (수정) | 충돌 상태 `'conflict'` |
| `app/src/app/features/trips/data/trip-editor-store.ts` (수정) | `saveState`에 `'conflict'`, `reload()` |
| `app/src/app/features/trips/data/trip-repository.ts` (수정) | 선택 메서드 `forget(id)` |
| `app/src/app/shared/ui/save-status/*` (수정) | 충돌 표시·새로 불러오기, 문구 '저장됨' |
| `app/src/app/features/trips/ui/trip-header/*`, `feature/trip-detail`, `feature/stop-form`, `feature/stay-form`, `feature/trip-form` (수정) | `reload` 연결 |
| `app/src/app/features/auth/data/auth-store.ts` (수정) | `dataClient()` |
| `app/src/app/app.config.ts`, `app/src/app/app.ts` (수정) | 제공자 선택, 계정 전환 시 `changeSession` |
| `docs/architecture/DATABASE.md`, `docs/DEVELOPMENT.md`, `docs/기획안-v0.1.md`, `openspec/changes/plan-travel-companion-mvp/tasks.md` (수정) | 결정·적용 현황 |

---

### Task 1: 마이그레이션 작성

**Files:**
- Modify: `supabase/migrations/20260917000000_create_trip_tables.sql`
- Create: `supabase/migrations/20260929000000_trip_version_and_save.sql`

**Interfaces:**
- Produces: `public.save_trip(p_trip jsonb, p_base_version integer) returns integer`. 충돌은 `raise exception 'conflict' using errcode = 'P0409'`. 로그인 없음은 errcode `28000`.

- [ ] **Step 1: 원격 적용 여부 확인**

Run: `cd supabase && npx supabase migration list --linked`
Expected: `20260917000000`이 Remote 칸에 없음. 있으면 멈추고 사용자에게 알린다(그 경우 id 칸 변경은 새 마이그레이션의 `alter`로 해야 한다).

- [ ] **Step 2: 기존 마이그레이션의 id 형식을 text로**

`20260917000000_create_trip_tables.sql`에서 다음을 바꾼다.
- `trips.id uuid primary key` → `id text primary key`
- `trip_regions.id`, `trip_stops.id`, `accommodation_stays.id` → `text primary key`
- `trip_id uuid not null references trips (id)` (세 곳) → `trip_id text not null references trips (id)`
- `region_id uuid references trip_regions (id)` (두 곳) → `region_id text references trip_regions (id)`
- `create function owns_trip(target uuid)` → `owns_trip(target text)`
- 파일 머리 주석에 한 줄 추가: `-- id는 text다. AI 일정 담기가 중복 적용을 막으려고 UUID가 아닌 고정 id를 쓴다(2026-09-29).`

`owner_id uuid`는 `auth.users(id)`를 가리키므로 그대로 둔다.

- [ ] **Step 3: 새 마이그레이션 작성**

`supabase/migrations/20260929000000_trip_version_and_save.sql`:

```sql
-- 저장 충돌을 막는 버전과, 여행 전체를 한 트랜잭션으로 저장하는 함수.
-- 설계: docs/superpowers/specs/2026-09-29-supabase-trip-storage-design.md

-- 저장이 성공할 때마다 1 오른다. 앱은 불러온 버전을 함께 보낸다.
alter table trips add column version integer not null default 0;

-- 통계가 지역을 세는 표준 지역 코드. 앱 모델의 regionCode다.
alter table trip_regions add column region_code text;

-- 여행 하나를 통째로 저장한다. 앱 모델(camelCase JSON)을 그대로 받는다.
-- security invoker라 RLS가 그대로 걸린다. 다른 사람의 여행은 보이지 않으므로
-- 같은 id로 저장하면 새 여행으로 넣으려다 기본 키 중복(23505)으로 실패한다.
create function save_trip(p_trip jsonb, p_base_version integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id text := p_trip->>'id';
  v_current integer;
  v_next integer;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select version into v_current from public.trips where id = v_id for update;

  if not found then
    if p_base_version <> 0 then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    insert into public.trips (id, owner_id, title, start_date, end_date, status,
                              schema_version, created_at, updated_at, version)
    values (v_id, v_uid, p_trip->>'title',
            (p_trip->>'startDate')::date, (p_trip->>'endDate')::date, 'draft',
            coalesce((p_trip->>'schemaVersion')::smallint, 1),
            coalesce((p_trip->>'createdAt')::timestamptz, now()),
            coalesce((p_trip->>'updatedAt')::timestamptz, now()), 1);
    v_next := 1;
  else
    if v_current <> p_base_version then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    v_next := v_current + 1;
    update public.trips
       set title = p_trip->>'title',
           start_date = (p_trip->>'startDate')::date,
           end_date = (p_trip->>'endDate')::date,
           updated_at = coalesce((p_trip->>'updatedAt')::timestamptz, now()),
           version = v_next
     where id = v_id;
  end if;

  -- 딸린 표는 지우고 다시 넣는다. 지역을 먼저 넣어야 장소·숙소의 region_id가 맞는다.
  delete from public.trip_stops where trip_id = v_id;
  delete from public.accommodation_stays where trip_id = v_id;
  delete from public.trip_regions where trip_id = v_id;

  insert into public.trip_regions (id, trip_id, name, "order", region_code)
  select r->>'id', v_id, r->>'name', (r->>'order')::integer, r->>'regionCode'
    from jsonb_array_elements(coalesce(p_trip->'regions', '[]'::jsonb)) as r;

  insert into public.trip_stops (id, trip_id, region_id, kind, name, address, date, "order",
                                 stay_minutes, memo, fixed_time, excluded, location_status,
                                 lat, lng, place_provider, place_id, place_url, estimated_cost)
  select s->>'id', v_id, s->>'regionId', (s->>'kind')::public.stop_kind, s->>'name',
         coalesce(s->>'address', ''), (s->>'date')::date, (s->>'order')::integer,
         (s->>'stayMinutes')::integer, coalesce(s->>'memo', ''), s->>'fixedTime',
         coalesce((s->>'excluded')::boolean, false),
         coalesce(s->>'locationStatus', 'unverified')::public.location_status,
         (s->'location'->>'lat')::double precision, (s->'location'->>'lng')::double precision,
         s->'placeRef'->>'provider', s->'placeRef'->>'id', s->'placeRef'->>'url',
         (s->>'estimatedCost')::integer
    from jsonb_array_elements(coalesce(p_trip->'stops', '[]'::jsonb)) as s;

  insert into public.accommodation_stays (id, trip_id, region_id, name, address, check_in,
                                          check_out, check_in_time, check_out_time, day_order,
                                          reservation, memo, location_status, lat, lng,
                                          place_provider, place_id, place_url, estimated_cost)
  select a->>'id', v_id, a->>'regionId', a->>'name', coalesce(a->>'address', ''),
         (a->>'checkIn')::date, (a->>'checkOut')::date, a->>'checkInTime', a->>'checkOutTime',
         (a->>'dayOrder')::integer,
         coalesce(a->>'reservation', 'unknown')::public.reservation_state,
         coalesce(a->>'memo', ''),
         coalesce(a->>'locationStatus', 'unverified')::public.location_status,
         (a->'location'->>'lat')::double precision, (a->'location'->>'lng')::double precision,
         a->'placeRef'->>'provider', a->'placeRef'->>'id', a->'placeRef'->>'url',
         (a->>'estimatedCost')::integer
    from jsonb_array_elements(coalesce(p_trip->'stays', '[]'::jsonb)) as a;

  return v_next;
end;
$$;

-- 로그인한 사용자만 부른다.
revoke execute on function save_trip(jsonb, integer) from public, anon;
grant execute on function save_trip(jsonb, integer) to authenticated;
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations
git commit -F- <<'EOF'
feat(app): 여행 저장 함수와 버전 마이그레이션을 추가한다
...본문...
EOF
```

---

### Task 2: DB 행 ↔ 여행 모델 변환

**Files:**
- Create: `app/src/app/features/trips/data/trip-rows.ts`
- Test: `app/src/app/features/trips/data/trip-rows.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TripRow { id: string; title: string; start_date: string | null; end_date: string | null;
    status: 'draft'; schema_version: number; created_at: string; updated_at: string; version: number;
    trip_regions: RegionRow[]; trip_stops: StopRow[]; accommodation_stays: StayRow[]; }
  export function tripFromRow(row: TripRow): Trip
  export const TRIP_SELECT: string  // PostgREST 중첩 select 문자열
  ```

- [ ] **Step 1: 실패하는 테스트 작성** — `trip-rows.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { tripFromRow, type TripRow } from './trip-rows';

const row: TripRow = {
  id: 't1', title: '강릉', start_date: '2026-10-10', end_date: '2026-10-11', status: 'draft',
  schema_version: 1, created_at: '2026-09-29T00:00:00+00:00', updated_at: '2026-09-29T01:00:00+00:00',
  version: 3,
  trip_regions: [
    { id: 'r2', name: '속초시', order: 1, region_code: null },
    { id: 'r1', name: '강릉시', order: 0, region_code: '51150' },
  ],
  trip_stops: [
    { id: 's1', region_id: 'r1', kind: 'meal', name: '초당순두부', address: '강릉', date: '2026-10-10',
      order: 0, stay_minutes: 60, memo: '', fixed_time: '12:30', excluded: false,
      location_status: 'verified', lat: 37.7, lng: 128.9, place_provider: 'kakao', place_id: '99',
      place_url: 'https://place.map.kakao.com/99', estimated_cost: 12000 },
  ],
  accommodation_stays: [
    { id: 'a1', region_id: null, name: '바다숙소', address: '', check_in: '2026-10-10',
      check_out: '2026-10-11', check_in_time: null, check_out_time: null, day_order: null,
      reservation: 'unknown', memo: '', location_status: 'unverified', lat: null, lng: null,
      place_provider: null, place_id: null, place_url: null, estimated_cost: null },
  ],
};

describe('tripFromRow', () => {
  it('snake_case 행을 앱 모델로 바꾸고 지역은 order로 정렬한다', () => {
    const trip = tripFromRow(row);
    expect(trip.startDate).toBe('2026-10-10');
    expect(trip.regions.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(trip.regions[0].regionCode).toBe('51150');
    expect(trip.regions[1]).not.toHaveProperty('regionCode');
    expect(trip.stops[0]).toMatchObject({
      regionId: 'r1', kind: 'meal', stayMinutes: 60, fixedTime: '12:30', locationStatus: 'verified',
      location: { lat: 37.7, lng: 128.9 },
      placeRef: { provider: 'kakao', id: '99', url: 'https://place.map.kakao.com/99' },
      estimatedCost: 12000,
    });
    expect(trip.stays[0]).toMatchObject({ checkIn: '2026-10-10', location: null, placeRef: null, dayOrder: null });
    expect(trip.schemaVersion).toBe(1);
  });

  it('좌표 한쪽만 있거나 제공자 id가 없으면 없는 것으로 본다', () => {
    const trip = tripFromRow({ ...row, trip_stops: [{ ...row.trip_stops[0], lng: null, place_id: null }] });
    expect(trip.stops[0].location).toBeNull();
    expect(trip.stops[0].placeRef).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/features/trips/data/trip-rows.spec.ts`
Expected: FAIL, `Cannot find module './trip-rows'`

- [ ] **Step 3: 구현** — `trip-rows.ts`

```ts
import type { AccommodationStay, Trip, TripRegion, TripStop } from '../model/trip';
import type { PlaceRef } from '../../places/model/place';

/**
 * Supabase 표의 행과 앱 모델 사이의 변환. 저장은 앱 모델 JSON을 그대로
 * save_trip에 보내므로 여기서는 읽기 방향만 다룬다.
 */
export interface RegionRow { id: string; name: string; order: number; region_code: string | null }
export interface StopRow {
  id: string; region_id: string | null; kind: TripStop['kind']; name: string; address: string;
  date: string | null; order: number; stay_minutes: number | null; memo: string;
  fixed_time: string | null; excluded: boolean; location_status: TripStop['locationStatus'];
  lat: number | null; lng: number | null; place_provider: string | null; place_id: string | null;
  place_url: string | null; estimated_cost: number | null;
}
export interface StayRow {
  id: string; region_id: string | null; name: string; address: string; check_in: string;
  check_out: string; check_in_time: string | null; check_out_time: string | null;
  day_order: number | null; reservation: AccommodationStay['reservation']; memo: string;
  location_status: AccommodationStay['locationStatus']; lat: number | null; lng: number | null;
  place_provider: string | null; place_id: string | null; place_url: string | null;
  estimated_cost: number | null;
}
export interface TripRow {
  id: string; title: string; start_date: string | null; end_date: string | null; status: 'draft';
  schema_version: number; created_at: string; updated_at: string; version: number;
  trip_regions: RegionRow[]; trip_stops: StopRow[]; accommodation_stays: StayRow[];
}

/** 목록·한 개 읽기에 같은 모양을 쓰도록 select 문자열을 한곳에 둔다. */
export const TRIP_SELECT = '*, trip_regions(*), trip_stops(*), accommodation_stays(*)';

function location(lat: number | null, lng: number | null) {
  return lat === null || lng === null ? null : { lat, lng };
}

function placeRef(provider: string | null, id: string | null, url: string | null): PlaceRef | null {
  if (!provider || !id) return null;
  return { provider: provider as PlaceRef['provider'], id, url };
}

export function tripFromRow(row: TripRow): Trip {
  const regions: TripRegion[] = [...row.trip_regions]
    .sort((a, b) => a.order - b.order)
    .map((r) => ({ id: r.id, name: r.name, order: r.order, ...(r.region_code ? { regionCode: r.region_code } : {}) }));
  const stops: TripStop[] = row.trip_stops.map((s) => ({
    id: s.id, kind: s.kind, name: s.name, address: s.address, regionId: s.region_id, date: s.date,
    order: s.order, stayMinutes: s.stay_minutes, memo: s.memo, fixedTime: s.fixed_time,
    excluded: s.excluded, locationStatus: s.location_status, location: location(s.lat, s.lng),
    placeRef: placeRef(s.place_provider, s.place_id, s.place_url), estimatedCost: s.estimated_cost,
  }));
  const stays: AccommodationStay[] = row.accommodation_stays.map((a) => ({
    id: a.id, name: a.name, address: a.address, regionId: a.region_id, checkIn: a.check_in,
    checkOut: a.check_out, checkInTime: a.check_in_time, checkOutTime: a.check_out_time,
    dayOrder: a.day_order, reservation: a.reservation, memo: a.memo, locationStatus: a.location_status,
    location: location(a.lat, a.lng), placeRef: placeRef(a.place_provider, a.place_id, a.place_url),
    estimatedCost: a.estimated_cost,
  }));
  return {
    id: row.id, title: row.title, startDate: row.start_date, endDate: row.end_date, regions, stops,
    stays, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, schemaVersion: 1,
  };
}
```

- [ ] **Step 4: 통과 확인** — 같은 명령, Expected: PASS
- [ ] **Step 5: 커밋** — `feat(app): Supabase 여행 행을 앱 모델로 바꾸는 변환을 추가한다`

---

### Task 3: 데이터 클라이언트와 Supabase 저장소

**Files:**
- Create: `app/src/app/features/trips/data/trip-data-client.ts`
- Create: `app/src/app/features/trips/data/supabase-trip-repository.ts`
- Modify: `app/src/app/features/trips/data/trip-repository.ts` (선택 메서드 `forget`)
- Test: `app/src/app/features/trips/data/supabase-trip-repository.spec.ts`

**Interfaces:**
- Consumes: `tripFromRow`, `TripRow`, `TRIP_SELECT` (Task 2)
- Produces:
  ```ts
  export interface TripDataClient {
    listRows(): Promise<TripRow[]>;
    getRow(id: string): Promise<TripRow | null>;
    saveTrip(trip: Trip, baseVersion: number): Promise<number>;
    deleteTrip(id: string): Promise<void>;
  }
  export class TripConflictError extends Error {}   // message: '다른 곳에서 먼저 바뀌었어요. 새로 불러와 주세요.'
  export class TripSaveError extends Error {}
  export function toTripError(error: { code?: string; message?: string } | null): Error
  export function supabaseTripDataClient(client: () => Promise<SupabaseClient>): TripDataClient
  export class SupabaseTripRepository implements TripRepository { constructor(data: TripDataClient) }
  // TripRepository에 추가: forget?(id: string): void — 기억한 버전을 버린다(새로 불러오기 전에 호출)
  ```

- [ ] **Step 1: 실패하는 테스트 작성** — `supabase-trip-repository.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createTrip } from '../util/factories';
import type { Trip } from '../model/trip';
import type { TripRow } from './trip-rows';
import { SupabaseTripRepository } from './supabase-trip-repository';
import { TripConflictError, TripSaveError, toTripError, type TripDataClient } from './trip-data-client';

function rowOf(trip: Trip, version: number): TripRow {
  return {
    id: trip.id, title: trip.title, start_date: trip.startDate, end_date: trip.endDate, status: 'draft',
    schema_version: 1, created_at: trip.createdAt, updated_at: trip.updatedAt, version,
    trip_regions: [], trip_stops: [], accommodation_stays: [],
  };
}

/** 서버 흉내: 버전이 맞을 때만 저장하고 1 올린다. */
function fakeServer() {
  const rows = new Map<string, { trip: Trip; version: number }>();
  const calls: number[] = [];
  const client: TripDataClient = {
    listRows: async () => [...rows.values()].map((r) => rowOf(r.trip, r.version)),
    getRow: async (id) => (rows.has(id) ? rowOf(rows.get(id)!.trip, rows.get(id)!.version) : null),
    saveTrip: async (trip, base) => {
      calls.push(base);
      const current = rows.get(trip.id)?.version ?? 0;
      if (current !== base) throw new TripConflictError();
      rows.set(trip.id, { trip, version: current + 1 });
      return current + 1;
    },
    deleteTrip: async (id) => void rows.delete(id),
  };
  return { rows, calls, client };
}

describe('SupabaseTripRepository', () => {
  it('새 여행은 버전 0으로, 그다음 저장은 돌려받은 버전으로 보낸다', async () => {
    const server = fakeServer();
    const repo = new SupabaseTripRepository(server.client);
    const trip = createTrip({ title: '강릉' });
    await repo.save(trip);
    await repo.save({ ...trip, title: '강릉 2' });
    expect(server.calls).toEqual([0, 1]);
  });

  it('불러온 여행은 서버 버전을 기억해 보낸다', async () => {
    const server = fakeServer();
    const trip = createTrip({ title: '강릉' });
    server.rows.set(trip.id, { trip, version: 5 });
    const repo = new SupabaseTripRepository(server.client);
    await repo.get(trip.id);
    await repo.save(trip);
    expect(server.calls).toEqual([5]);
  });

  it('다른 곳에서 먼저 저장했으면 충돌 오류를 던지고, forget 후 다시 읽으면 저장된다', async () => {
    const server = fakeServer();
    const trip = createTrip({ title: '강릉' });
    server.rows.set(trip.id, { trip, version: 1 });
    const repo = new SupabaseTripRepository(server.client);
    await repo.get(trip.id);
    server.rows.set(trip.id, { trip, version: 2 });
    await expect(repo.save(trip)).rejects.toBeInstanceOf(TripConflictError);
    repo.forget(trip.id);
    await repo.get(trip.id);
    await expect(repo.save(trip)).resolves.toBeUndefined();
  });

  it('목록을 못 읽으면 오류를 그대로 던진다', async () => {
    const server = fakeServer();
    const repo = new SupabaseTripRepository({ ...server.client, listRows: async () => { throw new TripSaveError('연결 실패'); } });
    await expect(repo.list()).rejects.toThrow('연결 실패');
  });

  it('목록은 최근 수정 순이다', async () => {
    const server = fakeServer();
    const a = { ...createTrip({ title: 'a' }), updatedAt: '2026-09-01T00:00:00Z' };
    const b = { ...createTrip({ title: 'b' }), updatedAt: '2026-09-02T00:00:00Z' };
    server.rows.set(a.id, { trip: a, version: 1 });
    server.rows.set(b.id, { trip: b, version: 1 });
    const repo = new SupabaseTripRepository(server.client);
    expect((await repo.list()).map((t) => t.title)).toEqual(['b', 'a']);
  });
});

describe('toTripError', () => {
  it('P0409는 충돌, 그 밖은 일반 저장 실패다', () => {
    expect(toTripError({ code: 'P0409', message: 'conflict' })).toBeInstanceOf(TripConflictError);
    expect(toTripError({ code: '23505', message: 'duplicate key' })).toBeInstanceOf(TripSaveError);
    expect(toTripError(null)).toBeInstanceOf(TripSaveError);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/features/trips/data/supabase-trip-repository.spec.ts`, Expected: FAIL(모듈 없음)

- [ ] **Step 3: `trip-repository.ts`에 선택 메서드 추가**

인터페이스 끝에:
```ts
  /** 기억한 서버 버전을 버린다. 충돌 뒤 새로 불러오기 전에 부른다. 기기 저장소는 쓰지 않는다. */
  forget?(id: string): void;
```

- [ ] **Step 4: `trip-data-client.ts` 구현**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trip } from '../model/trip';
import { TRIP_SELECT, type TripRow } from './trip-rows';

/** Supabase 호출을 이 좁은 창구 뒤에 둔다. 저장소 로직은 가짜로 테스트한다. */
export interface TripDataClient {
  listRows(): Promise<TripRow[]>;
  getRow(id: string): Promise<TripRow | null>;
  /** 저장하고 새 버전을 돌려준다. 버전이 어긋나면 TripConflictError. */
  saveTrip(trip: Trip, baseVersion: number): Promise<number>;
  deleteTrip(id: string): Promise<void>;
}

export class TripConflictError extends Error {
  constructor() {
    super('다른 곳에서 먼저 바뀌었어요. 새로 불러와 주세요.');
    this.name = 'TripConflictError';
  }
}

export class TripSaveError extends Error {
  constructor(message = '서버에 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.') {
    super(message);
    this.name = 'TripSaveError';
  }
}

/** save_trip은 충돌을 SQLSTATE P0409로 알린다. 나머지는 사용자가 다시 시도할 일이다. */
export function toTripError(error: { code?: string; message?: string } | null): Error {
  if (error?.code === 'P0409') return new TripConflictError();
  return new TripSaveError();
}

export function supabaseTripDataClient(client: () => Promise<SupabaseClient>): TripDataClient {
  return {
    async listRows() {
      const { data, error } = await (await client())
        .from('trips').select(TRIP_SELECT).order('updated_at', { ascending: false });
      if (error) throw new TripSaveError('여행 목록을 불러오지 못했어요. 다시 시도해 주세요.');
      return (data ?? []) as TripRow[];
    },
    async getRow(id) {
      const { data, error } = await (await client())
        .from('trips').select(TRIP_SELECT).eq('id', id).maybeSingle();
      if (error) throw new TripSaveError('여행을 불러오지 못했어요. 다시 시도해 주세요.');
      return (data as TripRow | null) ?? null;
    },
    async saveTrip(trip, baseVersion) {
      const { data, error } = await (await client())
        .rpc('save_trip', { p_trip: trip, p_base_version: baseVersion });
      if (error) throw toTripError(error);
      return data as number;
    },
    async deleteTrip(id) {
      const { error } = await (await client()).from('trips').delete().eq('id', id);
      if (error) throw new TripSaveError('여행을 지우지 못했어요. 다시 시도해 주세요.');
    },
  };
}
```

- [ ] **Step 5: `supabase-trip-repository.ts` 구현**

```ts
import type { Trip } from '../model/trip';
import type { TripRepository } from './trip-repository';
import type { TripDataClient } from './trip-data-client';
import { tripFromRow, type TripRow } from './trip-rows';

/**
 * 로그인한 사람의 여행을 Supabase에 저장한다. 여행마다 마지막으로 본 서버
 * 버전을 기억해 저장할 때 보낸다. 모델(Trip)에는 버전을 넣지 않아 화면
 * 코드를 바꾸지 않는다.
 */
export class SupabaseTripRepository implements TripRepository {
  readonly lastSkippedCount = 0;
  private readonly versions = new Map<string, number>();

  constructor(private readonly data: TripDataClient) {}

  private remember(row: TripRow): Trip {
    this.versions.set(row.id, row.version);
    return tripFromRow(row);
  }

  async list(): Promise<Trip[]> {
    const rows = await this.data.listRows();
    return rows.map((r) => this.remember(r))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  async get(id: string): Promise<Trip | null> {
    const row = await this.data.getRow(id);
    return row ? this.remember(row) : null;
  }

  async save(trip: Trip): Promise<void> {
    const next = await this.data.saveTrip(trip, this.versions.get(trip.id) ?? 0);
    this.versions.set(trip.id, next);
  }

  async remove(id: string): Promise<void> {
    await this.data.deleteTrip(id);
    this.versions.delete(id);
  }

  forget(id: string): void {
    this.versions.delete(id);
  }
}
```

- [ ] **Step 6: 통과 확인** — 같은 명령, Expected: PASS(6개)
- [ ] **Step 7: 커밋** — `feat(app): Supabase 여행 저장소와 충돌 오류를 추가한다`

---

### Task 4: 기기 여행 데이터 정리

**Files:**
- Create: `app/src/app/features/trips/data/legacy-local-cleanup.ts`
- Test: `app/src/app/features/trips/data/legacy-local-cleanup.spec.ts`

**Interfaces:**
- Consumes: `KeyValueStorage` (`local-storage-trip-repository.ts`)
- Produces: `export function clearLegacyLocalTrips(storage: KeyValueStorage & { key(i: number): string | null; readonly length: number }, prefix: string): boolean` — 지웠으면 true, 이미 정리됐으면 false.

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest';
import { clearLegacyLocalTrips } from './legacy-local-cleanup';

function memory(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
    map,
  };
}

describe('clearLegacyLocalTrips', () => {
  it('여행과 그 가계부를 지우고 표시를 남긴다. 다른 키는 둔다', () => {
    const s = memory({
      'tc.trips.v1': '{}', 'tc.trips.v1.ledger.a': '{}', 'tc.trips.v1.ledger.b': '{}',
      'tc.trips.v1.chat': '[]', 'tc.auth.v1': 'x',
    });
    expect(clearLegacyLocalTrips(s, 'tc.trips.v1')).toBe(true);
    expect([...s.map.keys()].sort()).toEqual(['tc.auth.v1', 'tc.trips.v1.chat', 'tc.trips.v1.migrated']);
    expect(s.getItem('tc.trips.v1.migrated')).toBe('server');
  });

  it('이미 정리했으면 다시 지우지 않는다', () => {
    const s = memory({ 'tc.trips.v1.migrated': 'server', 'tc.trips.v1.ledger.new': '{}' });
    expect(clearLegacyLocalTrips(s, 'tc.trips.v1')).toBe(false);
    expect(s.getItem('tc.trips.v1.ledger.new')).toBe('{}');
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/features/trips/data/legacy-local-cleanup.spec.ts`
- [ ] **Step 3: 구현**

```ts
import type { KeyValueStorage } from './local-storage-trip-repository';

type ListableStorage = KeyValueStorage & { key(i: number): string | null; readonly length: number };

/**
 * 서버 저장으로 바꾼 뒤 기기에 남은 예전 여행과 그 가계부를 한 번 지운다
 * (2026-09-29 사용자 결정: 계정으로 옮기지 않음). 표시를 남겨 다시 돌지 않게
 * 한다. 표시 뒤에 새로 생긴 서버 여행의 가계부는 건드리지 않는다.
 */
export function clearLegacyLocalTrips(storage: ListableStorage, prefix: string): boolean {
  const marker = `${prefix}.migrated`;
  if (storage.getItem(marker) === 'server') return false;
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === prefix || key?.startsWith(`${prefix}.ledger.`)) doomed.push(key);
  }
  for (const key of doomed) storage.removeItem(key);
  storage.setItem(marker, 'server');
  return true;
}
```

- [ ] **Step 4: 통과 확인** — Expected: PASS
- [ ] **Step 5: 커밋** — `feat(app): 서버 저장 전환 때 기기 여행과 가계부를 한 번 지운다`

---

### Task 5: 충돌 상태와 새로 불러오기

**Files:**
- Modify: `app/src/app/features/trips/data/pending-draft-registry.ts`
- Modify: `app/src/app/features/trips/data/trip-editor-store.ts`
- Test: `app/src/app/features/trips/data/trip-editor-store.spec.ts` (케이스 추가)

**Interfaces:**
- Consumes: `TripConflictError` (Task 3), `TripRepository.forget?` (Task 3)
- Produces:
  - `PendingDraft.state: 'saving' | 'error' | 'conflict'`
  - `SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'`
  - `TripEditorStore.reload(): Promise<Trip | null>` — 초안을 버리고 서버본을 다시 읽는다.

- [ ] **Step 1: 실패하는 테스트 추가** (`trip-editor-store.spec.ts`의 describe 안, 기존 `setup` 사용)

```ts
  it('충돌이면 conflict 상태로 두고 입력을 유지하며, reload는 서버본을 다시 읽는다', async () => {
    const { store, records, injector } = setup({
      save: async () => { throw new TripConflictError(); },
    });
    const repo = injector.get(TRIP_REPOSITORY);
    const forgotten: string[] = [];
    repo.forget = (id) => void forgotten.push(id);
    const server = createTrip({ title: '서버본' });
    records.set(server.id, server);
    await store.open(server.id);
    await store.commit({ ...server, title: '내 입력' });
    expect(store.saveState()).toBe('conflict');
    expect(store.current()?.title).toBe('내 입력');
    await store.reload();
    expect(forgotten).toEqual([server.id]);
    expect(store.current()?.title).toBe('서버본');
    expect(store.saveState()).toBe('idle');
  });
```

import 추가: `import { TripConflictError } from './trip-data-client';`

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/features/trips/data/trip-editor-store.spec.ts`, Expected: FAIL(`reload is not a function` 또는 state가 `'error'`)

- [ ] **Step 3: `pending-draft-registry.ts` 수정**

```ts
import { TripConflictError } from './trip-data-client';
...
export interface PendingDraft {
  readonly trip: Trip;
  readonly version: number;
  readonly state: 'saving' | 'error' | 'conflict';
  readonly error: string | null;
}
```
`save()`의 catch를 다음으로 바꾼다.
```ts
      } catch (error) {
        if (generation === this.generation() && this.get(id)?.version === version) {
          const state = error instanceof TripConflictError ? 'conflict' : 'error';
          this.put(id, { trip: snapshot, version, state, error: errorMessage(error) });
        }
        return false;
      }
```

- [ ] **Step 4: `trip-editor-store.ts` 수정**

- `export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';`
- `commit()` 끝의 `saveState: ok ? 'saved' : 'error'`를 다음으로:
  ```ts
        saveState: ok ? 'saved' : this.pending.get(stamped.id)?.state === 'conflict' ? 'conflict' : 'error',
  ```
- 클래스에 메서드 추가:
  ```ts
  /**
   * 충돌 뒤 서버 최신본을 다시 읽는다. 대기 중인 초안과 기억한 버전을 버린다.
   * 화면에 남아 있던 입력은 사라지므로 버튼 옆에 그렇게 적는다.
   */
  async reload(): Promise<Trip | null> {
    const id = this.state.id();
    if (!id) return null;
    this.pending.discard(id);
    this.repo.forget?.(id);
    patchState(this.state, { currentState: 'idle', saveState: 'idle' });
    return this.load(id);
  }
  ```
  `load()`의 조기 반환 조건 `this.currentState() === 'ready'`가 `idle`로 바뀌어 다시 읽는다.

- [ ] **Step 5: 통과 확인 + 전체 단위 테스트**

Run: `npx vitest run`
Expected: 모두 PASS

- [ ] **Step 6: 커밋** — `feat(app): 여행 저장 충돌을 구분하고 서버본을 새로 불러온다`

---

### Task 6: 저장 상태 표시(충돌·문구)

**Files:**
- Modify: `app/src/app/shared/ui/save-status/save-status.ts`, `save-status.html`
- Modify: `app/src/app/features/trips/ui/trip-header/trip-header.ts`, `trip-header.html`
- Modify: `app/src/app/features/trips/feature/trip-detail/trip-detail.html`, `stop-form/stop-form.html`, `stay-form/stay-form.html`, `trip-form/trip-form.html` (`app-save-status` 또는 `app-trip-header`를 쓰는 자리)

**Interfaces:**
- Consumes: `SaveState` (Task 5), `TripEditorStore.reload()` (Task 5)
- Produces: `SaveStatusComponent`의 `state` 입력에 `'conflict'`, 출력 `reload = output<void>()`. `TripHeader`도 같은 `reload` 출력.

- [ ] **Step 1: `save-status.ts`**
  - `state = input<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');`
  - `readonly reload = output<void>();` 추가
- [ ] **Step 2: `save-status.html`**
  - `saved` 문구 `기기에 저장됨 · {{ time() }}` → `저장됨 · {{ time() }}`
  - `@default` 문구 `기기 저장본` → `저장본`
  - `@case ('error')` 문구 `저장 실패 · 입력은 유지됨` 유지
  - 새 case 추가:
  ```html
  @case ('conflict') {
    <span class="flex flex-wrap items-center gap-2" role="alert" data-testid="save-status" data-state="conflict">
      <span appBadge class="cell cell--warn"><app-icon name="alert" [size]="14" /> 다른 곳에서 먼저 바뀌었어요</span>
      <button appButton type="button" class="btn btn--sm" (click)="reload.emit()" data-testid="reload-trip">
        <app-icon name="refresh" [size]="14" /> 새로 불러오기
      </button>
      <span class="text-12 text-ink-3">불러오면 지금 입력은 사라져요</span>
    </span>
  }
  ```
- [ ] **Step 3: `trip-header`** — `saveState` 입력 타입에 `'conflict'` 추가, `readonly reload = output<void>();`, 템플릿의 `app-save-status`에 `(reload)="reload.emit()"`.
- [ ] **Step 4: 쓰는 자리 연결** — `grep -rn "app-save-status\|app-trip-header" app/src/app --include=*.html`로 찾은 모든 자리에 `(reload)="store.reload()"`를 더한다(각 컴포넌트가 `TripEditorStore`를 부르는 이름에 맞춘다. 예: `editor.reload()`).
- [ ] **Step 5: 빌드와 e2e(테스트 앱) 회귀**

Run: `cd app && npx ng build && npx playwright test e2e/save-failure.spec.ts`
Expected: 빌드 성공, save-failure e2e PASS(문구를 검사하면 '저장됨'으로 바꾼다)

- [ ] **Step 6: 커밋** — `feat(app): 저장 충돌을 알리고 서버본을 새로 불러오는 버튼을 둔다`

---

### Task 7: 로그인 연결과 제공자 선택

**Files:**
- Modify: `app/src/app/features/auth/data/auth-store.ts`
- Modify: `app/src/app/app.config.ts`
- Modify: `app/src/app/app.ts`
- Test: `app/src/app/features/trips/data/pending-draft-registry.spec.ts` (없으면 새로)

**Interfaces:**
- Consumes: `SupabaseTripRepository`, `supabaseTripDataClient` (Task 3), `clearLegacyLocalTrips` (Task 4), `PendingDraftRegistry.changeSession`
- Produces: `AuthStore.dataClient(): Promise<SupabaseClient>` — 초기화를 기다려 클라이언트를 돌려주고, 설정이 없으면 `TripSaveError('서버에 연결되지 않았어요. 잠시 후 다시 시도해 주세요.')`

- [ ] **Step 1: 실패하는 테스트** — 계정이 바뀌면 이전 초안이 사라지는지

```ts
import '@angular/compiler';
import { Injector } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { createTrip } from '../util/factories';
import { PendingDraftRegistry } from './pending-draft-registry';
import { TRIP_REPOSITORY, type TripRepository } from './trip-repository';

describe('PendingDraftRegistry 계정 전환', () => {
  it('다른 계정으로 바뀌면 이전 계정의 실패 초안을 버린다', async () => {
    const repo: TripRepository = {
      lastSkippedCount: 0, list: async () => [], get: async () => null,
      save: async () => { throw new Error('offline'); }, remove: async () => undefined,
    };
    const pending = Injector.create({ providers: [PendingDraftRegistry, { provide: TRIP_REPOSITORY, useValue: repo }] })
      .get(PendingDraftRegistry);
    pending.changeSession('user-a');
    const trip = createTrip();
    await pending.save(trip);
    expect(pending.get(trip.id)?.state).toBe('error');
    pending.changeSession('user-b');
    expect(pending.get(trip.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: 통과 확인** — 이 동작은 이미 구현되어 있다. PASS여야 하며, 목적은 Step 5의 연결이 기대는 계약을 고정하는 것이다.

- [ ] **Step 3: `AuthStore.dataClient()`**

`callFunction` 위에 추가:
```ts
  /**
   * 여행 저장소가 쓸 DB 클라이언트. 초기화(설정 읽기·세션 복원)를 기다린다.
   * 설정이 없으면 서버 저장을 쓸 수 없으므로 저장 실패로 알린다.
   */
  async dataClient(): Promise<SupabaseClient> {
    await this.initialize();
    if (!this.client) throw new TripSaveError('서버에 연결되지 않았어요. 잠시 후 다시 시도해 주세요.');
    return this.client;
  }
```
import: `import { TripSaveError } from '../../trips/data/trip-data-client';`

- [ ] **Step 4: `app.config.ts` 제공자 선택**

`TRIP_REPOSITORY` 항목을 다음으로 바꾼다.
```ts
    // 실행 앱은 Supabase에 저장한다. 테스트 앱은 외부 서버 없이 기기 저장소를 쓴다.
    {
      provide: TRIP_REPOSITORY,
      useFactory: () => {
        if (environment.isTest)
          return new LocalStorageTripRepository(
            new SafeLocalStorage(),
            environment.storageKey,
            `${environment.storageKey}.failSave`,
          );
        try {
          clearLegacyLocalTrips(localStorage, environment.storageKey);
        } catch {
          // 저장소 접근이 막힌 브라우저에서도 앱은 뜬다.
        }
        const auth = inject(AuthStore);
        return new SupabaseTripRepository(supabaseTripDataClient(() => auth.dataClient()));
      },
    },
```
기존 `LocalStorageTripRepository` 제공 코드(세 번째 인자 포함)를 그대로 옮긴다. import 추가: `SupabaseTripRepository`, `supabaseTripDataClient`, `clearLegacyLocalTrips`, `AuthStore`.

- [ ] **Step 5: `app.ts` 계정 전환 연결**

생성자 안에 추가:
```ts
    // 로그인 계정이 바뀌면 이전 계정의 저장 대기열과 화면 상태를 버린다.
    const auth = inject(AuthStore);
    const pending = inject(PendingDraftRegistry);
    effect(() => pending.changeSession(auth.user()?.id ?? 'signed-out'));
```
import 추가: `AuthStore`, `PendingDraftRegistry`.

- [ ] **Step 6: 전체 단위 테스트·빌드·e2e 회귀**

Run: `cd app && npx vitest run && npx ng build && npx playwright test e2e/first-flow.spec.ts e2e/save-failure.spec.ts e2e/expenses-route.spec.ts`
Expected: 단위·빌드 PASS. e2e는 테스트 앱이 기기 저장소를 쓰므로 기존 결과와 같아야 한다(지역 이름 `강릉` 문제로 원래 실패하던 파일은 그대로 실패).

- [ ] **Step 7: 커밋** — `feat(app): 실행 앱의 여행 저장을 Supabase로 바꾼다`

---

### Task 8: 원격 적용과 실제 검증 (사용자 확인 필요)

**Files:**
- Modify: `docs/architecture/DATABASE.md`, `docs/DEVELOPMENT.md`, `docs/기획안-v0.1.md`, `openspec/changes/plan-travel-companion-mvp/tasks.md`

- [ ] **Step 1: 사용자에게 원격 적용 확인을 받는다.** 적용 대상은 두 마이그레이션이다. 운영 로그인 데이터에는 영향이 없다(새 표·함수만 만든다).

- [ ] **Step 2: 적용**

Run: `npx supabase db push --linked` (프로젝트 루트)
Expected: 두 마이그레이션 적용 완료. DB 비밀번호를 물으면 사용자에게 입력을 요청한다(`! npx supabase db push`).

- [ ] **Step 3: SQL로 서버 함수 확인** (Supabase 대시보드 SQL 편집기 또는 `npx supabase db query`가 있으면 그것)

```sql
-- 가짜 로그인 사용자 두 명으로 확인한다. 트랜잭션을 되돌려 흔적을 남기지 않는다.
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users limit 1))::text, true);
set local role authenticated;
select save_trip('{"id":"t-check","title":"확인","regions":[{"id":"r1","name":"강릉시","order":0,"regionCode":"51150"}],"stops":[{"id":"s1","kind":"place","name":"안목","regionId":"r1","date":null,"order":0,"stayMinutes":null,"memo":"","fixedTime":null,"excluded":false,"locationStatus":"unverified","location":null,"placeRef":null}],"stays":[]}'::jsonb, 0);  -- 1
select save_trip('{"id":"t-check","title":"확인2","regions":[],"stops":[],"stays":[]}'::jsonb, 0);  -- P0409 conflict
rollback;
```
Expected: 첫 호출 1, 두 번째 호출 `ERROR: conflict` (SQLSTATE P0409). 두 번째 사용자로 같은 id를 base 0으로 저장하면 `duplicate key`(23505).

- [ ] **Step 4: 실행 앱에서 확인** — `npm start`(4200)에서 로그인해 여행 만들기 → 새로고침해도 남는지, 다른 브라우저에서 같은 계정으로 보이는지, 다른 계정에서 안 보이는지, 두 탭에서 고쳐 충돌 알림과 새로 불러오기가 도는지. 사용자가 직접 검증한다고 했으므로 결과를 받아 기록한다.

- [ ] **Step 5: 문서 갱신**
  - `DATABASE.md`: id가 text인 이유, `version`·`region_code`·`save_trip`, "아직 없는 것"에서 저장 충돌 검사 제거, 적용 현황에 날짜·결과.
  - `DEVELOPMENT.md`: 현재 단계 "여행은 Supabase에 저장(본인만). 가계부는 기기 저장".
  - `기획안-v0.1.md`: 2026-09-29 결정(기기 여행은 옮기지 않고 삭제, 오프라인은 서버만).
  - OpenSpec `tasks.md`: 4.2·4.3(기기 초안 가져오기 → 삭제로 변경)·9.5(여행 저장 충돌) 진행 표시, 4.4는 사용자 검증 결과에 따라.

- [ ] **Step 6: 커밋** — `docs: 여행 Supabase 저장 적용과 결정을 적는다`
