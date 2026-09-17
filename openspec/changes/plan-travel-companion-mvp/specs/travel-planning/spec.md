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
시스템은 여행 상단에 날짜 상태·숙박 기간·지역 구분·조회 권한에 맞는 지출·동행 프로필 영역을 SHALL 제공하고 미연결·미정 상태를 실제 값과 구분한다. 구체적 배치는 현재 디자인 시스템을 기준으로 설계한다.
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

### Requirement: Model access goes through the server
시스템은 언어 모델을 서버에서만 SHALL 호출하고 모델 키를 브라우저에 두지 않는다. 지시문과 모델 이름도 서버가 갖는다.
#### Scenario: Request without a session
- **WHEN** 로그인하지 않은 요청이 AI 일정 생성을 부른다
- **THEN** 서버가 401로 거절하고 모델을 부르지 않는다
#### Scenario: Client sends only conditions
- **WHEN** 브라우저가 생성을 요청한다
- **THEN** 사용자가 고른 조건만 보내고 지시문·모델 이름은 보내지 않는다. 요청을 바꿔 모델에게 다른 일을 시킬 수 없다
#### Scenario: Invalid input reaches the server
- **WHEN** 지역이 비었거나 여행 일수가 허용 범위를 벗어난 요청이 온다
- **THEN** 모델을 부르지 않고 거절하며, 지나치게 긴 입력은 잘라 보낸다

### Requirement: Model supplies names only
시스템은 언어 모델에게 장소 이름·일차·분류만 SHALL 받고 좌표·주소·영업시간·설명은 받지 않는다. 모델이 쓴 문장을 장소 정보로 저장하거나 화면에 표시하지 않는다.
#### Scenario: Model writes an inaccurate description
- **WHEN** 모델이 장소 설명에 사실과 다른 내용을 적는다
- **THEN** 그 설명을 화면에 표시하지 않고 장소 검색에서 얻은 분류와 주소만 보여준다
#### Scenario: Response breaks the agreed shape
- **WHEN** 응답이 JSON이 아니거나 여행 기간을 벗어난 일차, 빈 이름, 같은 장소를 여러 번 담아 온다
- **THEN** 해당 항목을 버리고 남은 항목으로 결과를 만들며 잘못된 값을 저장하지 않는다

### Requirement: Verify model output against place search
시스템은 모델이 낸 장소 이름을 실제 장소 검색으로 SHALL 대조하고, 찾은 항목만 확인된 장소로 처리한다.
#### Scenario: Place is found
- **WHEN** 검색이 그 이름의 장소를 찾는다
- **THEN** 검색 결과의 좌표·주소·분류를 붙여 확인된 장소로 두고 기본 선택하며, 담을 때 좌표를 함께 저장해 지도에 표시한다
#### Scenario: Place is not found
- **WHEN** 검색이 그 이름을 찾지 못하거나 검색이 실패한다
- **THEN** 좌표를 만들지 않고 '직접 확인 필요'로 표시하며 선택할 수 없게 하고 담기에서 제외한다. 이름은 목록에 남겨 사용자가 직접 확인할 수 있게 한다
#### Scenario: Nothing is verified
- **WHEN** 확인된 장소가 하나도 없다
- **THEN** 조건을 바꿔 다시 만들도록 안내하고 담기를 막는다

### Requirement: Waiting and failure during generation
시스템은 생성하는 동안 진행 상태를 SHALL 표시하고 중단할 수 있게 한다. 실패하면 입력한 조건을 보존하고 고정 샘플로 대체하지 않는다.
#### Scenario: First call loads the model
- **WHEN** 모델을 처음 불러 응답이 오래 걸린다
- **THEN** 기다리는 중임과 예상 소요를 알리고 그만두기를 제공하며, 그만두면 조건 화면으로 돌아가되 오류로 표시하지 않는다
#### Scenario: Connection fails or times out
- **WHEN** AI 서버에 닿지 못하거나 응답이 시간 안에 오지 않는다
- **THEN** 연결 실패와 시간 초과를 구분해 알리고 입력 조건과 기존 여행을 그대로 두며 다시 시도할 수 있게 한다
#### Scenario: AI endpoint is not configured
- **WHEN** 접속 주소나 모델이 설정되지 않았다
- **THEN** 생성 버튼을 비활성으로 두고 이유를 표시하며 수동 일정 작성은 그대로 제공한다

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

