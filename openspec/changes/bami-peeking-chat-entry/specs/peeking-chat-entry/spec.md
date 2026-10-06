# Peeking chat entry

2026-10-06 색상 후속 결정: 사용자 재선택에 따라 목록·상세 AI 챗봇 진입 버튼을 기존 #16181D로 복원한다. Hover는 #2B2F38, 글자는 흰색이며 앱의 나머지 색상과 밤이 외형·배치는 유지한다.

## ADDED Requirements

### Requirement: Peeking Bami with original button colors
목록·상세의 채팅 진입 버튼은 밤이가 버튼 위에 두 앞발을 걸친 모습을 표시해야 한다(SHALL). 선택된 배경 #16181D·hover #2B2F38·흰 글자는 유지해야 한다(SHALL). 후속 요청에 따라 버튼은 짧고 둥근 80×48px, 캐릭터 상자는64×38px, 글자는12px로 표시해야 한다(SHALL).

#### Scenario: User opens chatbot from entry
- **WHEN** 사용자가 목록 또는 상세 화면을 본다
- **THEN** 밤이 얼굴은 버튼 위에 위치하고 앞발은 상단에 겹친다
- **AND** AI 챗봇 글자는 가리지 않으며 기존 동작대로 전체 대화 또는 시트를 연다

#### Scenario: User enters conversation
- **WHEN** 사용자가 대화 첫 화면 또는 상세 시트를 본다
- **THEN** 기존 밤이 전신을 각각72px와48px로 표시한다

### Requirement: Brown forehead stripes Bami
진입 버튼과 전체 대화·상세 시트의 밤이는 승인된 갈색 이마 줄무늬 있는 v1 이미지를 사용해야 한다(SHALL). 기존 외곽선·표정·스카프와 배치·크기·색상은 유지해야 한다(SHALL).

#### Scenario: Consistent mascot across entry and chat
- **WHEN** 사용자가 목록 또는 상세의 AI 챗봇을 연다
- **THEN** 진입 버튼의 얼굴과 대화 전신 모두 이마에 기존 갈색 줄무늬가 있다
- **AND** 전신의 꼬리와 몸 무늬는 기존 모습을 유지한다
