# 방문 통계 지도 설계 (2026-09-18)

이 문서는 방문 통계 화면(`/stats`)의 설계 결정과 근거를 기록한다. 이 문서는 구현 완료를 뜻하지 않는다. 검증 가능한 요구사항은 OpenSpec 제안에 별도로 기록한다.

## 1. 목적과 문제

지금까지 만든 화면은 모두 **앞으로 갈 여행**을 다룬다. 일정을 짜고, 장소를 담고, 지출을 적는다. 그러나 여행이 끝난 뒤에 남는 것이 없다. 사용자는 자신이 그동안 어디를 다녔는지 앱에서 확인할 방법이 없다.

방문 통계 지도는 이 빈자리를 채운다. 사용자가 일정에 담았던 장소를 지역 단위로 모아 지도에 쌓아 보여주고, 많이 간 지역일수록 더 높고 진하게 표시한다. 깃 커밋 기록처럼 누적이 눈에 보이게 만드는 것이 목표다.

## 2. 기존 결정과의 관계

### 22절의 갱신: 날짜 경과 자동 완료

기획안 22절은 다음과 같이 정하고 있었다.

> 여행 종료는 사용자가 결정하며 예정 날짜가 지났다는 이유만으로 자동 완료하지 않는다.

2026-09-18 사용자 결정으로 이 규칙을 갱신한다.

> 여행 종료일이 오늘 이전이면 그 여행의 장소를 방문한 것으로 간주해 통계에 집계한다.

갱신한 이유는 방문 완료를 사용자가 직접 선언하는 기능이 아직 없기 때문이다. 선언 기능을 먼저 만들면 통계 화면까지 가는 거리가 멀어지고, 그 사이 사용자는 아무 누적도 볼 수 없다. 날짜 기준은 완벽하지 않지만 추가 입력 없이 즉시 동작한다.

이 갱신의 범위를 분명히 한다. **자동 완료는 통계 집계에만 적용하며 `Trip` 데이터에 완료 상태를 기록하지 않는다.** 여행 목록의 표시는 그대로 "일정 날짜 지남"을 유지한다. 나중에 사용자 선언 기능을 추가할 때 이 규칙을 다시 좁힌다.

### 6절과의 관계: 미방문 지역을 칠하지 않는다

기획안 6절은 다음을 금지한다.

> 방문하지 않은 지역을 가본 것처럼 칠하지 않는다.

이 설계는 그 금지를 지킨다. 방문 기록이 없는 지역은 블록 높이가 0이고 기본 회색으로 남는다. 국토 전체를 채워 "정복률"을 보여주는 표현을 만들지 않는다. 진하기는 방문한 지역 사이의 상대적 빈도만 나타낸다.

### 11절과의 관계: 3D를 게임으로 만들지 않는다

기획안 11절은 "전체 길찾기 지도를 3D 게임으로 만들지 않는다"고 정하고, "지도 편집 중에는 3D를 멈추거나 언로드한다"를 요구한다.

이 설계는 3D 라이브러리를 도입하지 않는다. SVG 다각형과 CSS로 아이소메트릭 입체감을 만든다. 실제 3D 장면이 아니므로 언로드할 대상이 없고, 일정 편집 화면과 자원을 다투지 않는다. 11절의 취지를 어기지 않으면서 요청된 시각 표현을 얻는다.

## 3. 범위

| 포함 | 제외 |
| --- | --- |
| 국내 시·도 17개의 방문 횟수 지도 | 해외 여행. `Trip`에 국내·해외 구분이 없다 |
| 서울의 구 단위 하위 지도 | 나머지 16개 시·도의 하위 지도. 2단계에서 목록만 보여준다 |
| 구역별 방문 장소 목록 | 사진. 사진 기능 자체가 미구현이다 |
| 여행 목록에서 진입하는 `/stats` 라우트 | 하단 탭 바. 독립적인 설계 주제다 |

서울만 하위 격자를 만드는 이유는 격자 좌표를 손으로 배치해야 하기 때문이다. 한 곳으로 방식이 검증되면 나머지는 데이터 파일 추가로 늘릴 수 있다.

## 4. 집계 계약

