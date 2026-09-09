## Purpose
사용자가 검증된 여행 후보 중 원하는 장소를 선택하고 직접 찾은 장소와 함께 날짜별 일정을 구성하며, 이동 순서를 조정하고 외부 지도에서 다음 목적지로 이동하도록 지원한다.

## ADDED Requirements
### Requirement: Owner scoped persistent planning
시스템은 Supabase PostgreSQL에 저장한 여행·일정·숙소를 기본 소유자 전용으로 관리하고 인증된 사용자의 다른 기기에서 조회하도록 SHALL 지원한다.
#### Scenario: Another account requests a trip
- **WHEN** 별도 공유 권한이 없는 다른 계정이 여행 또는 연결된 숙소를 조회하거나 수정한다
- **THEN** 서버의 권한 정책으로 읽기와 쓰기를 거부한다
#### Scenario: Same owner on another device
- **WHEN** 서버에 저장한 여행을 같은 계정으로 다른 기기에서 연다
- **THEN** 저장된 일정과 숙소를 조회하며 기기에만 남은 초안을 서버 저장 완료로 표시하지 않는다

### Requirement: Selected read only itinerary sharing
시스템은 소유자가 선택한 날짜·장소와 별도로 동의한 숙소 이름·위치를 미리보기 후 읽기 전용 스냅샷 링크로 SHALL 공유하도록 한다. 기본 만료는 7일이고 원본 수정은 명시적 갱신 전 공개하지 않는다.
#### Scenario: Public preview and private fields
- **WHEN** 소유자가 기본 전체 선택된 날짜·장소 일부를 해제하고 링크를 발행한다
- **THEN** 선택한 정보만 별도 스냅샷에 저장하며 숙소는 별도 선택 전 제외하고 사진·개인 메모·예약번호·개인 경비·정산은 응답에 포함하지 않는다
#### Scenario: Source changes
- **WHEN** 원본 일정이 수정된다
- **THEN** 기존 공유본은 그대로 유지하고 소유자가 새 미리보기를 확인해 갱신할 때만 공개 내용이 변경된다
#### Scenario: Link expiration revocation and invalid token
- **WHEN** 로그인하지 않은 사람이 만료·해제·잘못된 토큰으로 조회한다
- **THEN** 서버에서 접근을 거부하며 공개 캐시에서 이전 공유 내용을 제공하지 않는다
#### Scenario: Active link holder
- **WHEN** 유효한 링크를 전달받은 사람이 로그인 없이 조회한다
- **THEN** 선택된 스냅샷만 조회하고 원본 읽기·쓰기 권한은 받지 않으며 발행 전 소유자에게 링크 소지자 접근 범위가 안내된다

### Requirement: Approved companion membership
시스템은 기본 7일 만료인 일회용 초대 링크 또는 여러 사람이 사용할 수 있는 초대 코드를 로그인한 사람이 제출하고 소유자가 승인한 경우에만 허용된 최신 일정·공동 장부 조회를 SHALL 허용한다. 초대·제거는 소유자가 관리하고 일정 쓰기는 소유자로 제한한다.
#### Scenario: Pending expired or reused invitation
- **WHEN** 미승인 계정 또는 만료·해제된 초대나 재사용한 일회용 링크로 여행 접근을 요청한다
- **THEN** 서버에서 읽기·쓰기를 거부한다
#### Scenario: Approved member with private accommodation fields
- **WHEN** 승인된 동행이 여행을 조회한다
- **THEN** 최신 허용 일정과 공동 경비만 응답하고 숙소 이름·위치는 소유자가 공유한 경우에만 포함하며 예약번호·개인 메모·사진 등 비공개 필드는 제외한다
#### Scenario: Removal and direct requests
- **WHEN** 소유자가 동행을 제거한 뒤 해당 계정이 여행·일정·숙소 ID로 직접 요청한다
- **THEN** 이후 서버 접근을 거부하면서 과거 지출·정산의 사람 ID와 기록을 보존한다

