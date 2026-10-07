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
| [채팅 기록 서버 저장 설계](superpowers/specs/2026-10-07-chat-history-server-design.md) | AI 대화를 본인만 보는 서버 기록으로 옮기는 표·함수·기기 기록 이전 결정 |
| [관리자 권한 설계](superpowers/specs/2026-09-29-admin-access-design.md) | 관리자 판별 방식·`/admin` 진입 범위와 근거. 요구사항은 기획안 36절에 있다 |
| [공지·문의 관리 설계](superpowers/specs/2026-10-01-support-admin-design.md) | 공지·문의 서버 저장과 관리자 공지·문의 관리 화면의 결정과 근거 |
| [AI 답변 품질 개선 설계](superpowers/specs/2026-10-01-chat-grounded-places-design.md) | 일정 짜기·챗봇이 실제 장소 후보 위에서 정해진 일만 하게 하는 설계와 프롬프트 초안. [OpenSpec](../openspec/changes/ground-ai-places/proposal.md) |
| [프로젝트 README](../README.md) | 앱 실행·테스트 명령 |
| [AGENTS.md](../AGENTS.md) / [CLAUDE.md](../CLAUDE.md) | 모든 에이전트의 공통 규칙 / Claude Code 진입점 |

## 제품·디자인 원본

