# 데이터베이스 구조

여행 데이터를 계정별로 저장하는 표 구조다. 원본 마이그레이션은 `supabase/migrations/`에 있고, 앱 모델은 `app/src/app/features/trips/model/trip.ts`다. 이 문서는 두 곳의 대응 관계와 설계 결정을 기록한다.

2026-09-17 작성. 적용 여부는 아래 '적용 현황'을 본다.

## 전체 관계

```text
auth.users
    │ 1
    │ owner_id                계정을 지우면 여행도 지운다
    ▼ N
  trips ────────────────────────────────────┐
    │ 1                  1                  │ 1
    │                    │                  │
    ▼ N                  ▼ N                ▼ N
trip_regions       trip_stops      accommodation_stays
    △ 1                 │ region_id          │ region_id
    └────────────────────┴────────────────────┘
         지역을 지우면 연결만 끊고 항목은 남긴다
```

여행이 중심이다. 지역·장소·숙소는 모두 여행에 딸리며 여행을 지우면 함께 사라진다.

## 표별 구조

### trips — 여행

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid | 기본 키. 앱이 만든 값을 그대로 쓴다 |
| owner_id | uuid | `auth.users`를 참조. 계정 삭제 시 함께 삭제 |
| title | text | 여행 이름 |
| start_date | date | null이면 날짜 미정 |
| end_date | date | null이면 날짜 미정 |
| status | trip_status | 현재 `draft`뿐이다 |
| schema_version | smallint | 모델 변경 시 이전 데이터를 구분한다 |
| created_at | timestamptz | |
| updated_at | timestamptz | 목록 정렬 기준 |

`(owner_id, updated_at desc)` 색인을 둔다. 여행 목록이 이 순서로 읽기 때문이다.

### trip_regions — 여행 안의 지역

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid | 기본 키 |
| trip_id | uuid | 여행 삭제 시 함께 삭제 |
| name | text | 지역 이름 |
| "order" | integer | 표시 순서. `order`가 예약어라 따옴표를 쓴다 |

### trip_stops — 일정 항목

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid | 기본 키 |
| trip_id | uuid | 여행 삭제 시 함께 삭제 |
| region_id | uuid | 지역 삭제 시 null이 된다. 항목은 남는다 |
| kind | stop_kind | `place`·`meal`·`break`·`buffer` |
| name | text | |
| address | text | 기본값은 빈 문자열 |
| date | date | **null이면 아직 어느 날짜에도 배치하지 않은 상태** |
| "order" | integer | 그 날짜 안에서의 순서 |
| stay_minutes | integer | 체류 계획(분). null은 미정 |
| memo | text | |
| fixed_time | text | `HH:mm`. 형식 검사를 건다 |
| excluded | boolean | 일정에서 제외. 삭제와 다르다 |
| location_status | location_status | `unverified`·`verified` |
| lat, lng | double precision | 확인된 좌표만 넣는다 |
| place_provider, place_id, place_url | text | 외부 장소 참조 |
| estimated_cost | integer | 계획 금액(원). null은 미정 |

`kind`의 저장값 `break`는 화면에서 '카페'로 보인다. 라벨만 바꾸고 저장값은 유지해 기존 일정이 깨지지 않게 한 결정이며, 앱의 `STOP_KIND_LABEL`에 같은 주석이 있다.

### accommodation_stays — 숙소

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid | 기본 키 |
| trip_id | uuid | 여행 삭제 시 함께 삭제 |
| region_id | uuid | 지역 삭제 시 null |
| name, address | text | |
| check_in | date | |
| check_out | date | 숙박 밤은 `[check_in, check_out)` |
| check_in_time, check_out_time | text | `HH:mm`. 형식 검사를 건다 |
| day_order | integer | 체크인 날짜 목록에서의 자리. null이면 맨 끝 |
| reservation | reservation_state | `unknown`·`reserved`·`not_reserved` |
| memo | text | |
| location_status, lat, lng | | 장소와 같다 |
| place_provider, place_id, place_url | text | |
| estimated_cost | integer | 숙박 전체 금액(원) |

