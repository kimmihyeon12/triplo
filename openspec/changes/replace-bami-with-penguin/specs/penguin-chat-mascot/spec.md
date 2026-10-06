# Penguin chat mascot

## ADDED Requirements

### Requirement: Consistent penguin mascot
앱은 사용자 승인 펭귄 자산을 목록·상세의 진입 버튼과 전체 대화·상세 채팅 시트에 사용해야 한다(SHALL).

#### Scenario: Chat entry
- **WHEN** 사용자가 목록 또는 상세를 본다
- **THEN** 버튼은80×48px·#16181D이며 hover는 #2B2F38이다
- **AND** 펭귄은64×48px 상자 하단에 정렬하고 버튼 상단에7px 겹치며 흰 AI 챗봇 글자를 가리지 않는다

#### Scenario: Conversation
- **WHEN** 사용자가 전체 대화 또는 상세 시트를 연다
- **THEN** 펭귄은 각각72px·48px로 표시된다
- **AND** 시트 제목은 AI 챗봇이며 캐릭터 안내와 서버 지침은 펭귄을 사용한다
- **AND** 기존 저장된 대화는 수정하지 않는다
