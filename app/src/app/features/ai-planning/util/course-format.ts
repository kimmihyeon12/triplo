import type { CourseLeg } from './course';

/** 체류시간을 읽기 쉬운 말로 쓴다. 70 → '1시간 10분' */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`;
}

/**
 * 코스 카드의 첫 줄. '11:25 (1시간 10분) · 액티비티 · 해운대구'.
 * 시각·체류·지역 중 미정인 값은 빼고 잇는다. 빈칸을 '미정'으로 채우면 줄이 길어져 읽기 어렵다.
 */
export function courseHeadline(start: string | null, stayMax: number | null, kindLabel: string, area: string): string {
  const stay = stayMax ? (start ? `(${formatDuration(stayMax)})` : formatDuration(stayMax)) : null;
  const time = [start, stay].filter(Boolean).join(' ');
  return [time, kindLabel, area].filter(Boolean).join(' · ');
}

/** 카드 사이 이동 줄. 모델 추정에는 AI 추정 표시를 붙이고, 직선거리는 사실값이라 그대로 쓴다. */
export function legText(leg: CourseLeg): string | null {
  const parts = [
    leg.mode && leg.minutes ? `${leg.mode} 약 ${leg.minutes}분 · AI 추정` : null,
    leg.km !== null ? `직선 ${leg.km}km` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** 확인된 주소에서 시·군·구를 뽑는다. 첫 토큰은 시·도라 건너뛴다. */
export function areaOf(address: string): string {
  return address.split(/\s+/).find((t, i) => i > 0 && /[시군구]$/.test(t)) ?? '';
}

/** 예산 − 예상 상한을 '여유 n원' 또는 '초과 n원'으로 쓴다. */
export function budgetGap(remaining: number): string {
  return `${remaining < 0 ? '초과' : '여유'} ${Math.abs(remaining).toLocaleString('ko-KR')}원`;
}
