# Tasks

2026-10-06 후속 승인: 사용자가 펭귄을 선택했다. 아래 밤이 적용·탐색 기록은 이력으로 보존하고 최신 구현·검증은 ../replace-bami-with-penguin/tasks.md를 따른다.

## Alternative mascot preview (2026-10-06)

- 추가 탐색: 고양이·펭귄·아기 오리·사막여우4종을 생성해 20장 추가 캡처. 총10종×5화면=50장. round-2.html은 새4종 전용, applied-comparison.html은 전체 비교다. 50개 이미지 로딩·5개 화면 전환·두 페이지390px 가로 넘침 없음·브라우저 오류 없음 검증 완료. 현재 제품은 밤이를 유지한다.

- 사용자 요청으로 강아지·참새·수달 및 새 후보 토끼·아기 물범을 전체 앱 화면에 넣은 비교 자료를 만들었다. 현재 밤이를 기준으로 포함해 6종×5화면=30장이다.
- 테스트 앱4300에서 브라우저 DOM의 이미지만 임시 교체했다. 버튼80×48px·#16181D 유지. 새 후보 그림 상자64×48px, 현재 밤이64×38px. 전체 대화72px·시트48px 유지.
- docs/design/references/mascot-launcher-options-2026-10-06/applied-comparison.html에서 목록·첫 시작·상세·대화·시트를 전환한다.
- 30개 캡처 이미지 로딩·버튼 크기/색상·가로 넘침 검사 통과. 비교 페이지5개 탭·390px 레이아웃·브라우저 오류 없음 확인.
- 제품 구현·확정 기획·사용법·배포는 변경하지 않았다. 후보 채택은 미정이며 현재 앱에는 밤이를 유지한다.

- [x] 9. 기존 버튼 색 #16181D·hover #2B2F38로 복원한다. 밤이·버튼 크기는 유지하고 문서·캡처·검증을 갱신한다. 아래 8번은 이전 색상 시도 기록이다.

## Original color restored verification (2026-10-06)

- float #16181D·hover #2B2F38 복원. 갈색 줄무늬 밤이·버튼80×48px·얼굴64×38px 유지.
- 기획안·디자인·OpenSpec 제안/설계/요구사항·사용법 설명 갱신.
- mascot E2E 2 passed(PC·360px 모바일), 실제 모바일 캡처 확인. 사용법 capture 1 passed(14장·강조 위치 갱신).
- lint·OpenSpec strict validation 통과. Impeccable 검출0건. 최종 build 성공(기존 초기 번들637.15kB·예산 초과37.15kB 경고 유지).
- 적용 화면: docs/design/references/mascot-options-2026-10-06/bami-original-color-restored-mobile.png. 배포 미실행.

- [x] 8. 사용자 지정 #1F1410을 진입 버튼에 적용하고 hover #34251F·흰 글자를 사용한다. 캡처·문서·검증을 갱신한다. 아래 색상 유지 기록은 과거 이력이다.

## Dark brown verification (2026-10-06)

- float와 float-hover 토큰만 #1F1410·#34251F로 변경했다. 사용처는 목록·상세의 챗봇 진입 버튼이며 나머지 앱 색상과 밤이는 유지했다.
- 흰 글자 대비는 기본18.01:1·hover14.68:1. 기존 E2E 2 passed(PC·360px 모바일), 실제 모바일 캡처 확인.
- 사용법 capture 1 passed(14장·강조 위치 갱신), lint·OpenSpec strict validation 통과, Impeccable 검출0건.
- 최종 build 성공. 기존 초기 번들637.15kB·예산 초과37.15kB 경고 유지. 배포 미실행.
- 적용 화면: docs/design/references/mascot-options-2026-10-06/bami-brown-1f1410-applied-mobile.png.

- [x] 7. 사용자 재선택에 따라 기존 갈색 이마 줄무늬 v1을 버튼·대화에 복원하고 문서·캡처·검증을 갱신한다. 아래 6번은 이전 적용 이력이다.

## Brown stripes restored verification (2026-10-06)

- 목록·상세 버튼과 전체 대화·상세 시트는 기존 갈색 줄무늬 v1 자산을 다시 사용한다. 버튼80×48px·얼굴64×38px·기존 색상 유지.
- 기획안·디자인·제안·설계·요구사항·사용법 설명을 현재 선택으로 갱신했다.
- mascot E2E 2 passed(PC·360px 모바일), 실제 모바일 캡처 확인. 사용법 capture 1 passed(14장과 강조 위치 갱신).
- lint, OpenSpec strict validation 통과. Impeccable 검출0건. 최종 build 성공(기존 초기 번들637.15kB, 예산 초과37.15kB 경고 유지).
- 적용 화면: docs/design/references/mascot-options-2026-10-06/bami-stripes-restored-mobile.png. 배포 미실행.

