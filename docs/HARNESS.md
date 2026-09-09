# 설치한 개발 도구
2026-09-09 설치. 프로젝트 로컬 경로 .agents/skills 사용. Codex에서 이 폴더를 새 작업 공간으로 열어 사용한다.

| 도구 | 설치 범위 / 버전 | 역할 |
|---|---|---|
| Superpowers | obra/superpowers @ b36e0829c6d0140e93cfef2ca599b1b07d4a7797, 핵심 스킬 9개 | 기획·설계·구현·디버깅·검증 |
| Impeccable | pbakaus/impeccable @ 7d6c5bdd92cefca066bea2d8f148de3d50607080, 엔진 0.1.5 | 제품 화면 디자인 |
| Taste | Leonxlnx/taste-skill @ ccbc15639c97057cbfcf32ecebc38ef716e4bb37 | 소개/랜딩 화면 |
| OpenSpec | @fission-ai/openspec 1.12.0, Codex 스킬 6개 | 변경 명세 관리 |
| Playwright skill | openai/skills @ 49f948faa9258a0c61caceaf225e179651397431 | 브라우저 검증 절차 |

Superpowers는 전체 마켓플레이스 플러그인이 아닌 핵심 스킬 설치다. 자동 훅은 설정하지 않았다. Impeccable 엔진 실행을 확인했다. Playwright는 스킬을 설치했으며 앱 구현 시 테스트 런타임을 추가한다.
OpenSpec은 프로젝트 개발 의존성으로 고정하고 package-lock.json을 생성했다. 설치 시 ignore-scripts를 적용했고 npm audit 결과 취약점 0건이었다.
공식 API 키, 유료 계정, 배포 환경은 아직 연결하지 않았다. 앱 자체가 없어 앱 테스트 결과는 없다.

## 운영 순서
1. 기획안 검토와 제품 범위 확정
2. 장소/경로/지도앱 연결 PoC 및 화면 설계
3. OpenSpec 작업별 구현
4. 의미 있는 단위·통합·브라우저 검증
5. 기기별 베타 검증

## 원본
- https://github.com/obra/superpowers
- https://github.com/pbakaus/impeccable
- https://github.com/Leonxlnx/taste-skill
- https://github.com/Fission-AI/OpenSpec
- https://github.com/openai/skills

## 프로젝트 MCP 설정 (2026-09-09)

Context7과 Supabase를 원격 HTTP MCP로 등록했다. Claude Code는 루트 `.mcp.json`, Codex는 `.codex/config.toml`을 사용한다. 두 파일에 비밀키는 없으며 기존 사용자 설정은 변경하지 않았다. 원격 방식이므로 별도 npm MCP 패키지를 프로젝트에 설치하지 않는다.

| 서버 | 상태 | 사용 범위 |
| --- | --- | --- |
| Context7 | 초기화 HTTP 200 응답 확인 | 키 없는 문서 조회. 익명 이용 제한에 도달하면 별도 인증 검토 |
| Supabase | 설정 등록, HTTP 401로 인증 필요 확인 | 현재 `features=docs`만 지정. 개발용 프로젝트 연결 전 DB 도구는 활성화하지 않음 |
| Playwright | 기존 Claude 사용자 설정의 연결 성공 확인 | 중복 설치하지 않음. Codex에서는 기존 Playwright 스킬/CLI로 검증 |

Claude Code에서 이 폴더를 열고 최초 프로젝트 MCP 연결 승인을 진행한다. `claude mcp list` 검사에서 새 두 서버는 Pending approval이었다. 이 파일을 생성한 것으로 최초 승인이 완료된 것은 아니다.
Supabase 개발용 프로젝트 URL 또는 project ref를 확인한 뒤 두 MCP URL을 같은 프로젝트로 맞춘다. 예: `https://mcp.supabase.com/mcp?project_ref=<실제-ref>&features=database,docs,debugging,development`. 계정 전체 접근으로 넓히지 않으며 실제 프로젝트에 필요한 도구만 사용한다. 현재 문서 조회용 URL에 로그인해도 DB를 조작할 수는 없다.
프로젝트 URL을 확정한 뒤 각 클라이언트에서 로그인한다. Claude Code는 `/mcp`에서 Supabase 인증 또는 `claude mcp login supabase`, Codex는 `codex mcp login supabase`를 사용한다. 한 클라이언트의 로그인이 다른 클라이언트에 자동 공유된다고 가정하지 않는다. 토큰을 채팅이나 설정 파일에 복사하지 않는다.
새 Codex 세션에서 서버를 로드한다. `codex mcp list`로 두 서버의 등록은 확인했지만 Supabase 인증·실제 DB 조회는 아직 미완료다. 로그인 후 양쪽에서 해당 개발 프로젝트의 테이블 목록 조회로 검증한다. 앱의 Supabase Auth/DB 연결은 개발 도구인 MCP 연결과 별도로 구현한다.

Supabase DB 선택과 초기 사용 대상(본인과 친구들)은 기획안에 반영했으며 `npm run spec:check`의 엄격 검증에서 변경안 1개가 통과했다. 설치 기록과 실제 앱 구현·서비스 연결 상태를 구분한다.
사용자 확인: Supabase 프로젝트는 아직 없으며 핵심 화면 작업 후 생성·연결한다. 현재 MCP는 문서 조회용 등록·인증 대기 상태로 두고, DB 연결을 기다리며 화면 개발을 멈추지 않는다. 핵심 흐름 검증 후 실제 프로젝트를 지정하고 인증을 진행한다.