### Requirement: Join a trip using an invitation code
시스템은 소유자가 발급한 8자리 영문·숫자 코드를 여러 친구가 입력해 참여를 요청하도록 SHALL 지원한다. 코드는 기본 7일 만료이며 여행별 활성 코드는 하나다. 공백·하이픈·대소문자를 정규화하고 로그인 및 소유자 승인을 요구한다.
#### Scenario: Multiple friends join using one code
- **WHEN** 서로 다른 두 계정이 유효한 같은 코드를 제출한다
- **THEN** 각각 승인 대기 요청을 생성하고 소유자가 승인한 계정에만 허용된 일정·공동 경비 조회 권한을 부여한다
#### Scenario: Duplicate request or existing member
- **WHEN** 같은 계정이 요청을 다시 제출하거나 이미 승인된 멤버가 코드를 입력한다
- **THEN** 대기 요청·멤버를 중복 생성하지 않고 기존 대기 상태 또는 참여한 여행을 표시한다
#### Scenario: Invalid code and repeated attempts
- **WHEN** 잘못된·만료·해제된 코드 또는 제한을 초과한 반복 요청을 제출한다
- **THEN** 여행 정보를 노출하지 않고 일반적인 코드 오류 또는 잠시 후 재시도 안내를 표시하며 서버에서 접근을 차단한다
#### Scenario: Rotation during pending approval
- **WHEN** 코드가 재발급되거나 만료·해제된 후 이전 코드의 대기 요청을 승인하려 한다
- **THEN** 승인을 거절하고 재요청을 안내하되 이미 승인된 동행의 권한과 회계 기록은 유지한다
#### Scenario: Rejected or removed account returns
- **WHEN** 거절·제거된 계정이 다시 참여하려 한다
- **THEN** 새 코드 또는 소유자 재초대로 새 승인 절차를 거치며 과거 회계 참여자를 이름만으로 자동 연결하지 않는다

### Requirement: Trip summary and companion profile states
시스템은 여행 상단에 날짜 상태·숙박 기간·지역 구분·조회 권한에 맞는 지출·동행 프로필 영역을 SHALL 제공하고 미연결·미정 상태를 실제 값과 구분한다. AA.png의 구체적 배치는 이미지 확인 후 설계한다.
#### Scenario: Date changes and undecided dates
- **WHEN** Asia/Seoul 기준 오늘이 바뀌거나 여행 날짜를 수정한다
- **THEN** D-N·D-day·여행 중 N일차·일정 날짜 지남과 N박 N+1일을 갱신하고 날짜 미정에는 D-day를 표시하지 않으며 예정일 경과로 여행을 자동 완료하지 않는다
#### Scenario: Unconnected expenses and invitations
- **WHEN** 지출·초대 기능을 연결하기 전 화면을 연다
- **THEN** 금액 0원이나 가상의 참여자를 보여주지 않고 지출 준비 상태·기본 프로필 아이콘·초대 준비 안내를 표시한다
#### Scenario: Authorized summaries and pending profiles
- **WHEN** 승인된 동행 또는 공개 링크 방문자가 여행을 조회한다
- **THEN** 동행은 공동 지출·승인된 멤버의 허용 프로필만 보고 개인 지출·승인 대기 프로필은 보지 못하며 공개 링크에 지출·동행 프로필을 자동 포함하지 않는다

