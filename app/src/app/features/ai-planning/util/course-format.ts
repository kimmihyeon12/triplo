import { wonRange } from '../../../shared/util/plan-estimate';
import type { CourseLeg } from './course';

/** 체류시간을 읽기 쉬운 말로 쓴다. 70 → '1시간 10분' */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`;
}

/**
 * 코스 카드의 첫 줄. '11:25 (1시간 10분)'. 분류는 배지가, 지역은 주소 줄이 이미 보여 주므로
 * 여기에 다시 쓰지 않는다(2026-09-30 사용자 지적: 같은 정보가 세 번 보였다).
 */
export function courseHeadline(start: string | null, stayMax: number | null): string {
  if (!stayMax) return start ?? '';
  return start ? `${start} (${formatDuration(stayMax)})` : `체류 ${formatDuration(stayMax)}`;
}

/** 카드 사이 이동 줄. 모델 추정에는 AI 추정 표시를 붙이고, 직선거리는 사실값이라 그대로 쓴다. */
export function legText(leg: CourseLeg): string | null {
  const parts = [
    leg.mode && leg.minutes ? `${leg.mode} 약 ${leg.minutes}분 · AI 추정` : null,
    leg.km !== null ? `직선 ${leg.km}km` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** 예산 − 예상 상한을 '여유 n원' 또는 '초과 n원'으로 쓴다. */
export function budgetGap(remaining: number): string {
  return `${remaining < 0 ? '초과' : '여유'} ${Math.abs(remaining).toLocaleString('ko-KR')}원`;
}

/**
 * 예산 묶음 한 칸. 금액이 있으면 금액을, 미정만 있으면 개수를, 항목이 없으면 '없음'을 쓴다.
 * 항목이 없는 칸을 '미정'으로 쓰면 아직 모르는 비용이 있는 것처럼 읽힌다.
 */
export function groupText(sum: { min: number; max: number; known: number; unknown: number }): string {
  const unknown = sum.unknown ? `미정 ${sum.unknown}곳` : '';
  if (!sum.known) return unknown || '없음';
  return [wonRange(sum), unknown].filter(Boolean).join(' · ');
}
