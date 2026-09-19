import { describe, expect, it } from 'vitest';
import { monthlyVisits } from './monthly-visits';

describe('monthlyVisits', () => {
  it('fills missing months and keeps the selected year separate', () => {
    const months = monthlyVisits([{ visitedOn: '2025-01-01' }, { visitedOn: '2026-01-01' }, { visitedOn: '2026-01-02' }, { visitedOn: '2026-12-03' }], 2026);
    expect(months).toHaveLength(12);
    expect(months[0].count).toBe(2);
    expect(months[1].count).toBe(0);
    expect(months[11].count).toBe(1);
    expect(months.reduce((sum, m) => sum + m.count, 0)).toBe(3);
  });
  it('keeps an empty history empty', () => {
    expect(monthlyVisits([], 2026).every(m => m.count === 0)).toBe(true);
  });
});
