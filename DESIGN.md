---
name: 트립플로 (국내 여행 비서)
description: 밝은 중성 회색 바탕 위 흰 카드, 상단 바에 통합된 화면 제목, 프리텐다드 한 가족의 굵기 위계, 딥 블루 하나의 모바일 우선 클린 앱.
colors:
  ground: "#fbfcfd"
  ground-2: "#f4f6f9"
  panel: "#ffffff"
  panel-2: "#fcfdfe"
  accent: "#3b6fef"
  accent-deep: "#2f5fdb"
  accent-deep-hover: "#2650bd"
  accent-tint: "#eaf0fe"
  accent-fill: "#cfdcfb"
  place-ink: "#2650bd"
  place-tint: "#eaf0fe"
  stay-ink: "#6a4bb5"
  stay-tint: "#efe9fb"
  warn-ink: "#7f5400"
  warn-tint: "#fff4d1"
  danger-ink: "#b3261e"
  danger-tint: "#fde8e6"
  ok-ink: "#1e7a4e"
  ok-tint: "#e3f5ea"
  ink: "#16181d"
  ink-2: "#4a4f58"
  ink-3: "#6b7280"
  border: "#e8eaef"
  border-strong: "#d4d8e0"
  on-accent: "#ffffff"
  brand: "#2f5fdb"
  naver-brand: "#03c75a"
  kakao-brand: "#fee500"
  kakao-brand-ink: "#3c1e1e"
  selected-fill-from: "#16181d"
  selected-fill-to: "#2a3b63"
  ai-fill-from: "#3b6fef"
  ai-fill-to: "#6d4fd6"
  ai-fill-hover-from: "#2f5fdb"
  ai-fill-hover-to: "#5c40c4"
typography:
  headline:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0"
  title:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "0"
  title-card:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
  subtitle:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0"
  body:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  body-sm:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  caption:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  cell: "8px"
  control: "10px"
  control-lg: "12px"
  panel: "16px"
  pill: "999px"
  circle: "50%"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep-hover}"
    textColor: "{colors.on-accent}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink}"
  button-on-hero:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.danger-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-ink}"
  button-sm:
    typography: "{typography.body-sm}"
    rounded: "{rounded.cell}"
    padding: "0 12px"
    height: "36px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0"
    width: "36px"
    height: "36px"
  chip-accent:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-deep}"
    typography: "{typography.caption}"
    rounded: "{rounded.cell}"
    padding: "2px 8px"
    height: "22px"
  chip-place:
    backgroundColor: "{colors.place-tint}"
    textColor: "{colors.place-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.cell}"
    padding: "2px 8px"
    height: "22px"
  chip-stay:
    backgroundColor: "{colors.stay-tint}"
    textColor: "{colors.stay-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.cell}"
    padding: "2px 8px"
    height: "22px"
  chip-warn:
    backgroundColor: "{colors.warn-tint}"
    textColor: "{colors.warn-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.cell}"
    padding: "2px 8px"
    height: "22px"
  chip-danger:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.cell}"
    padding: "2px 8px"
    height: "22px"
  chip-ok:
    backgroundColor: "{colors.ok-tint}"
    textColor: "{colors.ok-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.cell}"
    padding: "2px 8px"
    height: "22px"
  chip-ghost:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-3}"
    typography: "{typography.caption}"
    rounded: "{rounded.cell}"
    padding: "2px 8px"
    height: "22px"
  chip-solid-accent:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.on-accent}"
    typography: "{typography.caption}"
    rounded: "{rounded.cell}"
    padding: "2px 8px"
    height: "22px"
  card-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  card-list:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "0"
  card-list-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    padding: "14px 16px"
  card-list-row-selected:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.ink}"
  card-nested:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    height: "44px"
  tab-on:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "44px"
  day-chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
    width: "72px"
  day-chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
    width: "72px"
  badge-day:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.on-accent}"
    typography: "{typography.subtitle}"
    rounded: "{rounded.circle}"
    size: "40px"
  badge-stop:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.circle}"
    size: "28px"
  badge-activity:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.circle}"
    size: "28px"
  badge-stay:
    backgroundColor: "{colors.stay-tint}"
    textColor: "{colors.stay-ink}"
    rounded: "{rounded.circle}"
    size: "36px"
  map-marker:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.circle}"
    size: "28px"
  map-marker-stay:
    backgroundColor: "{colors.stay-ink}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.circle}"
    size: "28px"
  notice-warn:
    backgroundColor: "{colors.warn-tint}"
    textColor: "{colors.warn-ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  notice-danger:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  notice-ok:
    backgroundColor: "{colors.ok-tint}"
    textColor: "{colors.ok-ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  kind-toggle:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    height: "44px"
  kind-toggle-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    height: "44px"
---

# Design System: 트립플로 (국내 여행 비서)

## Overview

**Creative North Star: "클린 앱 표준"**

