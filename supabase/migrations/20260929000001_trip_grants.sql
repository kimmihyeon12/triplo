-- 로그인한 사용자에게 여행 표 권한을 명시적으로 준다.
-- 최근 Supabase 프로젝트는 public 스키마의 새 표에 권한을 자동으로 주지 않는다.
-- 원격 적용 후 비로그인 요청이 RLS가 아니라 'permission denied for table trips'로
-- 막히는 것을 보고 확인했다(2026-09-29). 행 단위 접근은 여전히 RLS가 막는다.
-- 비로그인(anon)에게는 주지 않는다.
grant select, insert, update, delete
  on public.trips, public.trip_regions, public.trip_stops, public.accommodation_stays
  to authenticated;
