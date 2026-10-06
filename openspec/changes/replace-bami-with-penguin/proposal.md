# 펭귄 챗봇 캐릭터 적용

## Why
사용자가 전체 앱 비교 시안의 펭귄을 선택했다.

## What Changes
- 승인된 penguin.png를 companion-penguin-v1.png로 복사해 목록·상세 진입과 전체 대화·시트에 사용한다.
- 진입 버튼80×48px·색상 #16181D/hover #2B2F38·흰 글자는 유지한다. 그림은 시안과 같은64×48px·하단 정렬·상단 겹침7px다.
- 캐릭터 안내·접근성·서버 지침을 펭귄으로 통일한다. 새 고유 이름은 만들지 않고 시트 제목은 시안대로 AI 챗봇이다.
- 사용법 설명·캡처와 검증을 갱신한다.

## Capabilities
### New Capabilities
- `penguin-chat-mascot`: 승인된 펭귄의 일관된 표시.
### Modified Capabilities
없음(main specs 없음).

## Impact
기존 bami-peeking-chat-entry의 캐릭터 규칙을 대체한다. 채팅·저장 동작과 기존 사용자 대화 기록은 변경하지 않는다. 배포는 포함하지 않는다.

2026-10-06 후속: 캐릭터 이름을 `펭이`로 정했다. 사용법·대체 텍스트·`ai-chat` 지시문을 함께 바꾼다.