### Requirement: Select verified recommendations
시스템은 AI 추천 장소를 실제 제공자의 장소 식별자와 연결하고, 추천 결과의 검증된 방문 항목을 기본 전체 선택하되 사용자 명시적 담기 동작으로 선택 항목만 일정에 추가하도록 SHALL 지원한다.
#### Scenario: Select some candidates
- **WHEN** 사용자가 기본 전체 선택된 결과에서 세 장소만 남기고 해제한 뒤 담기를 누른다
- **THEN** 선택한 세 장소만 추가되고 나머지는 후보로 남는다
#### Scenario: Initial selection does not save
- **WHEN** 여러 날짜의 추천 결과가 처음 표시된다
- **THEN** 결과의 모든 검증된 방문 항목을 선택 상태로 표시하고 총 선택 수를 안내하며 기존 여행·숙소는 변경하지 않는다
#### Scenario: Selection across days
- **WHEN** 사용자가 날짜별 일부 항목을 해제한 뒤 다른 날짜나 장소 상세를 보고 돌아온다
- **THEN** 선택 상태를 보존하고 전체·날짜별 선택/부분 선택/해제를 표시하며 담기 개수는 모든 날짜의 선택 합계와 일치한다
#### Scenario: Nothing selected
- **WHEN** 모든 추천 항목의 선택을 해제한다
- **THEN** 담기 버튼을 비활성화하고 선택 안내를 제공하며 기존 일정은 유지한다
#### Scenario: Same place on different days
- **WHEN** 동일 장소의 서로 다른 날짜 방문 항목 중 하나를 해제한다
- **THEN** 해당 방문 항목만 해제하고 다른 날짜의 의도적 재방문 선택은 유지한다
#### Scenario: Route changes after deselection
- **WHEN** 경로에 포함된 항목을 해제한다
- **THEN** 선택 수·알려진 체류 합계를 갱신하고 영향받은 경로를 재확인 필요로 표시하며 재조회 전 절약 시간이나 도착시각을 확정하지 않는다
#### Scenario: Regenerate or replace candidates
- **WHEN** 선택을 변경한 사용자가 재추천 또는 장소 교체를 요청한다
- **THEN** 선택 영향과 새 후보를 확인받고 기존 해제 상태를 몰래 초기화하지 않으며 별도 대안 후보를 자동 담기 대상으로 포함하지 않는다
#### Scenario: Failed or repeated import
- **WHEN** 선택 결과 담기에 실패하거나 같은 결과의 적용 요청이 반복된다
- **THEN** 실패 시 초안과 선택을 보존하고 재시도 시 동일 항목을 중복 저장하지 않으며 기존 확정 숙소는 별도 확인 없이 교체하지 않는다
#### Scenario: Unverified candidate
- **WHEN** 장소의 실재 여부를 확인할 수 없다
- **THEN** 검증된 추천 장소로 표시하지 않는다

### Requirement: Guided recommendation setup
시스템은 단계형 조건 입력으로 지역·날짜 또는 기간·동행·취향·이동수단과 일정 밀도를 수집하고 각 단계의 선택을 보존하도록 SHALL 지원한다.
#### Scenario: Back navigation
- **WHEN** 사용자가 앞 단계로 돌아가거나 기존 여행에서 추천을 시작한다
- **THEN** 입력값 또는 기존 여행 조건을 채우고 단계명·진행 상태를 표시하며 모순된 변경은 확인받는다
#### Scenario: Multiple regions or longer duration
- **WHEN** 두 지역 이상 또는 빠른 선택 버튼 범위를 넘는 여행 기간을 입력한다
- **THEN** 복수 지역 순서와 직접 기간 입력을 허용하며 날짜 미정 상태를 실제 날짜로 임의 변환하지 않는다
#### Scenario: Request failure
- **WHEN** 추천 요청이 실패하거나 취소된다
- **THEN** 입력 조건을 유지하고 재시도 및 수동 작성 경로를 제공한다

### Requirement: Manual planning survives AI failure
시스템은 장소 검색, 개인 저장, 날짜별 추가 및 수동 순서 변경을 AI 응답 없이도 SHALL 제공한다.
#### Scenario: AI unavailable
- **WHEN** AI 요청이 실패한다
- **THEN** 기존 일정은 유지되고 수동 검색과 편집은 계속 가능하다

