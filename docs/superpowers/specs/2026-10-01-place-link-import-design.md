# 지도 링크로 장소 담기 설계

2026-10-01 작성. 2026-09-20 네이버 링크 설계(브랜치 `feat/naver-link-import`의 `docs/superpowers/specs/2026-09-20-naver-link-import-design.md`, 미병합)를 대신한다. 사용자 결정으로 바뀐 점은 두 가지다. 카카오맵 링크도 받는다. 카카오 검색에 없는 장소는 링크의 주소·좌표로 담는다.

## 배경

2026-10-01 사용자 지적: '신가회전훠궈 수원역점'이 네이버와 카카오맵 웹에는 나오는데 앱의 장소 검색에는 없다. 확인해 보니 카카오 개발자용 장소 검색(지도 SDK `keywordSearch`)이 이 지점을 돌려주지 않는다. 같은 이름으로 찾으면 영통점만 나온다. 앱이 걸러 낸 것이 아니다.

이전 설계(링크에서 이름만 읽고 카카오로 다시 검색)로는 이런 장소를 담을 수 없다. 사용자는 링크에 있는 주소와 좌표로 담기를 골랐다. 지도 제공자(네이버·카카오)의 장소 데이터이며 모델이 만든 값이 아니므로 AGENTS.md의 "검증된 출처" 기준을 지킨다. 원본 링크를 함께 남겨 사용자가 확인할 수 있게 한다.

네이버 지도는 시스템 공유 시트를 쓰지 않으므로 **URL 복사 → 앱에서 붙여넣기**가 공통 경로다(2026-09-20 확인).

## 확인한 사실(2026-10-01, 실제 링크)

| 항목 | 결과 |
| --- | --- |
| 네이버 짧은 링크 | `https://naver.me/5Qsr0ejg` → 307 → `https://map.naver.com/p/entry/place/2058177895?...` → 301·302로 `m.map.naver.com`·`/appLink.nhn`까지 간다. 첫 이동에서 장소 번호를 얻는다 |
| 네이버 장소 페이지 | `https://m.place.naver.com/place/{번호}/home`(모바일 UA)이 업종 경로(`/restaurant/`)로 바뀐다. 약 56만 바이트 |
| 네이버 장소 데이터 | 본문의 `window.__APOLLO_STATE__` 안 `"PlaceDetailBase:{번호}"`에 `name`, `category`, `roadAddress`, `address`, `coordinate.x`(경도)·`coordinate.y`(위도)가 있다. 앞에서 약 36만 바이트 뒤라 head에서 읽기를 멈추면 안 된다 |
| 카카오 장소 정보 | `https://place-api.map.kakao.com/places/panel3/{번호}`(요청 머리 `pf: web`)의 `summary`에 `name`, `point.lon`·`point.lat`, `address.road`·`address.disp`·`address.jibun`, `category.name2`가 있다 |
| 같은 장소의 좌표 | 네이버 127.0037697, 37.268625 / 카카오 127.0037566, 37.2686159. 약 1.5m 차이 |

## 흐름

1. 장소 추가 화면(`/trips/:id/stops/new`)의 검색 상자 위에 `링크로 담기`를 둔다. 누르면 링크 입력이 펼쳐진다. 기본은 접혀 있다.
2. `붙여넣기`를 누를 때만 클립보드를 읽는다. 읽지 못하면 직접 붙여 넣으면 된다(오류로 보지 않는다).
3. `찾기`를 누르면 서버 함수 `resolve-place`가 링크를 따라가 장소 정보를 돌려준다.
4. 앱은 그 이름으로 링크 좌표 근처(반경 300m) 카카오 검색을 한다. 이름이 맞고(공백·기호를 빼고 한쪽이 다른 쪽을 포함) 200m 안인 후보가 있으면 그 카카오 후보로 담는다. 지금 검색과 같은 출처가 된다.
5. 없으면 링크에서 읽은 값으로 담는다. 출처는 링크의 제공자(`naver` 또는 `kakao`)와 장소 번호, 원본 주소다. 장소 화면에 "네이버 지도 정보" 같은 출처를 보여 준다.
6. 이름·주소·좌표가 채워지고 링크 입력이 접힌다. 이후 저장은 지금과 같다.

## 서버 함수 `resolve-place`

```
POST /functions/v1/resolve-place
Authorization: Bearer <사용자 토큰>
{ "url": "https://naver.me/5Qsr0ejg" }

200 { "provider": "naver", "id": "2058177895", "name": "신가회전훠궈 수원역점",
      "roadAddress": "경기 수원시 팔달구 향교로 25-1 2층", "address": "경기 수원시 팔달구 매산로2가 28-2",
      "lat": 37.268625, "lng": 127.0037697, "category": "중식당",
      "url": "https://m.place.naver.com/place/2058177895/home" }
400 { "error": "unsupported_url" }   네이버·카카오 지도 링크가 아니다
404 { "error": "place_not_found" }   따라갔으나 장소 정보를 읽지 못했다
502 { "error": "upstream_failed" }   제공자가 응답하지 않는다
401 { "error": "authentication_required" }
```

