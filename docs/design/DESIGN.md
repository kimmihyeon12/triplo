---
name: 트립플로 디자인 시스템
description: Pretendard·딥 블루·중성 배경을 사용하는 모바일 우선 여행 편집 UI.
---

# 트립플로 디자인 시스템

제품 방향은 [PRODUCT.md](PRODUCT.md), 구조·코드 규칙은 [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)를 따른다. 이 문서는 현재 UI의 사용 규칙을 관리한다. 색상·크기 값을 중복 선언하지 않고 [theme.css](../../app/src/styles/theme.css)를 실행 원본으로 사용한다. 실제 예제는 [실험실](http://localhost:4200/lab)에서 확인한다.

## 시각 방향

밝은 중성 배경 위 흰 카드, 명확한 텍스트 위계, 딥 블루 주 동작을 사용한다. 제목과 본문은 Pretendard 한 가족이며 숫자는 tabular-nums로 정렬한다. 상단에는 화면 제목을 표시하고 홈 링크에는 T 심볼을 사용한다. 뒤로 이동이 필요한 화면은 뒤로 가기 버튼을 표시한다.

카드에는 `rounded-panel`과 `shadow-panel`을 사용하고 내부 목록은 `border-border` 구분선으로 나눈다. 카드 테두리와 그림자를 불필요하게 겹치지 않는다. 이모지·스티커·장식용 서체를 제품 조작 요소로 쓰지 않는다.

## 토큰 사용

| 역할 | Tailwind 토큰·규칙 |
| --- | --- |
| 배경 | `bg-ground`, `bg-ground-2`, `bg-panel`, `bg-panel-2` |
| 텍스트 | `text-ink` 본문·제목, `text-ink-2` 보조, `text-ink-3` 힌트 |
| 주 동작·현재 선택 | `accent-deep`, `accent-deep-hover`, `accent-tint` |
| 숙소 | `stay-ink`, `stay-tint` |
| 미확인·주의 | `warn-ink`, `warn-tint` |
| 오류·충돌 | `danger-ink`, `danger-tint` |
| 완료 | `ok-ink`, `ok-tint` |
| 간격 | 기본 단위 4px. 화면 여백 16px, 넓은 화면 24px |
| 모서리 | panel 16px, control-lg 12px, control 10px, cell 8px |
| 서체 | `font-body`, `text-12`~`text-34`. 기본 본문 15px, 필드 라벨·안내 13px, 주요 화면 제목 22px |
| 반응형 | sm 420px, md 720px, lg 960px. 일반 콘텐츠 최대 960px, 인증 폼 최대 420px |

색만으로 상태를 구분하지 않고 텍스트·아이콘을 함께 사용한다. 숙소색·주의색·완료색을 일반 강조색으로 돌려 쓰지 않는다. 소셜 로그인은 해당 제공자의 브랜드 토큰을 사용한다.

그라데이션은 선택 날짜의 `--selected-fill`과 AI 만들기 진입의 `--ai-fill`에 한정한다. 일반 저장·추가 버튼은 단색이다. 광범위한 헤더·카드·브랜드 배경에 그라데이션을 확대하지 않는다.

## 구현 위치

- [styles.css](../../app/src/styles.css): Tailwind·기반 스타일의 진입점.
- [theme.css](../../app/src/styles/theme.css): 색상·서체·간격·모서리·그림자 토큰.
- [base.css](../../app/src/styles/base.css): 문서 기본값·리셋·기본 포커스.
- [effects.css](../../app/src/styles/effects.css): 키프레임과 모션 감소 처리.
- `app/src/app/shared/ui/<이름>/`: 공통 컴포넌트의 HTML·TS와 필요 시 `.styles.ts` 클래스 모음.
- [map-marker-styles.ts](../../app/src/app/features/places/util/map-marker-styles.ts): 지도 SDK가 생성하는 DOM의 Tailwind 클래스.

화면 스타일은 HTML Tailwind 유틸리티로 작성한다. 화면별 CSS 파일이나 인라인 `template`·`styles`는 사용하지 않는다. 공통 호스트 클래스 모음은 정적으로 작성해 Tailwind가 탐색할 수 있게 하며 `String.raw` 모음은 컴포넌트 속성의 `[class]` 바인딩으로 적용한다. Angular가 정적으로 해석해야 하는 `host.class`에 함수 호출 결과를 넣지 않는다.

Tailwind 권장 클래스 표기를 사용한다. 예를 들어 `[.notice_&]:font-bold`는 `in-[.notice]:font-bold`, `[top:0]`은 `top-0`, `[max-width:var(--content-max)]`는 `max-w-(--content-max)`로 작성한다. 권장 표기 경고를 설정으로 숨기지 않으며 불필요하게 반복된 클래스는 제거한다.

## 공통 컴포넌트

Select는 공통 `appInput`으로 44px 높이·12px 모서리·14px 텍스트·여유 있는 오른쪽 공간과 얇은 펼침 화살표를 사용한다. 네이티브 선택/키보드 조작을 유지하고 비활성·포커스 상태를 구분한다. 장소 검색 버튼은 돋보기 장식 없이 `검색` 텍스트로 통일하며 처리 중에는 버튼 안 스피너를 사용한다.

페이지 이동 로딩은 본문에 공간을 추가하지 않는다. 200ms 이상 지연될 때만 중앙의 작은 고정 로딩 표시를 겹쳐 띄우며 이동 완료·취소·실패 시 제거한다. 짧은 이동에는 표시하지 않고 기존 화면의 배치와 조작을 유지한다.

뒤로가기 `〈`가 있는 화면은 상단 제목을 왼쪽 정렬한다. 공통 상단 바의 44px 뒤로가기 영역 다음 4px 간격에서 제목을 시작하며 여행 상세도 같은 위치를 사용한다. 긴 제목은 말줄임하고 오른쪽 동작 영역을 침범하지 않는다.

| 구성요소 | 사용 방식 | 계약 |
| --- | --- | --- |
| 버튼 | `button[appButton]`, `a[appButton]` | default/primary/ghost/danger/icon. disabled/loading이면 실행과 라우팅을 차단. 네이티브 폼·링크 의미 유지 |
| 입력 | `input[appInput]`, `select[appInput]`, `textarea[appInput]` | 네이티브 Forms·label 유지. 입력·선택 높이 44px, 모서리 10px. textarea는 여러 줄 높이 |
| 필드 | `app-field` | label/inputId/hint. 입력 id를 inputId와 맞추고 힌트가 있으면 aria-describedby를 `<inputId>-hint`에 연결 |
| 배지 | `span[appBadge]` | accent/stay/warn/danger/ok/neutral. 상태 텍스트 필수 |
| 안내 | `div[appNotice]` | warn/danger/ok. 동적 오류 등 필요한 경우에만 소비자가 live region 지정 |
| 로딩 | `app-spinner` | 장식용. 독립 로딩은 부모 role=status와 접근성 이름, 버튼은 aria-busy 제공 |
| 오류 토스트 | `app-error-toast` | message/dismissed. 하단 중앙·안전 영역·role=alert·닫기 버튼. 자동 소멸하지 않음 |
| 하단 동작 바 | `div[appActionBar]` | 하단 고정·안전 영역. 내부 action-bar__inner에 주요 버튼 배치 |

새 UI는 공통 컴포넌트를 우선 사용한다. variant를 추가하면 제품 사용처와 실험실 예제를 함께 갱신한다. 실험실에만 쓰이는 모사 컴포넌트를 만들지 않는다.

## 상호작용과 접근성

- 버튼 로딩은 문구를 유지하고 내부 스피너·중복 실행 차단으로 표현한다. ‘화면으로 이동 중’ 같은 별도 문장을 추가하지 않는다.
- 스피너는 `animate-spin`과 `border-r-transparent`로 열린 테두리를 회전시킨다. border shorthand가 투명 부분을 덮지 않게 한다. 모션 감소 설정은 `motion-reduce:animate-none`으로 존중한다.
- 토스트는 짙은 배경·흰 본문·오류 아이콘을 사용하며 44px 닫기 영역을 확보한다. 모바일 하단 안전 영역을 반영한다.
- 작은 아이콘 버튼도 조작 영역은 최소 44px로 확보한다. 키보드 포커스를 숨기지 않는다.
- 지도 마커·순번·날짜 선택은 목록과 같은 상태를 표시한다. 방문 순서 안내선은 실제 경로로 설명하지 않는다.
- 미확인 위치·시각·숙소와 저장 오류는 숨기지 않는다. 오류 후 입력을 유지하고 재시도를 제공한다.
- 모바일 360px와 PC에서 가로 넘침·고정 버튼에 가려진 내용·키보드 조작을 확인한다.
