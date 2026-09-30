import { describe, expect, it } from 'vitest';
import { formatWon } from './won';

describe('formatWon', () => {
  it('세 자리마다 쉼표를 넣고 원을 붙인다', () => {
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(12000)).toBe('12,000원');
    expect(formatWon(1234567)).toBe('1,234,567원');
  });

  it('음수 잔액도 그대로 적는다', () => {
    expect(formatWon(-5000)).toBe('-5,000원');
  });
});
