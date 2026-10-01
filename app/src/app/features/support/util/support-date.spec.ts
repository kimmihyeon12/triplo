import { describe, expect, it } from 'vitest';
import { supportDay, supportTime } from './support-date';

describe('고객 지원 날짜 표기', () => {
  it('목록은 연·월·일을 같은 모양으로 보인다(기기 시간대 기준)', () => {
    const iso = new Date(2026, 9, 1, 23, 30).toISOString();
    expect(supportDay(iso)).toBe('2026.10.01');
  });
  it('상세는 날짜 뒤에 24시간 시각을 붙인다', () => {
    const iso = new Date(2026, 0, 5, 9, 7).toISOString();
    expect(supportTime(iso)).toBe('2026.01.05 09:07');
  });
});
