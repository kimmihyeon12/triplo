# 관리자 사용량·비용 화면

관리자가 Gemini·Supabase 무료 한도에 얼마나 가까운지와 유료였다면 이번 달 얼마였을지를 본다(2026-10-07 사용자 요청).

## 범위

- AI 서버 함수 3개가 Gemini 실제 호출·토큰을 `ai_calls`에 남긴다. 90일 뒤 정리.
- 관리자 전용 집계 함수 `admin_usage_summary()`.
- `/admin/usage` 화면과 관리자 홈 메뉴.

## 범위 밖

- 전송량·서버 함수 호출 수(관리 API 토큰 필요, 사용자 결정으로 제외), 한도 경고 알림, 사용자별 사용량.

설계: `docs/superpowers/specs/2026-10-07-admin-usage-design.md`. 마이그레이션 `20261007200000_admin_usage.sql`, `20261007200001_ai_calls_cleanup_cron.sql`.
