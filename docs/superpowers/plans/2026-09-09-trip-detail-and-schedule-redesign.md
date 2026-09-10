# 여행 상세 헤더·일정 화면 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**2026-09-09 정정:** 이 계획은 원래 Task 3에서 그라데이션 헤더를 여행 상세 화면(`trip-detail-page.ts`)에 적용하려 했으나, 구현 도중 사용자가 실제 화면을 보고 "그라데이션 자체가 과하다"고 판단해 취소했고, D-day·지출·동행 정보는 여행 상세가 아니라 여행 목록 화면(`trip-list-page.ts`)의 카드에 넣는 것이 원래 의도였음이 확인됐다. 아래 Task 3은 이 정정을 반영해 다시 작성했다(구버전 Task 3은 미커밋 상태에서 폐기, `app/src/styles.css`의 그라데이션 CSS는 커밋 `ffd337a`로 되돌림).

**Goal:** 여행 목록 화면(`/trips`)의 각 여행 카드에 D-day·지출 요약·동행 자리를 추가하고, 여행 상세 화면에서 모바일 첫 화면에 첫 장소가 보이도록 헤더·지도 높이를 줄이고, 장소 카드의 반복 편집 버튼을 순서 편집 모드로 분리하고, 지도 앱 버튼을 브랜드색으로 정리한다.

**Architecture:** 기존 Angular 20 standalone 컴포넌트 구조를 그대로 두고 그 안에서 템플릿·상태·도메인 함수를 확장한다. D-day 상태 계산은 `domain/dates.ts`의 순수 함수(`tripTimelineStatus`, Task 1에서 이미 완료)를 여행 목록 화면(`trip-list-page.ts`)에서 소비한다. 순서 편집 모드는 `trip-detail-page.ts`의 컴포넌트 signal로 관리한다. 지도 브랜드색은 `styles.css`의 CSS 변수와 유틸리티 클래스(Task 2에서 이미 완료)를 그대로 쓴다.

**Tech Stack:** Angular 20 (standalone, signals), TypeScript, Vitest(도메인 단위 테스트), Playwright(`app/e2e`, 별도 테스트 앱 포트 4300).

**Spec:** `docs/superpowers/specs/2026-09-09-trip-detail-ai-companion-expenses-design.md`(2026-09-09 정정 반영판)의 1·2·3·7·8절(색, 여행 카드 정보 확장, 일정 화면 개선, 지도 버튼 정비, 문서 동기화). 4~6절(AI 일정 만들기, 동행 초대, 지출·정산)은 이 계획에 포함하지 않고 후속 계획에서 다룬다.

## Global Constraints

- 단일 강조색은 딥 블루(`--accent-deep: #2f5fdb`) 하나다. 그라데이션은 쓰지 않는다(2026-09-09 정정으로 폐기).
- 종료 예정일 경과를 사용자 명시적 '여행 완료'와 자동으로 동일시하지 않는다.
- D-day·지출·동행 정보는 여행 목록 화면(`/trips`)의 카드에 표시한다. 여행 상세 화면(`/trips/:id`)의 헤더는 기존 그대로(제목·기간·지역·편집 버튼) 유지하고 확장하지 않는다.
- 위치·이동시간이 미확인인 항목은 미확인으로 유지하고, 확정값처럼 표시하지 않는다.
- 지도 앱 버튼에는 실제 브랜드 로고 이미지를 쓰지 않는다. 브랜드 색상(네이버 `#03C75A`, 카카오 `#FEE500`)만 반영하고 아이콘은 기존 `IconComponent`의 `pin`을 재사용한다.
- 모든 신규 텍스트는 한국어, 기존 코드 스타일(2-space indent, standalone 컴포넌트, `data-testid` 규칙)을 따른다.
- 모바일 360~390px와 PC(900px 이상)를 모두 검증한다.
- 이 프로젝트는 2026-09-09에 git 저장소로 초기화됐다(첫 커밋 `06dbaa1`). 각 Task는 정상적으로 `git add <자신이 수정한 파일만>` + `git commit`을 수행한다. 절대 `git add -A`나 `git add .`를 쓰지 않는다 — 워킹 디렉터리에 이 계획과 무관한 사용자의 별도 작업(로고 적용 등)이 미커밋 상태로 있을 수 있다.

---

## File Structure