### Requirement: Stays as itinerary entries
시스템은 체크인하는 날의 일정 목록에 숙소를 한 자리로 배치하고, 장소와 같은 방식으로 순서를 변경하도록 SHALL 지원한다. 숙소는 하루의 마지막에 고정되지 않으며 중간 순서에도 놓을 수 있다.
#### Scenario: Stay in the middle of a day
- **WHEN** 사용자가 체크인 후 다시 외출하는 일정을 만들기 위해 숙소를 장소들 사이로 옮긴다
- **THEN** 숙소가 해당 위치의 순번을 받고 앞뒤 장소와의 이동 구간을 함께 표시한다
#### Scenario: Ordering across places and stays
- **WHEN** 사용자가 숙소 바로 위에 있는 장소를 아래로 한 칸 옮긴다
- **THEN** 장소가 숙소를 건너뛰지 않고 숙소와 자리를 맞바꾼다
#### Scenario: Consecutive night
- **WHEN** 같은 숙소에 연박하는 날의 일정을 연다
- **THEN** 그날 밤을 보내는 숙소를 목록 맨 끝에 표시하고 이어서 묵는 날임을 알린다. 체크아웃하는 날에는 표시하지 않는다.
#### Scenario: Reordering on a consecutive night
- **WHEN** 이어서 묵는 날에서 숙소의 자리를 옮기려 한다
- **THEN** 숙소 자리는 체크인한 날에만 정하므로 그 날짜에서는 순서 이동을 제공하지 않고, 같은 날의 장소 순서를 바꿔도 체크인한 날에 잡아 둔 숙소 자리는 그대로 둔다
#### Scenario: Sort by proximity
- **WHEN** 사용자가 가까운 순 정렬을 실행한다
- **THEN** 숙소를 정렬 대상에 넣지 않고 그날의 마지막 자리로 보낸다

### Requirement: Stays on the day map
시스템은 일정 지도에 숙소를 장소와 구별되는 색으로 표시하고, 일정에 자리를 잡은 숙소는 방문 순번과 이동 안내선에 SHALL 포함한다.
#### Scenario: Checked-in stay
- **WHEN** 해당 날짜에 체크인하는 숙소에 확인된 좌표가 있다
- **THEN** 일정 순번을 부여한 숙소 마커를 표시하고 안내선을 그 지점까지 잇는다
#### Scenario: Checkout only
- **WHEN** 해당 날짜에 체크아웃만 하는 숙소가 있다
- **THEN** 그날 일정에 자리를 차지하지 않으므로 순번 없이 참고용 마커로만 표시한다
#### Scenario: Unverified stay location
- **WHEN** 숙소에 확인된 좌표가 없다
- **THEN** 마커를 만들지 않고 지도에 표시하지 못한 숙소 수를 알린다

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