이 시스템은 국내 여행·금융 앱 사용자가 이미 아는 관례를 흠 없이 실행하는 세계다. 미지근한 회백색 바탕(`ground`) 위에 흰 카드(`panel`)를 얕은 그림자 하나로 올리고, 카드 안 목록은 1px 구분선으로 나눈다. 탭은 밑줄, 날짜 칩은 알약, 위계는 서체 한 가족(Noto Sans KR 400/500/700)의 굵기와 크기, 그리고 잉크 3단계의 명도로만 세운다. 장식·표시 서체·스티커·이모지는 없다. 다른 앱과 구분되는 점은 색이 아니라 정직함이다. 미확인·미정·충돌이 회색 위계 위에 버터·로즈로만 드러난다.

밀도는 모바일 편집 도구답게 촘촘하다. 카드 사이는 16px, 카드 안 항목은 3~8px로 뭉치고, 페이지 안쪽 여백은 16/24px 두 단계다. 강조색은 딥 블루 하나이며 화면에서 가장 무거운 딥 블루(`accent-deep`)는 주 동작 버튼, 활성 탭 밑줄, 순번 배지와 지도 마커, 포커스 링에만 나타난다. 나머지 색은 모두 의미가 정해진 상태색이다. 확정된 거부: 코랄·민트 강조, 표시용 귀여운 서체(Jua)와 스티커 장식, 도로 안내표지판 체계, 카드 테두리와 그림자의 동시 사용.

**Key Characteristics:**
- 회백색 바탕(`ground`) 위 흰 카드(`panel`) 14px, 테두리 없이 `shadow-panel` 하나
- 카드 안 목록은 1px `border` 구분선, 첫 행은 선 없음
- 밑줄 탭(딥 블루 2px), 알약 날짜 칩(선택 = 잉크 채움 흰 글자), 12px 모서리 버튼·입력
- Noto Sans KR 한 가족, 400/500/700 굵기 위계, 제목 -0.02em·본문 -0.01em, `tabular-nums`
- 색 = 의미: 딥 블루=주 동작·현재 선택·순번, 라벤더=숙소, 버터=미확인만, 로즈=충돌·오류만, 민트=완료
- 24×24 뷰박스 위 2px 둥근 선 SVG 아이콘 한 세트, 이모지 없음
- 미확인·미정·충돌은 숨기지 않고 칩·알림·인셋 선으로 드러낸다

## Colors

따뜻한 회백색 중립 위에 딥 블루 하나를 강조로 두고, 나머지 네 색상군(라벤더·버터·로즈·민트)은 각각 잉크(글자)·틴트(배경) 두 단계로만 존재하는 의미색이다.

### Primary
현재 상단 로고는 필기체 T 심볼(`app/public/brand/triplo-symbol.svg`, `currentColor` 24~26px) 하나다. ‘트립플로’ 글자는 상단 바에 표시하지 않는다. 화면 제목이 상단 바 가운데에 들어가므로 워드마크까지 두면 중복이다. 아래의 과거 브랜드 점·16px 브랜드 글자 설명보다 이 규칙이 우선한다. 링크의 최소 조작 영역은 44×44px이며 브라우저 탭은 같은 파랑 배경의 흰 T를 사용한다.

**Gradient Rule (2026-09-10 개정).** 그라데이션은 두 곳에만 쓴다. 그 밖의 버튼·칩·카드·로고·파비콘은 단색이다.

1. **선택된 날짜 칩** (`--selected-fill`, 잉크 `#16181d` → 네이비 `#2a3b63`, 135도). 화면당 하나만 선택되는 큰 요소라 미묘한 깊이가 도움이 된다. 종류 토글처럼 작은 세그먼트가 여러 개 붙는 자리는 단색 `ink`로 채운다. 여러 개가 동시에 그라데이션이면 산만해진다.
2. **AI 만들기 진입 버튼** (`--ai-fill`, `#3b6fef` → `#6d4fd6`, 135도. hover는 `--ai-fill-hover`). ‘AI가 만들어 준다’는 특별함을 나타내는 진입점 하나뿐이다. 저장·추가 같은 일반 주 동작 버튼은 `accent-deep` 단색을 유지한다.

여행 헤더 전체 배경과 로고 워드마크에 그라데이션을 시험했다가 과하다고 판단해 취소한 이력이 있다. 넓은 면적과 브랜드 자산에는 쓰지 않는다.
- **진한 딥 블루** (`accent-deep`): 주 동작 버튼 채움, 링크 글자, 활성 탭 밑줄(2px), 상단 바 브랜드 점(10px), 일차 배지(40px)·장소 순번 배지(28px)·지도 마커(28px) 채움, 포커스 링(2px outline), 캐럿, 체크박스 `accent-color`, 지도 스피너 머리, 범례의 안내선 점선. 주 동작과 현재 위치·순번 외에는 쓰지 않는다.
- **진한 딥 블루 호버** (`accent-deep-hover`): 주 동작 버튼의 hover 채움 전용.
- **딥 블루 틴트** (`accent-tint`): 선택된 일정 행 배경, 순서 변경 직후 400ms 동안 켜지는 행 배경, ‘기기에 저장됨’ 칩 배경, 빈 상태 아이콘 원, 하루 합계 ‘체류’ 칩 배경. 딥 블루의 가장 약한 목소리다.
- **딥 블루 채움** (`accent-fill`): 텍스트 선택(`::selection`) 배경 한 곳뿐이다.
- **장소 잉크·틴트** (`place-ink` / `place-tint`): 종류 칩(장소·식사·휴식·여유), 지역 이동 칩, 하루 합계 체류 칩. 틴트는 `accent-tint`와 같은 값이며 글자만 더 어둡다. 장소·활동 외의 항목에 쓰지 않는다.

