## Purpose
여행 전 계획과 여행 후 실제 방문 기록을 구분하여 사용자가 날짜별 일정을 확인하고 방문 장소에 사진과 메모를 남겨 비공개 개인 여행 지도를 채울 수 있도록 한다.

## ADDED Requirements
### Requirement: Separate visit and itinerary state
시스템은 장소의 예정, 방문, 건너뜀 상태와 여행 전체 완료 상태를 구분하여 SHALL 저장한다.
#### Scenario: Finish with skipped stops
- **WHEN** 미방문 장소가 있는 여행을 종료한다
- **THEN** 미방문 장소를 방문으로 바꾸지 않고 여행을 완료할 수 있다
#### Scenario: Remove a visited stop
- **WHEN** 방문 기록이 있는 장소를 일정에서 제거한다
- **THEN** 기존 방문 기록과 사진은 별도 삭제 요청 없이 사라지지 않는다

### Requirement: Private photo map
시스템은 방문 장소에 사진과 메모를 연결하고 소유자만 볼 수 있는 기록 지도와 여행별 날짜 보기를 SHALL 제공한다.
#### Scenario: Upload failure
- **WHEN** 사진 업로드가 실패한다
- **THEN** 작성한 메모를 유지하고 재시도를 제공한다
#### Scenario: Another user accesses a photo
- **WHEN** 권한 없는 계정이 비공개 사진에 접근한다
- **THEN** 접근을 거부한다

### Requirement: Control personal records
시스템은 사진의 불필요한 위치 메타데이터를 기본 제거하고 사용자 기록 내보내기 및 삭제 수단을 SHALL 제공한다.
#### Scenario: Delete a photo
- **WHEN** 사용자가 사진 삭제를 완료한다
- **THEN** 해당 사진이 기록 지도에서 제거되고 저장소 삭제 상태가 반영된다

### Requirement: Explicit lifecycle and offline records
시스템은 사용자 동작으로 여행을 시작·완료하고 오프라인 기록의 저장·동기화 상태를 구분하여 SHALL 보존한다.
#### Scenario: End date passes
- **WHEN** 여행 종료 예정일이 지났지만 사용자가 완료하지 않았다
- **THEN** 여행이나 미방문 장소를 자동 완료하지 않는다
#### Scenario: Offline completion and memo
- **WHEN** 저장된 일정을 오프라인에서 보고 완료와 메모를 입력한다
- **THEN** 기기 저장과 동기화 대기를 표시하고 서버 저장 완료로 표시하지 않는다
#### Scenario: Reconnect with conflicting edits
- **WHEN** 재접속 시 다른 기기 변경과 대기 중인 기록이 충돌한다
- **THEN** 중복 반영이나 조용한 덮어쓰기 없이 비교를 제공하고 기록을 보존한다