- [PRODUCT.md](design/PRODUCT.md): 제품·브랜드 방향.
- [DESIGN.md](design/DESIGN.md): 현재 Tailwind 토큰 원본·공통 UI 계약·스피너·접근성 기준. 실제 예제는 [실험실](http://localhost:4200/lab).
- 실제 화면별 계약은 `.impeccable/surfaces/`를 확인한다(프로젝트 루트 기준).

## 참고·분석 기록

- [디자인 개선 필요 사항](design/DESIGN-IMPROVEMENTS.md): 2026-10-02 화면 비평 결과, 우선순위별 개선 목록. 미구현 문서.
- [아키텍처 최신성 점검 및 리팩터링 제안](architecture/REFACTORING-PROPOSAL.md): 2026-09-30 코드 대조 결과와 상태관리·중복 UI·조회 개선 제안. 미채택·미구현 문서.
- [통합된 화면 결정](기획안-v0.1.md): 31절에 구형 화면 설계·계획과 비교 자료의 고유 요구를 보존했다.

2026-09-15 사용자 결정으로 외부 서비스(트리플) 참조를 중단했다. 분석 문서와 비교 캡처를 제거했으며, 거기서 비롯된 우리 제품의 결정(단계형 조건 입력, 결과 기본 전체 선택 후 개별 해제·선택 항목만 담기)은 기획안 25절에 우리 기준으로 남아 있다.

이미 대체된 설정·경로·중복 설명은 원본에서 제거한다. 필요한 미구현 요구와 검증 기록은 유지한다. 참고 문서의 제안·과거 관찰은 현재 결정이나 구현 완료를 뜻하지 않는다. 원본 링크와 확인 범위를 유지하고, 채택한 결정만 기획·설계 원본에 반영한다.

## 수정 기준

2026-09-30 최신성 점검: 아키텍처·개발 안내·제품/디자인 기준·기획안·DB/연동 안내와 MVP OpenSpec의 현재 설명을 코드에 맞췄다. README와 AI-PLANNING의 기존 연결·배포 기록은 당시 근거로 유지한다. 날짜가 있는 과거 계획·검증 및 보관된 설계 문서는 현재 구현 완료 선언이 아니다. 원격 적용 상태와 외부 서비스 정책은 이번 작업에서 재검증하지 않았다.

- 최신 사용자 지시가 우선이다. 상충하는 현재 원본은 같은 작업에서 맞춘다. 과거 검증 기록은 당시 결과로 보존한다.
- 기능 변경은 기획안과 관련 OpenSpec을, 아키텍처 변경은 ARCHITECTURE.md와 관련 OpenSpec을 갱신한다. 개발 순서가 달라지면 DEVELOPMENT.md도 갱신한다.
- CLAUDE.md에는 원본 경로와 진입 지침만 둔다. 별도 인수인계 문서는 만들지 않는다. 경로가 바뀌면 이 목차와 모든 참조를 함께 수정한다.
- 각 기능 작업에는 필요한 문서를 골라 읽는다. 분석 기록·도구 설치 이력 전체를 매번 필수 입력으로 넣지 않는다.
- MD 파일 간 동기화는 자동이 아니다. 작업하는 에이전트가 직접 관련 원본을 수정하고 링크·명세를 검증한다.

## 화면 테마·알림

- [다크 모드](../openspec/changes/add-dark-mode/proposal.md): 설정에서 켜고 끄는 그래파이트 다크 테마. 기획안 43절, DESIGN.md '다크 모드'.
- [알림 내역](../openspec/changes/add-notification-inbox/proposal.md): 내 정보 > 소식에서 지난 30일 알림 보기. 기획안 44절.

## 장소 담기

- [큰 지도에서 주변 장소 골라 담기](../openspec/changes/add-map-explore/proposal.md): 분류 핀·다시 찾기·정보판에서 담기. [설계](superpowers/specs/2026-10-01-map-explore-design.md).
- [지도 링크로 장소 담기](../openspec/changes/add-place-link-import/proposal.md): 네이버·카카오 링크를 붙여 넣어 장소를 담는 흐름과 서버 함수 `resolve-place`의 요청 제한. [설계](superpowers/specs/2026-10-01-place-link-import-design.md).

## 가계부

- [사진으로 지출 입력·정산 복사](../openspec/changes/add-receipt-scan/proposal.md): 영수증 인식 흐름, 형광펜 범위 지정, 확인 후 저장 규칙.

## 챗봇 캐릭터

- [펭귄 적용 변경](../openspec/changes/replace-bami-with-penguin/proposal.md): 전체 앱 비교 시안에서 승인된 펭귄을 적용한다. 현재 색상과 버튼 크기를 유지한다. [검증 기록](../openspec/changes/replace-bami-with-penguin/tasks.md). 아래 밤이 자료는 이전 결정 및 탐색 이력이다.

- 캐릭터 후보 비교판(2026-10-06)은 펭귄을 채택한 뒤 지웠다. 결정과 근거는 [펭귄 적용 변경](../openspec/changes/replace-bami-with-penguin/proposal.md)에 있다.

- [밤이가 앞발을 걸친 진입 버튼](../openspec/changes/bami-peeking-chat-entry/proposal.md): 현재 버튼 색을 유지하고 진입 캐릭터만 변경한 후속 결정.

- [밤이 적용 변경](../openspec/changes/replace-cloud-with-bami/proposal.md): 2026-10-06 승인된 큰 얼굴·둥근 선·1번 콩눈으로 구름이를 교체한다. [검증 및 진행 기록](../openspec/changes/replace-cloud-with-bami/tasks.md).

- [실제 채팅 AI 연결](../openspec/changes/connect-chat-ai/proposal.md): 실행/테스트 제공자 분리, 인증·응답 검증 및 배포 상태.

- [AI 없는 채팅 명령 사용법](local-chat-commands.md): 일정 편집·조회·경비·되돌리기 명령과 지원 범위.

- [AI 없는 미배치 날짜 배정](../openspec/changes/local-chat-assignment/proposal.md): 날짜 해석·확인·되돌리기 및 검증 기록.
- [채팅 기록 서버 저장](../openspec/changes/store-chat-history/proposal.md): 본인만 보는 서버 대화 기록과 기기 기록 옮기기. [설계](superpowers/specs/2026-10-07-chat-history-server-design.md).

구름이 챗봇: [확정 시안과 적용 기록](design/references/cloud-chat-preview.md), [적용 OpenSpec](../openspec/changes/apply-cloud-chat-mascot/proposal.md). 미채택 캐릭터·생성 프롬프트 기록과 낡은 비교판은 정리했으며 최종 미리보기만 유지한다.


## 입체 기록 지도

- [별도 복셀 지도 제안·설계·검증](../openspec/changes/add-voxel-visit-map/proposal.md): `/stats`의 기본 3D 지도 및 `/stats/details`의 상세 통계. 구 실험 지도 라우트와 파일은 삭제.
- 현재 지도는 사용자 첨부 원본을 코드로 재현한다. 현재 기준에서 제외된 Higgsfield 생성 이미지·프롬프트 기록은 2026-09-22 미사용 파일 정리에서 삭제했다.

- [map2 방문 볼륨 구현 계획](superpowers/plans/2026-09-18-map2-visit-volume.md): 첨부 요청 적용 범위, 데이터 제약과 검증 순서.
- [map2 맞물리는 지형·장소 마커 구현 계획](superpowers/plans/2026-09-19-map2-fitted-terrain.md): 현재 지도 전용 범위, 저장 좌표와 임시 선택, 실제 브라우저 검증.
- 2026-09-21 지도·통계·배너·지역 배지 비교판 5개는 최종 선택이 코드와 DESIGN.md에 반영되어 2026-09-22 삭제했다. 최신 작업 중인 비교판과 실제 앱의 검증 자료는 유지한다.

2026-09-22 미사용 파일 정리: 참조 없는 기본 파비콘·옛 로고, 대체된 지도 이미지·생성 기록·비교판, 오래된 output 캡처·리포트 등 44개(4,678,683바이트)를 삭제했다. 삭제 경로의 현재 참조가 없음을 확인하고 앱 운영 빌드를 통과했다. 구름이 2장·현재 로그인/지도 아이콘·최신 시안과 검증 자료는 유지한다. 기존 번들 크기 및 LoginPage 미사용 import 경고는 남는다.

## 여행 자동생성

- [예산·요금 기준·추천 체류시간과 전체 지역 선택](ai-plan-estimates.md): 요청·응답 추가 항목, 일차별 목록, 추정과 실제 지출 구분, 검증·배포 상태.
- [관련 OpenSpec](../openspec/changes/add-ai-plan-estimates/proposal.md).
- [시간순 코스·분류 통일 OpenSpec](../openspec/changes/add-ai-course-plan/proposal.md), [설계](superpowers/specs/2026-09-30-ai-course-plan-design.md), [구현 계획](superpowers/plans/2026-09-30-ai-course-plan.md): 코스 카드·일곱 분류·가계부 분류 예산·숙소 숙박 담기.