### Requirement: Constrained route comparison
시스템은 하루별 차량 또는 도보 이동과 고정 장소 순서를 반영한 경로 변경안을 적용 전 비교하도록 SHALL 제공한다.
#### Scenario: Fixed appointment
- **WHEN** 사용자가 예약 장소 순서를 고정한 뒤 이동 줄이기를 요청한다
- **THEN** 고정을 지키는 변경안만 제안하며 불가능하면 이유를 표시한다
#### Scenario: Route data unavailable
- **WHEN** 실제 경로 시간 조회가 실패한다
- **THEN** 직선거리 계산값을 실제 도보 또는 차량 소요시간으로 표시하지 않는다

### Requirement: Honest place information
시스템은 영업시간, 휴무, 주차, 예약 정보가 확인되지 않았을 때 미확인 상태와 가능한 원문 확인 경로를 SHALL 표시한다.
#### Scenario: Missing hours
- **WHEN** 데이터 제공자가 영업시간을 제공하지 않는다
- **THEN** AI가 만든 영업시간 대신 확인 필요를 표시한다

### Requirement: Map destination handoff
시스템은 사용자가 선택한 다음 목적지를 네이버지도 또는 카카오맵으로 여는 동작을 SHALL 제공한다.
#### Scenario: Installed map application
- **WHEN** 사용자가 지도앱 열기를 누른다
- **THEN** 선택 목적지의 좌표와 이름이 해당 앱에 전달된다
#### Scenario: Application unavailable
- **WHEN** 지도앱을 열 수 없다
- **THEN** 웹 지도 또는 주소 복사 대안을 제공한다

### Requirement: Discovery without required GPS
시스템은 주변 장소와 지역 기반 랜덤 여행지 탐색을 제공하고 위치 권한 없이도 지역을 선택하도록 SHALL 지원한다.
#### Scenario: Location denied
- **WHEN** 위치 권한을 거부한다
- **THEN** 지역 입력으로 탐색을 계속한다
#### Scenario: Random destination
- **WHEN** 사용자가 지역 조건으로 랜덤 뽑기를 한다
- **THEN** 조건에 맞는 확인된 장소를 제안하거나 후보 없음을 표시한다

### Requirement: Multi-day trip dates
시스템은 시작일과 종료일로 당일 및 여러 박의 날짜별 일정을 SHALL 제공한다.
#### Scenario: Four night trip
- **WHEN** 사용자가 5월 1일부터 5월 5일까지 여행을 만든다
- **THEN** 4박 5일과 다섯 날짜의 일정을 표시한다
#### Scenario: Same day trip
- **WHEN** 사용자가 시작일과 종료일을 같은 날짜로 지정한다
- **THEN** 숙소 등록 없이 0박 1일의 일정을 작성할 수 있다
#### Scenario: Shorten a trip
- **WHEN** 기존 숙소와 방문지가 있는 여행 기간을 줄인다
- **THEN** 영향받는 항목을 보여주고 확인 후 반영하며 기간 밖 항목과 방문 기록을 자동 삭제하지 않는다

### Requirement: Register accommodation stays
시스템은 숙소 검색 또는 직접 입력으로 체크인·체크아웃 날짜를 가진 숙박을 등록하고 연박과 숙소 변경을 SHALL 지원한다.
#### Scenario: Change hotels
- **WHEN** 4박 여행에 A 숙소 2박과 B 숙소 2박을 등록한다
- **THEN** 날짜별 숙소와 숙소를 옮기는 날의 체크아웃·체크인을 표시한다
#### Scenario: Missing accommodation
- **WHEN** 일부 날짜의 숙소나 체크인 시각이 정해지지 않았다
- **THEN** 미정 상태를 표시하고 일정 편집을 허용한다
#### Scenario: Invalid dates
- **WHEN** 체크아웃 날짜가 체크인 날짜보다 앞서거나 같다
- **THEN** 숙박 저장 전에 날짜 수정을 요청한다
#### Scenario: Conflicting stays
- **WHEN** 숙박 날짜가 중복되거나 여행 기간을 벗어난다
- **THEN** 영향을 표시하고 사용자 확인을 요청한다