### Secondary
- **라벤더 (숙소)** (`stay-ink` / `stay-tint`): 숙소 칩, 체크인·체크아웃·연박 칩, 숙소 카드의 36px 침대 배지, 숙소 탭의 N박 번호 글자, 지도의 ‘숙’ 마커 채움. 숙소 외의 항목에 라벤더를 쓰지 않는다.

### Tertiary (상태색)
- **버터 (확인 필요·미확인)** (`warn-ink` / `warn-tint`): ‘위치 미확인’·‘숙소 미정’·‘시각 미정’ 칩, 지도 범례의 ‘지도에 없음 n개’ 칩, 영향·건너뜀 안내 알림, 힌트 안의 경고 아이콘, 주소 복사 대체 안내 글자. 확인되지 않은 것 외에는 노랑을 쓰지 않는다.
- **로즈 (충돌·오류)** (`danger-ink` / `danger-tint`): 고정 시각 충돌·숙박 중복 칩, 충돌 행의 왼쪽 3px 인셋 선, 저장 실패·검색 실패·찾을 수 없음 알림, 잘못된 입력 테두리, 지도 오류 상태의 1px 윤곽과 아이콘, 삭제·다시 저장 버튼 글자. 충돌·오류·되돌릴 수 없는 동작 외에는 로즈를 쓰지 않는다.
- **민트 (완료)** (`ok-ink` / `ok-tint`): ‘위치 확인됨’ 칩과 ‘숙박이 필요 없는 여행’ 알림. 강조색이 아니라 완료 확인 표시로만 존재한다.

### Neutral
- **회백색 바탕** (`ground`): 페이지 바탕, `theme-color`.
- **진한 회백색** (`ground-2`): 지도 캔버스·로딩 오버레이 바탕, 활동(식사·휴식·여유) 순번 배지와 제외된 항목 배지, 고스트 버튼 hover, 버튼 active, 입력 포커스 링(3px), 주소 복사 대체 텍스트 배경.
- **흰 판** (`panel`): 카드, 상단 바, 하단 동작 바(92% + blur), 버튼, 입력, 날짜 칩, 고스트 칩 배경.
- **연한 판** (`panel-2`): 버튼 hover 배경, 장소 검색 상자와 지도 안내 오버레이 배경, 지역 변경 구간 칩, 검색 결과 행 hover.
- **잉크** (`ink`): 본문·제목, 선택된 날짜 칩·종류 토글의 채움, 건너뛰기 링크 배경, 입력 포커스 테두리. **잉크 2** (`ink-2`): 기간·부제·지역 순서·비활성 탭·날짜 칩 글자·메모·범례. **잉크 3** (`ink-3`): 힌트·플레이스홀더·요약(`muted`)·고스트 칩 글자·이동 구간 문구·안내 오버레이 아이콘, 버튼·입력 hover 테두리.
- **연한 선** (`border`): 상단 바·하단 바·탭 트랙의 1px 선, 카드 안 목록 구분선, 아이콘 버튼·고스트 칩·중첩 행·검색 상자 테두리. **진한 선** (`border-strong`): 버튼·입력·날짜 칩·종류 토글 테두리, 이동 구간 점선, 머리글 지역 연결선(1.5px), 링크 카드 hover 테두리, 스크롤바.
- **흰 글자** (`on-accent`): `accent-deep`·`stay-ink`·`ink` 채움 위의 글자 전용.

### Named Rules
**The One Meaning Rule.** 색상군 하나는 뜻 하나에만 묶인다. 딥 블루는 주 동작·현재 선택·순번, 라벤더는 숙소, 버터는 확인되지 않음, 로즈는 충돌·오류, 민트는 완료. 새 화면에서 색이 필요하면 뜻을 먼저 정하고 그 뜻의 색을 쓴다. 뜻이 없는 색은 쓰지 않는다.

**The Single Accent Rule.** 강조색은 딥 블루 하나다. 코랄과 민트를 강조·선택·동작·링크색으로 쓰지 않는다. 민트는 완료 확인 틴트로만, 라벤더는 숙소 표시로만 존재한다.