### Requirement: Delete trips, places, and stays with confirmation
시스템은 여행·방문지·숙소를 사용자가 직접 삭제하도록 SHALL 지원하며 되돌릴 수 없는 동작임을 알리고 확인을 받은 뒤에만 반영한다.
#### Scenario: Delete a place from the itinerary
- **WHEN** 사용자가 일정 항목의 더보기에서 삭제를 고른다
- **THEN** 같은 화면에서 대상 이름과 되돌릴 수 없음을 알리고 확인한 뒤에만 해당 방문지를 제거하며 다른 날짜와 숙소는 그대로 둔다
#### Scenario: Delete a stay
- **WHEN** 사용자가 숙소 목록의 더보기에서 삭제를 고른다
- **THEN** 확인 후 해당 숙소만 제거하고 방문지·일정은 유지하며 숙소가 없어진 밤은 미정으로 표시한다
#### Scenario: Delete a trip
- **WHEN** 사용자가 여행 목록 또는 여행 상세의 더보기에서 삭제를 고른다
- **THEN** 일정·숙소가 함께 사라진다는 점을 알리고 확인한 뒤에만 여행을 제거하며 상세에서 삭제한 경우 목록으로 이동한다
#### Scenario: Cancel a deletion
- **WHEN** 사용자가 삭제 확인에서 취소한다
- **THEN** 아무것도 제거하지 않고 원래 화면 상태를 유지한다

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

### Requirement: Review AI conditions before generation
시스템은 첫 AI 입력의 3단계와 편집 가능한 조건 요약을 SHALL 제공한다. 재생성은 이전 조건을 유지한 요약에서 시작한다. 현재 샘플 흐름과 실제 제공자 연결을 구분한다.
#### Scenario: Edit conditions without generating
- **WHEN** 사용자가 입력 단계나 요약을 오가거나 결과 선택을 바꾼다
- **THEN** 기존 조건을 보존하고 최종 생성 버튼을 누르기 전에는 AI를 호출하지 않는다
#### Scenario: Retry selected sample application
- **WHEN** 선택한 샘플을 새 여행에 담다가 저장 실패 후 재시도한다
- **THEN** 같은 여행 식별자로 재시도하고 선택하지 않은 항목을 추가하지 않으며 좌표를 미확인으로 둔다

### Requirement: Google authentication and account access
시스템은 Supabase 카카오·Google OAuth와 PKCE를 통해 로그인하고 내 정보·로그아웃을 SHALL 제공한다. 계정별 여행 저장이 연결되기 전에는 기기 저장 상태를 명시한다.
#### Scenario: Login completes
- **WHEN** 카카오 또는 Google 인증 코드를 정상 교환한다
- **THEN** 코드를 주소에서 제거하고 직접 저장한 닉네임이 있으면 여행 목록으로, 없으면 닉네임 설정으로 이동하며 새로고침 후 계정을 복원한다
#### Scenario: Private account route
- **WHEN** 비로그인 사용자가 /account 또는 /trips의 목록·상세·편집·AI 경로로 직접 이동한다
- **THEN** 인증 확인 후 보호된 화면을 노출하지 않고 로그인 화면으로 보낸다
#### Scenario: Sign out
- **WHEN** 사용자가 로그아웃하거나 다른 탭에서 세션이 해제된다
- **THEN** 내 정보와 여행 화면을 닫고 로그인 화면으로 이동한다
#### Scenario: Authorization fails
- **WHEN** 인증이 취소되거나 코드 교환이 실패한다
- **THEN** 성공으로 표시하지 않고 민감한 오류 값을 숨긴 재시도 안내를 제공한다

### Requirement: Delete own account
시스템은 명시적 탈퇴 확인과 서버 인증 후 본인의 계정만 SHALL 삭제한다. 서버 미배포 상태는 사용 가능으로 표시하지 않는다.
#### Scenario: Confirmed account deletion
- **WHEN** 인증된 사용자가 탈퇴를 입력하고 계정 삭제를 확정한다
- **THEN** 서버가 확인한 사용자 ID의 계정만 삭제하고 삭제 성공 후 로그인 상태를 해제한다
#### Scenario: Unauthorized or failed deletion
- **WHEN** 인증이 없거나 유효하지 않거나 서버 삭제가 실패한다
- **THEN** 삭제 완료를 표시하지 않으며 타인 계정을 삭제할 수 없다
#### Scenario: Local drafts remain
- **WHEN** 현재 인증 전용 단계에서 탈퇴한다
- **THEN** Google·카카오 원본 계정과 기기 저장 여행은 남는다는 사실을 확정 전에 명시한다