### Requirement: AI accommodation registration drafts
시스템은 자연어 요청으로 숙소 등록 초안을 제시하고 사용자 검토와 명시적 적용 후에만 숙박을 저장하도록 SHALL 지원한다.
#### Scenario: Draft multiple stays
- **WHEN** 10월 1~4일 여행에서 첫 2박은 A 숙소, 마지막 1박은 B 숙소로 추가해 달라고 요청한다
- **THEN** 확인된 숙소 후보와 A의 1~3일·B의 3~4일 숙박 초안 및 날짜별 연결을 표시하고 적용 전에는 기존 일정을 변경하지 않는다
#### Scenario: Ambiguous accommodation or dates
- **WHEN** 동명 숙소가 여러 곳이거나 여행 날짜·요청한 숙박 날짜가 불명확하다
- **THEN** 주소·지역별 후보 선택 또는 날짜 확인을 요청하고 임의로 확정하지 않는다
#### Scenario: Search failure
- **WHEN** 요청한 숙소를 검색으로 확인하지 못한다
- **THEN** 재검색 또는 직접 입력을 제공하고 미확인 숙소 위치·이동시간을 생성하지 않는다
#### Scenario: Recommend an undecided accommodation
- **WHEN** 사용자가 숙소를 지정하지 않고 지역과 숙박 기간에 맞는 추천을 요청한다
- **THEN** 실제 검색으로 확인한 후보에서 사용자가 선택한 숙소만 등록 초안으로 전환하고 미확인 가격·재고·예약 여부·이용 시각은 확정하지 않는다
#### Scenario: Existing stay or stale draft
- **WHEN** 적용하려는 초안이 기존 숙소와 충돌하거나 초안 작성 이후 여행 기간·숙소가 변경되었다
- **THEN** 최신 일정으로 검증하고 영향 및 수정 초안을 확인받으며 기존 숙소를 자동 교체하지 않는다
#### Scenario: Retry draft application
- **WHEN** 동일한 초안 적용 요청이 재전송된다
- **THEN** 숙소를 중복 등록하지 않는다
#### Scenario: AI draft unavailable
- **WHEN** AI 초안 생성에 실패한다
- **THEN** 기존 숙소와 일정을 유지하고 검색·직접 등록을 계속 제공한다

### Requirement: Accommodation aware routes
시스템은 사용자 확정 숙소 지점과 체크인·체크아웃 시각을 일별 경로 제약으로 SHALL 반영한다.
#### Scenario: Propose daily endpoints
- **WHEN** 연박 숙소가 등록되어 있고 일별 출발·종료 지점이 미지정이다
- **THEN** 숙소 출발·복귀를 제안하고 사용자 지정 지점은 덮어쓰지 않는다
#### Scenario: Infeasible check-in
- **WHEN** 일정의 이동·체류 시간으로 확정 체크인 시각을 지킬 수 없다
- **THEN** 시간 충돌을 표시하고 숙소 제약을 몰래 변경하지 않는다
#### Scenario: Unknown accommodation coordinates
- **WHEN** 직접 입력한 숙소 위치를 확인하지 못한다
- **THEN** 경로 계산에 필요한 위치 확인을 안내하고 가상의 이동시간을 표시하지 않는다

