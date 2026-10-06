# Tasks

- [x] 1. 승인된 펭귄 자산을 앱에 복사하고 진입·대화·시트 참조를 변경한다.
- [x] 2. 표시·접근성·서버 지침을 펭귄으로 맞춘다.
- [x] 3. 기획·디자인·문서 목차·사용법 설명과 캡처를 갱신한다.
- [x] 4. PC·모바일 E2E, 시각 확인, lint, OpenSpec 및 최종 빌드 검증을 완료한다.

## Verification (2026-10-06)

- 승인 시안 penguin.png와 앱 companion-penguin-v1.png의 SHA256 일치: 294641F56788AB58A95CD81402FADD2C376AA508137A06E9A3F8A9AC86899F90.
- npx playwright test e2e/penguin-mascot.spec.ts: 2 passed(PC·360px 모바일). 이미지 로딩·진입64×48px·버튼80×48px·기존 색상·글자 비겹침·대화 진입/초기화·시트 검증 통과.
- 실제 모바일 목록과 대화 시작 캡처 확인. docs/design/references/mascot-launcher-options-2026-10-06/penguin-applied-mobile.png 및 penguin-applied-chat-mobile.png.
- 사용법 capture: 1 passed. 14장과 guide-marks 강조 위치 갱신.
- lint: 278개 모듈·라이트/다크 색상 대비·페이지 폭 통과. OpenSpec strict validation 및 git diff --check 통과. Impeccable 검출0건.
- 최종 운영 build 성공. 초기 번들639.66kB, 기존600kB 예산 초과39.66kB 경고 유지.
- 앱 소스와 서버 프롬프트에서 캐릭터 밤이 참조 제거 확인. 숙박의 일반 명사 '밤'과 기존 사용자 대화 기록은 유지했다.

배포는 미실행이며 서버 지침의 운영 반영도 배포 전이다.