### Requirement: Visible authentication progress
시스템은 초기 인증 확인과 로그인·로그아웃·회원탈퇴 요청 중 진행 상태를 SHALL 표시하고 중복 실행을 막는다.
#### Scenario: Request pending
- **WHEN** 인증 요청이나 라우트 인증 확인이 끝나지 않았다
- **THEN** 버튼 문구는 유지한 채 버튼 내부 스피너와 aria-busy를 제공하고 중복 실행을 막는다. 초기 인증 확인·라우트 대기는 접근성 이름이 있는 스피너로 표시하며 별도 처리 중 안내 문장은 표시하지 않는다

### Requirement: Authentication error toast
시스템은 로그인·로그아웃·탈퇴·닉네임 저장 오류를 닫을 수 있는 토스트로 SHALL 표시한다.
#### Scenario: Dismiss and retry
- **WHEN** 사용자가 오류 토스트를 닫는다
- **THEN** 오류 표시를 제거하되 로그인·설정 재시도에 필요한 동작은 계속 사용할 수 있다

#### Scenario: Bottom toast presentation
- **WHEN** 인증 오류 토스트가 표시된다
- **THEN** 화면 하단 중앙과 모바일 안전 영역 안에 배치하고 닫기 버튼·접근성 알림·모션 감소 설정을 유지한다

### Requirement: Nickname only social onboarding
시스템은 첫 카카오·Google 인증 후 닉네임만 SHALL 입력받고 저장 완료 후 여행 목록으로 이동한다. 제공자 프로필의 이름은 직접 선택한 닉네임을 대체하지 않는다.
#### Scenario: First social authentication
- **WHEN** 인증은 되었으나 유효한 travel_nickname이 없다
- **THEN** /onboarding으로 이동하고 닉네임 입력 하나만 제공하며 여행과 내 정보 직접 접근도 닉네임 설정으로 보낸다
#### Scenario: Save nickname
- **WHEN** 사용자가 앞뒤 공백 제거·NFC 정규화 후 2~20 코드포인트이며 제어문자가 없는 닉네임을 저장한다
- **THEN** 중복 이름을 허용하고 Auth user_metadata.travel_nickname에 저장 성공을 확인한 후 /trips로 이동한다. 저장 중 버튼 내부 스피너로 중복 실행을 막는다
#### Scenario: Retry profile saving
- **WHEN** 닉네임이 유효하지 않거나 서버 저장에 실패한다
- **THEN** 입력을 보존하고 닫을 수 있는 오류 토스트를 표시하며 여행 화면으로 이동하지 않는다
#### Scenario: Returning member
- **WHEN** 직접 저장한 유효한 닉네임이 있는 회원이 로그인하거나 /onboarding을 연다
- **THEN** 닉네임을 다시 받지 않고 여행 목록으로 이동한다

### Requirement: Minimal Kakao consent
시스템은 카카오 인증에 profile_nickname만 SHALL 요청하고 이메일·프로필 사진 동의를 추가하지 않는다. 제공자 설정은 이메일 없는 계정을 허용해야 한다.
#### Scenario: Kakao authorization request
- **WHEN** 사용자가 카카오 로그인을 시작한다
- **THEN** 실제 카카오 인가 요청의 scope는 profile_nickname이며 Google 요청의 동의 범위는 변경하지 않는다

