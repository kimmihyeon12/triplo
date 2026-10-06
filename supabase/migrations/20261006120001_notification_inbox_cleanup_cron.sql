-- 알림 내역 정리(2026-10-06). 30일이 지난 알림을 하루에 한 번 지운다(사용자 결정).
-- 로컬 검증(supabase/tests/notification-inbox.local.sql)은 pg_cron이 없어 이 파일을 쓰지 않는다.
create extension if not exists pg_cron;

select cron.schedule(
  'notification-inbox-cleanup',
  '17 3 * * *',
  $$ delete from public.notification_inbox where created_at < now() - interval '30 days' $$
);
