import { describe, expect, it } from 'vitest';
import { defaultPayer, expenseCategoryOf, expenseLinks } from './expense-link';
import { EXPENSE_CATEGORIES } from '../model/ledger';

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

describe('일정 분류와 정산 분류의 대응', () => {
  it('일정 분류를 한 표로 가계부 분류에 옮긴다', () => {
    expect((['place', 'activity', 'meal', 'break', 'shopping', 'other', 'buffer', 'stay'] as const).map(expenseCategoryOf))
      .toEqual(['activity', 'activity', 'food', 'food', 'shopping', 'other', 'other', 'stay']);
    const links = expenseLinks(
      [
        { id: 'a', name: '해변열차', kind: 'activity', excluded: false },
        { id: 's', name: '기념품점', kind: 'shopping', excluded: false },
        { id: 'o', name: '강릉역', kind: 'other', excluded: false },
      ],
      [],
    );
    expect(links.map((l) => l.category)).toEqual(['activity', 'shopping', 'other']);
  });
  it('정산 라벨이 일정 분류 라벨과 맞는다', () => {
    expect(EXPENSE_CATEGORIES).toEqual({ food: '식비', stay: '숙박', transport: '교통', activity: '관광·액티비티', shopping: '쇼핑', other: '기타' });
  });
});
