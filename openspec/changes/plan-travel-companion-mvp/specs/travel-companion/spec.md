## Purpose
실제 여행 기록을 꾸준히 남기는 즐거움을 주기 위해 방문과 여행 완료에 따라 작은 캐릭터가 성장하도록 하되 반복 조작이나 과도한 기록을 유도하지 않고 핵심 여행 기능과 독립적으로 제공한다.

## ADDED Requirements
### Requirement: Idempotent growth rewards
시스템은 동일한 방문 또는 완료 이벤트에 대한 보상을 중복 지급하지 않도록 SHALL 처리한다.
#### Scenario: Toggle completion
- **WHEN** 동일 일정을 완료 취소한 뒤 다시 완료한다
- **THEN** 최초 정상 완료보다 누적 보상이 증가하지 않는다
#### Scenario: Retry a request
- **WHEN** 네트워크 재시도로 동일 완료 요청이 다시 도착한다
- **THEN** 경험치는 한 번만 반영된다

### Requirement: Optional lightweight companion
시스템은 캐릭터 성장 표시를 숨기거나 3D 표현을 사용하지 않아도 모든 여행 계획과 기록 기능을 SHALL 제공한다.
#### Scenario: Reduced motion
- **WHEN** 사용자가 동작 줄이기를 사용하거나 3D 로딩이 실패한다
- **THEN** 정적인 캐릭터 표시로 대체하고 일정 기능을 계속 사용할 수 있다

### Requirement: Character progression
시스템은 여행 완료에 따른 경험치와 레벨을 독립적인 여행 동행 캐릭터의 성장으로 SHALL 표현한다. 구체적인 외형은 설계 단계에서 확정한다.
#### Scenario: Reach a growth threshold
- **WHEN** 정상적인 여행 완료 보상으로 성장 기준에 도달한다
- **THEN** 캐릭터의 레벨과 해당 성장 상태를 표시한다
