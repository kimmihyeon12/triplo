- [x] 서버·클라이언트 실패 테스트 작성
- [x] 인증·입력 검증·Gemini 구조화 응답 함수 구현
- [x] 실행 앱의 실제 AI 제공자 및 취소 신호 연결
- [x] 로컬 명령·테스트 픽스처 경로 유지
- [x] 관련 테스트 120개 및 앱 빌드 통과
- [x] 서버 코드 검토 및 배포 확인
- [x] 문서·검증 결과 최종 정리

## 배포·검증 (2026-09-22)

- 기존 Supabase 프로젝트 `wslqgfetdwcmqeztixvs`에 `ai-chat` v1 배포. 함수 목록에서 ACTIVE 및 verify_jwt=true 확인.
- 비밀값을 읽거나 출력하지 않고 GEMINI_API_KEY 등록 이름을 확인했다. ai-plan과 같은 서버 키를 사용한다.
- 배포 URL의 인증 없는 POST는 HTTP 401로 거절된다.
- 서버/클라이언트 단위 테스트는 모델 응답 모의값으로 검증한다. 실제 로그인 사용자로 Gemini 답변을 받는 라이브 왕복은 이 세션에서 확인하지 않았다.
- 코드 검토에서 배포 차단 문제 없음. 429를 일일 한도 소진으로 단정하던 안내를 요청 한도 안내로 수정했다.
- 서버 사용자별 영구 quota 집계는 미구현이다. 클라이언트 대화 한도와 모델 제공자 한도를 사용한다.
- 최종 검증: 관련 11개 테스트 파일·120개 테스트 통과, 운영 빌드 및 구조 검사 171개 모듈 통과. 기존 LoginPage 미사용 import 2개와 초기 번들 772.97kB/500kB 경고는 남는다.
- 인증 방식은 [Supabase 공식 Authorization headers 문서](https://supabase.com/docs/guides/functions/auth-headers)의 로그인 사용자 JWT 경로를 확인했다. 기존 verify_jwt=true 및 핸들러 getUser 검증을 유지한다.
