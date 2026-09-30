# AI 일정 짜기 시간순 코스·세부 분류 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 일정 짜기 결과를 일차별 시간순 코스로 보여 주고, 분류를 관광·액티비티·식사·카페·쇼핑·숙소로 넓혀 앱 전체에서 통일하며, 장소별 요금·요금 기준(AI 추정)과 분류별 예산 합계를 보여 준다.

**Architecture:** 서버 `ai-plan` 함수는 검색 없이 한 번 호출하고 응답 스키마에 순서·추천 시각·다음 장소 이동을 더한다. 앱은 응답을 검증(`ai-response`) → 장소 실존 확인(`verify-places`) → 순수 함수로 코스 계산(`course.ts`)·분류별 합계(`plan-estimate.ts`) → 화면 표시 → 담기(`ai-selection.ts`, 숙소는 `stays`) 순서로 처리한다. 분류 정의는 `trips/model/trip.ts`(라벨)와 `trips/util/kind-tone.ts`(색)에만 둔다.

**Tech Stack:** Angular 21(Zoneless, Signals), NgRx Signals `signalState`, Tailwind 토큰(`app/src/styles/theme.css`), Vitest, Playwright, Supabase Edge Functions(Deno), PostgreSQL 17 enum, Gemini `responseSchema`.

**Spec:** [docs/superpowers/specs/2026-09-30-ai-course-plan-design.md](../specs/2026-09-30-ai-course-plan-design.md)

## Global Constraints

- 일정에 **저장하는** 좌표·주소·분류·경로시간은 검증된 출처에서만 가져온다. 추천 시각·이동시간은 화면 표시 전용이며 `fixedTime`·경로시간으로 저장하지 않는다.
- 모든 요금은 "AI 추정"으로 표시한다. "공식·확인됨·최신·확정" 표현과 출처 URL을 화면·프롬프트 출력에 만들지 않는다.
- 저장값 `place`는 유지하고 라벨만 "관광"으로 바꾼다. 신규 저장값은 `activity`·`shopping`뿐이다. 숙소는 `stays`로 담는다.
- 분류 라벨 표는 `STOP_KIND_LABEL`·`PLAN_KIND_LABEL`(trip.ts) 외에 두지 않는다. 서버 프롬프트 라벨 문자열은 `관광`·`액티비티`·`식사`·`카페`·`쇼핑`·`숙소`.
- 기존 `ai-plan` API의 인증·한도·오류 코드와 `{ content, remaining }` 봉투를 바꾸지 않는다.
- 이전 응답(`order`·`start`·`moveToNext` 없음, `kind` "장소")도 받아서 표시한다.
- 파일 줄바꿈: `.gitattributes`가 `eol=crlf`로 지정한 ai-planning 파일은 CRLF를 유지하고, 그 밖의 파일은 기존 줄바꿈을 따른다. 편집 후 `git diff --check`로 확인한다.
- 커밋 메시지: `<type>(<scope>): <subject>`, scope는 `app`(앱)·생략(서버·문서). 커밋 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 운영 배포(DB 마이그레이션, 함수, 프론트엔드)는 각 단계 직전에 사용자 확인을 받는다. 개발·운영이 같은 Supabase를 쓴다.
- 명령 실행 위치: 앱 명령은 `app/`, git은 저장소 루트. 단위 테스트 `npx vitest run <path>`, 전체 `npx vitest run`, e2e `npx playwright test e2e/ai-plan.spec.ts --reporter=line`, 빌드 `npx ng build`, lint `npm run lint`.

## Review Focus

1. 확인되지 않은 장소가 코스 중간에서 빠진 경우: 빠진 자리 앞뒤의 모델 이동시간을 보여 주면 틀린 값이 된다 → 직선거리만 표시 (Task 5 테스트).
2. 모델이 같은 날 시각을 거꾸로 준 경우(`14:00` 다음 `11:00`): 순서는 유지하고 뒤 항목 시각만 미정 (Task 3 테스트).
3. 날짜 미정 여행의 숙소: 숙소 카드는 보이지만 담기에서 빠지고 안내 문구가 보여야 함 (Task 8 테스트, Task 7 화면).
4. 같은 숙소가 1·2일차에 연속으로 나온 경우: 숙박 하나로 합쳐 체크아웃이 늘어나야 함 (Task 8 테스트).
5. 기존에 저장된 여행의 `place`와 공동 편집 미리보기의 모르는 분류 문자열: 관광으로 보이고 오류가 나지 않아야 함 (Task 1·2 테스트).

---

### Task 1: 분류 모델 확장과 DB 마이그레이션 파일

**Files:**
- Modify: `app/src/app/features/trips/model/trip.ts:10,109-121`
- Modify: `app/src/app/features/trips/util/kind-tone.ts`
- Modify: `app/src/app/shared/util/badge-tone.ts` (타입에 `activity`·`shopping` 추가)
- Modify: `app/src/app/shared/ui/badge/badge.ts`, `app/src/app/shared/ui/badge/badge.styles.ts`
- Modify: `app/src/styles/theme.css` (토큰 추가)
- Modify: `docs/design/DESIGN.md:36,90`
- Create: `supabase/migrations/20260930000000_stop_kind_activity_shopping.sql`
- Test: `app/src/app/features/trips/util/kind-tone.spec.ts` (없으면 생성)

**Interfaces:**
- Produces: `StopKind = 'place' | 'activity' | 'meal' | 'break' | 'shopping' | 'buffer'`; `PlanKind = Exclude<StopKind, 'buffer'> | 'stay'`; `STOP_KIND_LABEL: Record<StopKind,string>`; `PLAN_KIND_LABEL: Record<PlanKind,string>`; `STOP_KINDS: readonly StopKind[]`(화면 순서); `toStopKind(value: unknown): StopKind`(모르는 값 → `'place'`); `kindTone(kind: PlanKind | StopKind): BadgeTone`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// app/src/app/features/trips/util/kind-tone.spec.ts
import { describe, expect, it } from 'vitest';
import { kindTone } from './kind-tone';
import { PLAN_KIND_LABEL, STOP_KIND_LABEL, STOP_KINDS, toStopKind } from '../model/trip';