- `app/src/app/domain/dates.ts` — **Modify.** D-day 상태 계산 함수 `tripTimelineStatus()` 추가.
- `app/src/app/domain/dates.spec.ts` — **Modify.** 위 함수의 단위 테스트 추가.
- `app/src/styles.css` — **Modify(완료).** 지도 브랜드색 변수·`.btn--naver`/`.btn--kakao` 추가(Task 2, 커밋 `45327e7`). 그라데이션 토큰은 도입 후 정정으로 제거(커밋 `ffd337a`).
- `app/src/app/features/trips/trip-list-page.ts` — **Modify.** 여행 카드에 D-day 배지, 지역 순서, 지출 요약 자리, 동행 프로필·초대 자리 추가(Task 3).
- `app/src/app/features/trips/trip-detail-page.ts` — **Modify.** 순서 편집 모드 상태·토글, 지도 높이 축소 연결, 더보기 메뉴, 지도 버튼 브랜드색 클래스 적용(Task 4·5). 헤더는 건드리지 않는다.
- `app/src/app/shared/trip-map.ts` — **Modify.** 모바일 기본 높이 축소, 확대/접기 토글 추가.
- `PRODUCT.md`, `DESIGN.md` — **Modify.** 여행 카드 확장 정보, 지도 브랜드색, 순서 편집 모드 문서화(그라데이션 항목은 추가하지 않는다).
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

**(Task 2 완료됨 — 커밋 `45327e7`. 단, 그라데이션 부분은 이후 정정으로 제거됨: 커밋 `ffd337a`. 이 Task를 다시 실행하지 않는다.)**

---

### Task 3: 여행 목록 카드에 D-day·지출 요약·동행 자리 추가

**Files:**
- Modify: `app/src/app/features/trips/trip-list-page.ts`

**Interfaces:**
- Consumes: Task 1의 `tripTimelineStatus(start, end, today)`, `todayIso()`, `TripTimelineStatus` 타입 (전부 `../../domain/dates`에서 import). 기존 `formatPeriod`, `TripStore`, `IconComponent`.
- Produces: 컴포넌트에 `timelineLabel(trip: Trip): string` 메서드 추가. 여행 카드 템플릿에 `data-testid="trip-timeline-{{trip.id}}"`(상태 배지), `data-testid="trip-expense-{{trip.id}}"`(지출 요약 자리), `data-testid="trip-companions-{{trip.id}}"`(동행 자리)를 추가한다. 후속 계획(지출·동행 실제 구현)이 이 DOM 자리를 재사용한다.

- [ ] **Step 1: 현재 파일 전체를 읽어 구조 확인**

실행자는 `app/src/app/features/trips/trip-list-page.ts` 전체를 `Read`로 읽는다. 이 파일은 158행 내외의 standalone 컴포넌트로, `@for (trip of store.trips(); track trip.id)` 루프 안에 `<a class="panel card" [routerLink]="['/trips', trip.id]">` 카드가 있고 그 안에 `.card__main`(제목·기간·지역 칩)과 `.card__meta`(장소 N개·숙소 N개)가 있다. 아래 스텝의 편집은 이 실제 구조를 기준으로 맞춘다.

- [ ] **Step 2: import와 상태 라벨 메서드 추가**

파일 상단 import를 다음으로 바꾼다(기존 `formatPeriod`만 가져오던 줄을 확장):

```typescript
import { formatPeriod, todayIso, tripTimelineStatus } from '../../domain/dates';
```

클래스 본문(`period(trip: Trip): string { ... }` 메서드 뒤)에 추가한다:

```typescript
  /** 여행 카드에 표시할 진행 상태 라벨. 종료일 경과는 '완료'가 아니라 '일정 날짜 지남'이다. */
  timelineLabel(trip: Trip): string {
    const status = tripTimelineStatus(trip.startDate, trip.endDate, todayIso());
    switch (status.kind) {
      case 'undecided':
        return '날짜 미정';
      case 'upcoming':
        return `예정 D-${status.daysUntil}`;
      case 'today':
        return '진행중 D-day';
      case 'ongoing':
        return `여행 중 · ${status.dayNumber}일차`;
      case 'past':
        return '일정 날짜 지남';
    }
  }

  /** 상태별 칩 클래스. 진행 중만 강조하고 나머지는 중립 표시다. */
  timelineCellClass(trip: Trip): string {
    const status = tripTimelineStatus(trip.startDate, trip.endDate, todayIso());
    if (status.kind === 'today' || status.kind === 'ongoing') return 'cell cell--solid-accent';
    if (status.kind === 'past') return 'cell cell--warn';
    return 'cell cell--ghost';
  }
```

- [ ] **Step 3: 카드 템플릿에 상태 배지·지출 자리·동행 자리 추가**

`.card__main` 안의 `<h2>{{ trip.title }}</h2>` 줄을 다음으로 바꾼다(제목과 상태 배지를 한 줄에 둔다):

