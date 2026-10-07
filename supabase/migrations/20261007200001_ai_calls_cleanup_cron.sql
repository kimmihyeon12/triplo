-- AI 호출 기록 정리(2026-10-07). 90일이 지난 줄을 하루에 한 번 지운다.
-- 로컬 검증(supabase/tests/admin-usage.local.sql)은 pg_cron이 없어 이 파일을 쓰지 않는다.
create extension if not exists pg_cron;

select cron.schedule(
  'ai-calls-cleanup',
  '27 3 * * *',
  $$ delete from public.ai_calls where at < now() - interval '90 days' $$
);