describe('일정 분류', () => {
  it('앱 전체가 쓰는 여섯 분류 라벨을 한 곳에서 정한다', () => {
    expect(PLAN_KIND_LABEL).toEqual({
      place: '관광', activity: '액티비티', meal: '식사', break: '카페', shopping: '쇼핑', stay: '숙소',
    });
    expect(STOP_KIND_LABEL.buffer).toBe('여유시간');
    expect(STOP_KINDS).toEqual(['place', 'activity', 'meal', 'break', 'shopping', 'buffer']);
  });
  it('분류마다 서로 다른 전용 색을 쓴다', () => {
    const tones = (['place', 'activity', 'meal', 'break', 'shopping', 'stay'] as const).map(kindTone);
    expect(new Set(tones).size).toBe(6);
    expect(kindTone('stay')).toBe('stay');
    expect(kindTone('buffer')).toBe('neutral');
  });
  it('모르는 분류 문자열은 관광으로 읽는다', () => {
    expect(toStopKind('activity')).toBe('activity');
    expect(toStopKind('sight')).toBe('place');
    expect(toStopKind(undefined)).toBe('place');
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/features/trips/util/kind-tone.spec.ts` → `PLAN_KIND_LABEL`·`toStopKind` 없음으로 FAIL.

- [ ] **Step 3: 구현**

`trip.ts`:
```ts
export type StopKind = 'place' | 'activity' | 'meal' | 'break' | 'shopping' | 'buffer';
/** AI 코스와 화면이 쓰는 분류. 숙소는 일반 장소가 아니라 stays로 담는다. */
export type PlanKind = Exclude<StopKind, 'buffer'> | 'stay';

/** 장소 추가·수정 화면과 선택 목록의 순서. */
export const STOP_KINDS: readonly StopKind[] = ['place', 'activity', 'meal', 'break', 'shopping', 'buffer'];

/**
 * 분류 라벨의 유일한 원본. 다른 기능은 자체 표를 두지 않고 이것을 쓴다(2026-09-30 분류 통일).
 * 저장값 'place'는 예전 '장소'이며 라벨만 '관광'으로 바꿨다. 'break'도 라벨만 카페다.
 */
export const STOP_KIND_LABEL: Record<StopKind, string> = {
  place: '관광',
  activity: '액티비티',
  meal: '식사',
  break: '카페',
  shopping: '쇼핑',
  buffer: '여유시간',
};

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  place: STOP_KIND_LABEL.place,
  activity: STOP_KIND_LABEL.activity,
  meal: STOP_KIND_LABEL.meal,
  break: STOP_KIND_LABEL.break,
  shopping: STOP_KIND_LABEL.shopping,
  stay: '숙소',
};

/** 저장소·서버에서 읽은 분류. 모르는 값은 관광으로 둔다. 이전 앱이 모르는 값을 만나도 깨지지 않게 한다. */
export function toStopKind(value: unknown): StopKind {
  return (STOP_KINDS as readonly unknown[]).includes(value) ? (value as StopKind) : 'place';
}
```
`STOP_KIND_DEFAULT_NAME`에 `activity: ''`, `shopping: ''`을 추가한다.

`kind-tone.ts`:
```ts
export function kindTone(kind: PlanKind | StopKind): BadgeTone {
  switch (kind) {
    case 'place': return 'place';
    case 'activity': return 'activity';
    case 'meal': return 'meal';
    case 'break': return 'cafe';
    case 'shopping': return 'shopping';
    case 'stay': return 'stay';
    default: return 'neutral';
  }
}
```

`badge-tone.ts`의 `BadgeTone`에 `'activity' | 'shopping'`을 추가하고 문서 주석의 "place·meal·cafe: 일정 분류 전용" 줄에 activity·shopping을 더한다. `badge.ts`에 `'[class.cell--activity]': "tone() === 'activity'"`, `'[class.cell--shopping]': "tone() === 'shopping'"`, `badge.styles.ts`에 `[&.cell--activity]:bg-activity-tint [&.cell--activity]:text-activity-ink [&.cell--shopping]:bg-shopping-tint [&.cell--shopping]:text-shopping-ink`를 추가한다.

`theme.css`의 meal/cafe 토큰 옆에 추가한다. 쇼핑은 가계부 쇼핑 분류와 같은 색을 써서 통일한다. 액티비티는 카페(청록)와 겹치지 않도록 주황 계열을 쓴다.
```css
  --color-activity-ink: #a5480c;
  --color-activity-tint: #fff0e5;
  --color-shopping-ink: var(--color-exp-shopping-ink);
  --color-shopping-tint: var(--color-exp-shopping-tint);
```
`scripts/check-contrast.mjs`가 새 ink/tint 쌍을 검사 목록에서 읽는지 확인하고, 목록이 하드코딩이면 두 쌍을 추가한다.

`DESIGN.md:36` 분류 행을 `관광 place-ink·place-tint, 액티비티 activity-ink·activity-tint, 식사 meal-…, 카페 cafe-…, 쇼핑 shopping-ink·shopping-tint(가계부 쇼핑과 같은 색), 숙소 stay-…`로, `:90` 배지 목록에 activity/shopping을 더한다.

마이그레이션:
```sql
-- 2026-09-30 AI 코스 분류 확장. 값을 추가만 하며 기존 행은 바뀌지 않는다.
-- 'place'는 그대로 두고 화면 라벨만 '관광'으로 바꾼다.
alter type public.stop_kind add value if not exists 'activity';
alter type public.stop_kind add value if not exists 'shopping';
```

- [ ] **Step 4: 컴파일 오류로 누락 찾기** — `npx ng build` 실행. `Record<StopKind, …>`에서 나는 오류를 이 Task의 파일에서만 고친다. 다른 기능 파일의 오류는 Task 2에서 고치므로 목록만 기록한다.

- [ ] **Step 5: 테스트 통과 확인** — `npx vitest run src/app/features/trips/util/kind-tone.spec.ts` PASS, `npm run lint` PASS(대비 검사 포함).

- [ ] **Step 6: 커밋**
```bash
git add app/src/app/features/trips/model/trip.ts app/src/app/features/trips/util/kind-tone.ts app/src/app/features/trips/util/kind-tone.spec.ts app/src/app/shared/util/badge-tone.ts app/src/app/shared/ui/badge app/src/styles/theme.css docs/design/DESIGN.md supabase/migrations/20260930000000_stop_kind_activity_shopping.sql
git commit -m "feat(app): 일정 분류에 액티비티·쇼핑을 더하고 장소 라벨을 관광으로 바꾼다"
```

### Task 2: 앱 전체 분류 통일

**Files:**
- Modify: `app/src/app/features/trips/feature/stop-form/stop-form.ts:69` (+ 템플릿이 `kinds`를 도는지 확인)
- Modify: `app/src/app/features/trips/feature/trip-detail/trip-detail.ts:151-154`
- Modify: `app/src/app/features/collaboration/util/preview-trip.ts:5,22`
- Modify: `app/src/app/features/expenses/util/expense-link.ts:17` 및 분류 매핑 함수
- Modify: `app/src/app/features/stats/util/saved-markers.ts:9`, `app/src/app/features/stats/util/visit-tally.ts:116`
- Modify: `app/src/app/features/travel-chat/util/local-command-targets.ts:38-40`
- Modify: `supabase/functions/ai-chat/contract.ts:6,21`, `supabase/functions/ai-chat/prompt.ts:5,17`
- Modify: `app/src/app/features/trips/data/trip-rows.ts` (DB 행 → 모델 변환에서 `toStopKind` 사용)
- Test: 각 파일의 기존 spec (`preview-trip.spec.ts`, `expense-link.spec.ts`, `visit-tally.spec.ts`, `local-command-targets.spec.ts` 또는 이를 부르는 spec, `trip-rows.spec.ts`)

**Interfaces:**
- Consumes: Task 1의 `StopKind`, `STOP_KINDS`, `STOP_KIND_LABEL`, `toStopKind`.
- Produces: `isSightseeing(kind: StopKind): boolean` (`trips/model/trip.ts`, place·activity·shopping → true) — 통계 'travel' 필터가 사용.

- [ ] **Step 1: 실패하는 테스트 작성** (각 spec 파일 끝에 추가)

```ts
// preview-trip.spec.ts
it('새 분류는 그대로, 모르는 분류는 관광으로 읽는다', () => {
  const trip = previewTrip({ ...BASE_PREVIEW, stops: [{ ...BASE_STOP, kind: 'activity' }, { ...BASE_STOP, name: 'x', kind: 'unknown' }] });
  expect(trip.stops.map(s => s.kind)).toEqual(['activity', 'place']);
});
// expense-link.spec.ts
it('액티비티는 관광·활동, 쇼핑은 쇼핑 지출로 옮긴다', () => {
  const links = expenseLinks({ stops: [stop('a', 'activity'), stop('s', 'shopping')], stays: [] });
  expect(links.map(l => l.category)).toEqual(['activity', 'shopping']);
});
// visit-tally.spec.ts
it('여행지 필터는 관광·액티비티·쇼핑을 함께 센다', () => {
  const trip = tripWith([stopAt('place'), stopAt('activity'), stopAt('shopping'), stopAt('meal')]);
  expect(tallyVisits([trip], 'travel').total).toBe(3);
});
// local-command-targets 테스트
it.each([['관광 전부 빼줘', 'place'], ['액티비티 전부 빼줘', 'activity'], ['쇼핑 전부 빼줘', 'shopping']])('%s는 %s만 고른다', (text, kind) => {
  const targets = commandTargets(text, tripWithAllKinds(), TODAY);
  expect(Array.isArray(targets) && targets.every(s => s.kind === kind)).toBe(true);
});
```
기존 spec의 도우미 이름(`previewTrip`, `expenseLinks`, `tallyVisits`, `commandTargets`, `BASE_*`, `stop`, `stopAt`, `tripWithAllKinds`)은 각 파일에 실제로 있는 이름으로 맞춘다. 없는 도우미는 그 spec 안에 작은 팩토리로 만든다(`createStop`/`createTrip` 사용).

- [ ] **Step 2: 실패 확인** — 각 spec을 `npx vitest run <path>`로 실행해 FAIL 확인.

- [ ] **Step 3: 구현**
  - `stop-form.ts:69`: `readonly kinds = STOP_KINDS;`. 191행의 포함 검사는 `STOP_KINDS.includes(k as StopKind)`로 바꾼다. 115행의 필수 이름 검사는 `STOP_KIND_DEFAULT_NAME[this.kind()] === ''`(관광·액티비티·쇼핑)일 때 적용하고 문구를 `'이름을 입력하세요.'`로 바꾼다.
  - `trip-detail.ts:151-154`: 라벨을 `STOP_KIND_LABEL`에서 가져온다. `stop(null, STOP_KIND_LABEL.place, 'place', 'add-stop')`, `stop('meal', STOP_KIND_LABEL.meal, …)`, `stop('break', STOP_KIND_LABEL.break, …)`("휴식" → "카페"로 통일), 여유시간은 그대로. 액티비티·쇼핑은 장소 추가 화면의 분류 선택에서 고른다(빠른 추가 버튼은 늘리지 않는다).
  - `preview-trip.ts`: `KINDS`를 지우고 `kind: toStopKind(s.kind)`.
  - `expense-link.ts`: `kind: StopKind`(import)로 바꾸고 매핑에 `activity → 'activity'`, `shopping → 'shopping'`을 추가한다. `place`는 기존 매핑을 유지한다.
  - `trip.ts`에 `export function isSightseeing(kind: StopKind): boolean { return kind === 'place' || kind === 'activity' || kind === 'shopping'; }`를 추가하고, `saved-markers.ts:9`와 `visit-tally.ts:116`의 `filter === 'travel' ? 'place' : filter` 비교를 `filter === 'travel' ? isSightseeing(stop.kind) : stop.kind === filter`로 바꾼다.
  - `local-command-targets.ts:38`: 기존 분기 앞에 추가한다.
    ```ts
    if (/액티비티|체험/.test(scope)) targets = targets.filter(s => s.kind === 'activity');
    else if (/쇼핑/.test(scope)) targets = targets.filter(s => s.kind === 'shopping');
    else if (/관광/.test(scope)) targets = targets.filter(s => s.kind === 'place');
    else if (/카페/.test(scope)) …(기존 그대로)
    ```
  - `ai-chat/contract.ts`: 허용 목록 `['place','activity','meal','break','shopping','buffer']`, 타입도 같게. `ai-chat/prompt.ts:5`: `places.kind는 place(관광),activity(액티비티),meal(식사),break(카페),shopping(쇼핑),buffer(여유)만 사용한다.`, `:17` enum 동일.
  - `trip-rows.ts`: DB 행의 `kind`를 모델로 옮기는 곳에 `toStopKind(row.kind)`.
  - `rg "'장소'|휴식" app/src/app --glob '!*.spec.ts'`로 분류 뜻으로 남은 하드코딩 라벨을 찾아 `STOP_KIND_LABEL`로 바꾼다(장소라는 일반 명사로 쓴 문구는 두지 않고 그대로 둔다).

- [ ] **Step 4: 통과 확인** — 위 spec들과 `npx ng build` PASS. `npx vitest run` 전체 PASS(라벨 "장소"를 기대하던 기존 테스트는 "관광"으로 고친다).

- [ ] **Step 5: 커밋**
```bash
git add -A app/src/app supabase/functions/ai-chat
git commit -m "refactor(app): 일정 분류 라벨과 판정을 공통 정의로 통일한다"
```
(서버 `ai-chat` 변경이 함께 들어가므로 커밋 본문에 "ai-chat 허용 분류에 activity·shopping 추가"를 적는다.)

### Task 3: AI 응답 해석 — 코스 필드

**Files:**
- Modify: `app/src/app/features/ai-planning/util/ai-response.ts`
- Test: `app/src/app/features/ai-planning/util/ai-response.spec.ts`

**Interfaces:**
- Consumes: Task 1 `PlanKind`.
- Produces:
```ts
export type MoveMode = '도보' | '대중교통' | '자가용' | '택시';
export interface AiMove { readonly mode: MoveMode; readonly minutes: number }
export interface AiItem {
  readonly estimate?: PlanEstimate;
  readonly day: number;
  readonly order: number;        // 그날 안의 1부터 순서(응답 순서로 보정)
  readonly start: string | null; // 'HH:mm' 또는 미정
  readonly moveToNext: AiMove | null;
  readonly name: string;
  readonly kind: PlanKind;
}
export function parseAiItems(content: string, dayCount: number): AiItem[];
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const json = (items: unknown[]) => JSON.stringify({ items });
it('여섯 분류와 이전 라벨 장소를 읽는다', () => {
  const out = parseAiItems(json(['관광', '액티비티', '식사', '카페', '쇼핑', '숙소', '장소', '???'].map((kind, i) => ({ day: 1, name: `곳${i}`, kind }))), 1);
  expect(out.map(i => i.kind)).toEqual(['place', 'activity', 'meal', 'break', 'shopping', 'stay', 'place', 'place']);
});
it('순서·시각·이동을 읽고 잘못된 값만 미정으로 둔다', () => {
  const out = parseAiItems(json([
    { day: 1, order: 1, name: 'A', kind: '관광', start: '10:00', moveToNext: { mode: '도보', minutes: 10 } },
    { day: 1, order: 2, name: 'B', kind: '식사', start: '25:00', moveToNext: { mode: '비행기', minutes: 10 } },
    { day: 1, order: 3, name: 'C', kind: '카페', start: '13:30', moveToNext: { mode: '도보', minutes: 0 } },
  ]), 1);
  expect(out.map(i => [i.order, i.start, i.moveToNext])).toEqual([
    [1, '10:00', { mode: '도보', minutes: 10 }], [2, null, null], [3, '13:30', null],
  ]);
});
it('같은 날 시각이 거꾸로 가면 순서는 두고 뒤 항목 시각만 미정으로 둔다', () => {
  const out = parseAiItems(json([
    { day: 1, order: 1, name: 'A', kind: '관광', start: '14:00' },
    { day: 1, order: 2, name: 'B', kind: '관광', start: '11:00' },
  ]), 1);
  expect(out.map(i => [i.name, i.start])).toEqual([['A', '14:00'], ['B', null]]);
});
it('순서가 없거나 겹치면 응답 순서로 다시 매긴다', () => {
  const out = parseAiItems(json([
    { day: 1, name: 'A', kind: '관광' }, { day: 2, order: 1, name: 'C', kind: '관광' },
    { day: 1, order: 1, name: 'B', kind: '관광' },
  ]), 2);
  expect(out.map(i => [i.name, i.day, i.order])).toEqual([['A', 1, 1], ['C', 2, 1], ['B', 1, 2]]);
});
it('이전 응답도 시각 없이 읽는다', () => {
  expect(parseAiItems(json([{ day: 1, name: 'A', kind: '장소' }]), 1)[0]).toMatchObject({ order: 1, start: null, moveToNext: null, kind: 'place' });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/features/ai-planning/util/ai-response.spec.ts` FAIL.

- [ ] **Step 3: 구현**

```ts
const KIND_BY_LABEL: Readonly<Record<string, PlanKind>> = {
  관광: 'place', 장소: 'place', 액티비티: 'activity', 식사: 'meal', 카페: 'break', 쇼핑: 'shopping', 숙소: 'stay',
};
const MOVE_MODES: readonly MoveMode[] = ['도보', '대중교통', '자가용', '택시'];

function parseStart(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h! <= 23 && m! <= 59 ? value : null;
}
function parseMove(value: unknown): AiMove | null {
  const v = value as { mode?: unknown; minutes?: unknown } | null;
  if (!v || typeof v !== 'object') return null;
  if (!MOVE_MODES.includes(v.mode as MoveMode)) return null;
  if (typeof v.minutes !== 'number' || !Number.isInteger(v.minutes) || v.minutes < 1 || v.minutes > 600) return null;
  return { mode: v.mode as MoveMode, minutes: v.minutes };
}
```
루프는 기존 검사를 유지하고 항목마다 `rawOrder`, `start: parseStart(item.start)`, `moveToNext: parseMove(item.moveToNext)`를 모은다. 루프가 끝난 뒤 일차별로:
1. 그날 항목의 `rawOrder`가 모두 1 이상 정수이고 서로 다르면 그 값으로 정렬하고, 아니면 응답 순서를 쓴다.
2. 정렬 결과에 1부터 `order`를 다시 매긴다.
3. 앞 항목(시각 있는 마지막 항목)보다 이른 `start`는 `null`로 바꾼다.
반환 배열은 원래 응답 순서(일차 섞임 포함)를 유지하고 각 항목에 보정된 `order`·`start`만 넣는다(마지막 테스트의 기대값 순서).

- [ ] **Step 4: 통과 확인** — 해당 spec PASS.

- [ ] **Step 5: 커밋**
```bash
git add app/src/app/features/ai-planning/util/ai-response.ts app/src/app/features/ai-planning/util/ai-response.spec.ts
git commit -m "feat(app): AI 응답에서 코스 순서·추천 시각·이동과 세부 분류를 읽는다"
```

### Task 4: 장소 확인 — 분류 결합과 코스 필드 보존

**Files:**
- Modify: `app/src/app/features/ai-planning/model/ai-plan.ts` (`VerifiedItem`)
- Modify: `app/src/app/features/ai-planning/data/verify-places.ts:84-137`
- Test: `app/src/app/features/ai-planning/data/verify-places.spec.ts`

**Interfaces:**
- Consumes: Task 3 `AiItem`, `AiMove`, `PlanKind`.
- Produces: `VerifiedItem`에 `order: number; start: string | null; moveToNext: AiMove | null; kind: PlanKind` (기존 `kind: StopKind` 대체). `export function kindFromCategory(category: string, fallback: PlanKind): PlanKind`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe('kindFromCategory', () => {
  it.each([
    ['음식점 > 한식', 'place', 'meal'], ['카페', 'meal', 'break'], ['숙박 > 호텔', 'place', 'stay'],
    ['관광명소', 'activity', 'activity'], ['시장', 'shopping', 'shopping'], ['관광명소', 'stay', 'place'],
    ['문화유적', 'meal', 'place'], ['', 'shopping', 'shopping'],
  ] as const)('%s + 모델 %s → %s', (category, model, expected) => {
    expect(kindFromCategory(category, model)).toBe(expected);
  });
});
it('확인한 장소는 순서·시각·이동을 그대로 들고 간다', async () => {
  const [item] = await verifyPlaces([{ day: 1, order: 2, start: '11:00', moveToNext: { mode: '도보', minutes: 5 }, name: '안목해변', kind: 'activity' }], ['강릉시'], fixtureSearch());
  expect(item).toMatchObject({ verified: true, order: 2, start: '11:00', moveToNext: { mode: '도보', minutes: 5 }, kind: 'activity' });
});
```
(`fixtureSearch()`는 기존 spec의 검색 대역을 쓴다. 없으면 `new FixturePlaceSearch()`.)

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현**

```ts
/**
 * 검색 분류는 먹는 곳·숙박을 정확히 가르지만 관광·액티비티·쇼핑은 가르지 못한다.
 * 그래서 앞의 셋은 검색을 따르고, 나머지는 모델 분류를 쓴다. 모델이 먹는 곳·숙소라고
 * 했는데 검색이 아니라고 하면 관광으로 낮춘다.
 */
export function kindFromCategory(category: string, fallback: PlanKind): PlanKind {
  if (category.includes('카페') || category.includes('디저트')) return 'break';
  if (category.includes('음식점') || category.includes('식당')) return 'meal';
  if (category.includes('숙박')) return 'stay';
  if (!category) return fallback;
  return fallback === 'meal' || fallback === 'break' || fallback === 'stay' ? 'place' : fallback;
}
```
`verifyOne`의 `base`에 `order: item.order, start: item.start, moveToNext: item.moveToNext`를 더한다. `VerifiedItem`의 `kind` 타입을 `PlanKind`로 바꾸고 `order`·`start`·`moveToNext` 필드를 문서 주석과 함께 추가한다(추천 시각·이동은 "AI 추정, 저장하지 않음").

- [ ] **Step 4: 통과 확인** — spec PASS, `npx ng build`로 `VerifiedItem.kind` 타입 변경 영향 확인(담기 쪽 오류는 Task 8에서 고친다. 이 단계에서는 `ai-selection.ts`에 `kind: item.kind === 'stay' ? 'place' : item.kind` 임시 변환을 넣어 빌드를 통과시키고, Task 8이 제대로 처리한다).

- [ ] **Step 5: 커밋**
```bash
git add app/src/app/features/ai-planning/model/ai-plan.ts app/src/app/features/ai-planning/data/verify-places.ts app/src/app/features/ai-planning/data/verify-places.spec.ts app/src/app/features/trips/util/ai-selection.ts
git commit -m "feat(app): 장소 확인에서 검색 분류와 모델 분류를 결합하고 코스 정보를 보존한다"
```

### Task 5: 코스 계산 순수 함수

**Files:**
- Create: `app/src/app/features/ai-planning/util/course.ts`
- Test: `app/src/app/features/ai-planning/util/course.spec.ts`

**Interfaces:**
- Consumes: `PlanItem`(=`VerifiedItem`, Task 4), `haversineKm(a: GeoPoint, b: GeoPoint): number` (`trips/util/itinerary.ts:102`).
- Produces:
```ts
export interface CourseLeg { readonly mode: MoveMode | null; readonly minutes: number | null; readonly km: number | null }
export interface CourseEntry {
  readonly item: PlanItem;       // day는 옮긴 일차가 반영된 값
  readonly start: string | null; // 옮긴 항목은 null
  readonly moved: boolean;
  readonly selected: boolean;
  /** 앞의 선택된 항목에서 오는 이동. 선택된 항목에만 있고 그날 첫 선택 항목은 null. */
  readonly legFromPrev: CourseLeg | null;
}
export interface DayCourse { readonly day: number; readonly entries: readonly CourseEntry[] }
export function buildCourses(
  results: readonly PlanItem[],
  selected: ReadonlySet<string>,
  overrides: Readonly<Record<string, number>>,
  days: readonly number[],
): DayCourse[];
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import { buildCourses } from './course';
import type { PlanItem } from '../model/ai-plan';

const P = (id: string, day: number, order: number, extra: Partial<PlanItem> = {}): PlanItem => ({
  id, day, order, name: id, kind: 'place', start: `1${order}:00`, moveToNext: { mode: '도보', minutes: 10 },
  verified: true, note: '', address: '', location: { lat: 37.5, lng: 127 + order * 0.01 }, placeRef: null, ...extra,
});
const all = (items: PlanItem[]) => new Set(items.map(i => i.id));

describe('buildCourses', () => {
  it('일차별로 순서대로 늘어놓고 인접 항목 사이에 모델 이동과 직선거리를 붙인다', () => {
    const items = [P('b', 1, 2), P('a', 1, 1), P('c', 2, 1)];
    const [d1, d2] = buildCourses(items, all(items), {}, [1, 2]);
    expect(d1!.entries.map(e => e.item.id)).toEqual(['a', 'b']);
    expect(d1!.entries[0]!.legFromPrev).toBeNull();
    expect(d1!.entries[1]!.legFromPrev).toMatchObject({ mode: '도보', minutes: 10 });
    expect(d1!.entries[1]!.legFromPrev!.km).toBeGreaterThan(0);
    expect(d2!.entries.map(e => e.item.id)).toEqual(['c']);
  });
  it('중간 항목이 빠졌거나 해제되면 건너뛴 구간은 직선거리만 보인다', () => {
    const items = [P('a', 1, 1), P('b', 1, 2), P('c', 1, 4)]; // order 3은 장소 확인 실패로 빠짐
    const [d1] = buildCourses(items, new Set(['a', 'c']), {}, [1]);
    const [a, b, c] = d1!.entries;
    expect(b!.selected).toBe(false);
    expect(b!.legFromPrev).toBeNull();
    expect(c!.legFromPrev).toMatchObject({ mode: null, minutes: null });
    expect(c!.legFromPrev!.km).toBeGreaterThan(0);
    expect(a!.start).toBe('11:00');
  });
  it('다른 일차로 옮긴 항목은 그날 끝(숙소 앞)에 붙고 시각·모델 이동이 없다', () => {
    const items = [P('a', 1, 1), P('h', 1, 2, { kind: 'stay' }), P('x', 2, 1)];
    const [d1] = buildCourses(items, all(items), { x: 1 }, [1, 2]);
    expect(d1!.entries.map(e => e.item.id)).toEqual(['a', 'x', 'h']);
    const x = d1!.entries[1]!;
    expect(x).toMatchObject({ moved: true, start: null });
    expect(x.item.day).toBe(1);
    expect(x.legFromPrev).toMatchObject({ mode: null, minutes: null });
    expect(d1!.entries[2]!.legFromPrev).toMatchObject({ mode: null, minutes: null });
  });
  it('좌표가 없으면 직선거리도 비우고, 항목이 없는 일차는 뺀다', () => {
    const items = [P('a', 1, 1, { location: null }), P('b', 1, 2)];
    const courses = buildCourses(items, all(items), {}, [1, 2]);
    expect(courses).toHaveLength(1);
    expect(courses[0]!.entries[1]!.legFromPrev).toMatchObject({ mode: '도보', minutes: 10, km: null });
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/features/ai-planning/util/course.spec.ts` FAIL(모듈 없음).

- [ ] **Step 3: 구현**

```ts
import { haversineKm } from '../../trips/util/itinerary';
import type { PlanItem } from '../model/ai-plan';
import type { MoveMode } from './ai-response';

/**
 * 결과를 일차별 시간순 코스로 늘어놓는다. 순수 계산이라 화면과 담기가 같이 쓴다.
 *
 * 모델 이동시간은 모델이 짠 바로 다음 항목까지의 추정이다. 사이 항목이 빠졌거나(장소 확인
 * 실패·해제) 순서가 바뀌면(일차 이동) 맞지 않으므로 버리고, 확인된 좌표의 직선거리만 남긴다.
 */
export function buildCourses(
  results: readonly PlanItem[],
  selected: ReadonlySet<string>,
  overrides: Readonly<Record<string, number>>,
  days: readonly number[],
): DayCourse[] {
  const courses: DayCourse[] = [];
  for (const day of days) {
    const own = results.filter(i => (overrides[i.id] ?? i.day) === day);
    const stays = (moved: boolean) => own.filter(i => i.kind === 'stay' && isMoved(i) === moved);
    const isMoved = (i: PlanItem) => overrides[i.id] !== undefined && overrides[i.id] !== i.day;
    const kept = own.filter(i => i.kind !== 'stay' && !isMoved(i)).sort((a, b) => a.order - b.order);
    const moved = own.filter(i => i.kind !== 'stay' && isMoved(i));
    const ordered = [...kept, ...moved, ...stays(false).sort((a, b) => a.order - b.order), ...stays(true)];
    if (!ordered.length) continue;
    let prev: PlanItem | null = null;
    const entries = ordered.map((raw): CourseEntry => {
      const wasMoved = isMoved(raw);
      const item = wasMoved ? { ...raw, day } : raw;
      const isSelected = selected.has(raw.id);
      let leg: CourseLeg | null = null;
      if (isSelected && prev) {
        const adjacent = !isMoved(prev) && !wasMoved && prev.day === raw.day && raw.order === prev.order + 1;
        const move = adjacent ? prev.moveToNext : null;
        leg = {
          mode: move?.mode ?? null,
          minutes: move?.minutes ?? null,
          km: prev.location && raw.location ? Math.round(haversineKm(prev.location, raw.location) * 10) / 10 : null,
        };
      }
      if (isSelected) prev = raw;
      return { item, start: wasMoved ? null : raw.start, moved: wasMoved, selected: isSelected, legFromPrev: leg };
    });
    courses.push({ day, entries });
  }
  return courses;
}
```
타입 선언(`CourseLeg`·`CourseEntry`·`DayCourse`)은 Interfaces 블록 그대로 같은 파일에 export한다. `isMoved`는 `stays`보다 먼저 선언되도록 위치를 정리한다(위 코드의 선언 순서를 `isMoved` → `stays` → `kept`로 바꾼다).

- [ ] **Step 4: 통과 확인** — spec PASS.

- [ ] **Step 5: 커밋**
```bash
git add app/src/app/features/ai-planning/util/course.ts app/src/app/features/ai-planning/util/course.spec.ts
git commit -m "feat(app): AI 결과를 일차별 시간순 코스로 계산하는 순수 함수 추가"
```

### Task 6: 분류별 예산 합계와 스토어 연결

**Files:**
- Modify: `app/src/app/shared/util/plan-estimate.ts` (`summarizeGroups` 추가)
- Modify: `app/src/app/features/ai-planning/data/ai-plan-store.ts:72-78,84-125,266-275`
- Test: `app/src/app/shared/util/plan-estimate.spec.ts`(없으면 `ai-planning/util/plan-estimates.spec.ts`에 추가), `app/src/app/features/ai-planning/data/ai-plan-store.spec.ts`

**Interfaces:**
- Consumes: Task 5 `buildCourses`, `DayCourse`; 기존 `costRange`, `summarizeEstimates`.
- Produces:
  - `export type BudgetGroup = 'stay' | 'food' | 'sight' | 'shopping';`
  - `export function budgetGroupOf(kind: PlanKind): BudgetGroup` (`ai-planning/util/course.ts`에 추가: stay→stay, meal·break→food, place·activity→sight, shopping→shopping)
  - `export function summarizeGroups<K extends string>(items: readonly { group: K; estimate?: PlanEstimate }[], partySize: number, groups: readonly K[]): Record<K, { min: number; max: number; known: number; unknown: number }>` (plan-estimate.ts)
  - 스토어: `readonly courses: Signal<DayCourse[]>`, `readonly groupSummary: Signal<Record<BudgetGroup, …>>`, `readonly budgetRemaining: Signal<number | null>`(예산 − 총액 상한, 음수면 초과), `readonly staysNeedDates: Signal<boolean>`(날짜 미정이고 선택된 숙소가 있으면 true). 기존 `dayGroups`는 제거하고 `costSummary`·`budgetExceeded`는 유지한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// plan-estimate spec
it('분류 묶음별로 합계와 미정 개수를 센다', () => {
  const cost = (min: number, max: number) => ({ cost: { min, max, basis: 'group' as const, quantity: 1, assumption: 'x' }, stay: null });
  const out = summarizeGroups([
    { group: 'food', estimate: cost(10000, 12000) }, { group: 'food' },
    { group: 'stay', estimate: cost(90000, 120000) },
  ], 2, ['stay', 'food', 'sight', 'shopping'] as const);
  expect(out.food).toEqual({ min: 10000, max: 12000, known: 1, unknown: 1 });
  expect(out.stay.max).toBe(120000);
  expect(out.sight).toEqual({ min: 0, max: 0, known: 0, unknown: 0 });
});
// ai-plan-store spec (기존 threeDayTrip·fakeAi 도우미 사용)
it('코스와 분류별 합계를 계산하고 해제·일차 이동을 반영한다', async () => {
  const est = (max: number) => ({ cost: { min: max, max, basis: 'group' as const, quantity: 1, assumption: 'x' }, stay: null });
  const store = threeDayTrip(fakeAi({ generate: async () => [
    { day: 1, order: 1, start: '10:00', moveToNext: null, name: '안목해변', kind: 'activity', estimate: est(5000) },
    { day: 1, order: 2, start: '12:00', moveToNext: null, name: '속초관광수산시장', kind: 'meal', estimate: est(20000) },
  ] }));
  store.set('budget', 10000);
  await store.generate();
  expect(store.courses()[0]!.entries).toHaveLength(2);
  expect(store.budgetRemaining()).toBeLessThan(0);
  store.toggle(store.courses()[0]!.entries[1]!.item.id);
  expect(store.budgetRemaining()).toBe(5000);
  store.setDay(store.courses()[0]!.entries[0]!.item.id, 2);
  expect(store.courses().map(c => c.day)).toEqual([1, 2]);
  expect(store.courses()[1]!.entries[0]).toMatchObject({ moved: true, start: null });
});
it('날짜 미정이면 선택된 숙소가 있을 때 안내 신호를 켠다', async () => {
  const store = undatedTrip(fakeAi({ generate: async () => [
    { day: 1, order: 1, start: null, moveToNext: null, name: '강릉 테스트 호텔', kind: 'stay' },
  ] }));
  await store.generate();
  expect(store.staysNeedDates()).toBe(true);
});
```
`undatedTrip`이 없으면 spec 안에 `threeDayTrip`을 복사해 날짜를 비운 도우미로 만든다. 기존 `dayGroups`를 기대하던 테스트(`ai-plan-store.spec.ts:16-33`)는 `courses`·`groupSummary` 기준으로 고친다.

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현**
  - `plan-estimate.ts`에 `summarizeGroups`를 추가한다. 내부에서 `costRange(item.estimate, partySize)`를 쓰고, 결과 객체는 `groups`마다 0으로 초기화한다.
  - `course.ts`에 `BudgetGroup`, `budgetGroupOf`, `BUDGET_GROUPS: readonly BudgetGroup[] = ['stay','food','sight','shopping']`, `BUDGET_GROUP_LABEL: Record<BudgetGroup,string> = { stay: '숙박', food: '식비', sight: '관광·체험', shopping: '쇼핑(선택 지출)' }`를 추가한다.
  - 스토어:
    ```ts
    readonly courses = computed(() => buildCourses(this.results(), this.selected(), this.dayOverrides(), this.dayChoices()));
    private readonly selectedItems = computed(() => this.courses().flatMap(c => c.entries).filter(e => e.selected).map(e => e.item));
    readonly costSummary = computed(() => summarizeEstimates(this.selectedItems(), this.partySize()));
    readonly groupSummary = computed(() => summarizeGroups(this.selectedItems().map(i => ({ group: budgetGroupOf(i.kind), estimate: i.estimate })), this.partySize(), BUDGET_GROUPS));
    readonly budgetRemaining = computed(() => this.totalBudget() === null ? null : this.totalBudget()! - this.costSummary().max);
    readonly staysNeedDates = computed(() => !this.startDate() && this.selectedItems().some(i => i.kind === 'stay'));
    ```
    `dayGroups`를 지우고, `items` computed는 `selection()`이 `courses` 기준으로 바뀌므로 화면이 더 쓰지 않으면 지운다(`ai-plan-flow.ts:66 planItems`가 쓰면 `courses` 평탄화로 대체). `selection()`의 `items`는 `this.courses().flatMap(c => c.entries).filter(e => e.selected).map(e => ({ ...e.item, start: e.start }))`로 바꿔 코스 순서와 옮긴 항목의 시각 미정이 담기까지 전달되게 한다.

- [ ] **Step 4: 통과 확인** — 두 spec PASS, `npx ng build`(템플릿의 `dayGroups` 참조 오류는 Task 7에서 고치므로 이 단계에서는 템플릿의 `draft.dayGroups()`를 `draft.courses()`로 이름만 바꾸고 `group.items`를 `group.entries`의 `e.item`으로 바꿔 빌드를 통과시킨다).

- [ ] **Step 5: 커밋**
```bash
git add app/src/app/shared/util/plan-estimate.ts app/src/app/shared/util/plan-estimate.spec.ts app/src/app/features/ai-planning
git commit -m "feat(app): AI 코스를 스토어에 연결하고 분류별 예산 합계를 계산한다"
```

### Task 7: 결과 화면 — 시간순 코스 카드

**Files:**
- Modify: `app/src/app/features/ai-planning/feature/ai-plan-flow/ai-plan-flow.html:386-560` (결과 섹션)
- Modify: `app/src/app/features/ai-planning/feature/ai-plan-flow/ai-plan-flow.ts` (도우미)
- Modify: `.impeccable/surfaces/`의 일정 짜기 화면 계약 파일(있으면)
- Test: e2e는 Task 9, 여기서는 컴포넌트 도우미 단위 테스트 `app/src/app/features/ai-planning/util/course-format.spec.ts`

**Interfaces:**
- Consumes: 스토어 `courses`, `groupSummary`, `budgetRemaining`, `staysNeedDates`, `costSummary`, `totalBudget`; `PLAN_KIND_LABEL`, `kindTone`, `costRange`, `costBasis`, `wonRange`, `BUDGET_GROUPS`, `BUDGET_GROUP_LABEL`.
- Produces (`app/src/app/features/ai-planning/util/course-format.ts`):
  - `export function formatDuration(minutes: number): string` — 70 → `1시간 10분`, 45 → `45분`, 120 → `2시간`
  - `export function courseHeadline(start: string | null, stayMax: number | null, kindLabel: string, area: string): string` — `11:25 (1시간 10분) · 액티비티 · 해운대구`, 시각·체류·지역이 없으면 그 부분을 뺀다
  - `export function legText(leg: CourseLeg): string | null` — `도보 약 10분 · AI 추정 · 직선 0.8km`, 모델 이동 없으면 `직선 0.8km`, 둘 다 없으면 `null`
  - `export function areaOf(address: string): string` — 주소의 시·군·구 토큰(`서울 종로구 사직로 161` → `종로구`, `강원 강릉시 …` → `강릉시`), 없으면 `''`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import { areaOf, courseHeadline, formatDuration, legText } from './course-format';

it('체류시간을 시간·분으로 쓴다', () => {
  expect([formatDuration(45), formatDuration(70), formatDuration(120)]).toEqual(['45분', '1시간 10분', '2시간']);
});
it('카드 첫 줄은 비어 있는 값을 빼고 잇는다', () => {
  expect(courseHeadline('11:25', 70, '액티비티', '해운대구')).toBe('11:25 (1시간 10분) · 액티비티 · 해운대구');
  expect(courseHeadline(null, null, '관광', '')).toBe('관광');
  expect(courseHeadline(null, 60, '식사', '중구')).toBe('1시간 · 식사 · 중구');
});
it('이동 줄은 모델 추정과 직선거리를 구분한다', () => {
  expect(legText({ mode: '도보', minutes: 10, km: 0.8 })).toBe('도보 약 10분 · AI 추정 · 직선 0.8km');
  expect(legText({ mode: null, minutes: null, km: 2.4 })).toBe('직선 2.4km');
  expect(legText({ mode: null, minutes: null, km: null })).toBeNull();
});
it('주소에서 시·군·구를 뽑는다', () => {
  expect(areaOf('서울 종로구 사직로 161')).toBe('종로구');
  expect(areaOf('강원특별자치도 강릉시 창해로 14')).toBe('강릉시');
  expect(areaOf('')).toBe('');
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 도우미 구현** (`course-format.ts`)

```ts
import type { CourseLeg } from './course';

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`;
}
export function courseHeadline(start: string | null, stayMax: number | null, kindLabel: string, area: string): string {
  const time = [start, stayMax ? (start ? `(${formatDuration(stayMax)})` : formatDuration(stayMax)) : null].filter(Boolean).join(' ');
  return [time, kindLabel, area].filter(Boolean).join(' · ');
}
export function legText(leg: CourseLeg): string | null {
  const parts = [
    leg.mode && leg.minutes ? `${leg.mode} 약 ${leg.minutes}분 · AI 추정` : null,
    leg.km !== null ? `직선 ${leg.km}km` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
export function areaOf(address: string): string {
  return address.split(/\s+/).find((t, i) => i > 0 && /[시군구]$/.test(t)) ?? '';
}
```

- [ ] **Step 4: 템플릿 교체**

결과 섹션(`@case ('result')`)의 비용 요약 `section`과 목록 `section`을 아래 구조로 바꾼다. 기존 체크박스 클래스 문자열, `app-map-links`, 일차 `select` 마크업과 주석은 그대로 옮겨 쓴다. 디자인은 `docs/design/DESIGN.md` 토큰·공통 UI만 쓰고 참고 화면의 모양을 복제하지 않는다.

```html
<section class="bg-panel rounded-panel shadow-panel p-4" aria-labelledby="ai-cost-title" data-testid="ai-cost-summary">
  <h2 id="ai-cost-title" class="text-13 font-medium text-ink-3">예상 총액 · AI 추정</h2>
  @let costs = draft.costSummary();
  <p class="text-22 font-bold tabular-nums mt-1">{{ wonRange(costs.known ? costs : null) }}</p>
  @if (draft.budgetRemaining() !== null) {
    <p class="text-13 mt-1 tabular-nums" [class.text-danger-ink]="draft.budgetRemaining()! < 0" data-testid="ai-budget-remaining">
      예산 {{ draft.totalBudget()!.toLocaleString('ko-KR') }}원 대비
      {{ draft.budgetRemaining()! < 0 ? '초과 ' + (-draft.budgetRemaining()!).toLocaleString('ko-KR') : '여유 ' + draft.budgetRemaining()!.toLocaleString('ko-KR') }}원
    </p>
  }
  <dl class="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 text-14" data-testid="ai-budget-groups">
    @for (g of budgetGroups; track g) {
      @let s = draft.groupSummary()[g];
      <dt>{{ budgetGroupLabel[g] }}</dt>
      <dd class="text-right tabular-nums">{{ wonRange(s.known ? s : null) }}@if (s.unknown) { <span class="text-12 text-ink-3"> · 미정 {{ s.unknown }}곳</span> }</dd>
    }
  </dl>
  <p class="text-12 text-ink-3 mt-3">출발지 교통비와 이동 교통비는 포함하지 않아요. 요금은 AI 추정이며 미정 항목은 합계에서 빠져요. 예산 안에 든다고 보장하지 않아요.</p>
</section>

@if (draft.staysNeedDates()) {
  <div appNotice data-testid="ai-stay-needs-dates"><app-icon name="alert" /><div class="notice__body flex-1 min-w-0">날짜를 정하면 숙소를 담을 수 있어요. 지금 담으면 숙소는 빠져요.</div></div>
}

<section class="panel bg-panel rounded-panel shadow-panel" data-testid="ai-result">
  <!-- 제목·안내·전체 선택은 기존 마크업 유지. 안내 문구만 "원치 않는 곳은 해제하세요. 시각·이동시간은 AI 추천이며 일정에는 순서·체류시간·계획 금액만 저장돼요." -->
  @for (course of draft.courses(); track course.day) {
    <section [attr.aria-labelledby]="'ai-day-title-' + course.day" [attr.data-testid]="'ai-day-group-' + course.day">
      <h3 class="border-t border-border bg-canvas px-4 py-3 text-15 font-bold" [id]="'ai-day-title-' + course.day">{{ course.day }}일차</h3>
      <ol class="flex flex-col">
        @for (e of course.entries; track e.item.id) {
          @if (e.legFromPrev && legText(e.legFromPrev); as leg) {
            <li class="px-4 py-1.5 text-12 text-ink-3" aria-hidden="false" [attr.data-testid]="'ai-leg-' + e.item.id">↓ {{ leg }}</li>
          }
          <li class="pickrow grid grid-cols-[32px_minmax(0,1fr)_auto] gap-x-3 p-4 [border-top:1px_solid_var(--color-border)]" [class.opacity-55]="!e.selected">
            <!-- 체크박스: 기존 input 그대로, data-testid 'ai-pick-' + e.item.id -->
            <div class="min-w-0">
              <p class="text-12 text-ink-3 tabular-nums" [attr.data-testid]="'ai-start-' + e.item.id">{{ courseHeadline(e.start, e.item.estimate?.stay?.max ?? null, kindLabels[e.item.kind], areaOf(e.item.address)) }}</p>
              <p class="flex items-center gap-1.5 text-15"><strong class="truncate">{{ e.item.name }}</strong><span appBadge tone="ok">실존 확인</span></p>
              @if (costRange(e.item.estimate, draft.partySize())) {
                <p class="text-12 text-ink-3 mt-1" [attr.data-testid]="'ai-estimate-' + e.item.id">요금 기준: {{ costBasis(e.item.estimate, draft.partySize()) }}</p>
              }
              <!-- app-map-links, 분류 배지(kindTone(e.item.kind)), 일차 select(canChangeDay일 때, [selected]="d === e.item.day")는 기존 마크업을 옮긴다 -->
            </div>
            <p class="text-14 font-medium tabular-nums text-right">
              @if (costRange(e.item.estimate, draft.partySize()); as r) { {{ wonRange(r) }}<span class="block text-11 text-ink-3 font-normal">AI 추정</span> } @else { <span class="text-12 text-ink-3">요금 미정</span> }
            </p>
          </li>
        }
      </ol>
    </section>
  }
</section>
```
`ai-plan-flow.ts`에 `readonly kindLabels = PLAN_KIND_LABEL; readonly budgetGroups = BUDGET_GROUPS; readonly budgetGroupLabel = BUDGET_GROUP_LABEL; readonly courseHeadline = courseHeadline; readonly legText = legText; readonly areaOf = areaOf;`를 둔다. `kindLabels = STOP_KIND_LABEL`는 교체한다. 템플릿에 쓴 텍스트 크기 유틸(`text-22`, `text-11` 등)이 테마에 없으면 DESIGN.md에 있는 가장 가까운 크기로 바꾼다.
`allSelected`·`toggleAll`·`selected().size/planItems().length`는 코스 평탄화 목록(`draft.courses().flatMap(c => c.entries)`) 기준으로 바꾼다.

- [ ] **Step 5: 확인** — 도우미 spec PASS, `npx ng build`, `npm run lint`(페이지 폭·대비) PASS. 개발 서버에서 픽스처가 아닌 화면은 Task 11에서 확인한다. 이 단계에서 `impeccable` 스킬로 결과 화면을 한 번 점검(critique)하고 지적 사항 중 DESIGN.md 위반만 고친다.

- [ ] **Step 6: 커밋**
```bash
git add app/src/app/features/ai-planning .impeccable/surfaces
git commit -m "feat(app): AI 일정 결과를 시간순 코스 카드와 분류별 예산으로 보여 준다"
```

### Task 8: 담기 — 숙소는 stays, 메모에 추천 시각

**Files:**
- Modify: `app/src/app/features/trips/util/ai-selection.ts`
- Modify: `app/src/app/shared/util/plan-estimate.ts` (`estimateMemo`에 추천 시각 인자)
- Test: `app/src/app/features/trips/util/ai-selection.spec.ts`

**Interfaces:**
- Consumes: `AiPlanSelection.items`(코스 순서, 각 항목 `start`는 옮긴 경우 null — Task 6), `createStay`, `createStop`, `appendStop`, `addDays`.
- Produces: `estimateMemo(estimate: PlanEstimate | undefined, partySize: number, start?: string | null): string` — `start`가 있으면 첫 줄 다음에 `AI 추천 시각 11:25`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const item = (id: string, day: number, extra: Partial<PlanItem> = {}): PlanItem => ({
  id, day, order: 1, start: null, moveToNext: null, name: id, kind: 'place', verified: true,
  note: '', address: '강원 강릉시 x', location: { lat: 37.7, lng: 128.9 }, placeRef: null, ...extra,
});
const sel = (items: PlanItem[], dated = true): AiPlanSelection => ({
  requestId: 'r', partySize: 2, regions: ['강릉시'],
  startDate: dated ? '2026-10-01' : null, endDate: dated ? '2026-10-03' : null, items,
});

it('숙소는 그 일차 체크인·다음 날 체크아웃 숙박으로 담는다', () => {
  const trip = selectionToTrip(sel([item('호텔', 1, { kind: 'stay', estimate: { cost: { min: 90000, max: 120000, basis: 'room_night', quantity: 1, assumption: '2인 1실 1박' }, stay: null } })]));
  expect(trip.stops).toHaveLength(0);
  expect(trip.stays[0]).toMatchObject({ name: '호텔', checkIn: '2026-10-01', checkOut: '2026-10-02', estimatedCost: 120000, reservation: 'unknown' });
});
it('같은 숙소가 연속 일차면 하나로 합친다', () => {
  const trip = selectionToTrip(sel([item('호텔', 1, { kind: 'stay' }), item('호텔', 2, { id: 'h2', name: '호텔', kind: 'stay' })]));
  expect(trip.stays).toHaveLength(1);
  expect(trip.stays[0]).toMatchObject({ checkIn: '2026-10-01', checkOut: '2026-10-03' });
});
it('날짜 미정이면 숙소를 담지 않는다', () => {
  expect(selectionToTrip(sel([item('호텔', 1, { kind: 'stay' })], false)).stays).toHaveLength(0);
});
it('코스 순서대로 담고 새 분류와 추천 시각 메모를 남긴다', () => {
  const trip = selectionToTrip(sel([item('A', 1, { kind: 'activity', start: '10:00' }), item('B', 1, { kind: 'shopping' })]));
  expect(trip.stops.map(s => [s.name, s.kind, s.order])).toEqual([['A', 'activity', 0], ['B', 'shopping', 1]]);
  expect(trip.stops[0]!.memo).toContain('AI 추천 시각 10:00');
  expect(trip.stops[0]!.fixedTime).toBeNull();
  expect(trip.stops[1]!.memo).not.toContain('AI 추천 시각');
});
```
주의: `estimateMemo`는 추정이 없으면 `''`을 돌려준다. 추천 시각만 있는 항목도 메모를 남기도록 Step 3에서 처리한다.

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현**
  - `estimateMemo`: `start`가 있으면 추정이 없어도 `['AI 추천 계획 · 방문 전 확인하세요', 'AI 추천 시각 11:25']`를 돌려준다. 추정이 있으면 기존 첫 줄 다음에 `AI 추천 시각 …`을 넣는다.
  - `selectionToTrip`: Task 4의 임시 변환을 지운다. 루프에서 `item.kind === 'stay'`이면 날짜가 있을 때만 숙박 후보로 모으고, 아니면 `createStop({ …, kind: item.kind, memo: estimateMemo(item.estimate, partySize, item.start) })`. 숙박 후보는 이름이 같고 일차가 이어지면(`prev.day + 1 === item.day`) 체크아웃을 늘리고 `estimatedCost`를 더한다(둘 다 있을 때, 하나라도 없으면 `null`). 모은 뒤 `createStay({ id: \`${requestId}:${item.id}\`, name, address, regionId: regionIdForAddress(...), checkIn: addDays(startDate, day - 1), checkOut: addDays(startDate, lastDay), estimatedCost, location, placeRef, memo: estimateMemo(...) })`로 `trip.stays`에 넣는다.
  - 파일 머리 주석에 "추천 시각은 메모에만, 이동시간은 저장하지 않는다(경로시간 저장 규칙)"를 적는다.

- [ ] **Step 4: 통과 확인** — spec PASS, `npx vitest run` 전체 PASS.

- [ ] **Step 5: 커밋**
```bash
git add app/src/app/features/trips/util/ai-selection.ts app/src/app/features/trips/util/ai-selection.spec.ts app/src/app/shared/util/plan-estimate.ts
git commit -m "feat(app): AI 코스 담기에서 숙소를 숙박으로 만들고 추천 시각을 메모에 남긴다"
```

### Task 9: 서버 프롬프트·스키마, 픽스처, e2e

**Files:**
- Modify: `supabase/functions/ai-plan/prompt.ts` (`PER_DAY`, `SYSTEM_PROMPT` 분류·코스 규칙, `RESPONSE_SCHEMA`, `buildUserPrompt` 기본 구성 문장)
- Modify: `app/src/app/features/ai-planning/data/ai-plan-handler.spec.ts` (프롬프트 문구 검증)
- Modify: `app/src/app/features/ai-planning/data/fixture-ai-provider.ts`
- Modify: `app/e2e/ai-plan.spec.ts`

**Interfaces:**
- Consumes: Task 3의 응답 형식(라벨 문자열, `order`, `start`, `moveToNext{mode,minutes}`).
- Produces: `PER_DAY = { sight: 3, activityOrShopping: 1, meal: 2, cafe: 1, stay: 1 }` (prompt.ts).

- [ ] **Step 1: 실패하는 테스트 작성** (`ai-plan-handler.spec.ts`)

```ts
it('코스 형식과 기본 분류 구성을 모델에 요구한다', async () => {
  const { handler, callModel } = setup();
  await handler(post({ ...BODY, dayCount: 2 }));
  const prompt = (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0];
  expect(prompt.system).toContain('관광·액티비티·식사·카페·쇼핑·숙소');
  expect(prompt.system).toContain('마지막 날에는 숙소를 넣지 않는다');
  expect(prompt.user).toContain('관광 2~3곳');
  expect(prompt.user).not.toContain('카페 2곳씩');
});
it('추가 요청이 범위를 정하면 기본 구성을 넣지 않는다', async () => {
  const { handler, callModel } = setup();
  await handler(post({ ...BODY, extraNote: '맛집만 5곳' }));
  expect((callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0].user).not.toContain('관광 2~3곳');
});
```
그리고 `RESPONSE_SCHEMA` 모양을 직접 검사한다.
```ts
import { RESPONSE_SCHEMA } from '../../../../../../supabase/functions/ai-plan/prompt';
it('응답 스키마가 코스 필드와 여섯 분류를 가진다', () => {
  const item = RESPONSE_SCHEMA.properties.items.items;
  expect(item.properties.kind.enum).toEqual(['관광', '액티비티', '식사', '카페', '쇼핑', '숙소']);
  expect(item.required).toEqual(expect.arrayContaining(['day', 'order', 'name', 'kind', 'start', 'estimate']));
  expect(item.properties.moveToNext.properties.mode.enum).toEqual(['도보', '대중교통', '자가용', '택시']);
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현** (`prompt.ts`)
  - 분류 규칙 블록을 교체한다:
    ```
    분류 규칙(관광·액티비티·식사·카페·쇼핑·숙소 중 하나):
    - '관광': 보고 둘러보는 곳(명소·박물관·전망대·공원·해변·유적).
    - '액티비티': 직접 타거나 해 보는 곳(체험·레저·케이블카·열차·공방).
    - '식사': 밥을 먹는 식당만. 시장이나 거리 전체를 식사로 적지 않는다.
    - '카페': 커피·디저트를 파는 실제 가게만.
    - '쇼핑': 물건을 사는 곳(시장·상점가 안의 개별 매장·백화점·아울렛·기념품점).
    - '숙소': 실제 숙박업소 이름. 하루의 마지막 항목으로 두고, 마지막 날에는 숙소를 넣지 않는다.
    ```
  - 코스 규칙 블록을 추가한다:
    ```
    코스 규칙:
    - 하루 일정을 실제로 다니는 순서로 짠다. order는 그날 1부터 매긴다.
    - start는 그 장소에 도착하는 추천 시각(HH:mm, 24시간)이다. 점심은 11:30~13:30, 저녁은 17:30~19:30 사이에 둔다.
    - 앞 항목의 start + 체류시간 + 이동시간이 다음 항목의 start를 넘지 않게 한다.
    - moveToNext는 다음 항목까지의 이동수단(도보·대중교통·자가용·택시)과 분(minutes)이다. 사용자의 이동수단 조건을 따른다. 그날 마지막 항목은 null.
    - 일정 밀도가 '여유롭게'면 하루를 늦게 시작하고 항목을 줄인다. '알차게'면 일찍 시작하고 늘린다.
    - 이동시간·시각은 추천일 뿐이며 확정 시각처럼 쓰지 않는다.
    ```
  - `RESPONSE_SCHEMA` 항목에 `order: { type: 'integer' }`, `start: { type: 'string', nullable: true }`, `moveToNext: { type: 'object', nullable: true, properties: { mode: { type: 'string', enum: ['도보','대중교통','자가용','택시'] }, minutes: { type: 'integer' } }, required: ['mode','minutes'] }`, `kind` enum 여섯 가지, `required: ['day','order','name','kind','start','estimate']`. `moveToNext`는 required에 넣지 않는다(마지막 항목 생략 허용).
  - `PER_DAY`와 `buildUserPrompt` 기본 구성 문장:
    ```ts
    `${note ? '위 요청에 어긋나지 않는 선에서, ' : ''}하루에 관광 2~3곳, 액티비티 또는 쇼핑 1곳, 식사 2곳(점심·저녁), 카페 1곳을 코스로 짜고` +
      ` 마지막 날을 뺀 날마다 숙소 1곳을 그날 마지막에 넣어 줘.`
    ```
    `PER_DAY_TOTAL` 등 쓰이지 않게 된 상수는 지운다. `MAX_ITEMS`(ai-response.ts, 40)는 30일×8곳을 넘을 수 있으나 기존 상한을 유지한다.
  - 픽스처(`fixture-ai-provider.ts`): 픽스처 장소 검색에 있는 이름으로 코스를 만든다.
    ```ts
    const E = (min: number, max: number, basis: 'person' | 'group' | 'room_night', assumption: string, stay: [number, number] | null) =>
      ({ cost: { min, max, basis, quantity: 1, assumption }, stay: stay && { min: stay[0], max: stay[1], reason: '테스트용 체류시간 예시' } });
    const FIXTURE_ITEMS: readonly AiItem[] = [
      { day: 1, order: 1, start: '10:00', moveToNext: { mode: '도보', minutes: 15 }, name: '안목해변', kind: 'activity', estimate: E(0, 0, 'group', '테스트용 무료 예시', [60, 90]) },
      { day: 1, order: 2, start: '12:00', moveToNext: { mode: '자가용', minutes: 20 }, name: '오죽헌', kind: 'place', estimate: E(3000, 5000, 'person', '테스트용 입장료 예시', [60, 90]) },
      { day: 1, order: 3, start: '14:00', moveToNext: null, name: '없는장소테스트', kind: 'place' },
      { day: 1, order: 4, start: '20:00', moveToNext: null, name: '강릉 테스트 호텔', kind: 'stay', estimate: E(90000, 120000, 'room_night', '테스트용 2인 1실 1박 예시', null) },
      { day: 2, order: 1, start: '11:00', moveToNext: null, name: '속초관광수산시장', kind: 'shopping' },
    ];
    ```
  - e2e(`ai-plan.spec.ts`): 기존 `ai-day-group-*`·`ai-pick-*`·`ai-day-*`·`ai-estimate-*` testid를 쓰는 시나리오를 새 데이터에 맞게 고치고(오죽헌 id는 `ai-1`, 호텔 `ai-3`, 시장 `ai-4`), 다음을 추가한다.
    ```ts
    test('시간순 코스와 이동·예산 묶음을 보여 주고 숙소를 숙박으로 담는다', async ({ page }) => {
      // 강릉시, 2026-10-01~02, 2명으로 생성 (기존 도우미 사용)
      await expect(page.getByTestId('ai-start-ai-0')).toContainText('10:00 (1시간 30분) · 액티비티');
      await expect(page.getByTestId('ai-leg-ai-1')).toContainText('도보 약 15분 · AI 추정');
      await expect(page.getByTestId('ai-leg-ai-3')).toContainText('직선'); // 확인 실패 항목을 건너뛴 구간
      await expect(page.getByTestId('ai-leg-ai-3')).not.toContainText('AI 추정');
      await expect(page.getByTestId('ai-budget-groups')).toContainText('숙박');
      await page.getByTestId('ai-apply').click(); // 실제 담기 버튼 testid로 맞춘다
      // 여행 상세에서 숙소 '강릉 테스트 호텔'과 '액티비티' 배지 확인, 새로고침 후 유지 확인
    });
    ```
    (`ai-leg-ai-3`은 호텔 카드 앞 이동 줄이다. 오죽헌 다음 order 3이 확인 실패로 빠졌으므로 모델 이동 없이 직선거리만 나와야 한다.)

- [ ] **Step 4: 통과 확인** — `npx vitest run` 전체, `npx playwright test e2e/ai-plan.spec.ts --reporter=line` 전부 PASS(데스크톱·360px).

- [ ] **Step 5: 커밋**
```bash
git add supabase/functions/ai-plan/prompt.ts app/src/app/features/ai-planning/data app/e2e/ai-plan.spec.ts
git commit -m "feat: AI 일정 서버 프롬프트를 시간순 코스와 여섯 분류로 바꾸고 픽스처·e2e를 맞춘다"
```

### Task 10: 문서와 OpenSpec

**Files:**
- Create: `openspec/changes/add-ai-course-plan/{proposal.md,design.md,tasks.md,specs/ai-course-plan/spec.md}`
- Modify: `docs/기획안-v0.1.md` (AI 일정 짜기 절: 코스 형태·분류·예산)
- Modify: `docs/ai-plan-estimates.md` (사용 흐름 3~6단계, API 응답 예시, 검증 기록 자리)
- Modify: `docs/README.md` (여행 자동생성 절에 새 OpenSpec·설계 링크), `docs/DEVELOPMENT.md`(검증 기준이 바뀐 경우만)

- [ ] **Step 1:** OpenSpec 변경을 기존 `add-ai-plan-estimates` 형식을 따라 만든다. 요구사항은 스펙 3~6절을 "SHALL" 문장과 시나리오로 옮긴다(분류 통일, 코스 표시, 해제·일차 이동, 숙소 담기, 요금 AI 추정 표시, 예산 묶음, 이전 응답 호환).
- [ ] **Step 2:** `npx openspec validate add-ai-course-plan --strict`(저장소에서 쓰는 명령 확인: `docs/DEVELOPMENT.md`) PASS.
- [ ] **Step 3:** 기획안·ai-plan-estimates·README를 갱신하고 링크가 실제 파일을 가리키는지 확인한다.
- [ ] **Step 4: 커밋**
```bash
git add openspec/changes/add-ai-course-plan docs
git commit -m "docs: AI 일정 시간순 코스·분류 통일 기획과 OpenSpec 추가"
```

### Task 11: 전체 검증과 배포 (사용자 확인 필요)

- [ ] **Step 1: 로컬 전체 검증** — `npx vitest run`, `npx ng build`, `npm run lint`, `npx playwright test --reporter=line`(전체), `git diff --check`. 결과 숫자를 기록한다.
- [ ] **Step 2: 사용자 확인 후 DB 마이그레이션 적용** — `npx supabase db push`로 `20260930000000_stop_kind_activity_shopping.sql`만 적용되는지 `--dry-run`으로 먼저 확인한다. 적용 뒤 `select unnest(enum_range(null::public.stop_kind));`로 여섯 값 확인.
- [ ] **Step 3: 사용자 확인 후 함수 배포** — `npx supabase functions deploy ai-plan` 그리고 `npx supabase functions deploy ai-chat`. 배포 직후 사용자 토큰으로 실제 생성 1회(scratchpad의 `call-plan.mjs` 방식): 200 응답, 분류 분포, `start` 순서, `estimate.cost` 채움 비율, 응답 시간 기록. Gemini가 스키마를 거부(400·500)하면 즉시 이전 커밋의 함수로 다시 배포하고 사용자에게 알린다.
- [ ] **Step 4: 로컬 앱에서 실제 생성 화면 확인** — 코스 카드·이동·예산 묶음·담기·여행 상세 숙소 표시를 Playwright로 확인하고 캡처한다.
- [ ] **Step 5: 사용자 확인 후 프론트엔드 배포** — 저장소의 배포 절차(`docs/DEVELOPMENT.md`·README의 배포 항목)를 따른다.
- [ ] **Step 6: 기록** — `docs/ai-plan-estimates.md`의 실제 검증 결과 절에 날짜와 수치를 남기고 커밋한다.