```html
                      <div class="card__title-row">
                        <h2>{{ trip.title }}</h2>
                        <span [class]="timelineCellClass(trip)" [attr.data-testid]="'trip-timeline-' + trip.id">{{ timelineLabel(trip) }}</span>
                      </div>
```

그리고 `.card__main` 블록의 닫는 `</div>` 바로 앞(지역 칩 `@if` 블록 뒤)에 지출 요약과 동행 자리를 추가한다:

```html
                      <div class="row card__extra">
                        <span class="cell cell--ghost" [attr.data-testid]="'trip-expense-' + trip.id">지출 미설정</span>
                        <span class="cell cell--ghost" [attr.data-testid]="'trip-companions-' + trip.id">
                          <app-icon name="luggage" [size]="12" /> 동행 준비 중
                        </span>
                      </div>
```

주석: 지출·동행은 아직 실제 데이터가 없으므로 "미설정"·"준비 중"으로만 표시한다. 0원이나 가짜 참여자를 만들어 채우지 않는다(스펙 2절). 카드 전체가 이미 `<a routerLink>`라서 이 안에 중첩 링크나 버튼을 넣지 않는다 — 지출·정산 화면 이동과 [+ 초대] 동작은 실제 기능이 생기는 후속 계획에서 카드 구조를 조정하며 연결한다.

- [ ] **Step 4: 카드 스타일 추가**

컴포넌트 `styles` 배열의 `.card__regions { gap: 6px; }` 규칙 뒤에 추가한다:

```css
      .card__title-row {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-wrap: wrap;
      }
      .card__extra {
        gap: 6px;
        margin-top: 2px;
      }
```

- [ ] **Step 5: 테스트 실행**

Run: `cd app && npx vitest run`
Expected: 기존 테스트 전부 통과(이 Task는 도메인 로직을 바꾸지 않는다).

Run: `cd app && npm run e2e`
Expected: 기존 e2e 통과. 카드의 기존 `data-testid`(`trip-card-<id>`, `trip-list`, `empty-trips`, `new-trip`)를 그대로 유지했으므로 셀렉터 기반 테스트는 깨지지 않아야 한다. 깨지는 테스트가 있으면 그 selector를 확인해 템플릿을 조정한다.

- [ ] **Step 6: Commit**

```bash
git add app/src/app/features/trips/trip-list-page.ts
git commit -m "feat(app): 여행 목록 카드에 D-day·지출·동행 자리 추가"
```

`git add -A`를 쓰지 않는다. 워킹 디렉터리에 이 계획과 무관한 사용자의 로고 작업이 미커밋 상태로 있다.

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

```bash
git add app/src/app/shared/trip-map.ts app/src/app/features/trips/trip-detail-page.ts
git commit -m "feat(app): 지도 접기·확대로 모바일 첫 화면에 첫 장소 노출"
```

`git add -A`를 쓰지 않는다.

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

```bash
git add app/src/app/features/trips/trip-detail-page.ts
# e2e 파일도 수정했다면 그 파일 경로도 함께 추가한다
git commit -m "feat(app): 장소 카드 편집 버튼을 순서 편집 모드로 분리하고 지도 버튼 브랜드색 적용"
```

`git add -A`를 쓰지 않는다.

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

```bash
git add app/src/app/features/trips/stop-form-page.ts
# e2e 파일도 수정했다면 그 파일 경로도 함께 추가한다
git commit -m "feat(app): 장소 추가 폼의 선택 입력을 접이식으로 정리"
```

`git add -A`를 쓰지 않는다.

---

### Task 7: 문서 동기화

**Files:**
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`
- Modify: `docs/디자인-비교-검토-2026-09-09.md`

**Interfaces:**
- Consumes: 없음.
- Produces: 없음(문서 텍스트 변경만).

- [ ] **Step 1: PRODUCT.md Brand Commitments에 지도 버튼 브랜드색 규칙 추가**

`PRODUCT.md`의 `## Brand Commitments` 절에서 시각 방향 항목(현재 "강조색은 딥 블루 하나이며..."로 시작하는 문단) 뒤에 새 항목을 추가한다:

```markdown
- 지도 앱 버튼(2026-09-09 확정): 네이버지도·카카오맵 버튼은 각 사의 브랜드 색상(네이버 #03c75a, 카카오 #fee500)만 배경으로 반영하고 로고 이미지·로고 모양은 쓰지 않는다. 아이콘은 자체 SVG 세트의 pin을 재사용한다.
- 그라데이션은 쓰지 않는다(2026-09-09 확정): 여행 헤더 그라데이션을 시험 적용했다가 화면에 과하다고 판단해 취소했다. 강조는 딥 블루 단색 하나로만 표현한다.
```

