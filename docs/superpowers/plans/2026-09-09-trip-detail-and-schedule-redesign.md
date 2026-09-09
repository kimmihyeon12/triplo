# 여행 상세 헤더·일정 화면 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여행 상세 화면의 상단 정보(제목·D-day·기간·지역 순서·지출 요약·동행 자리)를 다시 짜고, 모바일 첫 화면에서 첫 장소가 보이도록 헤더·지도 높이를 줄이고, 장소 카드의 반복 편집 버튼을 순서 편집 모드로 분리하고, 지도 앱 버튼을 브랜드색으로 정리한다.

**Architecture:** 기존 Angular 20 standalone 컴포넌트 구조(`app/src/app/features/trips/trip-detail-page.ts`)를 그대로 두고 그 안에서 템플릿·상태·도메인 함수를 확장한다. 새 D-day 상태 계산은 `domain/dates.ts`에 순수 함수로 추가한다. 순서 편집 모드는 `trip-detail-page.ts`의 컴포넌트 signal로 관리한다. 그라데이션·브랜드색은 `styles.css`의 CSS 변수와 유틸리티 클래스로 추가한다.

**Tech Stack:** Angular 20 (standalone, signals), TypeScript, Vitest(도메인 단위 테스트), Playwright(`app/e2e`, 별도 테스트 앱 포트 4300).

**Spec:** `docs/superpowers/specs/2026-09-09-trip-detail-ai-companion-expenses-design.md`의 1·2·3·7·8절(색과 그라데이션, 여행 상단 정보, 일정 화면 개선, 지도 버튼 정비, 문서 동기화). 4~6절(AI 일정 만들기, 동행 초대, 지출·정산)은 이 계획에 포함하지 않고 후속 계획에서 다룬다.

## Global Constraints

- 단일 강조색은 딥 블루(`--accent-deep: #2f5fdb`)를 유지한다. 새로 추가하는 그라데이션(딥 보라 `#4c3fd6` → 마젠타 `#a13fd6`, 135deg)은 여행 상세 상단 정보 카드 배경 한 곳에만 쓴다(이 계획에서 AI 카드는 아직 만들지 않는다).
- 그라데이션 위 텍스트는 흰색이며 WCAG AA 대비(4.5:1)를 만족해야 한다.
- 종료 예정일 경과를 사용자 명시적 '여행 완료'와 자동으로 동일시하지 않는다.
- 위치·이동시간이 미확인인 항목은 미확인으로 유지하고, 확정값처럼 표시하지 않는다.
- 지도 앱 버튼에는 실제 브랜드 로고 이미지를 쓰지 않는다. 브랜드 색상(네이버 `#03C75A`, 카카오 `#FEE500`)만 반영하고 아이콘은 기존 `IconComponent`의 `pin`을 재사용한다.
- 모든 신규 텍스트는 한국어, 기존 코드 스타일(2-space indent, standalone 컴포넌트, `data-testid` 규칙)을 따른다.
- 모바일 360~390px와 PC(900px 이상)를 모두 검증한다.
- 이 프로젝트는 git 저장소가 아니다(`Is a git repository: false`). 계획의 "커밋" 스텝은 `git add`/`git commit` 대신 변경 사항을 그대로 저장하고 다음 스텝으로 진행하는 것으로 대체한다(실행자는 이 규칙을 모든 Task에 적용한다).

---

## File Structure

- `app/src/app/domain/dates.ts` — **Modify.** D-day 상태 계산 함수 `tripTimelineStatus()` 추가.
- `app/src/app/domain/dates.spec.ts` — **Modify.** 위 함수의 단위 테스트 추가.
- `app/src/styles.css` — **Modify.** 그라데이션 토큰, 헤더 카드 유틸리티 클래스, 지도 브랜드색 변수 추가.
- `app/src/app/features/trips/trip-detail-page.ts` — **Modify.** 상단 정보 카드 템플릿 재구성, 순서 편집 모드 상태·토글, 지도 높이 축소, 더보기 메뉴, 지도 버튼 브랜드색 클래스 적용.
- `app/src/app/features/trips/trip-detail-page.spec.ts` — **Create.** (현재 파일 없음. 상단 정보 카드 상태 표시·순서 편집 모드 토글의 컴포넌트 테스트를 새로 만든다.)
- `app/src/app/shared/trip-map.ts` — **Modify.** 모바일 기본 높이 축소, 확대/접기 토글 추가.
- `PRODUCT.md`, `DESIGN.md` — **Modify.** 그라데이션 예외 규칙, 지도 브랜드색, 순서 편집 모드 문서화.
- `docs/디자인-비교-검토-2026-09-09.md` — **Modify.** 상태를 "미확정 제안"에서 "2026-09-09 확정 반영"으로 갱신.

