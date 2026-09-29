import { describe, expect, it } from 'vitest';
import { defaultPayer, expenseLinks } from './expense-link';

describe('expenseLinks', () => {
  it('일정 항목의 종류를 지출 분류로 옮기고 알 수 없으면 기타로 둔다', () => {
    const links = expenseLinks(
      [
        { id: 's1', name: '국밥집', kind: 'meal', excluded: false, estimatedCost: 9000 },
        { id: 's2', name: '카페', kind: 'break', excluded: false },
        { id: 's3', name: '경포대', kind: 'place', excluded: false },
        { id: 's4', name: '쉬기', kind: 'buffer', excluded: false },
        { id: 's5', name: '뺀 곳', kind: 'place', excluded: true },
      ],
      [{ id: 'h1', name: '호텔', estimatedCost: 100000 }],
    );
    expect(links.map((l) => [l.id, l.category])).toEqual([
      ['s1', 'food'],
      ['s2', 'food'],
      ['s3', 'activity'],
      ['s4', 'other'],
      ['h1', 'stay'],
    ]);
    expect(links[0].estimatedCost).toBe(9000);
  });
});

describe('defaultPayer', () => {
  it('나를 먼저 고르고 없으면 첫 사람을 고른다', () => {
    expect(defaultPayer([{ id: 'p2', name: '민지' }, { id: 'self', name: '나' }])).toBe('self');
    expect(defaultPayer([{ id: 'p2', name: '민지' }])).toBe('p2');
    expect(defaultPayer([])).toBe('');
    expect(defaultPayer([{ id: 'self', name: '주인' }, { id: 'member-u2', name: '민지' }], 'member-u2')).toBe('member-u2');
    expect(defaultPayer([{ id: 'self', name: '주인' }], 'member-u9')).toBe('self');
  });
});
