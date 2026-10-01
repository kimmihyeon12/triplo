-- 알림 발송 예약(2026-10-01). 1분마다 보낼 알림이 있을 때만 push-dispatch를 부른다.
-- 함수 주소와 비밀 헤더 값은 저장소에 적지 않고 Vault에서 읽는다. 배포할 때 한 번 넣는다:
--   select vault.create_secret('<https://<project>.supabase.co/functions/v1/push-dispatch>', 'push_dispatch_url');
--   select vault.create_secret('<임의의 긴 값>', 'push_cron_secret');   -- Edge 비밀값 PUSH_CRON_SECRET과 같은 값
-- 로컬 검증(supabase/tests/push.local.sql)은 pg_cron·pg_net이 없어 이 파일을 쓰지 않는다.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'push-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from public.notification_outbox where sent_at is null)
  $$
);