### 화면은 집계 결과만 받는다

이 설계의 가장 중요한 결정이다. 통계 화면은 `Trip` 전체를 절대 받지 않는다.

```ts
export interface RegionVisitCount {
  regionCode: string;   // 'gangwon-gangneung'
  name: string;         // '강릉'
  visitCount: number;
}

export interface VisitedPlace {
  id: string;
  name: string;
  address: string;
  visitedOn: IsoDate;          // 여행 종료일
  location: GeoPoint | null;   // null이면 위치 미확인
  tripId: string;
  tripTitle: string;
}

export interface VisitStatsRepository {
  provinceCounts(): Promise<RegionVisitCount[]>;
  subRegionCounts(provinceCode: string): Promise<RegionVisitCount[]>;
  placesIn(regionCode: string): Promise<VisitedPlace[]>;
}

export const VISIT_STATS_REPOSITORY = new InjectionToken<VisitStatsRepository>('VISIT_STATS_REPOSITORY');
```

이 계약을 두는 이유는 저장소 이전 때문이다. 현재는 여행이 localStorage에 있어 전부 읽어 세어도 문제가 없다. 그러나 Supabase로 옮긴 뒤 여행이 수백 건 쌓이면, 통계 화면을 열 때마다 모든 일정을 내려받는 구조는 감당할 수 없다.

화면이 `Trip[]`을 받으면 집계 위치를 서버로 옮길 수 없다. 화면이 `RegionVisitCount[]`를 받으면 구현체만 갈아끼우면 된다.

| 단계 | 구현체 | 집계 위치 |
| --- | --- | --- |
| 현재 | `LocalVisitStatsRepository` | 브라우저. `TripRepository.list()`를 읽어 센다 |
| Supabase 이후 | `SupabaseVisitStatsRepository` | 서버. `GROUP BY region_code` 집계 쿼리 |

같은 패턴을 `TripRepository`가 이미 쓰고 있다. 그 파일의 주석이 "Supabase 연결 단계에서 같은 인터페이스의 서버 구현으로 교체한다"고 선언한다.

### 방문 판정 규칙

한 장소를 방문으로 세는 조건은 다음을 모두 만족하는 경우다.

1. 소속 여행의 `endDate`가 오늘보다 이전이다. 종료일이 없거나 오늘 이후면 세지 않는다
2. 장소의 `excluded`가 `false`다. 일정에서 제외한 장소는 가지 않은 것으로 본다
3. 장소의 `kind`가 `'buffer'`가 아니다. 이동 여유 시간은 장소가 아니다

숙소(`AccommodationStay`)도 같은 규칙으로 집계한다. 숙소는 실제로 머문 곳이므로 방문에서 뺄 이유가 없다.

### 좌표가 없는 장소

직접 이름만 입력한 장소는 `location`이 `null`이다. 이 장소를 다음과 같이 다룬다.

| 자리 | 처리 |
| --- | --- |
| 지역 블록 횟수 | 포함한다 |
| 개별 지도 핀 | 제외한다. 찍을 좌표가 없다 |
| 장소 목록 | 포함하되 "위치 미확인" 표시를 붙인다 |

사용자가 실제로 넣은 장소인데 검색을 거치지 않았다는 이유로 횟수에서 사라지면, 통계가 실제보다 적게 보인다. 없는 것처럼 감추지 않는다.

## 5. 지역 코드 도입

### 문제

`TripRegion`은 현재 `id`, `name`, `order`만 가진다. `id`는 여행마다 새로 만드는 임의 문자열이고, `name`은 `korea-regions.ts` 고정 목록에서 고른 지명이다. 고정 목록을 쓰므로 표기 흔들림은 없다.

그럼에도 이름 문자열만으로 집계하면 두 가지 약점이 남는다.

첫째, 행정구역이 개편되어 지명이 바뀌면 과거 여행의 통계가 끊긴다. 둘째, `'광주(경기)'`처럼 구분용 괄호가 붙은 표시 이름은 집계 키로 쓰기에 불안하다. 셋째, 시·도 정보가 여행에 저장되지 않아 전국 지도에서 묶으려면 매번 이름으로 역조회해야 한다.