### Requirement: Multiple regions in one trip
시스템은 하나의 여행에 복수 지역을 등록하고 같은 날짜에 여러 지역의 방문지와 숙소를 배치하도록 SHALL 지원한다.
#### Scenario: Three nights across two regions
- **WHEN** 사용자가 3박 4일 여행에 강릉 A 숙소 2박과 속초 B 숙소 1박을 등록한다
- **THEN** 하나의 여행에 네 날짜를 유지하고 3일차에 A 체크아웃, 지역 간 이동, B 체크인을 함께 표시한다
#### Scenario: Return to the same accommodation
- **WHEN** 사용자가 숙소가 있는 지역에서 다른 지역을 방문한 뒤 당일 돌아온다
- **THEN** 숙소 변경 없이 두 지역의 방문지와 왕복 이동을 같은 날짜에 배치할 수 있다
#### Scenario: Change regional allocation
- **WHEN** 사용자가 지역 순서·이동일을 바꾸거나 지역을 제거한다
- **THEN** 영향받는 방문지·숙소·예약을 보여주고 확인 후 반영하며 기존 일정·방문 기록·사진을 자동 삭제하지 않는다

### Requirement: Account for inter-region travel
시스템은 실제 일정 지점 사이의 지역 간 이동시간을 일별 시간 계산에 중복 없이 포함하고 확인되지 않은 정보와 사용자 입력을 구분하도록 SHALL 지원한다.
#### Scenario: Inter-region route is available
- **WHEN** 서로 다른 지역에 있는 인접 방문지 또는 숙소 간 경로 시간이 조회된다
- **THEN** 해당 이동을 일정과 지도에 표시하고 하루 총 소요시간에 한 번만 합산한다
#### Scenario: Transfer conflicts with check-in
- **WHEN** 지역 간 이동과 방문지 체류로 확정 체크인 또는 예약 시각을 지킬 수 없다
- **THEN** 충돌과 방문지 축소·재배치 선택지를 표시하고 사용자 적용 전 지역 순서·일정·숙소를 변경하지 않는다
#### Scenario: Unsupported transport or missing time
- **WHEN** 기차·시외버스 등 자동 경로 비교 미지원 구간이 있거나 이동시간 조회가 실패한다
- **THEN** 이동수단·출발·도착 시각을 직접 기록할 수 있고 사용자 입력 또는 확인 필요로 표시하며 미정 이동의 소요시간과 일정 실현 가능성을 확정하지 않는다

### Requirement: Progressive trip creation
시스템은 날짜가 미정인 여행 초안과 미배치 장소를 보관하고 필요한 계산 시점에 누락 조건을 확인하도록 SHALL 지원한다.
#### Scenario: Dates undecided
- **WHEN** 사용자가 날짜 없이 지역과 장소를 저장한다
- **THEN** 날짜 미정 초안으로 저장하고 숙박 날짜·일별 영업 가능 여부·정확한 도착시각을 확정하지 않는다
#### Scenario: Set trip dates
- **WHEN** 날짜 미정 여행에 유효한 시작일과 종료일을 설정한다
- **THEN** 날짜별 일정을 만들고 미배치 장소를 유지하며 숙박 날짜 확인과 배치를 제공한다

### Requirement: Scoped reversible AI changes
시스템은 지정 범위의 AI 변경안을 비교·선택·검증한 뒤 명시적으로 적용하고 계획 변경을 되돌릴 수 있도록 SHALL 지원한다.
#### Scenario: Edit one day
- **WHEN** 사용자가 3일차를 여유롭게 바꾸도록 요청한다
- **THEN** 3일차의 변경 전후와 고정 조건을 표시하고 다른 날짜 변경이 필요하면 별도 제안하며 적용 전 기존 계획을 유지한다
#### Scenario: Partial selection
- **WHEN** 사용자가 일부 변경만 선택한다
- **THEN** 의존하는 변경을 함께 묶고 선택한 결과의 예약·숙소·시간 제약을 재검증한다
#### Scenario: Stale or failed application
- **WHEN** 초안 이후 일정이 바뀌었거나 적용에 실패한다
- **THEN** 오래된 초안을 덮어쓰지 않고 재검토를 요청하거나 기존 상태를 유지하며 부분 저장과 재시도 중복을 방지한다
#### Scenario: Undo after later edits
- **WHEN** 후속 편집이 있는 상태에서 AI 적용을 되돌리려 한다
- **THEN** 복원 영향을 비교하고 확인받으며 방문 상태·사진·기록을 복원으로 덮어쓰지 않는다