**The Ink Selection Rule.** 현재 선택된 세그먼트(날짜 칩, 종류 토글)는 딥 블루가 아니라 잉크(`ink`) 채움 + 흰 글자다. 딥 블루는 순번·주 동작·밑줄에 남겨 두어 한 화면에서 딥 블루가 두 가지 뜻을 갖지 않게 한다.

## Typography

**Display Font:** Noto Sans KR (fallback Pretendard, Apple SD Gothic Neo, Malgun Gothic)
**Body Font:** Noto Sans KR 400 / 500 / 700 (Google Fonts, 같은 가족)

**Character:** 서체는 한 가족뿐이고 위계는 굵기(400 본문, 500 버튼·칩·탭, 700 제목·라벨·선택)와 크기, 잉크 3단계 명도로만 만든다. 제목은 -0.02em, 본문은 -0.01em으로 살짝 조인다. 숫자는 `tabular-nums`로 시각·분·순번이 줄 맞춰 선다. 표시용 서체는 없다.

### Hierarchy
- **Headline** (700, 28px, 1.25, -0.02em): 페이지 `h1`. 여행 상세 머리글의 여행 이름, 목록·폼 페이지 제목.
- **Title** (700, 22px, 1.3, -0.02em): 전역 `h2` 기본값. 실제로 카드 안 `h2`는 18px(Title-card), 빈 상태 `h2`는 16px로 내려 쓴다.
- **Title-card** (700, 18px, 1.3): 여행 목록 카드의 여행 이름.
- **Subtitle** (700, 16px, 1.4): `h3` 섹션 제목, 전체 보기 일차 배지 숫자, 상단 바 브랜드 글자, 빈 상태 제목.
- **Body** (400, 15px, 1.55, -0.01em): 본문 기본값, 버튼 글자(500/700), 탭 글자(500, 활성 700), 일정 항목 제목(700), 하루 합계 라벨(700), 안내 오버레이 강조.
- **Body-sm** (400, 14px, 1.55): 머리글 기간·지역 순서(500), 폼 라벨(700), 알림 본문, 작은 버튼(500), 종류 토글(500, 선택 700), 날짜 칩의 ‘N일차’(700), 숙소 N박 번호(700).
- **Label** (400, 13px): 힌트·오류 문구(500)·요약(`small`), 순번 배지·지도 마커 숫자(700).
- **Caption** (500, 12px, 1.4): 상태 칩 글자, 날짜 칩의 날짜 줄(400), 이동 구간 문구, 지도 마커 ‘숙’(700).

### Named Rules
**The One Family Rule.** 서체는 Noto Sans KR 한 가족뿐이다. 표시용·손글씨·라운드 서체를 제목이나 배지에 끌어오지 않는다. 위계가 부족하면 굵기 한 단계(400→500→700) 또는 잉크 한 단계(`ink-3`→`ink-2`→`ink`)를 올린다.

**The No-Tracking Rule.** 자간 확대·대문자 변환·영문 부제목·킥커(작은 윗머리 라벨)를 쓰지 않는다. 한글 라벨은 한 줄이고, 자간은 제목 -0.02em과 본문 -0.01em 두 값뿐이다.

## Layout

콘텐츠는 한 열, 최대 폭 960px(`--content-max`) 가운데 정렬. 페이지 안쪽 여백은 360px에서 16px, 720px 이상에서 24px이며 하단은 고정 동작 바를 위해 `32px + 88px`을 비운다. 상단 바는 흰 판에 1px 아랫선, 안쪽 여백 `10px 16px`, 왼쪽에 10px 딥 블루 점 + 16px 700 ‘트립플로’, 오른쪽에 고스트 칩. 머리글(`hero`)은 판 없이 바탕 위에 여백(상하 8px)만으로 선다.

세로 리듬은 `stack`(16px) 하나로 통일하고, 카드 안은 3~8px의 짧은 간격으로 항목을 뭉친다. 가로 배치는 `row`(8px, 줄바꿈 허용)이며 칩 무리는 4~6px로 더 좁게 붙인다. 폼의 두 칸 행(`field-row`)은 420px 이하에서 한 칸으로, 종류 토글은 4열에서 2열로 접힌다. 필드 사이는 20px, 라벨-입력 6px.

전체 보기 카드는 `40px 1fr` 격자(720px 이상에서 `40px 1fr auto`, 숙박 칩이 오른쪽 열 최대 260px로 이동). 날짜별 보기는 360px에서 날짜 칩이 가로 스크롤 줄(6px 간격, `scroll-snap-type: x proximity`), 900px 이상에서 `180px 1fr` 격자로 바뀌고 날짜 칩 열이 `top: 16px`에 sticky로 고정되며 칩은 왼쪽 정렬 12px 모서리 사각으로 바뀐다. 지도 카드는 280px, 900px 이상에서 380px. 일정 항목은 `28px 1fr` 격자, 720px 이상에서 `28px 1fr auto`로 동작 버튼 무리가 오른쪽 열로 이동한다. 숙소 카드는 `36px 1fr auto`, 숙박 행은 `40px 76px 1fr`.