### 결정

`korea-regions.ts`의 `KoreaRegion`에 `code`를 추가하고, `TripRegion`에 선택 필드로 붙인다.

```ts
export interface KoreaRegion {
  readonly name: string;
  readonly province: string;
  readonly short: string;
  readonly code: string;         // 추가. 'gyeonggi-gwangju'
  readonly provinceCode: string; // 추가. 'gyeonggi'
}

export interface TripRegion {
  id: string;
  name: string;
  order: number;
  regionCode?: string;  // 추가. 선택 필드
}
```

코드에는 표시용 괄호를 넣지 않는다. `'광주(경기)'`는 `'gyeonggi-gwangju'`가 된다.

### 기존 여행의 처리

`schemaVersion`을 올리는 전면 마이그레이션을 하지 않는다. 읽는 시점에 보정한다.

1. `regionCode`가 있으면 그대로 쓴다
2. 없으면 `name`으로 표준 목록을 찾아 코드를 얻는다. 이름이 고정 목록에서 온 값이므로 거의 전부 찾아진다
3. 둘 다 실패하면 "분류되지 않음"으로 따로 센다. 화면에 그 개수를 표시한다

전면 마이그레이션은 실패하면 기존 데이터를 망가뜨릴 수 있다. 읽기 시점 보정은 실패해도 그 여행 하나가 "분류되지 않음"에 들어갈 뿐이다. 위험이 훨씬 작다.

`local-storage-trip-repository.ts`의 `isTrip()` 검증은 `regionCode`를 필수로 요구하지 않는다.

## 6. 화면 구조

라우트는 `/stats` 하나이며, 단계는 쿼리 파라미터로 표현한다. 라우트를 늘리지 않으면서 뒤로 가기가 자연스럽게 동작한다.

| 단계 | 경로 | 내용 |
| --- | --- | --- |
| 전국 | `/stats` | 시·도 17개 블록 지도, 총 방문 장소 수, 방문 지역 수, 색 범례 |
| 지역 | `/stats?region=seoul` | 하위 구역 블록 지도(서울만) 또는 구역 목록, 월별 분포 |
| 장소 | `/stats?region=seoul-gangnam` | 그 구역에서 방문한 장소 목록 |

장소 항목을 누르면 소속 여행 상세로 이동한다.

방문 기록이 하나도 없으면 빈 상태 안내와 여행 만들기 링크를 보여준다. 첫 사용자가 빈 지도를 보고 고장으로 오해하지 않게 한다.

## 7. 렌더링

### 격자 데이터

```ts
export interface GridCell {
  readonly q: number;
  readonly r: number;
  readonly regionCode: string;
}
```

`q`, `r`은 육각 격자 좌표다. 시·도마다 여러 칸을 배정해 국토 윤곽을 거칠게 닮게 만든다. 실제 행정구역 경계(GeoJSON)를 쓰지 않는 이유는 원본이 수 MB 단위라 단순화 전처리와 라이선스 확인이 필요하고, 통계 화면의 목적이 정확한 지리 정보 전달이 아니기 때문이다.

나중에 실제 경계로 교체하더라도 이 파일의 내용만 바뀐다. 다른 코드는 `GridCell` 배열만 본다.

### 블록 그리기

육각형 하나를 세 개의 다각형으로 그린다. 윗면, 왼쪽 옆면, 오른쪽 옆면이다. 옆면 높이는 방문 횟수를 5단계로 나눈 값에 비례하고, 윗면 색도 같은 5단계를 쓴다.

겹침 순서를 맞추기 위해 `q + r`이 작은 칸부터 그린다. 뒤쪽 블록이 앞쪽 블록에 가려지는 순서다.

색 5단계는 `DESIGN.md`의 토큰을 쓴다. 새 색을 만들지 않는다.

### 상호작용과 접근성

확대는 SVG `viewBox`를 CSS transition으로 옮겨 처리한다. `prefers-reduced-motion`이 켜져 있으면 전환 없이 즉시 바뀐다.

