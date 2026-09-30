-- 2026-09-30 AI 코스 분류 확장. 값을 추가만 하며 기존 행은 바뀌지 않는다.
-- 'place'는 그대로 두고 화면 라벨만 '관광'으로 바꾼다.
alter type public.stop_kind add value if not exists 'activity';
alter type public.stop_kind add value if not exists 'shopping';
alter type public.stop_kind add value if not exists 'other';