## Elevation & Depth

그림자 기반이되 아주 얕다. 카드는 테두리 없이 잉크색 계열의 두 겹 그림자(`shadow-panel`) 하나로 회백색 바탕에서 뜨고, hover에도 들리지 않는다. 카드 안의 깊이는 그림자가 아니라 1px 구분선과 `panel`→`panel-2`→`ground-2`의 톤 층으로 만든다. 테두리를 가진 요소(버튼·입력·날짜 칩·종류 토글·중첩 행·검색 상자)는 그림자를 갖지 않는다. 상태를 알릴 때만 선이 나타난다: 링크 카드 hover는 `border-strong` 1px, 선택된 숙소 카드는 `accent-deep` 1px, 충돌 행은 왼쪽 3px 로즈 인셋, 지도 오류는 로즈 1px 윤곽.

### Shadow Vocabulary
- **판 그림자** (`box-shadow: 0 1px 2px rgba(28, 25, 23, 0.05), 0 8px 24px -14px rgba(28, 25, 23, 0.14)`): 카드·판, 전체 보기 행, 일정 목록 카드, 지도 캔버스의 휴식 상태. 유일한 카드 그림자다.
- **떠오름 그림자** (`box-shadow: 0 2px 4px rgba(28, 25, 23, 0.06), 0 14px 32px -12px rgba(28, 25, 23, 0.2)`): 바탕 위에 떠 있는 요소용으로 정의되어 있으나 현재 화면에서는 쓰이는 곳이 없다. 새 팝오버·시트에만 쓴다.
- **마커 그림자** (`box-shadow: 0 2px 6px rgba(28, 25, 23, 0.28)`): 28px 지도 마커. 선택 시 `0 0 0 4px rgba(201, 69, 47, 0.22), 0 4px 10px rgba(28, 25, 23, 0.3)`과 1.2배 확대.
- **포커스 링**: 입력은 `ink` 테두리 + `0 0 0 3px var(--ground-2)`. 그 밖의 요소는 `outline: 2px solid var(--accent-deep)`, offset 2px, 8px 모서리.

### Named Rules
**The Shadow-Not-Border Rule.** 흰 카드에는 그림자만 있고 휴식 상태 테두리는 투명이다. 카드에 선이 보이는 경우는 hover(`border-strong`), 선택(`accent-deep`), 충돌(로즈 인셋), 지도 오류(로즈 윤곽) 네 가지뿐이며 이때도 그림자는 그대로다. 반대로 테두리가 있는 컨트롤은 그림자를 갖지 않는다.

**The Separator-Inside Rule.** 한 카드 안에 여러 항목이 있으면 항목마다 카드를 만들지 않는다. 카드 하나 안에서 1px `border` 윗선으로 나누고 첫 행은 선을 없앤다. 이동 구간 행도 같은 선으로 나눈다.

**The Settle Rule.** 순서 변경으로 옮겨진 행은 배경이 `accent-tint`로 켜졌다가 400ms `ease-out`에 `panel`로 꺼진다. 모션 감소 설정에서는 애니메이션 없이 틴트만 남긴다. 상태 전이는 모두 160ms `cubic-bezier(0.16, 1, 0.3, 1)`.

## Shapes

모서리 언어는 다섯 단계다. 카드·판·지도 캔버스·전체 보기 행은 14px(`panel`), 버튼·입력·알림·중첩 행·검색 상자·종류 토글·데스크톱 날짜 칩은 12px(`control`), 작은 버튼과 아이콘 버튼은 10px(`button-sm`), 상태 칩과 포커스 링·브랜드 링크·주소 복사 상자는 8px(`cell`), 모바일 날짜 칩만 알약(`pill`)이다. 순번·일차·숙소 배지와 지도 마커, 브랜드 점, 빈 상태 아이콘 원은 완전한 원(`circle`, 40/36/28/18/10px). 직각 모서리는 없다.

선은 얇고 중립적이다. 버튼·입력·날짜 칩·종류 토글은 1px `border-strong`, 아이콘 버튼·중첩 행·고스트 칩은 1px `border`. 점선은 ‘사이’와 ‘안내’를 뜻한다: 이동 구간 세로선은 2px dashed `border-strong`(18px), 지도의 방문 순서 안내선은 3px dashed `accent-deep` 70%이며 경로가 아니다. 머리글의 지역 연결선은 1.5px 실선 `border-strong` 14px. 아이콘은 24 뷰박스 위 2px 둥근 선(round cap/join) 한 세트이며 기본 18px, 칩 안 12~14px, 버튼 안 14~16px, 지도 안내 22px, 빈 상태 36px.

## Components

