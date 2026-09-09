# 프로젝트 문서 안내

이 파일이 문서의 공통 목차다. 문서를 역할별로 묶어 찾고, 세부 내용은 각 원본에서 관리한다. 루트에는 에이전트 진입점과 공통 설계 원본을 유지한다. OpenSpec과 스킬이 사용하는 정해진 경로는 유지한다.

## 빠른 시작

1. 공통 작업 규칙: [AGENTS.md](../AGENTS.md)
2. 개발 범위·현재 단계·실행 순서: [DEVELOPMENT.md](DEVELOPMENT.md)
3. 구조·상태관리·기술 결정: [ARCHITECTURE.md](../ARCHITECTURE.md)
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
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Angular 21 목표, 폴더·의존성·상태 수명·공통 코드·비동기 처리 기준과 출처 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 개발 순서·연동 범위·검증 안내 |
| [HARNESS.md](HARNESS.md) | MCP·스킬·지도 등 도구 설정과 설치 기록 |
| [프로젝트 README](../README.md) | 앱 실행·테스트 명령 |
| [AGENTS.md](../AGENTS.md) / [CLAUDE.md](../CLAUDE.md) | 모든 에이전트의 공통 규칙 / Claude Code 진입점 |

## 제품·디자인 원본

- [PRODUCT.md](../PRODUCT.md): 제품·브랜드 방향.
- [DESIGN.md](../DESIGN.md): 제품의 시각 규칙과 디자인 토큰.
- 실제 화면별 계약은 `.impeccable/surfaces/`를 확인한다(프로젝트 루트 기준).

## 참고·분석 기록

- [트리플 맞춤 일정 분석](트리플-맞춤일정-분석.md)
- [TourJ·AI 입력 방식 검토](TourJ-참고와-AI-입력방식-검토.md)
- [디자인 비교 검토](디자인-비교-검토-2026-09-09.md)

참고 문서의 제안·과거 관찰은 현재 결정이나 구현 완료를 뜻하지 않는다. 원본 링크와 확인 범위를 유지하고, 채택한 결정만 기획·설계 원본에 반영한다.

## 수정 기준

- 최신 사용자 지시가 우선이다. 상충하는 현재 원본은 같은 작업에서 맞춘다. 과거 검증 기록은 당시 결과로 보존한다.
- 기능 변경은 기획안과 관련 OpenSpec을, 아키텍처 변경은 ARCHITECTURE.md와 관련 OpenSpec을 갱신한다. 개발 순서가 달라지면 DEVELOPMENT.md도 갱신한다.
- CLAUDE.md에는 원본 경로와 진입 지침만 둔다. 별도 인수인계 문서는 만들지 않는다. 경로가 바뀌면 이 목차와 모든 참조를 함께 수정한다.
- 각 기능 작업에는 필요한 문서를 골라 읽는다. 분석 기록·도구 설치 이력 전체를 매번 필수 입력으로 넣지 않는다.
- MD 파일 간 동기화는 자동이 아니다. 작업하는 에이전트가 직접 관련 원본을 수정하고 링크·명세를 검증한다.
