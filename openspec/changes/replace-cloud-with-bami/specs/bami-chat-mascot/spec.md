# Bami chat mascot

## ADDED Requirements

### Requirement: Consistent Bami identity
앱은 승인된 밤이 기본 콩눈 이미지와 이름을 챗봇 진입 및 대화 화면에 일관되게 표시해야 한다(SHALL). 서버 AI 지침도 여행 친구 이름을 밤이로 사용해야 한다(SHALL).

#### Scenario: User opens chatbot
- **WHEN** 사용자가 목록 또는 여행 상세에서 챗봇을 연다
- **THEN** 진입 버튼은 56px 밤이, 전체 대화 시작 화면은 72px 밤이, 상세 시트 머리글은 48px 밤이와 `AI 챗봇 · 밤이`를 표시한다
- **AND** 전신은 크롭되지 않고 대화가 시작된 전체 채팅에는 캐릭터를 반복하지 않는다

#### Scenario: App ships mascot assets
- **WHEN** 앱을 빌드한다
- **THEN** 구름이 자산을 포함하지 않고 idle/talking/found 모두 `/brand/companion-bami-v1.png`를 사용한다

### Requirement: Updated guide
앱 사용법은 밤이를 소개하고 새 앱 화면의 캡처 및 밝힐 자리를 제공해야 한다(SHALL).

#### Scenario: User reads chatbot guide
- **WHEN** 사용자가 여행 목록·AI 챗봇 사용법을 본다
- **THEN** 설명은 밤이 이름을 사용하며 현재 앱으로 생성한 캡처를 제공한다
