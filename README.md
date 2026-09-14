# 트립플로 (국내 여행 비서)
국내 여행 AI 후보 선택 → 일정 구성 → 방문 기록 → 사진 지도와 캐릭터 성장으로 이어지는 반응형 웹/PWA 프로젝트입니다.

현재 단계는 **내부 알파(수동 일정 관리, 같은 기기 저장)** 입니다. 서비스 배포, 원격 저장소 생성, Supabase 연결은 아직 하지 않았습니다.
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

지도·장소 검색(카카오맵): `app/public/app-config.example.json`을 `app/public/app-config.json`으로 복사하고 카카오 디벨로퍼스 JavaScript 키를 넣습니다. 키 발급·도메인 등록 절차와 무료 한도는 [HARNESS.md](docs/HARNESS.md)의 ‘지도·장소 검색 제공자’ 절을 참고하세요. 키가 없어도 앱은 동작하며 지도·검색만 ‘연결 안 됨’으로 표시됩니다.

명세 검증: `npm run spec:check` (저장소 루트)
