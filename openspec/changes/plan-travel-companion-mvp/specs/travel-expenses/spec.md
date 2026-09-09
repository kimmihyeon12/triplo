## Purpose
여행별 예산과 지출을 기록하고 일정·숙소와 연결해 여행 비용을 한눈에 확인하도록 한다. 트리플의 여행 가계부를 참고하되 실제 결제·송금·은행 연동은 범위 밖이다. 후속 범위이며 내부 알파에는 포함하지 않는다.

## ADDED Requirements
### Requirement: Record trip expenses
시스템은 여행에 금액·카테고리·날짜·메모를 가진 지출 항목을 기록하고 여행 총액, 날짜별·카테고리별 합계를 SHALL 제공한다.
#### Scenario: Expense without budget
- **WHEN** 사용자가 예산을 설정하지 않고 지출을 기록한다
- **THEN** 지출을 저장하고 총액과 카테고리별 합계를 표시하며 예산 관련 경고를 만들지 않는다
#### Scenario: Expense without a date
- **WHEN** 사용자가 날짜를 지정하지 않고 지출을 기록한다
- **THEN** 날짜 미지정 지출로 보관하고 여행 총액에는 포함하되 날짜별 합계에는 넣지 않는다

### Requirement: Budget comparison
시스템은 여행 총예산 또는 카테고리별 예산이 설정된 경우 예산 대비 사용액과 잔액을 SHALL 표시한다.
#### Scenario: Over budget
- **WHEN** 카테고리 지출 합계가 해당 카테고리 예산을 넘는다
- **THEN** 초과 금액을 표시하고 지출 기록을 막지 않는다

### Requirement: Link expenses to itinerary and stays
시스템은 지출을 장소 일정 항목 또는 숙박에 선택적으로 연결하고, 연결 대상이 제외·삭제되어도 지출을 SHALL 보존한다.
#### Scenario: Accommodation fee suggestion
- **WHEN** 사용자가 숙소 등록·편집에서 숙박 요금을 입력한다
- **THEN** ‘숙소’ 카테고리 지출로 함께 기록할지 확인하고 사용자가 거부하면 지출을 만들지 않는다
#### Scenario: Linked stop removed
- **WHEN** 지출이 연결된 장소를 일정에서 삭제한다
- **THEN** 지출은 연결 해제 상태로 남고 여행 총액에 계속 포함된다
#### Scenario: Trip shortened
- **WHEN** 여행 기간을 줄여 일부 지출 날짜가 기간 밖이 된다
- **THEN** 해당 지출을 삭제하지 않고 날짜 미지정 또는 기간 밖으로 표시한다

### Requirement: Participant based expense allocation
시스템은 공동 지출마다 결제자 1명과 부담 대상들을 지정하고 균등 분배 또는 직접 입력한 원화 부담액을 SHALL 저장한다. 양수 지출액과 0 이상 부담액의 합계 일치를 검증하고 개인 지출은 정산에서 제외한다.
#### Scenario: Rounding remainder
- **WHEN** 공동 지출 10,000원을 A·B·C 순서로 균등 분배한다
- **THEN** A 3,334원, B 3,333원, C 3,333원으로 저장하고 재계산에도 같은 결과를 유지한다
#### Scenario: Excluded diner and invalid allocation
- **WHEN** ABC 여행에서 AB만 식사하고 사용자가 부담액을 직접 입력한다
- **THEN** C에게 부담을 배정하지 않고 AB 부담액 합계가 지출액과 다르면 저장을 막고 입력을 보존한다
#### Scenario: Membership changes
- **WHEN** 새 친구가 참여하거나 기존 친구가 탈퇴하거나 미가입 친구에게 계정을 연결한다
- **THEN** 안정된 사람 ID로 과거 결제·분담·수령을 보존하고 과거 지출을 자동 재분배하지 않는다

### Requirement: Net balances and transfer suggestions
시스템은 공동 지출과 취소되지 않은 수동 수령 기록으로 사람별 잔액과 송금 제안을 SHALL 계산한다. 잔액은 결제−부담+보낸 수령확인액−받은 수령확인액이며 합은 0원이어야 한다. 송금 제안은 최소 횟수를 보장하지 않는다.
#### Scenario: Different payers and participants
- **WHEN** A가 180,000원 숙소를 ABC 균등으로 결제하고 B가 60,000원 식사를 AB 균등으로 결제한다
- **THEN** A +90,000원, B −30,000원, C −60,000원을 표시하고 B→A 30,000원·C→A 60,000원을 제안한다

### Requirement: Manual settlement receipts and recalculation
시스템은 소유자가 실제 외부 송금 후 수동 수령 기록·일부 수령·이유를 남긴 취소를 SHALL 처리하도록 한다. 은행 확인·자동 송금은 제공하지 않는다. 모든 잔액이 0일 때만 현재 내역 기준 완료로 표시한다.
#### Scenario: Partial receipt and duplicate retry
- **WHEN** B가 A에게 30,000원을 보낼 상황에서 소유자가 10,000원 수령을 기록하고 같은 요청을 재시도한다
- **THEN** 수령은 한 번만 반영하고 B의 남은 금액은 20,000원이며 여행 지출 총액은 바뀌지 않는다
#### Scenario: Invalid or stale receipt
- **WHEN** 수령 금액이 양쪽 현재 미정산 잔액을 초과하거나 저장 중 장부 버전이 변경된다
- **THEN** 저장을 거절하고 입력을 보존하며 최신 장부 확인 후 다시 기록하게 한다
#### Scenario: Receipt cancellation
- **WHEN** 소유자가 오입력 수령 기록을 이유와 함께 취소한다
- **THEN** 원본과 취소 이력을 보존하고 그 금액을 잔액 계산에서 제외해 미정산액을 복원한다
#### Scenario: Expense changes after settlement
- **WHEN** 정산 후 지출을 수정·삭제하거나 새 공동 지출을 추가한다
- **THEN** 기존 수령 기록을 보존하고 반환 필요 금액을 포함한 잔액을 다시 계산하며 0원이 아니면 미정산으로 표시한다

### Requirement: Shared ledger access
시스템은 개인 지출을 작성자 전용으로 유지하며 명시적 공동 경비만 승인된 동행에게 읽기 권한을 SHALL 제공한다. 초기 공동 장부 쓰기는 소유자로 제한한다.
#### Scenario: Member reads or writes ledger
- **WHEN** 승인된 동행이 장부를 조회하거나 수정을 요청한다
- **THEN** 공동 지출·분담·정산만 조회하고 개인 지출·개인 합계·예약번호를 응답에서 제외하며 쓰기를 거부한다
#### Scenario: Removed member reads ledger
- **WHEN** 제거된 멤버가 이전 여행 ID로 장부를 직접 조회한다
- **THEN** 서버에서 요청을 거절하고 과거 회계 기록은 그대로 보존한다

### Requirement: Private and recoverable records
시스템은 지출 기록을 기본 비공개로 저장하고 저장 실패 시 입력을 보존해 재시도를 SHALL 제공한다.
#### Scenario: Save failure
- **WHEN** 지출 저장이 실패한다
- **THEN** 입력값을 유지하고 저장 실패와 다시 저장을 표시한다
