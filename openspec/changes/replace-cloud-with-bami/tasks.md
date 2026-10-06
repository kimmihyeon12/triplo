# Tasks

- [x] 1. 승인된 기본 콩눈 밤이 투명 자산을 저장하고 기존 public 구름이 자산을 이전 자료로 이동한다.
- [x] 2. 앱 이름·이미지·접근성 설명·서버 프롬프트와 사용법 설명을 변경한다.
- [x] 3. 기획안·디자인·제품 문서·목차를 새 결정과 일치시킨다.
- [x] 4. 기존 캐릭터 E2E를 갱신하고 데스크톱·모바일 검증, 사용법 캡처 재생성, 빌드와 lint를 실행한다.
- [x] 5. 코드 리뷰와 실제 결과를 확인하고 완료/미완료 사항을 기록한다.

## Verification (2026-10-06)

- `npx playwright test e2e/bami-mascot.spec.ts`: 2 passed. 데스크톱·360px 모바일에서 이미지 로드/크롭 없음·진입 버튼 크기·새 대화·상세 시트 제목과 이미지 확인.
- `npx playwright test --config=playwright.capture.config.ts`: 1 passed. 전체 사용법 캡처와 guide-marks.ts 재생성 완료. 밝힐 자리 결과는 기존과 같고, 캡처 중 4장에 파일 차이가 발생했다.
- `npm run build`: 성공. 초기 번들 637.25kB로 600kB 권장 예산을 37.25kB 초과하는 경고 1개. 빌드 brand에는 밤이만 포함되고 구름이 자산은 없다. 생성된 사용법 파일과 dist 사용법 파일의 해시가 일치한다.
- `npm run lint`: 기능 경계·순환 273개 모듈, 색 대비 AA 및 페이지 폭 검사 통과.
- `openspec validate replace-cloud-with-bami --strict`: 통과.
- Impeccable 변경 컴포넌트 검사: 0건.
- 독립 코드 리뷰: 조치가 필요한 결함 없음. 실행 코드/프롬프트의 구름이·옛 이미지 경로 잔여 참조 없음.
- 캡처: `output/playwright/bami-{desktop,mobile-360}-{list,welcome,chat,detail,sheet}.png`.

## Remaining / Deployment

로컬 구현과 검증 완료. 웹 및 ai-chat Edge Function 배포는 수행하지 않았다. 서버 이름 변경은 해당 함수를 배포한 뒤 원격 응답에 반영된다. 기존 사용자 대화 기록과 과거 시안 자료는 유지한다.
