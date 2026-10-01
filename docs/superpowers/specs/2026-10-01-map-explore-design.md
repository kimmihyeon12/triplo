# 큰 지도에서 주변 장소 골라 담기 설계

2026-10-01 작성. 사용자 요청: "모바일에서 지도 크게 봐서 지도에서 선택하여 일정 저장할 수 있는 기능". 고르는 방식은 주변 장소 핀, 여는 곳은 여행 상세 지도(사용자 선택).

## 제약

카카오 지도 SDK는 지도 그림에 찍힌 기본 장소(가게 이름)를 눌렀을 때 앱에 알려 주지 않는다. 그래서 앱이 카카오 분류 검색으로 장소를 받아 직접 핀을 그리고, 그 핀을 누르게 한다.

## 흐름

1. 여행 상세 지도 오른쪽 위 `크게 보고 담기` → `/trips/:id/map?day=`(보던 날).
2. 지도가 화면을 다 쓴다(상단 바 아래). 그날 일정·숙소는 지금처럼 번호 핀이다. 위에 날짜 버튼과 분류 버튼 `맛집·카페·관광·숙소`를 띄운다.
3. 분류를 누르면 지금 보이는 범위에서 카카오 분류 검색(FD6·CE7·AT4·AD5)을 해 최대 30곳(15곳씩 두 쪽)을 분류 색 핀으로 보인다. 같은 분류를 다시 누르면 끈다.
4. 지도를 범위 폭의 20% 넘게 옮기거나 크게 확대·축소하면 `이 지역에서 다시 찾기`가 뜬다. 자동으로 찾지 않는다(카카오 무료 한도).
5. 핀을 누르면 아래 정보판: 이름·분류·주소·`카카오맵에서 보기`, 담을 날(기본: 보던 날, 날짜 미정 가능), `담기`.
6. `담기`는 그날 일정 끝에 더한다. 종류는 분류로 정한다(맛집→식사, 카페→카페, 관광→관광). 좌표·주소·출처는 카카오 값 그대로라 '위치 확인됨'이다. 담으면 핀이 체크로 바뀌고 `담았어요`가 된다. 지도는 옮기지 않는다(보던 자리 유지).
7. 숙소 핀은 체크인·체크아웃을 정해야 해 `숙소로 담기 · 날짜 정하기`로 숙소 추가 화면에 장소를 채워 넘긴다(`history.state.place`).

이미 담은 곳: 같은 출처 번호, 또는 같은 이름이 40m 안이면 체크 핀으로 보인다.

## 코드

| 파일 | 역할 |
| --- | --- |
| `places/model/map.ts` | `NearbyCategory`, `NearbyPlace`, `PlacePin` |
| `places/data/map-provider.ts` | `MapInstance.renderPlaces`·`bounds`, `render(model, fit)`, 마운트 옵션 `onPlaceClick`·`onIdle` |
| `places/data/kakao/kakao-map-provider.ts` | 주변 핀 층(CustomOverlay), `idle` 이벤트로 범위 알림 |
| `places/data/fixture/fixture-map-provider.ts` | 테스트 지도. 보이는 범위 안 핀만 그리고, `tc-fixture-move` 이벤트로 지도 이동을 흉내 낸다 |
| `places/data/place-search.ts` | `NEARBY_PLACE_SEARCH`(`nearby(category, bounds)`). 이름 검색과 따로 둬 기존 테스트 대역을 건드리지 않는다 |
| `places/data/kakao/kakao-place-search.ts` | `categorySearch`(범위·두 쪽) |
| `places/data/fixture/fixture-place-search.ts` | 강릉 주변 고정 목록(이름 검색 목록과 분리) |
| `places/data/place-pin.ts` | 핀 버튼 DOM(분류 아이콘, 담은 곳은 체크) |
| `places/ui/trip-map/trip-map.ts` | 입력 `places`·`selectedPlaceId`·`fitOnChange`·`bare`, 출력 `placeSelect`·`boundsChange`, 크기 바뀌면 다시 맞추기 |
| `trips/util/map-explore.ts` | 분류→종류, 이미 담은 곳 판정, 그날 일정 끝에 더하기 |
| `trips/feature/map-explore/` | 큰 지도 화면 |
| `trips/feature/stay-form/stay-form.ts` | 넘겨받은 장소 채우기 |

## 테스트

- 단위: 분류→종류, 위치·출처 저장, 이미 담은 곳 판정.
- e2e(360px·데스크톱): 크게 보기 → 맛집 → 범위 밖은 없음 → 핀 → 다른 날 담기 → 상세에 보임 / 지도 이동 → 다시 찾기 / 숙소 → 숙소 화면에 이름 채움 / 범위에 없음·불러오기 실패 안내.
- 실제 카카오 지도·분류 검색은 배포 후 운영에서 확인한다(테스트 앱은 고정 지도·목록).

## 넣지 않는 것

지도 기본 장소 누르기(SDK 미지원), 아무 지점 길게 눌러 담기, 핀 묶음 표시, 장소 추가 화면의 지도 고르기.
