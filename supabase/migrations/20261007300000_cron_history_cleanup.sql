-- pg_cron 실행 기록 정리(2026-10-07). 푸시 발송이 매분 돌며 cron.job_run_details에 한 줄씩 남겨
-- 6일 만에 23MB가 됐다(앱 데이터는 1.3MB). 그대로 두면 무료 DB 500MB를 약 4개월 뒤 채운다.
-- 실행 기록은 문제를 볼 때만 쓰므로 7일만 남긴다.
-- 로컬 검증은 pg_cron이 없어 이 파일을 쓰지 않는다.
create extension if not exists pg_cron;

select cron.schedule(
  'cron-history-cleanup',
  '37 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$
);
