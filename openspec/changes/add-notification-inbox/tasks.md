- [x] 서버: `notification_inbox` 표·RLS, `queue_notification`·`notify_notice_published` 갱신, `mark_notifications_read`, 30일 정리 cron
- [x] 앱: `NOTIFICATION_INBOX`(Supabase·기기 구현), 알림 내역 화면, 내 정보 소식 줄과 안 읽은 수
- [x] 기획안 44절·OpenSpec·푸시 설계 문서 범위 갱신
- [x] 원격 Supabase에 마이그레이션 두 개 적용(2026-10-06 `supabase db push`, 로그인 없는 조회·읽음 처리는 42501로 거부됨을 확인. 로그인한 사용자의 원격 조회는 확인하지 않음)

검증(2026-10-06): 로컬 PostgreSQL 17 `supabase/tests/notification-inbox.local.sql` 전부 기대값(푸시 없이 남김, 일정 변경 10분 묶음, 끈 종류 제외·푸시 대기열은 유지, 공지는 켠 사람마다, 본인만 읽기, 직접 쓰기·anon 거부, 계정 삭제 시 함께 삭제). 기존 `push.local.sql`에 새 마이그레이션을 얹어도 기대값이 같다(여행 삭제 단계의 외래 키 오류는 원래 테스트에도 있는 현상). 단위 테스트 18개(알림 폴더·테마) 통과. 별도 test 앱(4310) `account.spec.ts`·`notifications.spec.ts` 데스크톱·360px 28개 통과. 라이트·다크 화면 캡처 확인.