### Requirement: Shared Tailwind design system
시스템은 Tailwind 테마 토큰과 실제 제품에서 재사용하는 UI 컴포넌트를 SHALL 제공하고 모든 컴포넌트의 HTML과 TS를 분리한다. 화면별 CSS 대신 HTML Tailwind 유틸리티를 사용하고 공통 호스트·지도 DOM 클래스는 TS에서 공유한다. CSS는 테마·기반 스타일·키프레임에 한정한다.
#### Scenario: Consistent form appearance
- **WHEN** 사용자가 로그인·닉네임·여행 입력폼을 연다
- **THEN** 동일한 색상·서체·입력·버튼·포커스·비활성 규칙을 사용하며 기존 인증·저장 동작을 유지한다
#### Scenario: Design system laboratory
- **WHEN** 사용자가 실험실 /lab을 연다
- **THEN** 실제 공통 컴포넌트의 기본·비활성·로딩·오류 상태와 토큰을 확인하고 입력·토스트·버튼 예제를 조작할 수 있다

#### Scenario: Visible loading rotation
- **WHEN** 모션 감소 설정이 없는 사용자가 로딩 상태를 본다
- **THEN** 스피너는 테두리의 열린 부분이 회전하여 처리 중임을 표시하고 모션 감소 설정에서는 회전을 멈춘다

### Requirement: Local design preview
시스템은 development 구성에서만 인증 없이 화면 디자인을 확인하는 미리보기를 SHALL 허용한다. production과 인증 회귀 테스트에서는 기존 인증·닉네임 가드를 유지한다.
#### Scenario: Navigate without a completed profile
- **WHEN** 로컬 미리보기에서 비로그인 또는 닉네임 미완료 사용자가 여행·온보딩·내 정보 화면으로 이동한다
- **THEN** 인증 때문에 다른 화면으로 강제 이동하지 않는다. 계정 예시는 미리보기임을 표시하고 실제 세션을 생성하지 않는다

### Requirement: Link based collaborative itinerary
시스템은 유효 공유 링크의 비로그인 소지자에게 일정 조회를 SHALL 허용하고 로그인·닉네임 설정 후 참여한 사용자에게 공동 일정 편집을 허용한다. 기존 승인형·조회 전용 동행 규칙은 이 요구로 대체한다.
#### Scenario: Guest and joined editor
- **WHEN** 비로그인 방문자가 유효 링크를 열고 이후 로그인해 참여한다
- **THEN** 비로그인에서는 일정만 보고 참여 후 기존 편집기를 사용한다. 다른 여행 ID와 만료 링크로 권한을 얻지 못한다.
#### Scenario: Concurrent edit
- **WHEN** 다른 참여자가 먼저 저장해 기준 버전이 바뀐다
- **THEN** 오래된 저장을 거절하고 입력을 보존하며 최신 일정 다시 불러오기를 제공한다.
### Requirement: Estimated costs separate from actual expenses
시스템은 장소·활동·숙소에 선택적 예상 비용을 SHALL 저장하고 실제 가계부와 분리한다.
#### Scenario: Plan without a confirmed price
- **WHEN** 예상 비용을 비워두거나 실제 결제액이 예상과 다르다
- **THEN** 미입력은 미정이고 실제 지출은 명시적 입력값으로 저장하며 두 합계를 구분한다.
### Requirement: Itinerary image export
시스템은 전체 또는 선택 날짜의 일정을 PNG로 SHALL 내보내고 개인정보·편집 버튼·지도 타일을 제외한다.
#### Scenario: Download schedule
- **WHEN** 사용자가 날짜 범위와 예상 비용 포함 여부를 선택해 내보낸다
- **THEN** 긴 이름을 줄바꿈한 일정 이미지를 다운로드하며 실패 시 오류와 재시도를 제공한다.

### Requirement: Ticket header on saved itinerary image
시스템은 저장하는 일정 이미지 위쪽에 탑승권 형태의 머리글을 SHALL 넣는다. 머리글은 여행 이름, 출발·도착 지역, 시작일과 종료일, 기간, 담은 장소 규모, 지역, 티켓 번호를 담는다. 날짜는 `2026.10.02(금)`처럼 연도와 요일을 함께 적는다.
#### Scenario: Ticket number stays the same for a trip
- **WHEN** 같은 여행의 일정 이미지와 초대 화면을 각각 연다
- **THEN** 두 화면이 여행 id에서 결정적으로 뽑아낸 같은 `TR-XXXX-XXXX` 번호를 보여주며, 저장 스키마를 늘리지 않는다.
#### Scenario: Ticket number is not a reservation code
- **WHEN** 티켓 번호를 화면이나 이미지에 표시한다
- **THEN** 실제 예약번호나 외부에서 조회할 수 있는 값으로 표시하지 않는다.

