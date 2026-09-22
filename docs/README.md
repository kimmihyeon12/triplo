# 프로젝트 문서 안내

이 파일이 문서의 공통 목차다. 문서를 역할별로 묶어 찾고, 세부 내용은 각 원본에서 관리한다. 루트에는 AGENTS.md·CLAUDE.md·README.md 진입점만 두고 설계 원본은 docs/architecture/와 docs/design/에서 관리한다. OpenSpec과 스킬이 사용하는 정해진 경로는 유지한다.

## 빠른 시작

1. 공통 작업 규칙: [AGENTS.md](../AGENTS.md)
2. 개발 범위·현재 단계·실행 순서: [DEVELOPMENT.md](DEVELOPMENT.md)
3. 구조·상태관리·기술 결정: [ARCHITECTURE.md](architecture/ARCHITECTURE.md)
4. 이번 작업의 기획·명세·작업 현황: 아래 해당 문서

## 기획·요구사항

| 원본 | 담당 내용 |
| --- | --- |
| [기획안](기획안-v0.1.md) | 사용자 요구, 사용 흐름, 범위, 우선순위 |
| [내부 알파 화면 설계](알파-화면설계-v0.1.md) | 화면별 입력·저장·오류·검증 시나리오 |
| [OpenSpec 제안](../openspec/changes/plan-travel-companion-mvp/proposal.md) | 변경 목적·범위 |
| [OpenSpec 설계](../openspec/changes/plan-travel-companion-mvp/design.md) | 해당 변경의 설계 결정 |
| [OpenSpec 요구사항](../openspec/changes/plan-travel-companion-mvp/specs/travel-planning/spec.md) | 일정 기능의 검증 가능한 요구사항, 인접 specs 폴더에 경비·기록·캐릭터 명세 |
| [OpenSpec 작업 현황](../openspec/changes/plan-travel-companion-mvp/tasks.md) | 미완료·완료 작업과 검증 기준 |

## 개발·운영 기준

| 원본 | 담당 내용 |
| --- | --- |
| [ARCHITECTURE.md](architecture/ARCHITECTURE.md) | Angular 21·NgRx Signals·Zoneless 구현과 폴더·의존성·상태 수명·공통 코드·비동기 처리 기준과 출처 |
| [DATABASE.md](architecture/DATABASE.md) | 여행 표 구조·관계·접근 제어와 설계 결정. 원본 마이그레이션은 `supabase/migrations/` |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 개발 순서·연동 범위·검증 안내 |
| [HARNESS.md](HARNESS.md) | MCP·지도·Supabase 인증 설정과 개발 도구 안내 |
| [AI-PLANNING.md](AI-PLANNING.md) | AI 일정 만들기의 모델 선택 근거, 키 설정, 무료 한도, 실제 검증 기록 |
| [챗봇 설계](superpowers/specs/2026-09-17-travel-chat-design.md) | 대화형 여행 탐색 챗봇의 설계 결정과 근거. 요구사항은 기획안 35절과 OpenSpec에 있다 |
| [프로젝트 README](../README.md) | 앱 실행·테스트 명령 |
| [AGENTS.md](../AGENTS.md) / [CLAUDE.md](../CLAUDE.md) | 모든 에이전트의 공통 규칙 / Claude Code 진입점 |

## 제품·디자인 원본

- [PRODUCT.md](design/PRODUCT.md): 제품·브랜드 방향.
- [DESIGN.md](design/DESIGN.md): 현재 Tailwind 토큰 원본·공통 UI 계약·스피너·접근성 기준. 실제 예제는 [실험실](http://localhost:4200/lab).
- 실제 화면별 계약은 `.impeccable/surfaces/`를 확인한다(프로젝트 루트 기준).

## 참고·분석 기록

- [통합된 화면 결정](기획안-v0.1.md): 31절에 구형 화면 설계·계획과 비교 자료의 고유 요구를 보존했다.

2026-09-15 사용자 결정으로 외부 서비스(트리플) 참조를 중단했다. 분석 문서와 비교 캡처를 제거했으며, 거기서 비롯된 우리 제품의 결정(단계형 조건 입력, 결과 기본 전체 선택 후 개별 해제·선택 항목만 담기)은 기획안 25절에 우리 기준으로 남아 있다.

이미 대체된 설정·경로·중복 설명은 원본에서 제거한다. 필요한 미구현 요구와 검증 기록은 유지한다. 참고 문서의 제안·과거 관찰은 현재 결정이나 구현 완료를 뜻하지 않는다. 원본 링크와 확인 범위를 유지하고, 채택한 결정만 기획·설계 원본에 반영한다.

## 수정 기준

- 최신 사용자 지시가 우선이다. 상충하는 현재 원본은 같은 작업에서 맞춘다. 과거 검증 기록은 당시 결과로 보존한다.
- 기능 변경은 기획안과 관련 OpenSpec을, 아키텍처 변경은 ARCHITECTURE.md와 관련 OpenSpec을 갱신한다. 개발 순서가 달라지면 DEVELOPMENT.md도 갱신한다.
- CLAUDE.md에는 원본 경로와 진입 지침만 둔다. 별도 인수인계 문서는 만들지 않는다. 경로가 바뀌면 이 목차와 모든 참조를 함께 수정한다.
- 각 기능 작업에는 필요한 문서를 골라 읽는다. 분석 기록·도구 설치 이력 전체를 매번 필수 입력으로 넣지 않는다.
- MD 파일 간 동기화는 자동이 아니다. 작업하는 에이전트가 직접 관련 원본을 수정하고 링크·명세를 검증한다.

## 구름이 챗봇

구름이 챗봇: [확정 시안과 적용 기록](design/references/cloud-chat-preview.md), [적용 OpenSpec](../openspec/changes/apply-cloud-chat-mascot/proposal.md). 미채택 캐릭터·생성 프롬프트 기록과 낡은 비교판은 정리했으며 최종 미리보기만 유지한다.

## 입체 기록 지도

- [별도 복셀 지도 제안·설계·검증](../openspec/changes/add-voxel-visit-map/proposal.md): `/stats`의 기본 3D 지도 및 `/stats/details`의 상세 통계. 구 실험 지도 라우트와 파일은 삭제.
- [Higgsfield 지도 참고 이미지와 적용 기록](design/references/map2-higgsfield.md): 이전 시도 보관용. 현재 map2는 사용자 첨부 원본을 직접 코드로 재현하며 생성물은 디자인 기준이 아니다.

- [map2 방문 볼륨 구현 계획](superpowers/plans/2026-09-18-map2-visit-volume.md): 첨부 요청 적용 범위, 데이터 제약과 검증 순서.
- [map2 맞물리는 지형·장소 마커 구현 계획](superpowers/plans/2026-09-19-map2-fitted-terrain.md): 현재 지도 전용 범위, 저장 좌표와 임시 선택, 실제 브라우저 검증.
- 2026-09-21 비교 시안(`design/references/`의 `map-concepts` · `stats-entry-options` · `stats-banner-states` · `banner-thumb-options` · `region-badge-options`): 색·배치·배너 형태를 고르기 위해 만든 비교판이다. 고른 결과는 DESIGN.md와 코드에 반영했으며 이 파일들은 선택 근거 보관용이다. 여기 남은 다른 안은 현재 기준이 아니다.