### Requirement: Honest daily time accounting
시스템은 이동·활동·여유시간을 중복 없이 계산하고 조회값·사용자 계획값·미확인 시간을 구분하도록 SHALL 지원한다.
#### Scenario: Meals and breaks
- **WHEN** 식사·휴식과 지역 간 이동이 있는 하루를 계산한다
- **THEN** 식당 체류와 식사 블록 및 일반 이동과 지역 이동을 중복 합산하지 않는다
#### Scenario: Unknown onward travel
- **WHEN** 장소 미정 활동 또는 이동시간 미확인 구간이 있다
- **THEN** 이후 도착시각을 미확인으로 표시하거나 사용자가 입력한 추정 가정을 명시하며 실현 가능성을 단정하지 않는다

### Requirement: Whole trip overview
시스템은 전체·날짜별·숙소 보기와 미배치 항목 목록을 SHALL 제공한다.
#### Scenario: Review a multi-region trip
- **WHEN** 사용자가 여러 지역 여행의 전체 보기를 연다
- **THEN** 날짜별 지역·주요 일정·숙소·이동시간·미확인 구간·충돌을 요약하고 해당 날짜 편집으로 연결한다
#### Scenario: Unplanned night
- **WHEN** 숙소 미정인 밤이나 빈 날짜가 있다
- **THEN** 미정 상태와 숙박 계획 없음 선택을 제공하며 초안 저장을 막지 않는다

### Requirement: In-trip timing updates
시스템은 사용자가 현재 시각·출발점·건너뛰기를 변경하면 남은 일정의 시간과 충돌을 확인하도록 SHALL 지원한다.
#### Scenario: Late departure
- **WHEN** 사용자가 늦어진 출발 시각을 입력한다
- **THEN** 조회 가능한 남은 이동과 예약·숙소 충돌을 갱신하고 실패 시 조회 시점과 미확인을 표시하며 방문지·숙소를 자동 교체하지 않는다

### Requirement: Isolated editing state and ordered asynchronous updates
시스템은 여행과 사용자별 편집 상태를 분리하고 오래된 조회·저장 응답이 최신 입력을 덮어쓰지 않도록 SHALL 처리한다.
#### Scenario: Previous trip response arrives late
- **WHEN** 사용자가 여행 A에서 B로 이동한 후 A의 조회 응답이 도착한다
- **THEN** B의 데이터·로딩·오류 상태를 A의 결과로 바꾸지 않는다
#### Scenario: New edits while saving
- **WHEN** 저장 요청 중 추가 편집이 생기고 이전 요청이 성공한다
- **THEN** 새 입력을 보존하고 실제로 저장된 버전만 완료로 표시하며 남은 편집의 저장 상태를 유지한다
#### Scenario: Retry a failed draft after navigation
- **WHEN** 저장 실패 후 같은 세션에서 다른 여행을 열었다가 돌아온다
- **THEN** 해당 여행의 실패 입력을 복원해 재시도하게 하고 다른 여행의 실패 입력과 섞지 않는다
#### Scenario: Session changes
- **WHEN** 로그인 계정이 바뀌거나 로그아웃한다
- **THEN** 이전 사용자의 비공개 화면 상태와 실패 입력 보관소를 정리하고 늦게 도착한 이전 요청을 반영하지 않는다
#### Scenario: Outdated remote write
- **WHEN** Supabase 연결 후 다른 탭이나 기기에 더 최신 버전이 저장된 상태에서 오래된 변경을 저장한다
- **THEN** 충돌을 알리고 재검토하게 하며 최신 원본을 조용히 덮어쓰지 않는다