---

### Task 1: D-day/여행 상태 계산 함수

**Files:**
- Modify: `app/src/app/domain/dates.ts`
- Test: `app/src/app/domain/dates.spec.ts`

**Interfaces:**
- Consumes: 기존 `IsoDate`, `diffDays`, `todayIso`(같은 파일 내).
- Produces: `export type TripTimelineStatus = { kind: 'undecided' } | { kind: 'upcoming'; daysUntil: number } | { kind: 'today' } | { kind: 'ongoing'; dayNumber: number } | { kind: 'past' };` 그리고 `export function tripTimelineStatus(start: IsoDate | null, end: IsoDate | null, today: IsoDate): TripTimelineStatus`. `dayNumber`는 시작일을 1일차로 센다.

- [ ] **Step 1: Write the failing test**

`app/src/app/domain/dates.spec.ts` 파일 끝에 추가한다:

```typescript
import { tripTimelineStatus } from './dates';

describe('tripTimelineStatus', () => {
  it('날짜가 없으면 undecided', () => {
    expect(tripTimelineStatus(null, null, '2026-09-09')).toEqual({ kind: 'undecided' });
    expect(tripTimelineStatus('2026-09-10', null, '2026-09-09')).toEqual({ kind: 'undecided' });
  });

  it('시작일 전이면 upcoming과 D-N', () => {
    expect(tripTimelineStatus('2026-09-15', '2026-09-17', '2026-09-09')).toEqual({ kind: 'upcoming', daysUntil: 6 });
  });

  it('시작일이 오늘이면 today', () => {
    expect(tripTimelineStatus('2026-09-09', '2026-09-11', '2026-09-09')).toEqual({ kind: 'today' });
  });

  it('여행 기간 중이면 ongoing과 dayNumber', () => {
    expect(tripTimelineStatus('2026-09-07', '2026-09-11', '2026-09-09')).toEqual({ kind: 'ongoing', dayNumber: 3 });
    expect(tripTimelineStatus('2026-09-07', '2026-09-11', '2026-09-11')).toEqual({ kind: 'ongoing', dayNumber: 5 });
  });

  it('종료일이 지나면 past이며 자동 완료로 표시하지 않는다', () => {
    expect(tripTimelineStatus('2026-09-01', '2026-09-05', '2026-09-09')).toEqual({ kind: 'past' });
  });

  it('당일 여행(시작=종료)도 today·past를 정확히 구분한다', () => {
    expect(tripTimelineStatus('2026-09-09', '2026-09-09', '2026-09-09')).toEqual({ kind: 'today' });
    expect(tripTimelineStatus('2026-09-09', '2026-09-09', '2026-09-10')).toEqual({ kind: 'past' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (저장소 루트에서): `cd app && npx vitest run src/app/domain/dates.spec.ts`
Expected: FAIL — `tripTimelineStatus` is not exported / not defined.

- [ ] **Step 3: Write minimal implementation**

`app/src/app/domain/dates.ts`의 `todayIso` 함수 뒤에 추가한다:

```typescript
export type TripTimelineStatus =
  | { kind: 'undecided' }
  | { kind: 'upcoming'; daysUntil: number }
  | { kind: 'today' }
  | { kind: 'ongoing'; dayNumber: number }
  | { kind: 'past' };

/**
 * 여행 시작·종료일과 오늘 날짜(Asia/Seoul 기준 IsoDate)로 진행 상태를 계산한다.
 * 종료일 경과는 'past'로만 표시하며 사용자 명시적 여행 완료와 자동으로 같지 않다.
 */