### Buttons
흰 12px 사각 버튼이 기본이고, 진한 딥 블루 채움 하나만 화면에서 무겁다.
- **Shape:** 12px 모서리, 최소 높이 44px, 좌우 16px, 15px 500, 아이콘 간격 6px.
- **Primary:** `accent-deep` 채움 + 흰 700 글자, hover `accent-deep-hover`. 저장, 첫 여행 만들기, 하단 바의 장소·숙소 추가.
- **Secondary(기본):** 흰 판 + 1px `border-strong`. hover `panel-2` 배경 + `ink-3` 테두리, active `ground-2`. disabled 40% 불투명.
- **On-hero:** 흰 판 + 1px `border`, hover `ink-3` 테두리. 판 없는 머리글 위의 새 여행·편집.
- **Ghost:** 투명, 높이 40px, 좌우 12px, `ink-2` 글자. hover `ground-2` + `ink`. 취소·위치 지우기·지도 링크·주소 복사.
- **Danger:** 흰 판 + `border-strong` + 로즈 글자, hover 로즈 틴트 + 로즈 테두리. 삭제·다시 저장·다시 검색.
- **Small:** 높이 36px, 좌우 12px, 14px 글자, 10px 모서리. **Icon:** 40×40, 10px 모서리, 1px `border`, hover `ink-3` 테두리. 뒤로·위로·아래로·편집·제외·복원.

### Chips (상태 칩)
정보의 뜻을 색으로 붙이는 8px 사각 칩. 이름표이지 버튼이 아니다.
- **Style:** 8px 모서리, 최소 높이 24px, `1px 8px`, 12px 500, 줄바꿈 없음, 아이콘 14px, 투명 1px 테두리.
- **틴트 칩:** accent(기기에 저장됨), place(종류·지역 이동·체류 합계), stay(숙소·체크인·체크아웃·연박), warn(미확인·미정·지도에 없음), danger(충돌·중복·저장 실패), ok(위치 확인됨·숙박 필요 없음).
- **고스트 칩:** 흰 판 + 1px `border` + `ink-3`. 저장 상태 기본값, 고정 시각(충돌 없을 때), 제외됨, 이동 구간 문구, 내부 알파 표시.
- **솔리드 칩:** `accent-deep` + 흰 700 글자. 폼의 지역 순번(26px 원).

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** 흰 판(`panel`). 중첩 컨테이너(장소 검색 상자, 지도 안내 오버레이)는 `panel-2` + 12px, 폼의 지역 행은 `panel` + 12px + 1px `border`.
- **Shadow Strategy:** `shadow-panel`만. hover 들림 없음.
- **Border:** 휴식 시 투명 1px. 링크 카드 hover `border-strong`, 선택된 숙소 카드 `accent-deep`.
- **Internal Padding:** 판 16px, 전체 보기 행 `14px 16px 14px 14px`, 일정 행 `14px 16px`, 빈 상태 20~24px.
- **목록 카드(`items`):** 여백 없는 흰 카드 하나에 행이 1px `border` 윗선으로 쌓인다(첫 행 선 없음, `overflow: hidden`). 선택된 행은 `accent-tint` 배경, 충돌 행은 왼쪽 3px 로즈 인셋, 제외된 행은 본문 50% 불투명 + `ground-2` 배지.
- **원형 배지:** 일차 배지 40px `accent-deep` + 흰 16px 700 숫자. 장소 순번 배지 28px `accent-deep` + 흰 13px 700(버튼, 누르면 지도 마커와 동기화). 식사·휴식·여유 배지 28px `ground-2` + `ink`. 위치 미확인 배지 55% 불투명. 숙소 배지 36px `stay-tint` + `stay-ink` 침대 아이콘.

### Inputs / Fields
- **Style:** 흰 판 + 1px `border-strong` + 12px 모서리, 최소 높이 48px, `11px 14px`. textarea 최소 96px 세로 리사이즈. select는 1.8px 잉크 선 화살표를 오른쪽 12px에 배경으로 넣고 오른쪽 여백 36px.
- **Label / Hint / Error:** 라벨 14px 700 잉크, 힌트 13px `ink-3`(경고 아이콘은 `warn-ink`), 오류 13px 500 로즈.
- **Hover / Focus:** hover `ink-3` 테두리. focus `ink` 테두리 + 3px `ground-2` 링, outline 없음.
- **Error:** `aria-invalid` 시 로즈 테두리.
- **Checkbox(영향 확인):** 12px 모서리 흰 상자 + 1px `border-strong`, 14px 500, 20px 체크박스 `accent-color: accent-deep`.
- **종류 세그먼트(라디오):** 4열 격자(420px 이하 2열), 6px 간격, 44px, 12px 모서리, 1px `border-strong`, 14px 500 `ink-2`. hover `ink-3` 테두리. 선택 시 `ink` 채움 + 흰 700 글자. 키보드 포커스는 2px 딥 블루 outline.

