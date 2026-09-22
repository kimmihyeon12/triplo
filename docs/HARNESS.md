# 설치한 개발 도구
2026-09-09 설치. 프로젝트 로컬 경로 .agents/skills 사용. Codex에서 이 폴더를 새 작업 공간으로 열어 사용한다.

| 도구 | 설치 범위 / 버전 | 역할 |
|---|---|---|
| Superpowers | obra/superpowers @ b36e0829c6d0140e93cfef2ca599b1b07d4a7797, 핵심 스킬 9개 | 기획·설계·구현·디버깅·검증 |
| Impeccable | pbakaus/impeccable @ 7d6c5bdd92cefca066bea2d8f148de3d50607080, 엔진 0.1.5 | 제품 화면 디자인 |
| Taste | Leonxlnx/taste-skill @ ccbc15639c97057cbfcf32ecebc38ef716e4bb37 | 소개/랜딩 화면 |
| OpenSpec | @fission-ai/openspec 1.12.0, Codex 스킬 6개 | 변경 명세 관리 |
| Playwright skill | openai/skills @ 49f948faa9258a0c61caceaf225e179651397431 | 브라우저 검증 절차 |

Superpowers는 전체 마켓플레이스 플러그인이 아닌 핵심 스킬 설치다. 자동 훅은 설정하지 않았다. Impeccable 엔진 실행을 확인했다. Playwright는 app/e2e와 별도 테스트 앱을 사용한다.
OpenSpec은 프로젝트 개발 의존성으로 고정하고 package-lock.json을 생성했다. 설치 시 ignore-scripts를 적용했고 npm audit 결과 취약점 0건이었다.
앱은 구현되어 있다. 현재 구현·검증 범위는 [DEVELOPMENT.md](DEVELOPMENT.md)를 따른다. 아래 설치 결과는 당시 기록이며 현재 도구 인증 상태를 보장하지 않는다.

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

## 프로젝트 MCP 설정 (설치 당시 확인 기록)

Context7과 Supabase를 원격 HTTP MCP로 등록했다. Claude Code는 루트 `.mcp.json`, Codex는 `.codex/config.toml`을 사용한다. 두 파일에 비밀키는 없으며 기존 사용자 설정은 변경하지 않았다. 원격 방식이므로 별도 npm MCP 패키지를 프로젝트에 설치하지 않는다.

| 서버 | 상태 | 사용 범위 |
| --- | --- | --- |
| Context7 | 초기화 HTTP 200 응답 확인 | 키 없는 문서 조회. 익명 이용 제한에 도달하면 별도 인증 검토 |
| Supabase | 설정 등록, HTTP 401로 인증 필요 확인 | 현재 `features=docs`만 지정. 개발용 프로젝트 연결 전 DB 도구는 활성화하지 않음 |
| Playwright | 기존 Claude 사용자 설정의 연결 성공 확인 | 중복 설치하지 않음. Codex에서는 기존 Playwright 스킬/CLI로 검증 |

Claude Code에서 이 폴더를 열고 최초 프로젝트 MCP 연결 승인을 진행한다. `claude mcp list` 검사에서 새 두 서버는 Pending approval이었다. 이 파일을 생성한 것으로 최초 승인이 완료된 것은 아니다.
개발용 project ref는 wslqgfetdwcmqeztixvs이며 MCP 연결 시 두 MCP URL을 같은 프로젝트로 맞춘다. 예: `https://mcp.supabase.com/mcp?project_ref=<실제-ref>&features=database,docs,debugging,development`. 계정 전체 접근으로 넓히지 않으며 실제 프로젝트에 필요한 도구만 사용한다. 현재 문서 조회용 URL에 로그인해도 DB를 조작할 수는 없다.
MCP로 DB 작업이 필요할 때 각 클라이언트에서 인증한다. Claude Code는 `/mcp`에서 Supabase 인증 또는 `claude mcp login supabase`, Codex는 `codex mcp login supabase`를 사용한다. 한 클라이언트의 로그인이 다른 클라이언트에 자동 공유된다고 가정하지 않는다. 토큰을 채팅이나 설정 파일에 복사하지 않는다.
새 Codex 세션에서 서버를 로드한다. `codex mcp list`로 두 서버의 등록은 확인했지만 Supabase 인증·실제 DB 조회는 아직 미완료다. 로그인 후 양쪽에서 해당 개발 프로젝트의 테이블 목록 조회로 검증한다. 앱의 Supabase Auth/DB 연결은 개발 도구인 MCP 연결과 별도로 구현한다.

