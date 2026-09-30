# 설계

상세 설계 원본은 [설계 문서](../../../docs/superpowers/specs/2026-09-30-ai-course-plan-design.md)이며 구현 계획은 `docs/superpowers/plans/2026-09-30-ai-course-plan.md`다. 여기에는 결정만 요약한다.

- 분류 정의는 `trips/model/trip.ts`의 `STOP_KIND_LABEL`·`PLAN_KIND_LABEL`·`STOP_KINDS`·`toStopKind`와 `trips/util/kind-tone.ts`에만 둔다. `PlanKind = StopKind | 'stay'`. 저장값 `place`·`break`는 그대로 두고 라벨만 관광·카페다. 모르는 저장값은 관광으로 읽는다.
- 일정 분류 → 가계부 분류 대응은 `expenses/util/expense-link.ts`의 `KIND_EXPENSE_CATEGORY` 하나로 관리하고 AI 예산 묶음도 이를 쓴다. 교통은 계산하지 않으므로 묶음에서 뺀다.
- 분류 결정: 장소 검색 분류가 음식점·카페·숙박이면 검색을 따르고, 나머지(관광·액티비티·쇼핑·기타)는 모델 분류를 쓴다. 모델이 먹는 곳·숙소라 했는데 검색이 아니면 관광으로 낮춘다. 챗봇은 숙박 검색 결과를 예전처럼 관광으로 담는다.
- 응답 해석: 순서가 모두 1 이상 정수이고 겹치지 않을 때만 모델 순서를 쓰고, 아니면 응답 순서를 쓴다. 앞 항목보다 이른 시각은 미정으로 둔다. 이동은 도보·대중교통·자가용·택시와 1~600분만 받는다.
- 코스 계산(`ai-planning/util/course.ts`): 숙소는 그날 끝, 옮겨 온 항목은 숙소 앞에 둔다. 옮긴 항목은 시각 미정. 모델 이동은 같은 날 모델 순서가 바로 이어지는 두 선택 항목 사이에서만 쓰고, 그 밖은 확인된 좌표의 직선거리만 쓴다.
- 저장 규칙: 추천 시각·이동시간은 `fixedTime`·경로시간으로 저장하지 않는다. 추천 시각은 메모에 "AI 추천 시각"으로 남긴다. 날짜 미정이면 숙소는 담지 않고 안내한다.
