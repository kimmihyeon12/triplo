---
version: 1
slug: "app-src-app-app-html"
primary_target: "app/src/app/app.html"
related_targets: ["app/src/app/app.css", "app/src/index.html", "app/public/brand/triplo-favicon.svg"]
---

# Surface brief: 트립플로 워드마크

Scope: 상단 홈 링크와 favicon. Mode: Operate. 2026-09-10 최신 사용자 지시: 앱 이름이 들어가는 로고로 변경. 현재 적용안이며 최종 브랜드 확정은 아니다.
이전 심볼안과 이름을 표시하지 않는 조건은 최신 지시로 대체한다.
Build path: code-led. HTML 텍스트·CSS와 SVG favicon. 앱의 기능·아키텍처·버전 변경과 분리한다.

## Direction contract

THESIS: 앱의 이름을 바로 읽을 수 있는 간결한 워드마크.
OWN-WORLD: 기존 Noto Sans KR 계열, 22px/700, 자간 -0.035em. #21469b→#3d73da 같은 파랑 계열 안의 은은한 그라데이션.
STORY: 어느 화면에서든 트립플로 이름이 여행 목록으로 돌아가는 홈 링크다.
FIRST VIEWPORT: 왼쪽에 이름만 표시하며 오른쪽 알파 안내와 겹치지 않는다. 최소 44px 높이의 클릭 영역, 360px 화면 지원.
SIGNATURE: 그림 심볼 대신 이름의 굵기·간격과 절제된 색 변화.
BEHAVIOR: 접근성 이름 ‘트립플로 홈’, /trips 이동, 키보드 포커스, 고대비 모드 단색 표시. favicon은 같은 파랑 배경의 흰 T.

검증: output/playwright/verify-wordmark.js로 PC 1440px·모바일 360px에서 이름·심볼 제거·넘침 없음·44px 조작 영역·홈 이동·키보드 포커스·강제 색 모드·favicon 응답을 확인했다. 캡처는 output/playwright/wordmark-*.png.