### Requirement: Collapsible days control the saved image
시스템은 일정 이미지 저장 화면에서 날짜별 접기와 전체 접기를 SHALL 제공하고, 미리보기에서 보이는 범위를 그대로 이미지에 담는다.
#### Scenario: Save a folded day as one summary line
- **WHEN** 사용자가 특정 날짜를 접고 이미지를 저장한다
- **THEN** 그날은 제목과 `장소 4곳 · 예상 82,000원` 형태의 요약 한 줄만 담기고, 예상 비용 합계는 비용 포함을 켠 경우에만 적는다. 비용을 하나도 적지 않은 날은 0원이 아니라 미정으로 둔다.
#### Scenario: Save the ticket alone
- **WHEN** 사용자가 모든 날짜를 접고 이미지를 저장한다
- **THEN** 일정 목록 없이 티켓 한 장만 저장하고 파일 이름으로 구분한다.
#### Scenario: Folding is not persisted
- **WHEN** 사용자가 날짜를 접은 뒤 화면을 떠났다가 다시 연다
- **THEN** 접힘 상태를 저장하지 않고 전부 펼친 상태로 시작한다.

### Requirement: Shared ticket appearance
시스템은 티켓을 쓰는 화면(로그인·앱 설치·초대장·저장한 일정 이미지)에서 같은 그라데이션·절취선·칸 순서·소인·줄무늬를 SHALL 사용한다.
#### Scenario: Reading the same trip on two screens
- **WHEN** 같은 여행의 초대 화면과 저장한 일정 이미지를 견준다
- **THEN** 날짜·기간·일정 규모·지역·티켓 번호가 같은 표기와 같은 차례로 놓인다.
#### Scenario: Editing surface stays quiet
- **WHEN** 일정을 접고 펴며 고르는 미리보기 화면을 연다
- **THEN** 본권의 그라데이션을 쓰지 않고 흰 바탕에 절취선만 두어 일정 목록이 뒤로 밀리지 않게 한다.
#### Scenario: Pressing a ticket on a touch device
- **WHEN** 손가락으로 티켓을 누른다
- **THEN** 글자가 선택되어 끌리지 않고 기울기만 반응하며 화면 스크롤은 그대로 동작한다.
#### Scenario: Perforation notch reads as a cut-out
- **WHEN** 티켓의 절취선 양옆 홈을 본다
- **THEN** 홈은 티켓 가장자리를 파낸 반원으로 보이고, 배경 위에 동그라미가 얹힌 것처럼 보이지 않는다.


### Requirement: Companion entry within trip detail
시스템은 개별 여행 상세 상단에 뒤로·여행 이름·편집 연필·참여자 이니셜·초대 +·더보기를 SHALL 배치한다. 가계부 진입은 일정 옆 탭, PNG 저장은 더보기 메뉴에서 제공한다.
#### Scenario: Travel without connected companions
- **WHEN** 실제 동행이 연결되지 않은 여행을 연다
- **THEN** 가상 친구 프로필을 만들지 않고 실제 로그인한 본인의 닉네임 이니셜과 초대 +를 표시한다. 실제 동행 목록은 서버 연결 후 제공한다.
#### Scenario: Preview before database connection
- **WHEN** DB 연결 전 초대 화면에서 공유 미리보기를 연다
- **THEN** 같은 기기의 일정으로 비로그인/참여자 화면을 보여주고 실제 초대·공동 편집 미연결 상태를 명시한다. 프로필·개인 메모·예약정보·가계부는 미리보기 일정에 포함하지 않는다.


