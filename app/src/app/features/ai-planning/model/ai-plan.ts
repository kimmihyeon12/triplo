/** 3단계 입력 → 조건 요약 → 샘플 결과 선택. */
export type Phase = 'step1' | 'step2' | 'step3' | 'summary' | 'result';

export interface SampleItem {
  readonly id: string;
  readonly day: number;
  readonly name: string;
  readonly kindLabel: string;
  readonly note: string;
  /** 좌표가 확인된 항목만 기본 선택 대상이다. */
  readonly verified: boolean;
}

/**
 * 샘플 결과. 실제 LLM 키가 없으므로 고정 목데이터다.
 * 화면에 '샘플 결과'로 명확히 라벨링하며 실제 연동으로 위장하지 않는다.
 */
export const SAMPLE_ITEMS: readonly SampleItem[] = [
  {
    id: 's1',
    day: 1,
    name: '안목해변 카페거리',
    kindLabel: '장소',
    note: '바다 옆 카페 거리',
    verified: true,
  },
  {
    id: 's2',
    day: 1,
    name: '초당순두부마을',
    kindLabel: '식사',
    note: '점심 후보',
    verified: true,
  },
  { id: 's3', day: 1, name: '오죽헌', kindLabel: '장소', note: '실내 위주', verified: true },
  {
    id: 's4',
    day: 2,
    name: '속초 중앙시장',
    kindLabel: '장소',
    note: '먹거리 골목',
    verified: true,
  },
  {
    id: 's5',
    day: 2,
    name: '설악산 케이블카',
    kindLabel: '장소',
    note: '기상에 따라 운휴',
    verified: true,
  },
  {
    id: 's6',
    day: 2,
    name: '이름 미확인 전망 카페',
    kindLabel: '장소',
    note: '위치 미확인 — 직접 확인 필요',
    verified: false,
  },
];

export const COMPANION = ['혼자', '친구', '연인', '가족'] as const;
export const PACE = ['여유롭게', '보통', '알차게'] as const;
export const TRANSPORT = ['자가용', '대중교통', '도보 중심'] as const;

export interface AiPlanSelection {
  readonly requestId: string;
  readonly regions: string[];
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly items: readonly SampleItem[];
}