- [x] 6. 승인된 이마 줄무늬 없는 얼굴·전신 v2를 적용하고 문서·사용법 캡처와 검증을 갱신한다.

## Plain forehead follow-up verification (2026-10-06)

- 승인된 얼굴 시안과 built-in image_gen으로 편집한 전신을 app/public/brand의 companion-bami-peeking-v2.png·companion-bami-v2.png로 저장하고 앱의 참조를 교체했다. 편집 지시문은 production-no-stripes-prompt.json에 기록했다.
- 이마 두 줄만 제거했으며 기존 전신 꼬리/몸 무늬와 버튼 크기·색상은 유지한다.
- 기존 mascot E2E 2 passed(PC·360px 모바일). 실제 목록·상세·대화 캡처에서 외형과 로딩을 확인했다.
- 사용법 capture 1 passed: 14장 및 강조 위치 갱신. lint, OpenSpec strict 검증, git diff --check 통과. Impeccable 검출0건.
- 최종 운영 build 성공. 기존 초기 번들637.15kB/예산 초과37.15kB 경고 유지. 배포 미실행.
- 적용 화면: docs/design/references/mascot-options-2026-10-06/bami-no-stripes-applied-mobile.png 및 bami-no-stripes-chat-mobile.png.

- [x] 5. 폭이 너무 좁다는 후속 요청: 버튼 폭만80px로 넓히고 이미지64×38px·높이48px는 유지한다. 캡처와 검증을 갱신한다.

## Width follow-up verification (2026-10-06)

- 버튼 폭60→80px. 밤이 크기64×38px, 버튼 높이48px, 기존 색상 유지.
- 기존 E2E 2 passed(데스크톱·360px 모바일), 모바일 캡처 육안 확인.
- 사용법 capture 1 passed: 14장과 강조 위치 재생성.
- lint, OpenSpec strict validation, git diff --check 통과. Impeccable 검출0건.
- 최종 build 성공. 초기 번들637.15kB, 기존600kB 예산 초과37.15kB 경고 유지.
- 화면: `docs/design/references/mascot-options-2026-10-06/bami-peeking-balanced-mobile.png`. 배포 미실행.

- [x] 4. 후속 요청: 밤이64×38px·버튼60×48px로 축소하고 캡처·검증을 다시 실행한다.

## Compact follow-up verification (2026-10-06)

- 버튼60×48px·이미지64×38px·글자12px·겹침7px로 축소했다. 기존 배경/hover/흰 글자는 유지한다.
- 기존 E2E 최종2 passed. 이미지 기본 max-width 제한으로 최초 측정60px가 나와 max-w-none으로 의도한64px를 보존한 뒤 데스크톱·모바일 모두 통과했다. 글자의 좌우 비넘침도 확인했다.
- 사용법 capture 1 passed: 14장과 밝힐 자리 재생성 완료.
- lint, OpenSpec strict validation, git diff --check 통과. Impeccable 검사0건.
- 최종 build 성공. 초기 번들637.14kB, 권장 예산 초과37.14kB 경고는 남음.
- 최신 화면: `docs/design/references/mascot-options-2026-10-06/bami-peeking-compact-mobile.png`. 배포 미실행.

- [x] 1. 승인된 얼굴·앞발 투명 자산과 진입 버튼 배치를 적용한다.
- [x] 2. 기획·디자인·목차·사용법 설명을 갱신한다.
- [x] 3. 기존 E2E, 사용법 캡처, lint, 운영 빌드 및 시각 검증을 완료한다.

## Verification (2026-10-06)

- `npx playwright test e2e/bami-mascot.spec.ts`: 최종 2 passed(데스크톱·360px 모바일). 이미지 로드, 버튼 상단 겹침/글자 비겹침, 기존 기본색/흰 글자, 데스크톱 hover 색, 진입 동작 및 기존 대화 전신 유지 확인. 최초 모바일 실행은 hover를 기대한 검증 오류로 실패했으며 `(hover: hover)` 조건에 맞게 수정 후 모두 통과했다.
- `npx playwright test --config=playwright.capture.config.ts`: 1 passed. 14장과 guide-marks 재생성. 버튼 위 밤이도 밝은 영역에 포함한다.
- `npm run lint`: 경계/순환 273개 모듈, 대비 AA, 페이지 폭 검사 통과.
- `npm run build`: 성공. 초기 번들637.15kB, 기존600kB 권장 예산 초과 경고37.15kB는 남아 있다.
- `openspec validate bami-peeking-chat-entry --strict`, `git diff --check`: 통과.
- Impeccable 변경 HTML 검사0건, 독립 코드 리뷰 조치 필요 결함 없음.
- 실제 모바일 적용 캡처: `docs/design/references/mascot-options-2026-10-06/bami-peeking-applied-mobile.png`.

## Remaining

최종 선택은 갈색 줄무늬 밤이와 기존 #16181D 진입 버튼이다. 브라운 색상은 철회했으며 배포는 수행하지 않았다.