### Requirement: Unified trip period selection
시스템은 여행 기간을 하나의 달력에서 시작일·종료일 순서로 SHALL 선택하게 하고 종료일 선택 시 양쪽 입력에 함께 적용한다.
#### Scenario: Choose dates across months
- **WHEN** 시작일을 고른 뒤 다음 달의 종료일을 선택한다
- **THEN** 시작일부터 종료일까지 범위를 표시하고 선택 완료 후 기간과 박수를 갱신한다.
#### Scenario: Cancel an unfinished range
- **WHEN** 시작일만 고른 상태에서 선택창을 닫는다
- **THEN** 기존 저장 전 입력 기간을 변경하지 않는다. 기간 비우기는 양쪽 날짜를 함께 지운다.
### Requirement: Consistent field hints
시스템은 입력 하단의 일반 설명을 6px 간격·공통 hint 색상으로 SHALL 표시한다.
#### Scenario: Compare title and region hints
- **WHEN** 여행 만들기 화면의 여행 이름·기간·지역 입력을 본다
- **THEN** 각 설명은 입력 박스 아래에서 같은 간격과 글자색으로 시작한다.

### Requirement: Conversational trip discovery
시스템은 목적지를 정하지 못한 사용자를 위해 대화형 탐색을 선택형 단계와 별개 경로로 SHALL 제공한다. 대화에서 얻은 결과도 일정 저장은 확인 카드를 거친다.
#### Scenario: Entering from the trip list
- **WHEN** 여행 목록에서 AI 일정 만들기를 누른다
- **THEN** 조건 고르기와 대화로 찾기 중에서 고르는 화면을 먼저 보여준다. 여행 목록에 별도의 떠 있는 챗봇 버튼을 두지 않는다.
#### Scenario: Entering from trip detail
- **WHEN** 개별 여행 상세에서 오른쪽 아래 떠 있는 버튼을 누른다
- **THEN** 하단 시트가 화면 절반쯤 올라오고 뒤로 그 여행의 일정이 계속 보인다. 대화 대상은 그 여행으로 고정되며 어느 여행인지 다시 묻지 않는다.
#### Scenario: Floating button does not hide content
- **WHEN** 360px 화면에서 일정 목록을 끝까지 내린다
- **THEN** 떠 있는 버튼이 마지막 항목을 가리지 않고, 오류 알림이 뜰 때 버튼과 겹치지 않는다.
#### Scenario: Starting with suggested prompts
- **WHEN** 대화를 처음 연다
- **THEN** 빈 화면 대신 추천 질문 칩을 4~6개 보여준다. 여행 상세에서는 그 여행의 상태를 반영한 칩을 제시한다.

### Requirement: Chat scope restriction
시스템은 국내 여행과 무관한 요청을 SHALL 걸러내고 대화 상태를 바꾸지 않는다. 범위 판정은 지시문만이 아니라 서버 검사로 함께 수행한다.
#### Scenario: Asking something unrelated to travel
- **WHEN** 코드 작성이나 주가처럼 여행과 무관한 것을 묻는다
- **THEN** 정해진 안내를 돌려주고 추천 질문 칩을 다시 보여준다. 일정과 대화 기록은 바뀌지 않는다.
#### Scenario: Asking about services the app does not cover
- **WHEN** 항공권 가격이나 렌터카 예약을 묻는다
- **THEN** 다루지 않는 영역임을 알린 뒤 일정 만들기로 이어지는 제안을 함께 보여준다. 거절만 하고 대화를 끊지 않는다.
#### Scenario: Asking for a subjective judgement
- **WHEN** 어디가 재미있는지, 맛집이 어디인지 묻는다
- **THEN** 맛과 재미를 단정하지 않고 어떤 장소가 있는지 설명하는 추천으로 답한다.