Supabase DB 선택과 초기 사용 대상(본인과 친구들)은 기획안에 반영했으며 `npm run spec:check`의 엄격 검증에서 변경안 1개가 통과했다. 설치 기록과 실제 앱 구현·서비스 연결 상태를 구분한다.

공식 설정 근거: [Context7](https://context7.com/docs/resources/all-clients), [Supabase](https://supabase.com/docs/guides/ai-tools/mcp), [Claude Code](https://code.claude.com/docs/en/mcp), [Codex](https://developers.openai.com/codex/mcp).

## 현재 앱 실행 환경

| 항목 | 값 |
| --- | --- |
| 프레임워크 | Angular 21·NgRx Signals 21·Zoneless, TypeScript 5.9. 실제 버전은 `app/package.json`과 잠금 파일 기준 |
| 단위 테스트 | Vitest 4 (`app/vitest.config.ts`), 순수 함수·저장소·상태 경쟁·인증 유틸리티 검증 |
| 브라우저 검증 | @playwright/test 1.63 (`app/playwright.config.ts`). 최초 1회 `npx playwright install chromium` 필요(기존 MCP용 브라우저와 별개 버전) |
| 런타임/테스트 분리 | 런타임 `npm start` 4200 + 저장 키 `tc.trips.v1` / 테스트 `ng serve --configuration test` 4300 + 저장 키 `tc.test.trips.v1`(`src/environments/environment.test.ts`). 테스트 앱은 `tc.test.trips.v1.failSave` 키로 저장 실패를 주입한다 |
| 디자인 | Tailwind v4와 실제 공통 UI. 원본은 docs/design/DESIGN.md, 실험실은 /lab |
| 폰트 | Pretendard Variable을 src/index.html에서 로드. 오프라인·자체 호스팅은 PWA 단계에서 검증 |

## 지도·장소 검색 제공자 (2026-09-09 결정, 카카오맵)

| 항목 | 확인 내용 |
| --- | --- |
| 제공자 | 카카오맵 JavaScript SDK + `libraries=services`(키워드 검색·주소 변환). 브라우저에서 JavaScript 키로 호출 |
| 필수 설정 | 2024-12-01부터 신규 앱은 [앱] > [카카오맵] > [사용 설정] 상태 **ON** 필수. 지도 SDK에는 REST API 키가 아니라 **JavaScript 키**를 쓴다 |
| 도메인 제한 | [앱 설정] > [플랫폼] > Web > 사이트 도메인에 `http://localhost:4200`, `http://localhost:4300`(테스트 앱은 픽스처를 써서 실제로는 필요 없음), 이후 배포 도메인 등록 |
| 키 파일 | `app/public/app-config.example.json`을 `app/public/app-config.json`으로 복사해 `kakaoJsKey` 입력. 두 .gitignore에 등록되어 커밋되지 않음. 이 키는 공개용이며 도메인으로만 보호되므로 비밀키·REST 키를 넣지 않는다 |
| 앱 구조 | `app/src/app/features/places/data/`: `map-provider.ts`·`place-search.ts` 인터페이스, `kakao/` 실제 구현, `fixture/` 테스트 픽스처. 테스트 앱(4300)은 픽스처를 주입해 외부 호출이 없다 |

키 발급 절차: developers.kakao.com 로그인 → [내 애플리케이션] > [애플리케이션 추가하기](앱 이름·회사명 입력) → 앱 선택 → [카카오맵] > [사용 설정] ON → [앱 설정] > [앱 키] > JavaScript 키 복사 → [앱 설정] > [플랫폼] > Web 등록에 사이트 도메인 추가 → `app-config.json` 작성 → 앱 새로고침.
근거: [카카오맵 시작하기](https://developers.kakao.com/docs/latest/ko/kakaomap/common), [쿼터](https://developers.kakao.com/docs/latest/ko/getting-started/quota), [지도 Web API 가이드](https://apis.map.kakao.com/web/guide/), [카카오맵 API 활성화 공지](https://devtalk.kakao.com/t/api/140875), [네이버 Maps 무료 이용량 FAQ](https://www.ncloud-forums.com/topic/129/).

지도 픽스처 검증과 실제 카카오 SDK·검색 결과 확인은 구분한다. 최신 검증 기록은 OpenSpec tasks를 따른다. 쿼터·과금·관리 화면 경로는 연결 시 제공자 콘솔과 공식 문서에서 확인한다.

## Supabase 소셜 로그인 연결
프로젝트 ref: `wslqgfetdwcmqeztixvs`. 사용자가 프로젝트 생성·공개 키 제공·Google 제공자 설정을 진행했다. 이전 ‘프로젝트 없음’ 기록은 당시 상태다. Google Client Secret은 Supabase 제공자 설정에만 입력한다.
런타임 설정: app/public/supabase-config.example.json을 참고한 supabase-config.json(Git 제외). 지도 키 파일은 유지한다. Supabase URL Configuration의 Site URL은 http://localhost:4200, Redirect URL은 http://localhost:4200/auth/callback. Google 리디렉션 URI는 https://wslqgfetdwcmqeztixvs.supabase.co/auth/v1/callback 이다.
실제 별도 브라우저에서 4200 /login → Supabase → accounts.google.com의 ‘로그인 - Google 계정’ 화면 도착을 확인했다. 사용자의 실제 Google 계정 인증 완료·DB 저장은 이 검증에 포함하지 않는다.
배포된 AI Edge Function은 `ai-plan`과 `ai-chat`이다. AI 일정 만들기(`ai-plan`)는 2026-09-17, 채팅(`ai-chat`)은 2026-09-22 배포했다. 모델 키는 공통 `GEMINI_API_KEY` 비밀값으로 갖는다. 설정 절차와 검증 범위는 [AI-PLANNING.md](AI-PLANNING.md)를 따른다. 비밀값은 `npx supabase secrets set`으로 등록하며 앱 설정 파일에 넣지 않는다.

회원탈퇴 함수는 supabase/functions/delete-account/에 준비한다. 현재 CLI projects list는 Access token not provided를 반환하므로 관리 인증·배포 전이다. 프로젝트 터미널에서 `npx supabase login`으로 인증 후 `npx supabase functions deploy delete-account --project-ref wslqgfetdwcmqeztixvs`로 배포한다. 서버가 주입하는 SUPABASE_SERVICE_ROLE_KEY는 앱에 복사하지 않는다. 배포 확인 후 로컬 공개 설정의 accountDeletionEnabled를 true로 변경하고 별도 테스트 계정의 탈퇴를 검증한다. 기존 여행 테이블·사진 Storage 연결 전에 삭제 정책을 확장해야 한다.
참고: [Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google), [계정 삭제](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).

첫 가입: 카카오·Google 인증 후 닉네임만 입력한다. Supabase Auth Users의 user_metadata.travel_nickname 저장 성공 후 여행 목록으로 이동한다. 기존 닉네임이 있으면 입력을 생략한다. 카카오 로그인은 Supabase Authentication > Providers > Kakao 설정 후 공개 인증 설정 조회 결과에 따라 버튼이 활성화된다. 사용자 제공자 설정 완료 후 실제 accounts.kakao.com의 카카오계정 화면 도착을 확인했다. 실제 사용자 계정 인증 완료는 별도 확인 대상이다.

KOE205 수정: signInWithOAuth의 options.queryParams.scope=profile_nickname으로 기본 이메일·사진 동의 요청을 제외한다. options.scopes는 기본 목록에 추가되므로 대체 용도로 사용하지 않는다. Google 요청은 유지한다. 실제 Supabase → 카카오 요청에서 profile_nickname만 전달됨을 확인했다. 실계정 인증 성공은 별도 확인 대상이다.

카카오 KOE205 대응: 인증 요청은 profile_nickname만 사용하고 이메일·프로필 사진을 추가 요청하지 않는다. 서비스 닉네임은 인증 후 직접 입력한다. 카카오 Developers의 닉네임 동의항목 활성화와 Supabase Kakao 제공자의 Allow users without an email 설정이 필요하다.

로컬 디자인 미리보기: development 구성에서만 designPreview=true이며 여행·계정·온보딩 진입을 허용한다. production과 test 구성은 false로 기존 인증 가드를 유지한다. 계정 미리보기는 화면용 표시이며 AuthStore에 가짜 세션을 넣거나 서버 계정을 만들지 않는다. 개발 설정 변경 후 서버 재시작과 브라우저 강력 새로고침이 필요하다.