### Navigation
- **상단 바:** 흰 판 + 1px `border` 아랫선. 왼쪽 10px 딥 블루 점 + 16px 700 ‘트립플로’(-0.02em), 오른쪽 고스트 칩 ‘내부 알파 · 기기 저장’. 건너뛰기 링크는 잉크 채움 12px 모서리, 포커스 시 왼쪽 위 8px에 나타난다.
- **밑줄 탭:** 1px `border` 트랙 위에 균등 폭 탭 3개, 높이 44px, 15px 500 `ink-2`, hover `ink`. 활성 탭은 `ink` 700 + 아래 2px `accent-deep` 밑줄(트랙 선과 1px 겹침). 판·채움·알약 없음.
- **날짜 칩:** 알약, 최소 폭 72px, `7px 12px`, 1px `border-strong`, 흰 판, 가운데 정렬 14px 700 ‘N일차’ + 12px 400 날짜(85%). hover `ink-3` 테두리. 선택 시 `ink` 채움 + 흰 글자. 360px 가로 스크롤(6px 간격, snap), 900px 이상 세로 sticky 열에서 왼쪽 정렬 12px 사각으로 바뀐다.
- **뒤로 가기:** 40px 아이콘 버튼.

### Notices (알림 판)
12px 모서리, `12px 16px`, 14px, 아이콘 18px + 본문 10px 간격, 강조 700. warn(영향·건너뜀·미정·검색 미연결), danger(찾을 수 없음·저장 실패·검색 실패, `role="alert"`), ok(숙박 필요 없음). 알림 안의 동작은 8px 위 여백의 작은 버튼 행. 알림에는 테두리·그림자가 없다.

### Bottom Action Bar
화면 하단 고정, `panel` 92% + `backdrop-filter: blur(10px)`, 위 1px `border`, `12px 16px + safe-area`, z-index 10. 안쪽은 960px 가운데 정렬, 8px 간격의 버튼들이 균등 폭으로 늘어난다(딥 블루 [장소 추가] + 딥 블루 [숙소 추가], 폼에서는 [취소] + 딥 블루 [저장]). 페이지 하단 여백(88px + 32px)이 이 바를 위해 예약된다.

### Save Status
저장 상태를 칩 하나로 말한다. idle 고스트 ‘기기 저장본’, saving 고스트 ‘저장 중…’(`role="status"`), saved `accent` 틴트 칩 + 14px 체크 아이콘 + ‘기기에 저장됨 · HH:MM’, error 로즈 칩 ‘저장 실패 · 입력은 유지됨’ + 작은 danger 버튼 ‘다시 저장’(`role="alert"`). 머리글 오른쪽 위와 폼 동작 행에 놓인다.

### Place Search Box
`panel-2` + 1px `border` + 12px 모서리, 안쪽 12px, 8px 세로 간격의 중첩 상자. 첫 줄은 검색 입력(최소 160px, 늘어남) + 흰 [검색] 버튼(16px 돋보기). 상태 문구는 13px `ink-3`(`role="status"`): checking ‘검색 제공자 확인 중…’ / idle 제공자 안내 / searching ‘…에서 검색 중…’ / empty 결과 없음 안내. unavailable은 버터 알림(사유 + 직접 입력 안내), error는 로즈 알림 + 작은 danger [다시 검색]. results는 흰 판 + 1px `border` + 12px 목록(최대 280px 스크롤), 행은 `10px 12px`, 1px 구분선, 이름 700 + 13px `ink-3` 분류·주소, hover `panel-2`. 검색 입력·버튼은 checking·unavailable에서 비활성.

### Map Card
14px 모서리 `ground-2` 캔버스(280px, 900px 이상 380px) + `shadow-panel`, 아래 8px에 범례 한 줄. 상태는 같은 자리의 오버레이로 표현한다.
- **checking:** `ground-2` 오버레이 + 13px `ink-3` ‘지도 제공자 확인 중…’.
- **loading:** `ground-2` 오버레이 + 22px 스피너(3px `border` 링, 머리만 `accent-deep`, 800ms linear; 모션 감소 시 정지·회색) + 13px ‘… 불러오는 중…’.
- **unavailable:** `panel-2` 안내 오버레이, 22px `ink-3` 지도 아이콘 + 15px 700 ‘지도가 연결되지 않았습니다’ + 사유 + 키 파일 안내.
- **error:** `panel-2` 안내 오버레이에 `danger-ink` 1px 윤곽(outline, -1px), 22px 로즈 경고 아이콘 + 15px 700 ‘지도를 표시하지 못했습니다’ + 사유, `role="alert"`.
- **ready-empty:** 캔버스 위 `panel-2` 안내 ‘이 날 지도에 표시할 확인된 위치가 없습니다’ + 등록 안내.
- **범례:** 13px `ink-2`, 항목 간격 `6px 14px`. 18px 미니 마커 ‘1’ 방문 순서, 라벤더 미니 마커 ‘숙’ 숙소, 22px 3px dashed 딥 블루 70% 선 ‘방문 순서 안내선 · 경로 아님’, 미확인이 있으면 버터 칩 ‘지도에 없음 n개 · 위치 미확인’.

