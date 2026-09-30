import { describe, expect, it } from 'vitest';
import { areaOf, budgetGap, courseHeadline, formatDuration, legText } from './course-format';

describe('코스 카드 문구', () => {
  it('체류시간을 시간·분으로 쓴다', () => {
    expect([formatDuration(45), formatDuration(70), formatDuration(120)]).toEqual(['45분', '1시간 10분', '2시간']);
  });
  it('카드 첫 줄은 비어 있는 값을 빼고 잇는다', () => {
    expect(courseHeadline('11:25', 70, '액티비티', '해운대구')).toBe('11:25 (1시간 10분) · 액티비티 · 해운대구');
    expect(courseHeadline(null, null, '관광', '')).toBe('관광');
    expect(courseHeadline(null, 60, '식사', '중구')).toBe('1시간 · 식사 · 중구');
  });
  it('이동 줄은 모델 추정과 직선거리를 구분한다', () => {
    expect(legText({ mode: '도보', minutes: 10, km: 0.8 })).toBe('도보 약 10분 · AI 추정 · 직선 0.8km');
    expect(legText({ mode: null, minutes: null, km: 2.4 })).toBe('직선 2.4km');
    expect(legText({ mode: null, minutes: null, km: null })).toBeNull();
  });
  it('주소에서 시·군·구를 뽑는다', () => {
    expect(areaOf('서울 종로구 사직로 161')).toBe('종로구');
    expect(areaOf('강원특별자치도 강릉시 창해로 14')).toBe('강릉시');
    expect(areaOf('')).toBe('');
  });
  it('예산 차이를 여유·초과로 쓴다', () => {
    expect(budgetGap(15000)).toBe('여유 15,000원');
    expect(budgetGap(-2500)).toBe('초과 2,500원');
    expect(budgetGap(0)).toBe('여유 0원');
  });
});