### 받는 링크

- 네이버: `naver.me`, `map.naver.com`, `m.map.naver.com`, `m.place.naver.com`, `pcmap.place.naver.com`
- 카카오: `kko.to`, `place.map.kakao.com`, `map.kakao.com`(`itemId`·`urlX` 등에서 번호), `m.map.kakao.com`
- 호스트는 목록과 정확히 같아야 한다(`endsWith` 금지). https만 받는다.

### 요청 대상 제한(SSRF)

- 리디렉션은 자동으로 따라가지 않고 한 번씩 따라가며, 매번 다음 주소의 호스트를 확인한다. 최대 4번.
- 장소 번호를 얻으면 더 따라가지 않고 정해진 주소(네이버 장소 페이지, 카카오 장소 정보)만 부른다.
- 요청마다 8초 제한. 본문은 최대 1MB까지만 읽고, 네이버는 좌표를 찾으면 그만 읽는다.
- 로그인한 사용자만 쓸 수 있다. 사용자가 `찾기`를 누를 때 한 번만 부른다. 목록을 긁거나 반복 호출하지 않는다.

### 깨질 수 있다는 점

공개 API가 아니라 공개 페이지·장소 정보를 읽는다. 제공자가 구조를 바꾸면 `place_not_found`가 온다. 앱은 "장소를 읽지 못했어요. 이름으로 검색해 주세요"를 보여 주고 검색 상자로 넘긴다. 기능이 멈추지 않고 손이 한 번 더 가는 정도다.

## 코드 구성

| 파일 | 역할 |
| --- | --- |
| `supabase/functions/resolve-place/place-link.ts` | 링크 판별·장소 번호 꺼내기·네이버 페이지와 카카오 정보에서 장소 읽기(순수 함수). 앱도 같은 파일을 가져와 미리 걸러 낸다 |
| `supabase/functions/resolve-place/handler.ts` | 인증·입력 검사·응답. 외부 요청은 주입받는다 |
| `supabase/functions/resolve-place/index.ts` | 한 번씩 따라가는 요청과 크기·시간 제한 |
| `app/src/app/features/places/data/place-link-resolver.ts` | 서버 함수 호출(Supabase)과 테스트용 고정 응답 |
| `app/src/app/features/places/util/match-link-place.ts` | 카카오 후보 중 같은 장소 고르기(이름·거리) |
| `app/src/app/features/places/ui/place-link-box/` | 링크 입력 화면 조각 |
| `app/src/app/features/places/model/place.ts` | `PlaceRef.provider`에 `naver` 추가 |

DB는 바꾸지 않는다. `place_provider`는 text다.

## 오류 처리

| 상황 | 화면 |
| --- | --- |
| 지도 링크가 아님(앱에서 미리 거름) | "네이버·카카오 지도 링크만 담을 수 있어요" |
| 장소를 읽지 못함 | "장소를 읽지 못했어요. 이름으로 검색해 주세요" |
| 제공자 응답 없음 | "잠시 후 다시 시도해 주세요" + 다시 시도 |
| 로그인이 풀림 | 기존 인증 오류 처리 |
| 클립보드 읽기 거부 | 입력칸에 포커스만 둔다 |

## 테스트

- 링크 판별·번호 꺼내기·호스트 제한: 허용·거부 주소 표.
- 장소 읽기: 실제 응답에서 필요한 부분만 잘라 둔 예제(네이버 `PlaceDetailBase`, 카카오 `summary`)와 구조가 바뀐 경우.
- 서버 핸들러: 인증, 짧은 링크 한 번 따라가기, 허용 밖으로 리디렉션되면 중단, 4번 넘으면 중단, 제공자 오류.
- 같은 장소 고르기: 이름 표기 차이·거리 경계.
- Playwright(테스트 앱 고정 응답): 링크 붙여 넣기 → 카카오에 있으면 카카오 출처, 없으면 링크 출처로 저장. 360px·데스크톱.
- 실제 확인: 배포 후 `https://naver.me/5Qsr0ejg`와 카카오 장소 14261688.

## 범위에 넣지 않는 것

- 앱을 열 때 클립보드를 먼저 읽어 묻기(권한 팝업이 뜬다).
- 숙소 화면의 링크 담기(장소 화면에서 먼저 쓰고 판단한다).
- 영업시간·사진 등 다른 정보 가져오기.