## 설계 결정

### 좌표를 따로 두지 않고 두 컬럼으로 편다

앱 모델은 `location: GeoPoint | null`이지만 표에서는 `lat`·`lng` 두 컬럼으로 편다. PostGIS를 쓰지 않으므로 별도 타입이 필요 없고, 두 값이 항상 함께 있거나 함께 없어야 하므로 `(lat is null) = (lng is null)` 검사를 건다.

### 시각을 time이 아니라 text로 둔다

`time` 타입을 쓰면 `07:00:00`처럼 초가 붙어 앱의 `HH:mm` 형식과 어긋난다. 변환 코드를 양쪽에 두느니 형식 검사를 건 text가 낫다.

### 금액에 null을 허용한다

`null`은 미정이고 `0`은 무료다. 둘을 구분해야 하므로 기본값을 두지 않는다. 음수는 검사로 막는다.

### 지역 삭제는 연결만 끊는다

앱 모델의 `regionId`가 `null`을 허용하므로 표도 같게 둔다. 지역을 지웠다고 그 지역의 장소까지 사라지면 사용자가 일정을 잃는다.

## 접근 제어

네 표 모두 Row Level Security를 켠다. 규칙은 하나다. **본인 여행만 읽고 쓴다.**

`trips`는 `owner_id`를 직접 본다. 딸린 세 표는 `owns_trip(trip_id)` 함수로 여행의 주인을 확인한다. 같은 규칙을 세 번 적지 않기 위해서다.

```sql
create function owns_trip(target uuid) returns boolean ...
  select exists (
    select 1 from public.trips
    where id = target and owner_id = (select auth.uid())
  );
```

`auth.uid()`를 `(select auth.uid())`로 감싼 것은 의도적이다. 행마다 다시 부르지 않고 한 번만 계산하게 한다.

## 저장 방식

여행 하나를 저장할 때 **네 표를 한 트랜잭션으로** 갱신한다(2026-09-17 사용자 결정). 앱이 표마다 나눠 호출하면 중간에 끊겼을 때 일정이 반만 저장된 상태로 남는다.

구현은 여행 전체를 JSON으로 받아 처리하는 RPC 함수로 한다. 이 함수는 아직 만들지 않았다.

기존 `TripRepository` 인터페이스의 `save(trip)`이 여행 하나를 통째로 넘기므로 화면 코드는 바뀌지 않는다.

## 계정 삭제

`delete-account` 함수는 `auth.users` 행을 실제로 지운다(soft delete가 아니다). `trips.owner_id`에 `on delete cascade`를 걸어 두었으므로 그 사람의 여행·지역·장소·숙소가 함께 사라진다.

이 설정이 없으면 외래 키 위반으로 **탈퇴 자체가 실패**한다. `docs/HARNESS.md`가 "여행 테이블 연결 전에 삭제 정책을 확장해야 한다"고 적은 것이 이 지점이다.

## 아직 없는 것

- **저장 충돌 검사.** 현재 인터페이스에 버전 인자가 없어 여러 탭에서 같은 여행을 저장하면 나중 것이 앞선 것을 덮는다. OpenSpec tasks 9.5에서 다룬다.
- **친구 공유 관련 표.** `TripParticipant`·`TripMember`·`TripInvite`·`TripShare`는 tasks 8.2 범위다. 그때 이 RLS 규칙도 "본인 여행"에서 "참여한 여행"으로 넓혀야 한다.
- **가계부 표.** 실제 지출·결제자·분담은 별도 표가 필요하다.
- **AI 호출 횟수 기록.** 사용자별 하루 제한을 서버에서 세려면 표가 필요하다. tasks 13.12에서 다룬다.

## 적용 현황

- 2026-09-17 마이그레이션 작성. **원격 적용 전이다.**
- 프로젝트 `wslqgfetdwcmqeztixvs`(PostgreSQL 17.6), 적용 명령은 `npx supabase db push`.
- 적용 후 확인할 것: 두 계정 간 접근 차단, 같은 계정 다른 기기 조회, 계정 삭제 시 여행 연쇄 삭제.
