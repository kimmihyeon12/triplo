-- 알림 발송 함수(push-dispatch, 서비스 권한)가 알림 표를 읽고 고칠 수 있게 한다(2026-10-01).
-- 20261001120000에서 anon·authenticated 권한만 정리하고 service_role에는 주지 않아,
-- 발송 함수가 대기열을 읽지 못해 500을 내고 알림이 하나도 나가지 않았다.
-- 앱 사용자 권한은 그대로다(구독·설정은 본인 것만 읽기, 쓰기는 함수로만).
grant select, insert, update, delete on public.push_subscriptions, public.notification_settings, public.notification_outbox to service_role;
