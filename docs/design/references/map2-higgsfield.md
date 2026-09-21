# map2 Higgsfield 디자인 참고

> 이전 시도 보관용. 사용자의 최신 정정에 따라 이미지 생성 없이 채팅에 첨부한 원본 2.5D 블록 디자인을 직접 구현한다. 이 생성물의 낮은 입체감·수평 범례는 현재 디자인 기준이 아니다.

- 생성: 2026-09-18, Higgsfield MCP / Recraft V4.1 utility, 1k, 4:3, 1장
- 생성 ID: `8e5bfea5-8854-49e5-b1d9-a35ddb1c9e31`
- 사전 견적: 1.25크레딧
- 파일: [map2-higgsfield.png](map2-higgsfield.png)
- 용도: 디자인 참고. 사용자 여행 데이터·사진은 전송하지 않았다.

## 적용

중성 지도 바탕, 낮은 복셀 높이, 간결한 수평 범례, 방문 요약, 지도 밖 선택 지역 횟수를 앱 공통 PageBar·버튼·아이콘·스피너와 Tailwind 토큰으로 구현한다. 생성 이미지를 지도 배경으로 붙이지 않으며 임의 경계·지명·예시 숫자는 사용하지 않는다. 2013년 출처 경계와 기존 LocalVisitStats 집계를 유지한다.

## 생성 프롬프트

Use case: ui-mockup. High fidelity design reference for Triplo, an existing Korean travel app visited-region statistics screen. A quiet functional product interface, no promotional content. 4:3 desktop screen, neutral off-white #fbfbfa canvas, white #ffffff surfaces, charcoal #16181d Korean sans-serif typography similar to Pretendard, blue #2f5fdb selected controls. Slim app header with back arrow and title '기록 지도'. Main composition: large softly rounded white voxel map of South Korea including Jeju on a neutral light gray map canvas, restrained isometric view, soft ambient shadows, flat broad province areas colored from #e3f5ea to #1e7a4e according to visit count, no tall towers. Compact summary at top left showing '방문 지역' and '누적 방문', plenty of breathing room. Small elegant map labels, right-aligned stacked zoom and reset controls, a small horizontal green color legend at bottom. A compact selected-region readout below the map, clear single-line counts. App-like spacing, 16px corners, minimum chrome, approachable and precise. No illustrations outside the map, no photos, no scenic background, no gradients, no giant headline, no sidebar dashboard. This is a visual concept only; invented geometry or sample numbers will not be used as actual travel data.