export function tripTimelineStatus(start: IsoDate | null, end: IsoDate | null, today: IsoDate): TripTimelineStatus {
  if (!start || !end) return { kind: 'undecided' };
  const untilStart = diffDays(today, start);
  if (untilStart > 0) return { kind: 'upcoming', daysUntil: untilStart };
  const untilEnd = diffDays(today, end);
  if (untilEnd < 0) return { kind: 'past' };
  if (untilStart === 0) return { kind: 'today' };
  return { kind: 'ongoing', dayNumber: diffDays(start, today) + 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/app/domain/dates.spec.ts`
Expected: PASS (모든 dates.spec.ts 테스트 통과, 기존 테스트 포함).

- [ ] **Step 5: Commit**

이 저장소는 git이 아니므로 커밋 대신 다음을 확인한다: `git status`를 실행하지 않는다. 대신 `cd app && npx vitest run src/app/domain/dates.spec.ts`가 전부 통과했음을 재확인하고 Task 2로 진행한다.

---

### Task 2: 그라데이션·지도 브랜드색 CSS 토큰

**Files:**
- Modify: `app/src/styles.css`

**Interfaces:**
- Consumes: 기존 `:root` 변수(`--accent-deep`, `--on-accent` 등, `on-accent`는 실제로는 인라인 `#ffffff`로 쓰이던 값 — 아래서 확인).
- Produces: 새 CSS 커스텀 프로퍼티 `--header-gradient`, `--naver-brand`, `--kakao-brand`, `--kakao-brand-ink`. 그리고 유틸리티 클래스 `.hero--gradient`, `.btn--naver`, `.btn--kakao`.

- [ ] **Step 1: 기존 `on-accent` 사용처 확인 (테스트 없음, 조사 스텝)**

`app/src/styles.css`에 `--on-accent` 변수가 정의돼 있지 않고 흰색이 `#ffffff` 리터럴로 여러 곳에 쓰이고 있다(DESIGN.md의 팔레트에는 있지만 실제 CSS에는 변수화되지 않음). 이번 스텝에서는 새로 변수를 추가하지 않고 기존 관례대로 `#ffffff` 리터럴을 그대로 쓴다. 이 사실만 확인하고 다음 스텝으로 진행한다(코드 변경 없음).

- [ ] **Step 2: `:root` 변수 블록에 그라데이션·브랜드색 추가**

`app/src/styles.css`의 `:root { ... }` 블록에서 `--accent-tint: #eaf0fe;` 줄 다음에 추가한다:

```css
  /* 여행 상단 헤더 전용 그라데이션 (The Single Accent Rule의 명시적 예외, DESIGN.md 참고) */
  --header-gradient: linear-gradient(135deg, #4c3fd6 0%, #a13fd6 100%);

  /* 지도 앱 브랜드색(로고 이미지 아님, 배경색만) */
  --naver-brand: #03c75a;
  --kakao-brand: #fee500;
  --kakao-brand-ink: #3c1e1e;
```

- [ ] **Step 3: 지도 버튼 유틸리티 클래스 추가**

같은 파일의 `.btn--on-hero:hover { ... }` 규칙 뒤(358행 부근, 폼 섹션 시작 전)에 추가한다:

```css
.btn--naver {
  background: var(--naver-brand);
  border-color: var(--naver-brand);
  color: #ffffff;
}
.btn--naver:hover {
  background: color-mix(in srgb, var(--naver-brand) 85%, black);
  border-color: color-mix(in srgb, var(--naver-brand) 85%, black);
}
.btn--kakao {
  background: var(--kakao-brand);
  border-color: var(--kakao-brand);
  color: var(--kakao-brand-ink);
}
.btn--kakao:hover {
  background: color-mix(in srgb, var(--kakao-brand) 85%, black);
  border-color: color-mix(in srgb, var(--kakao-brand) 85%, black);
}
```

- [ ] **Step 4: 헤더 그라데이션 유틸리티 클래스 추가**

같은 파일의 `.hero__sub { ... }` 규칙 뒤에 추가한다:

```css
.hero--gradient {
  background: var(--header-gradient);
  border-radius: var(--radius-panel);
  padding: var(--sp-4);
  color: #ffffff;
}
.hero--gradient .hero__sub,
.hero--gradient .head__region {
  color: rgba(255, 255, 255, 0.86);
}
.hero--gradient .head__link {
  border-color: rgba(255, 255, 255, 0.5);
}
```

- [ ] **Step 5: 빌드로 CSS 문법 오류 없는지 확인**

Run: `cd app && npm run build`
Expected: 빌드 성공(exit code 0). CSS 파싱 오류가 있으면 여기서 실패한다.

- [ ] **Step 6: Commit**

git 저장소가 아니므로 커밋 생략. 빌드 성공을 확인했으면 Task 3으로 진행한다.

---

### Task 3: 여행 상세 헤더에 D-day·지역순서·지출자리·동행자리 추가

**Files:**
- Modify: `app/src/app/features/trips/trip-detail-page.ts`

**Interfaces:**
- Consumes: Task 1의 `tripTimelineStatus(start, end, today)`, `todayIso()` (둘 다 `../../domain/dates`에서 import), Task 2의 `.hero--gradient` 클래스.
- Produces: 컴포넌트에 `timelineStatus = computed<TripTimelineStatus>(...)` signal 추가. 템플릿에 상태 배지·지출 자리·동행 자리 표시. 이후 Task(지출·동행 실제 구현)가 이 자리의 DOM 구조(`data-testid="trip-expense-summary"`, `data-testid="trip-companions"`)를 재사용한다.

- [ ] **Step 1: 컴포넌트 테스트 파일 생성 및 실패 테스트 작성**

`app/src/app/features/trips/trip-detail-page.spec.ts`는 현재 존재하지 않는다. 새로 만든다. 먼저 기존 컴포넌트가 어떤 방식으로 테스트되는지 참고할 유사 파일이 없으므로, Angular TestBed 없이 순수 렌더 확인이 가능한 최소 구성으로 작성한다:

```typescript
import { describe, expect, it } from 'vitest';
import { tripTimelineStatus } from '../../domain/dates';

// trip-detail-page.ts의 헤더가 사용할 상태 계산이 올바른 kind를 돌려주는지만
// 이 스펙에서 재확인한다. 컴포넌트 자체의 TestBed 렌더 테스트는 기존 e2e(Playwright)가
// 담당하므로(app/e2e), 여기서는 템플릿이 바인딩하는 순수 로직만 다룬다.
describe('trip-detail-page 헤더 상태 배지', () => {
  it('여행 중 상태의 라벨 문구를 구성할 수 있다', () => {
    const status = tripTimelineStatus('2026-09-07', '2026-09-11', '2026-09-09');
    expect(status.kind).toBe('ongoing');
    if (status.kind === 'ongoing') {
      expect(`여행 중 · ${status.dayNumber}일차`).toBe('여행 중 · 3일차');
    }
  });

  it('종료일 경과는 완료가 아니라 past로만 표시한다', () => {
    const status = tripTimelineStatus('2026-09-01', '2026-09-05', '2026-09-09');
    expect(status.kind).toBe('past');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/app/features/trips/trip-detail-page.spec.ts`
Expected: PASS 실제로는 통과해야 정상이다(Task 1에서 이미 구현했으므로). 이 테스트는 "구현이 깨지지 않는지"를 지키는 회귀 테스트이며, 지금 단계에서는 이미 통과한다. 통과함을 확인하고 다음 스텝으로 진행한다(이 Task는 신규 순수 로직이 없고 템플릿 통합이 핵심이라 TDD red 단계를 건너뛴다).

- [ ] **Step 3: 컴포넌트에 import와 computed 추가**

`app/src/app/features/trips/trip-detail-page.ts` 4행의 import를 수정한다:

```typescript
import { enumerateDays, formatKoreanDate, formatPeriod, todayIso, tripTimelineStatus, type TripTimelineStatus } from '../../domain/dates';
```

같은 파일에서 클래스 필드 선언부(`activeTab`, `selectedDay` 등이 있는 위치, `store = inject(TripStore);` 근처)를 찾아 그 뒤에 추가한다:

```typescript
  readonly timelineStatus = computed<TripTimelineStatus | null>(() => {
    const t = this.trip();
    if (!t) return null;
    return tripTimelineStatus(t.startDate, t.endDate, todayIso());
  });

  readonly timelineLabel = computed(() => {
    const s = this.timelineStatus();
    if (!s) return '';
    switch (s.kind) {
      case 'undecided': return '날짜 미정';
      case 'upcoming': return `예정 D-${s.daysUntil}`;
      case 'today': return '진행중 D-day';
      case 'ongoing': return `여행 중 · ${s.dayNumber}일차`;
      case 'past': return '일정 날짜 지남';
    }
  });
```

`computed`가 이미 1행에서 import돼 있는지 확인한다(기존 `import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';`에 이미 포함돼 있으므로 추가 import는 필요 없다).

- [ ] **Step 4: 헤더 템플릿을 그라데이션 카드로 재구성**

`app/src/app/features/trips/trip-detail-page.ts`의 `<header class="hero head" data-testid="trip-header">` 블록(37~59행)을 다음으로 교체한다:

```typescript
        <header class="hero hero--gradient head" data-testid="trip-header">
          <div class="head__top">
            <a class="btn btn--icon btn--on-hero" routerLink="/trips" aria-label="트립플로 목록으로"><app-icon name="back" /></a>
            <app-save-status />
          </div>
          <div class="row" style="justify-content: space-between; align-items: flex-start;">
            <div>
              <h1 data-testid="trip-title">{{ trip()!.title }}</h1>
              <p class="head__period" data-testid="trip-period">{{ period() }}</p>
            </div>
            @if (timelineLabel(); as label) {
              <span class="cell cell--solid-accent" data-testid="trip-timeline-status">{{ label }}</span>
            }
          </div>
          <div class="head__bottom">
            @if (trip()!.regions.length > 0) {
              <p class="row head__regions" data-testid="trip-regions">
                @for (r of trip()!.regions; track r.id; let last = $last) {
                  <span class="head__region">{{ r.name }}</span>
                  @if (!last) {
                    <span class="head__link" aria-hidden="true"></span>
                  }
                }
              </p>
            } @else {
              <p class="hero__sub">지역 미지정</p>
            }
            <a class="btn btn--on-hero btn--sm" [routerLink]="['/trips', trip()!.id, 'edit']" data-testid="trip-edit"><app-icon name="edit" [size]="14" /> 편집</a>
          </div>
          <div class="row" style="margin-top: var(--sp-3);" data-testid="trip-expense-summary">
            <span class="cell cell--ghost">지출 미설정</span>
          </div>
          <div class="row" style="margin-top: var(--sp-2);" data-testid="trip-companions">
            <span class="cell cell--ghost">동행 기능 준비 중</span>
            <button type="button" class="btn btn--sm btn--on-hero" disabled aria-disabled="true">+ 초대</button>
          </div>
        </header>
```

주석: `cell--solid-accent`는 기존 `styles.css`에 이미 정의된 클래스(255~259행)로 딥 블루 배경 + 흰 글자를 낸다. `trip-expense-summary`, `trip-companions`는 이번 Task에서는 정적 자리표시만 두고, 후속 계획(지출·동행 구현 계획)에서 실제 데이터로 교체한다.

- [ ] **Step 5: Playwright로 시각 확인**

Run: `cd app && npm run e2e -- --grep "trip-header"` (기존 e2e 스펙에 `trip-header` 관련 테스트가 없으면 이 grep은 0건 실행으로 끝난다. 그 경우 대신 다음을 실행한다.)

기존 e2e 스펙 이름을 모르므로 먼저 확인한다: `cd app && ls e2e` 로 파일 목록을 본 뒤, 여행 상세 화면을 다루는 스펙 파일 하나를 골라 전체 실행한다: `cd app && npm run e2e`
Expected: 기존 e2e 테스트 중 헤더 구조 변경으로 깨지는 것이 있는지 확인한다. `data-testid="trip-header"`, `trip-title`, `trip-period`, `trip-regions`, `trip-edit`는 그대로 유지했으므로 기존 셀렉터 기반 테스트는 계속 통과해야 한다. 실패하는 테스트가 있으면 그 selector를 확인해 Step 4의 템플릿을 조정한다.

- [ ] **Step 6: Commit**

git 저장소가 아니므로 커밋 생략. e2e 통과를 확인했으면 Task 4로 진행한다.

---

### Task 4: 모바일 첫 화면에 첫 장소 노출 — 지도 높이 축소 및 접기/확대

**Files:**
- Modify: `app/src/app/shared/trip-map.ts`
- Modify: `app/src/app/features/trips/trip-detail-page.ts`

**Interfaces:**
- Consumes: 없음(기존 `TripMapComponent`의 `model`, `selectedId`, `markerSelect` 입출력 그대로 사용).
- Produces: `TripMapComponent`에 `collapsed = input(false)` input과 새 CSS 클래스 `.tc-map--collapsed`(높이 180px) 추가. `trip-detail-page.ts`에 `mapCollapsed = signal(true)` 상태와 토글 버튼 추가.

- [ ] **Step 1: `trip-map.ts` 구조 확인**

`app/src/app/shared/trip-map.ts`를 읽어 현재 지도 컨테이너의 높이를 정의하는 CSS 규칙과 컴포넌트 input 목록을 확인한다(이미 87·148행에서 `--accent-deep` 참조를 확인했으므로 해당 파일이 존재함은 확인됨). 정확한 높이 값과 셀렉터 이름은 실행 시점에 파일을 읽어 확정한다 — 이 계획은 구조를 안다고 가정하지 않고, 실행자가 Step 2 전에 반드시 `Read` 도구로 전체 파일을 읽도록 지시한다.

- [ ] **Step 2: 지도 컴포넌트에 collapsed input과 높이 클래스 추가**

`app/src/app/shared/trip-map.ts`의 `@Component` 클래스 필드에 추가한다(기존 `model = input.required<...>()` 등이 있는 위치 근처):

```typescript
  readonly collapsed = input(false);
```

템플릿의 최상위 지도 컨테이너 엘리먼트(예: `<div class="tc-map" ...>` 형태로 존재할 것)에 `[class.tc-map--collapsed]="collapsed()"` 바인딩을 추가한다. 정확한 엘리먼트와 기존 클래스 이름은 Step 1에서 읽은 실제 파일 내용을 기준으로 맞춘다.

`styles: [...]` 배열 또는 별도 CSS에 다음 규칙을 추가한다:

```css
.tc-map--collapsed {
  height: 180px;
}
```

(이미 지도 컨테이너에 고정 높이가 있다면 그 규칙을 오버라이드하도록 우선순위를 맞춘다.)

- [ ] **Step 3: trip-detail-page.ts에 접기/확대 토글 상태 추가**

클래스 필드에 추가한다:

```typescript
  readonly mapCollapsed = signal(true);
```

`<app-trip-map ... />` 사용처(전체 보기·날짜별 보기 각각에 있을 수 있음, 367행 부근과 날짜별 탭 부근을 모두 확인)에 `[collapsed]="mapCollapsed()"`를 추가하고, 바로 위나 아래에 토글 버튼을 추가한다:

```typescript
                <button type="button" class="btn btn--ghost btn--sm" (click)="mapCollapsed.set(!mapCollapsed())" [attr.aria-expanded]="!mapCollapsed()" data-testid="map-toggle">
                  <app-icon [name]="mapCollapsed() ? 'arrow-down' : 'arrow-up'" [size]="14" /> {{ mapCollapsed() ? '지도 크게 보기' : '지도 접기' }}
                </button>
```

- [ ] **Step 4: 모바일 뷰포트로 검증**

Run: `cd app && npm run e2e`
Expected: 기존 지도 관련 e2e(있다면)가 통과하는지 확인한다. 실패 시 selector 충돌을 실제 파일 확인 후 수정한다.

이어서 모바일 최초 화면에 첫 장소가 보이는지 수동 확인이 필요하면 `npm start`로 개발 서버를 띄우고 브라우저 개발자 도구를 390×844로 설정해 확인한다. 자동화된 스크린샷 검증은 다음 Task에서 Playwright로 캡처한다.

- [ ] **Step 5: Commit**

git 저장소가 아니므로 커밋 생략. 다음 Task로 진행한다.

---

### Task 5: 장소 카드 반복 편집 버튼을 순서 편집 모드로 분리

**Files:**
- Modify: `app/src/app/features/trips/trip-detail-page.ts`

**Interfaces:**
- Consumes: 없음(기존 `move()`, `toggle()`, `isFirst()`, `isLast()` 메서드 재사용).
- Produces: `reorderMode = signal(false)` 상태와 토글 버튼. `item__actions` 블록을 `reorderMode()` 조건부로 감싸고, 기본 상태에서는 `[더보기]` 버튼 하나만 노출한다.

- [ ] **Step 1: 순서 편집 모드 상태 추가**

클래스 필드에 추가한다:

```typescript
  readonly reorderMode = signal(false);
  readonly openMenuStopId = signal<string | null>(null);
```

- [ ] **Step 2: 날짜별 목록 헤더에 순서 편집 모드 토글 버튼 추가**

날짜별 보기(`activeTab() === 'days'`) 패널 안, 장소 목록(`<ol>`, 328행 부근의 `<div class="item__actions">`를 포함하는 리스트) 바로 위에 추가한다:

```typescript
                  <div class="row" style="justify-content: flex-end;">
                    <button type="button" class="btn btn--ghost btn--sm" (click)="reorderMode.set(!reorderMode())" [attr.aria-pressed]="reorderMode()" data-testid="reorder-toggle">
                      {{ reorderMode() ? '순서 편집 끝내기' : '순서 편집' }}
                    </button>
                  </div>
```

- [ ] **Step 3: 장소 카드 액션 블록을 모드에 따라 분기**

314~332행(`item__links` 행과 `item__actions` 블록)을 다음 구조로 교체한다:

```typescript
                              <div class="item__links row">
                                <a class="btn btn--naver btn--sm" [href]="naverUrl(seg.stop)" target="_blank" rel="noopener noreferrer"><app-icon name="pin" [size]="14" /> 네이버지도</a>
                                <a class="btn btn--kakao btn--sm" [href]="kakaoUrl(seg.stop)" target="_blank" rel="noopener noreferrer"><app-icon name="pin" [size]="14" /> 카카오맵</a>
                                <button type="button" class="btn btn--ghost btn--sm" (click)="openMenuStopId.set(openMenuStopId() === seg.stop.id ? null : seg.stop.id)" [attr.aria-expanded]="openMenuStopId() === seg.stop.id" [attr.data-testid]="'more-' + seg.stop.id">
                                  더보기
                                </button>
                              </div>
                              @if (openMenuStopId() === seg.stop.id && seg.stop.address) {
                                <button type="button" class="btn btn--ghost btn--sm" (click)="copyAddress(seg.stop)" [attr.data-testid]="'copy-' + seg.stop.id">
                                  <app-icon name="copy" [size]="14" /> {{ copiedId() === seg.stop.id ? '복사됨' : '주소 복사' }}
                                </button>
                              }
                              @if (copyFallback() && copyFallbackId() === seg.stop.id) {
                                <p class="small copy-fallback">클립보드를 사용할 수 없습니다. 아래 주소를 직접 선택해 복사하세요.<br /><output class="copy-fallback__text">{{ seg.stop.address }}</output></p>
                              }
                            </div>
                            @if (reorderMode()) {
                              <div class="item__actions">
                                <button type="button" class="btn btn--icon" [disabled]="isFirst(idx)" (click)="move(seg.stop.id, 'up')" [attr.aria-label]="seg.stop.name + ' 위로'" [attr.data-testid]="'up-' + seg.stop.id"><app-icon name="arrow-up" [size]="16" /></button>
                                <button type="button" class="btn btn--icon" [disabled]="isLast(idx)" (click)="move(seg.stop.id, 'down')" [attr.aria-label]="seg.stop.name + ' 아래로'" [attr.data-testid]="'down-' + seg.stop.id"><app-icon name="arrow-down" [size]="16" /></button>
                                <a class="btn btn--icon" [routerLink]="['/trips', trip()!.id, 'stops', seg.stop.id]" [attr.aria-label]="seg.stop.name + ' 편집'" [attr.data-testid]="'edit-' + seg.stop.id"><app-icon name="edit" [size]="16" /></a>
                                <button type="button" class="btn btn--icon" (click)="toggle(seg.stop.id)" [attr.aria-label]="seg.stop.name + (seg.stop.excluded ? ' 복원' : ' 제외')" [attr.aria-pressed]="seg.stop.excluded" [attr.data-testid]="'exclude-' + seg.stop.id"><app-icon [name]="seg.stop.excluded ? 'eye' : 'eye-off'" [size]="16" /></button>
                              </div>
                            }
```

주의: 기존 코드에서 `</div>`(item__main 닫는 태그, 326행)가 있던 위치를 유지해야 한다. 위 교체 블록의 들여쓰기와 닫는 태그 개수를 원본과 대조해 정확히 맞춘다. 실행자는 이 스텝 전에 파일의 정확한 현재 라인을 다시 `Read`로 확인한 뒤 `Edit` 도구로 교체한다(라인 번호가 이전 Task들의 편집으로 밀렸을 수 있음).

- [ ] **Step 4: 관련 e2e 셀렉터 확인 및 실행**

`up-`, `down-`, `edit-`, `exclude-` data-testid를 쓰는 기존 e2e 스펙이 있는지 `app/e2e`에서 확인한다(Grep으로 검색). 있다면 그 테스트가 순서 편집 모드 진입(`reorder-toggle` 클릭)을 거치도록 테스트 파일도 함께 수정해야 하므로, 실행자는 이 스텝에서 해당 e2e 파일을 찾아 클릭 시퀀스 앞에 `page.click('[data-testid="reorder-toggle"]')`를 추가한다.

Run: `cd app && npm run e2e`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

git 저장소가 아니므로 커밋 생략. 다음 Task로 진행한다.

---

### Task 6: 장소 추가 폼의 선택 입력 접기

**Files:**
- Modify: `app/src/app/features/trips/stop-form-page.ts`

**Interfaces:**
- Consumes: 없음(기존 폼 필드·검증 로직 재사용).
- Produces: `advancedOpen = signal(false)` 상태로 체류시간·고정 시각·메모 필드 그룹을 감싸는 `<details>` 또는 조건부 블록.

- [ ] **Step 1: 현재 폼 구조 확인**

실행자는 `app/src/app/features/trips/stop-form-page.ts` 전체를 `Read`로 읽어 필드 순서(종류·검색·이름·주소·지역·날짜·체류·고정 시각·메모)와 각 필드의 정확한 템플릿 코드를 확인한다.

- [ ] **Step 2: 선택 입력 그룹을 접이식으로 전환**

클래스 필드에 추가한다:

```typescript
  readonly advancedOpen = signal(false);
```

체류시간·고정 시각·메모 필드를 감싸는 `<fieldset>` 또는 `<div class="stack">` 앞에 토글 버튼을 추가하고, `@if (advancedOpen())`로 그 블록을 감싼다:

```typescript
                <button type="button" class="btn btn--ghost btn--sm" (click)="advancedOpen.set(!advancedOpen())" [attr.aria-expanded]="advancedOpen()" data-testid="advanced-toggle">
                  {{ advancedOpen() ? '선택 정보 접기' : '선택 정보 더보기 (체류시간·고정 시각·메모)' }}
                </button>
                @if (advancedOpen()) {
                  <!-- 기존 체류시간·고정 시각·메모 필드 블록을 여기로 이동 -->
                }
```

정확한 필드 블록의 시작·끝 위치는 Step 1에서 읽은 실제 파일 내용을 기준으로 실행자가 확정한다.

- [ ] **Step 3: 기존 e2e에서 이 폼을 쓰는 테스트 확인**

`app/e2e`에서 체류시간·고정 시각·메모 입력을 직접 채우는 테스트가 있는지 Grep으로 확인한다. 있다면 입력 전에 `page.click('[data-testid="advanced-toggle"]')`를 추가하도록 그 테스트 파일을 수정한다.

- [ ] **Step 4: 테스트 실행**

Run: `cd app && npm run e2e`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

git 저장소가 아니므로 커밋 생략. 다음 Task로 진행한다.

---

### Task 7: 문서 동기화

**Files:**
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`
- Modify: `docs/디자인-비교-검토-2026-09-09.md`

**Interfaces:**
- Consumes: 없음.
- Produces: 없음(문서 텍스트 변경만).

- [ ] **Step 1: PRODUCT.md Brand Commitments에 그라데이션 예외 규칙 추가**

`PRODUCT.md`의 `## Brand Commitments` 절에서 시각 방향 항목(현재 "강조색은 딥 블루 하나이며..."로 시작하는 문단) 뒤에 새 항목을 추가한다:

```markdown
- 그라데이션 예외(2026-09-09 확정): 여행 상세 헤더 배경 한 곳에 한해 딥 보라(#4c3fd6)→마젠타(#a13fd6) 그라데이션을 허용한다. 나머지 모든 버튼·탭·링크·지도 마커는 계속 단색 딥 블루를 쓴다. 지도 앱 버튼(네이버지도·카카오맵)은 각 사의 브랜드 색상만 반영하며 로고 이미지는 쓰지 않는다.
```

- [ ] **Step 2: DESIGN.md에 그라데이션 토큰과 예외 규칙 기록**

`DESIGN.md`의 "The Single Accent Rule" 문단(375행 부근, 이미 앞선 개명 작업에서 딥 블루로 수정됨) 바로 뒤에 새 문단을 추가한다:

```markdown
**Gradient Exception (2026-09-09).** 여행 상세 헤더 배경(`--header-gradient: linear-gradient(135deg, #4c3fd6, #a13fd6)`) 한 곳만 The Single Accent Rule의 명시적 예외다. 다른 화면·버튼·탭에 그라데이션을 확장하려면 별도 결정이 필요하다. 지도 앱 버튼은 네이버(`#03c75a`)·카카오(`#fee500`) 브랜드색을 배경으로 쓰되 로고 이미지는 쓰지 않는다.
```

- [ ] **Step 3: 디자인 비교 검토 문서 상태 갱신**

`docs/디자인-비교-검토-2026-09-09.md`의 3행("이번 결과는 검토 의견이며 제품 코드나 기획상의 디자인 방향을 변경한 것이 아니다.") 뒤에 추가한다:

```markdown
**2026-09-09 확정 반영**: 위 우선 개선 1~3번(첫 장소 노출, 반복 편집 버튼 정리, 장소 추가 폼 선택 입력 접기)은 `docs/superpowers/plans/2026-09-09-trip-detail-and-schedule-redesign.md`로 구현했다.
```

- [ ] **Step 4: 변경 사항 육안 확인**

세 파일을 다시 읽어 마크다운 문법이 깨지지 않았는지 확인한다.

- [ ] **Step 5: Commit**

git 저장소가 아니므로 커밋 생략. 이것으로 이 계획의 모든 Task가 끝난다.

---

## Self-Review 결과 (계획 작성자가 직접 확인함)

- **스펙 커버리지**: 스펙 1절(색과 그라데이션)→Task 2·7, 2절(여행 상단 정보)→Task 3, 3절(일정 화면 개선)→Task 4·5·6, 7절(지도 버튼)→Task 5·7, 8절(문서 동기화)→Task 7. 4~6절(AI·동행·지출)은 이 계획에서 명시적으로 제외했다(헤더 자리표시만 Task 3에서 마련).
- **플레이스홀더 스캔**: "선택 정보 더보기" 필드 이동처럼 정확한 라인을 지금 알 수 없는 부분(Task 1의 trip-map.ts 구조, Task 6의 stop-form-page.ts 필드 위치)은 실행자가 실행 시점에 `Read`로 실제 파일을 확인하도록 명시적으로 지시했다. "TODO"나 "알아서 구현"류 표현은 쓰지 않았다.
- **타입 일관성**: `TripTimelineStatus`는 Task 1에서 정의하고 Task 3에서 그대로 import해 쓴다. `tripTimelineStatus`, `todayIso` 함수 시그니처가 Task 1과 Task 3에서 일치한다.
