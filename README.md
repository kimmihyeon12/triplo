# 트립플로 (국내 여행 비서)
국내 여행 AI 후보 선택 → 일정 구성 → 방문 기록 → 사진 지도와 캐릭터 성장으로 이어지는 반응형 웹/PWA 프로젝트입니다.

현재 단계는 **내부 알파(계정별 서버 저장·친구 공동 편집)** 입니다. 배포 주소는 https://triplo.pages.dev 입니다. 개발·운영 DB 분리는 후속 작업입니다.

주요 기능(2026-10-06 기준):
- 여행·가계부: Supabase 소셜 로그인, 계정별 서버 저장(RLS), 초대 링크 공동 편집, 영수증 사진으로 지출 입력·정산
- 일정: AI 일정 짜기(고른 곳만 담기), 큰 지도에서 주변 장소 담기, 지도 링크로 담기, 방문 통계 지도
- 챗봇: 펭귄 캐릭터 `펭이`의 AI 여행 챗봇. 대화 기록은 기기에 계정별로 남는다
- 내 정보: 공지·문의(서버 저장), 웹 푸시 알림과 알림 내역(30일), 다크 모드(설정에서 켜기, 기기별 저장)
- Play 스토어 준비: PWA PNG 아이콘, 스토어 등록 이미지(`store/out/`). TWA 출시 절차는 [개발 안내](docs/DEVELOPMENT.md)
- **Angular 21 + NgRx Signals 21 + Zoneless**를 사용합니다. 업그레이드 작업과 상태관리 결정은 [아키텍처](docs/architecture/ARCHITECTURE.md)와 OpenSpec tasks 9절을 따릅니다.
- [전체 문서 목차](docs/README.md) · [개발 안내](docs/DEVELOPMENT.md)
- [기획안](docs/기획안-v0.1.md)
- [내부 알파 화면 설계](docs/알파-화면설계-v0.1.md)
- [개발 도구 설치 내역](docs/HARNESS.md)
- [MVP 명세 초안](openspec/changes/plan-travel-companion-mvp/proposal.md) · [작업 현황](openspec/changes/plan-travel-companion-mvp/tasks.md)

## 앱 실행 (`app/`, Angular 21)
```bash
cd app
npm ci              # Node 22.20+ / npm 11 권장
npm start            # 런타임 앱 http://localhost:4200 (저장 키 tc.trips.v1)
npm test             # 순수 함수·저장소·상태 경쟁 단위 테스트
npm run lint         # 기능 경계·순환 참조 검사
npx playwright install chromium   # 최초 1회
npm run e2e          # 브라우저 시나리오 (테스트 앱 4300, 저장 키 tc.test.trips.v1)
npm run build        # 프로덕션 빌드
```

지도·장소 검색(카카오맵): `app/public/app-config.example.json`을 `app/public/app-config.json`으로 복사하고 카카오 디벨로퍼스 JavaScript 키를 넣습니다. 키 발급·도메인 등록 안내는 [HARNESS.md](docs/HARNESS.md)의 ‘지도·장소 검색 제공자’ 절을 참고하세요. 키가 없어도 앱은 동작하며 지도·검색만 ‘연결 안 됨’으로 표시됩니다.

명세 검증: `npm run spec:check` (저장소 루트)

스토어 이미지 다시 만들기: `cd app && npx playwright test --config=playwright.store.config.ts`로 화면을 찍고(카카오 키 필요, 4200 사용) 저장소 루트에서 `node store/render.mjs`로 합성합니다.

디자인 확인: development 앱은 로그인 없이 페이지에 진입할 수 있습니다. [실험실](http://localhost:4200/lab)에서 공통 UI를 확인하세요. production과 test는 인증 가드를 유지합니다. 소셜 로그인 설정은 [HARNESS.md](docs/HARNESS.md)를 따릅니다.