`PRODUCT.md`의 `## Operating Context` 절에서 하단 메뉴 항목("하단 주요 메뉴 4개(기획): 발견 / 트립플로 / 기록지도 / 여행 친구...")을 다음으로 갱신한다:

```markdown
- 하단 주요 메뉴 4개(기획): 발견 / 트립플로 / 기록지도 / 여행 친구. 알파는 ‘트립플로’를 구현했고 여행 목록 카드에 D-day·지출·동행 자리를 표시한다(지출·동행은 자리만 있고 실제 데이터는 후속).
```

- [ ] **Step 2: DESIGN.md에 지도 버튼 브랜드색 기록**

`DESIGN.md`의 "The Single Accent Rule" 문단(375행 부근, 이미 앞선 개명 작업에서 딥 블루로 수정됨) 바로 뒤에 새 문단을 추가한다:

```markdown
**Map App Brand Colors (2026-09-09).** 네이버지도(`#03c75a`)·카카오맵(`#fee500`) 버튼만 각 서비스 브랜드색을 배경으로 쓴다. 두 색은 강조색 체계가 아니라 외부 서비스 식별용이며 다른 요소에 쓰지 않는다. 로고 이미지·로고 모양은 쓰지 않고 자체 `pin` 아이콘을 얹는다. 카카오 옐로 위 글자는 흰색이 아니라 잉크색(`#3c1e1e`)이다. 그라데이션은 시험 후 폐기했으므로 The Single Accent Rule에 예외는 없다.
```

- [ ] **Step 3: 디자인 비교 검토 문서 상태 갱신**

`docs/디자인-비교-검토-2026-09-09.md`의 3행("이번 결과는 검토 의견이며 제품 코드나 기획상의 디자인 방향을 변경한 것이 아니다.") 뒤에 추가한다:

```markdown
**2026-09-09 확정 반영**: 위 우선 개선 1~3번(첫 장소 노출, 반복 편집 버튼 정리, 장소 추가 폼 선택 입력 접기)은 `docs/superpowers/plans/2026-09-09-trip-detail-and-schedule-redesign.md`로 구현했다.
```

- [ ] **Step 4: TourJ 검토 문서의 그라데이션 제안 결론 기록**

`docs/TourJ-참고와-AI-입력방식-검토.md`의 "## 우리 앱에 적용할 디자인 제안" 절 첫 줄("트리플의 간결한 정보 위계에 TourJ에서 확인한 부드러운 그라데이션을 결합하는 방향을 제안한다.") 뒤에 추가한다:

```markdown
**2026-09-09 결론**: 그라데이션 제안은 채택하지 않았다. 딥 블루→보라 계열로 실제 적용해 본 뒤 사용자가 화면에 과하다고 판단해 취소했고, 강조는 딥 블루 단색 하나로 유지한다. 같은 절의 AI 입력 3단계 제안은 채택했다.
```

- [ ] **Step 5: 변경 사항 육안 확인**

네 파일을 다시 읽어 마크다운 문법이 깨지지 않았는지 확인한다.

- [ ] **Step 6: Commit**

```bash
git add PRODUCT.md DESIGN.md "docs/디자인-비교-검토-2026-09-09.md" "docs/TourJ-참고와-AI-입력방식-검토.md"
git commit -m "docs: 지도 버튼 브랜드색·여행 카드 확장 반영, 그라데이션 폐기 기록"
```

이것으로 이 계획의 모든 Task가 끝난다.

---

## Self-Review 결과 (계획 작성자가 직접 확인함)

- **스펙 커버리지**: 스펙 1절(색)→Task 2·7, 2절(여행 카드 정보 확장)→Task 3, 3절(일정 화면 개선)→Task 4·5·6, 7절(지도 버튼)→Task 5·7, 8절(문서 동기화)→Task 7. 4~6절(AI·동행·지출)은 이 계획에서 명시적으로 제외했다(여행 카드의 지출·동행 자리표시만 Task 3에서 마련).
- **플레이스홀더 스캔**: "선택 정보 더보기" 필드 이동처럼 정확한 라인을 지금 알 수 없는 부분(Task 1의 trip-map.ts 구조, Task 6의 stop-form-page.ts 필드 위치)은 실행자가 실행 시점에 `Read`로 실제 파일을 확인하도록 명시적으로 지시했다. "TODO"나 "알아서 구현"류 표현은 쓰지 않았다.
- **타입 일관성**: `TripTimelineStatus`는 Task 1에서 정의하고 Task 3에서 그대로 import해 쓴다. `tripTimelineStatus`, `todayIso` 함수 시그니처가 Task 1과 Task 3에서 일치한다.