### Map Markers
28px 원, 2px 흰 테두리, `accent-deep` 채움 + 흰 13px 700 순번, `0 2px 6px rgba(28,25,23,0.28)` 그림자. 숙소는 `stay-ink` 채움 + 12px ‘숙’. 선택(`--on`)은 1.2배 확대 + 4px 딥 블루 22% 링 + 짙은 그림자, z-index 3이며 목록 행의 `accent-tint` 배경과 동기화된다. 범례용 미니 마커는 18px, 1.5px 테두리, 10px 글자, 그림자 없음. 마커를 잇는 점선은 방문 순서 안내선이지 경로가 아니다.

### Leg (이동 구간)
목록 카드 안의 한 행. 위 1px `border` 선, `4px 14px 4px 26px`, 2px dashed `border-strong` 세로선(18px) + 12px `ink-3` 문구 또는 고스트 칩(‘속초 → 강릉 이동 · 시간 미확인’). 지역이 바뀌는 구간은 `panel-2` 배경 + `border` 테두리 + `ink-2` 글자 칩.

## Do's and Don'ts

### Do:
- **Do** 카드는 흰 판(`panel`) + 14px + `shadow-panel`만으로 세우고, 휴식 상태 테두리는 투명으로 둔다.
- **Do** 한 카드 안의 여러 항목은 1px `border` 구분선으로 나누고 첫 행은 선을 없앤다. 항목마다 카드를 만들지 않는다.
- **Do** 버튼·입력·알림은 12px, 작은·아이콘 버튼은 10px, 상태 칩은 8px, 번호·마커 배지는 완전한 원(40/36/28px)으로 만든다.
- **Do** 현재 선택(날짜 칩·종류 토글)은 `ink` 채움 + 흰 글자로, 활성 탭은 `ink` 700 + 딥 블루 2px 밑줄로 표시한다.
- **Do** 미확인·미정은 버터 칩, 충돌·중복·오류는 로즈 칩·인셋 선·알림으로 드러낸다. 숨기지 않는다.
- **Do** 아이콘은 `app-icon` 세트(24 뷰박스, 2px 둥근 선 SVG)에서 고르고, 새 아이콘은 같은 선 굵기로 그린다.
- **Do** 서체는 Noto Sans KR 하나로, 위계는 400/500/700 굵기와 12~28px 크기, 잉크 3단계로만 만든다. 제목 -0.02em, 본문 -0.01em, `tabular-nums`.
- **Do** 포커스는 2px `accent-deep` outline(입력은 `ink` 테두리 + 3px `ground-2` 링)으로 보이게 하고, 모션 감소 설정에서는 애니메이션을 끄고 상태 색만 남긴다.
- **Do** 세로 간격은 `stack` 16px, 칩 무리는 4~6px, 페이지 안쪽 여백은 16/24px 단계를 지키고 하단 88px + 32px을 동작 바에 비운다.
- **Do** 지도 마커와 목록 순번 배지는 같은 숫자·같은 딥 블루로 대응시키고, 마커 사이 점선은 ‘방문 순서 안내선 · 경로 아님’으로 범례에 적는다.

### Don't:
- **Don't** 파랑·민트를 강조·선택·동작·링크색으로 쓰지 않는다. 민트는 완료 확인 틴트로만 존재한다.
- **Don't** 카드에 눈에 보이는 테두리와 그림자를 함께 두지 않는다. 카드에 선이 보이는 것은 hover·선택·충돌·지도 오류 네 상태뿐이다.
- **Don't** 버터를 ‘확인되지 않음’ 외의 뜻(강조·경고 일반·장식)에 쓰지 않는다.
- **Don't** 로즈를 충돌·오류·삭제 외의 뜻에 쓰지 않는다. 주의 환기용 빨강은 없다.
- **Don't** 라벤더를 숙소 외, 장소 틴트를 장소·활동 외의 항목에 쓰지 않는다.
- **Don't** 표시용·귀여운·손글씨 서체, 시스템 기본 서체 노출, 두 번째 서체 가족을 쓰지 않는다.
- **Don't** 이모지·유니코드 기호를 아이콘으로 쓰지 않는다.
- **Don't** 영문 부제목·자간 확대·대문자 변환·킥커(작은 윗머리 라벨)를 쓰지 않는다. 라벨은 한국어 한 줄이다.
- **Don't** 알약 모양을 버튼·칩·탭에 쓰지 않는다. 알약은 모바일 날짜 칩 하나뿐이다.
- **Don't** 지도의 점선을 경로나 이동시간으로 읽히게 하지 않는다. 미확인 이동시간은 ‘시간 미확인’으로 남긴다.
- **Don't** 머리글에 판·배경색·선을 두지 않는다. 머리글은 여백과 굵은 제목으로만 선다.
- **Don't** 직각 모서리, 하드 오프셋 그림자, hover 시 카드 들림을 쓰지 않는다.