### Requirement: Unverified information disclosure
시스템은 영업시간·휴무·요금·예약 여부를 모델이 답할 때 확인된 사실과 SHALL 구분해 표시하고 확인할 수 있는 링크를 함께 제공한다. 이 값들은 일정에 저장하지 않는다.
#### Scenario: Asking about opening hours
- **WHEN** 특정 장소가 몇 시에 여는지 묻는다
- **THEN** 답변 위에 AI가 생성해 부정확할 수 있다는 표시를 두고, 아래에 네이버 지도와 카카오맵 링크를 함께 제공한다.
#### Scenario: Business information never reaches storage
- **WHEN** 대화에서 안내받은 영업시간이 있는 장소를 일정에 담는다
- **THEN** 저장되는 값은 장소 검색으로 확인한 좌표·주소·분류뿐이며 모델이 말한 영업시간은 일정 항목에 들어가지 않는다.

### Requirement: Chat draft confirmation
시스템은 대화가 만든 변경을 사용자 확인 없이 SHALL 반영하지 않는다. 확인은 말풍선 안의 카드에서 받으며 말로 안내하지 않는다.
#### Scenario: Reviewing a reorder proposal
- **WHEN** 대화로 일정 순서 정리를 요청한다
- **THEN** 바뀌기 전과 후를 나란히 보여주는 카드가 버튼과 함께 말풍선 안에 나타난다. 앱 어딘가를 누르라는 문장으로 대신하지 않는다.
#### Scenario: Undoing an applied change
- **WHEN** 카드에서 적용한 뒤 되돌리기를 누른다
- **THEN** 변경 직전 상태로 돌아가고 기존 숙소·고정 예약을 보존한다.
#### Scenario: Reading the result in plain words
- **WHEN** 변경이 적용된 결과 메시지를 본다
- **THEN** 내부 처리 표현이 아니라 무엇이 어떻게 바뀌었는지 사용자 언어로 적는다.

### Requirement: Chat draft verification
시스템은 대화가 제안한 장소를 장소 검색으로 SHALL 대조하고 확인된 것만 담을 수 있게 한다. 모델이 등록 함수를 직접 호출하게 하지 않는다.
#### Scenario: Proposing a place that does not exist
- **WHEN** 모델이 실제로 없는 장소 이름을 낸다
- **THEN** 검색에서 찾지 못한 이름은 직접 확인 필요로 남기되 선택할 수 없게 하고 담기에서 제외한다.
#### Scenario: Reordering by distance
- **WHEN** 거리순 정렬을 요청한다
- **THEN** 이미 저장된 좌표로 앱이 직접 계산하며 모델의 추측한 거리를 쓰지 않는다.

### Requirement: Chat session call limit
시스템은 한 대화 세션의 모델 호출을 20회로 SHALL 제한한다.
#### Scenario: Reaching the limit
- **WHEN** 한 대화에서 호출이 20회에 이른다
- **THEN** 지금까지의 초안을 담고 새 대화를 시작하도록 안내하며, 이미 만들어진 초안은 계속 담을 수 있다.
#### Scenario: Conversation stays on the device
- **WHEN** 대화를 나눈 뒤 앱을 다시 연다
- **THEN** 대화 기록은 이 기기에만 저장되어 있고 서버로 보내지 않는다.

#### Scenario: Keep the picker open while its panel scrolls
- **WHEN** 작은 높이에서 기간 선택기 패널 내부를 스크롤한다
- **THEN** 패널은 닫히지 않고 달력 콘텐츠가 계속 스크롤되며, 패널 밖 스크롤에서는 선택기가 닫힌다.

#### Scenario: Use shared tabs with keyboard arrows
- **WHEN** 공통 탭에 포커스한 상태에서 ArrowRight 또는 ArrowLeft를 누른다
- **THEN** 인접 탭으로 포커스와 선택 상태가 이동하고 현재 탭만 기본 탭 순서에 포함된다.
