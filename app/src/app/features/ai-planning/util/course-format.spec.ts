import { describe, expect, it } from 'vitest';
import { budgetGap, groupText, legText } from './course-format';

describe('코스 카드 문구', () => {
  it('이동 줄은 모델 추정과 직선거리를 구분한다', () => {
    expect(legText({ mode: '도보', minutes: 10, km: 0.8 })).toBe('도보 약 10분 · AI 추정 · 직선 0.8km');
    expect(legText({ mode: null, minutes: null, km: 2.4 })).toBe('직선 2.4km');
    expect(legText({ mode: null, minutes: null, km: null })).toBeNull();
  });
  it('예산 차이를 여유·초과로 쓴다', () => {
    expect(budgetGap(15000)).toBe('여유 15,000원');
    expect(budgetGap(-2500)).toBe('초과 2,500원');
    expect(budgetGap(0)).toBe('여유 0원');
  });
  it('예산 묶음은 금액·미정 개수·없음을 겹치지 않게 쓴다', () => {
    expect(groupText({ min: 3000, max: 5000, known: 1, unknown: 0 })).toBe('3,000~5,000원');
    expect(groupText({ min: 3000, max: 5000, known: 1, unknown: 2 })).toBe('3,000~5,000원 · 미정 2곳');
    expect(groupText({ min: 0, max: 0, known: 0, unknown: 1 })).toBe('미정 1곳');
    expect(groupText({ min: 0, max: 0, known: 0, unknown: 0 })).toBe('없음');
  });
});