공식 설정 근거: [Context7](https://context7.com/docs/resources/all-clients), [Supabase](https://supabase.com/docs/guides/ai-tools/mcp), [Claude Code](https://code.claude.com/docs/en/mcp), [Codex](https://developers.openai.com/codex/mcp).

## 앱 실행 환경 (2026-09-09, 내부 알파)

| 항목 | 값 |
| --- | --- |
| 프레임워크 | Angular 20.3 (standalone, signals), TypeScript 5.9. `app/`에 위치. 전역 Angular CLI 20.3.8로 생성 |
| 단위 테스트 | Vitest 3 (`app/vitest.config.ts`, 도메인·저장소 순수 모듈만). Karma는 제거 |
| 브라우저 검증 | @playwright/test 1.63 (`app/playwright.config.ts`). 최초 1회 `npx playwright install chromium` 필요(기존 MCP용 브라우저와 별개 버전) |
| 런타임/테스트 분리 | 런타임 `npm start` 4200 + 저장 키 `tc.trips.v1` / 테스트 `ng serve --configuration test` 4300 + 저장 키 `tc.test.trips.v1`(`src/environments/environment.test.ts`). 테스트 앱은 `tc.test.trips.v1.failSave` 키로 저장 실패를 주입한다 |
| 디자인 | Impeccable 4.3: PRODUCT.md(문서 추론 표시), `.impeccable/surfaces/app-src-app-features-trips.md` 방향 계약. 1차 배정(시드 580ca994 표지판)은 사용자 거부로 폐기, 2차는 사용자 핀 고정(따뜻·귀여움), 3차(2026-09-09 리뉴얼, 시드 81aaffeb)는 후보 3개 비교 후 사용자가 ‘클린 앱 표준’ 선택. 감지기 `impeccable.cmd detect --json` 결과 0건. 리뷰 스크린샷은 `.impeccable/review/`(git 제외) |
| 폰트 | Google Fonts Jua(제목)·Nanum Gothic(본문)을 `src/index.html`에서 로드. 오프라인·자체 호스팅은 PWA 단계에서 서브셋과 함께 처리 |

2026-09-09 실행 결과: `npm test` 43건 통과, `npm run e2e` 28건 통과(데스크톱·360×740), `npm run build` 초기 277kB. 실제 장소 검색·경로·지도앱 스킴·Supabase는 연결하지 않았다.

## 지도·장소 검색 제공자 (2026-09-09 결정, 카카오맵)

| 항목 | 확인 내용 |
| --- | --- |
| 제공자 | 카카오맵 JavaScript SDK + `libraries=services`(키워드 검색·주소 변환). 브라우저에서 JavaScript 키로 호출 |
| 무료 한도 | 개발자 계정의 **첫 번째로 카카오맵을 활성화한 앱**에만 무료 쿼터. 지도 Web SDK 일 300,000건, 키워드 검색·주소 변환 등 REST 일 100,000건. 결제 수단 등록 불필요. 두 번째 앱부터는 비즈월렛 연결 후 유료 설정이 필요하므로 앱을 하나만 만든다 |
| 필수 설정 | 2024-12-01부터 신규 앱은 [앱] > [카카오맵] > [사용 설정] 상태 **ON** 필수. 지도 SDK에는 REST API 키가 아니라 **JavaScript 키**를 쓴다 |
| 도메인 제한 | [앱 설정] > [플랫폼] > Web > 사이트 도메인에 `http://localhost:4200`, `http://localhost:4300`(테스트 앱은 픽스처를 써서 실제로는 필요 없음), 이후 배포 도메인 등록 |
| 키 파일 | `app/public/app-config.example.json`을 `app/public/app-config.json`으로 복사해 `kakaoJsKey` 입력. 두 .gitignore에 등록되어 커밋되지 않음. 이 키는 공개용이며 도메인으로만 보호되므로 비밀키·REST 키를 넣지 않는다 |
| 대안 | 네이버 클라우드 Maps: 대표 계정 1개에 무료 이용량(Web Dynamic Map 월 1,000만 건 등)이 있으나 NCP 계정·초과 과금 구조가 있어 2순위. 네이버 개발자센터 지역 검색: 일 25,000건, 브라우저 직접 호출 불가(서버 프록시 필요)로 후속 보조 후보 |
| 앱 구조 | `app/src/app/integrations/`: `map-provider.ts`·`place-search.ts` 인터페이스, `kakao/` 실제 구현, `fixture/` 테스트 픽스처. 테스트 앱(4300)은 픽스처를 주입해 외부 호출이 없다 |

키 발급 절차: developers.kakao.com 로그인 → [내 애플리케이션] > [애플리케이션 추가하기](앱 이름·회사명 입력) → 앱 선택 → [카카오맵] > [사용 설정] ON → [앱 설정] > [앱 키] > JavaScript 키 복사 → [앱 설정] > [플랫폼] > Web 등록에 사이트 도메인 추가 → `app-config.json` 작성 → 앱 새로고침.
근거: [카카오맵 시작하기](https://developers.kakao.com/docs/latest/ko/kakaomap/common), [쿼터](https://developers.kakao.com/docs/latest/ko/getting-started/quota), [지도 Web API 가이드](https://apis.map.kakao.com/web/guide/), [카카오맵 API 활성화 공지](https://devtalk.kakao.com/t/api/140875), [네이버 Maps 무료 이용량 FAQ](https://www.ncloud-forums.com/topic/129/).

검증 기록: 2026-09-09 픽스처 제공자로 Playwright 4건 통과(`app/e2e/map-search.spec.ts`), Vitest 55건 통과. 실제 카카오 키로의 지도 렌더링·키워드 검색 실데이터 검증은 사용자 키 입력 후 기록한다(아직 없음).
