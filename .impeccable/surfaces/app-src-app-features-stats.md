---
version: 1
slug: "app-src-app-features-stats"
primary_target: "app/src/app/features/stats"
related_targets: ["app/src/app/features/stats/feature/visit-map","app/src/app/features/stats/feature/stats"]
---

## 현재 기준: 시·군·구 230개 단위 (2026-09-22)

앞선 모든 시·도 17개 기준을 대신한다. Operate 모드.

**단위**: 2026-07-01 기준 시·군·구 230개. 광주와 전남이 전남광주통합특별시로
합쳐져 시·도는 16개다. 수원·성남·창원 등 일반구가 있는 시 13개는 구를 상위
시로 합쳤다. 서울·부산의 자치구와 통합시의 옛 광주 자치구는 그대로 둔다.

**경계**: `public/geo/korea-municipalities-2026.geo.json` 594KB. 원본은
vuski/admdongkor(CC BY 4.0, SGIS 출처표시 승계)이며 화면 하단에 표기한다.
속성은 `cd`(`12_여수시`)·`nm`·`sido`·`sidonm`. 생성은
`scripts/build-municipalities.mjs`, 지역 목록은 `scripts/build-region-data.mjs`.

**두 화면의 숫자는 같아야 한다.** `/stats`·`/stats/details`·여행 목록 배너가
모두 '다녀온 지역 N / 230'과 '담은 장소 M곳'을 같은 값으로 보여준다. 한쪽을
시·도로, 다른 쪽을 시·군·구로 세면 어느 쪽이 맞는지 알 수 없다.

**커버리지**: 230이 분모라 초반은 2~3%다. 퍼센트를 앞세우지 않고 '5개 지역 ·
전국의 2%'처럼 센 수를 먼저 보여준다. 0%에 가까운 막대는 성취가 아니라
없음을 강조할 뿐이다.

**목록**: '다녀온 지역'은 시·군·구 한 줄씩. '아직 안 간 곳' 225곳은 시·도로
접어 두고 하나씩 펼친다. 칩으로 한꺼번에 깔면 실제 기록이 묻힌다.

**마커**: 고른 자리 하나만 띄운다. 아무것도 고르지 않았으면 그리지 않는다.
블록 판정이 시·군·구 단위라 누른 블록이 곧 그 지역이며 보정이 없다.

**/stats/details**: 화면 전용 CSS를 버리고 앱 토큰과 Tailwind만 쓴다.
`max-w-(--content-max)` 가운데 정렬, `rounded-panel bg-panel shadow-panel`
패널, 공통 `UiButton`·`IconComponent`·`UiSpinner`. 시·도 격자와 서울 자치구
격자는 삭제했다(230개를 손배치할 수 없고 전국 지도가 이미 같은 단위다).
방문 횟수 점은 지도와 같은 `--color-map-visit-*` 토큰을 읽는다.

**지우지 말 것**: 주소를 여행 지역보다 먼저 읽는 규칙, 시·도 이름만 아는
장소를 분류하지 않는 규칙, 통합·개칭 전 표기를 함께 읽는 매핑.

**검증**: 단위 테스트 457개, 의존성 경계 164개 모듈, 타입 검사 통과. 실제
브라우저 1280×900과 360×740에서 가로 넘침 없음, 조작 영역 44px 확인. 여수
블록을 눌러 마커·패널이 '여수시'로 뜨는 것과 구례·함평이 각각 색이 차는 것을
확인했다.