각 블록은 키보드로 선택할 수 있어야 한다. 그리고 **같은 데이터를 표로 보여주는 대체 목록을 화면 아래에 항상 둔다.** 지도를 읽을 수 없는 사용자에게 숨은 대체 텍스트만 제공하는 방식은 확인하기 어렵고 쉽게 낡는다. 눈에 보이는 목록이면 모두가 같은 것을 본다.

## 8. 파일 구조

```text
app/src/app/features/stats/
├── stats.routes.ts
├── model/visit-stats.ts              # RegionVisitCount, VisitedPlace
├── data/
│   ├── visit-stats-repository.ts     # 인터페이스 + 토큰
│   ├── local-visit-stats.ts          # localStorage 집계 구현
│   ├── korea-grid.ts                 # 시·도 격자
│   └── seoul-grid.ts                 # 서울 구 격자
├── util/
│   ├── visit-tally.ts                # 여행 → 지역별 횟수 (순수 함수)
│   └── hex-geometry.ts               # 격자 좌표 → SVG 다각형 (순수 함수)
├── ui/region-block-map/              # 블록 지도 컴포넌트
└── feature/stats/                    # 화면
```

집계 규칙(`visit-tally`)과 좌표 변환(`hex-geometry`)을 순수 함수로 분리한다. 두 가지 모두 입력과 출력이 분명해 테스트하기 좋고, 화면 없이 검증할 수 있다.

## 9. 검증

### 단위 테스트

| 대상 | 확인할 것 |
| --- | --- |
| `visit-tally` | 종료일이 미래인 여행을 세지 않는다 |
| `visit-tally` | 종료일이 없는 여행을 세지 않는다 |
| `visit-tally` | `excluded`가 참인 장소를 세지 않는다 |
| `visit-tally` | `kind`가 `'buffer'`인 항목을 세지 않는다 |
| `visit-tally` | 좌표 없는 장소가 지역 횟수에는 포함된다 |
| `visit-tally` | `regionCode`가 없는 여행을 이름으로 보정한다 |
| `visit-tally` | 보정에 실패한 지역을 "분류되지 않음"으로 센다 |
| `visit-tally` | 숙소를 방문에 포함한다 |
| `hex-geometry` | 격자 좌표가 예상 다각형 점들을 만든다 |
| `hex-geometry` | 방문 횟수가 예상 높이 단계로 바뀐다 |

### E2E 테스트

`/stats` 진입 → 블록 클릭 → 확대 → 라벨 클릭 → 장소 목록 확인. 그리고 기록이 없을 때 빈 상태가 나오는지 확인한다.

### 실제 실행 확인

개발 서버를 띄워 화면을 직접 보고 스크린샷으로 확인한다. 테스트 통과만으로 완료를 보고하지 않는다.

## 10. 함께 갱신할 문서

이 작업은 기존 결정을 바꾸므로 같은 작업에서 다음을 갱신한다.

- `docs/기획안-v0.1.md` 22절: 통계 집계에 한정한 날짜 경과 자동 완료 규칙과 그 범위
- `openspec/changes/`: 통계 화면 변경 제안(제안·설계·요구사항·작업)
- `docs/DEVELOPMENT.md`: 개발 순서 반영
- `docs/README.md`: 이 설계 문서 링크 추가

## 11. 이후 과제

이 설계에 포함하지 않았으나 이어질 작업이다.

- 사용자가 직접 선언하는 방문 완료·건너뛰기. 기획안 7절의 `planned → visited / skipped`
- 나머지 16개 시·도의 하위 격자
- 방문 기록에 사진 연결. Supabase Storage 연결이 선행 조건이다
- 해외 여행 구분과 필터
- 하단 탭 바와 기록지도 탭 편입

## 2026-09-18 별도 WebGL 지도 결정

위 SVG 결정과 손배치 격자는 `/stats`에 해당한다. 최신 사용자 요청으로 `/lab/map2`에는 Three.js와 실제 출처의 2013년 시·도 경계 기반 복셀 지도를 별도로 추가한다. 기존 집계 함수를 공유하며 상세 범위·데이터 출처·검증은 `openspec/changes/add-voxel-visit-map/`이 원본이다. 이 페이지는 전국 시·도만 지원하고 서울 상세 지도는 포함하지 않는다.
