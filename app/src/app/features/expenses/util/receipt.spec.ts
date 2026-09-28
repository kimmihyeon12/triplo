import { describe, expect, it } from 'vitest';
import { draftsToExpenses, parseReceipt, type ReceiptDraft } from './receipt';

const people = [
  { id: 'self', name: '나' },
  { id: 'a', name: '민지' },
];

describe('parseReceipt', () => {
  it('검증을 통과한 항목을 모두 체크된 후보로 만든다', () => {
    const result = parseReceipt(
      JSON.stringify({
        store: 'GS25 강릉역점',
        total: 9500,
        items: [
          { title: '생수', amount: 1500, date: '2026-05-01', category: 'food' },
          { title: ' 과자 ', amount: 3200, date: '', category: 'food' },
        ],
      }),
    );
    expect(result.store).toBe('GS25 강릉역점');
    expect(result.total).toBe(9500);
    expect(result.dropped).toBe(0);
    expect(result.drafts).toEqual([
      { title: '생수', amount: 1500, date: '2026-05-01', category: 'food', checked: true },
      { title: '과자', amount: 3200, date: '', category: 'food', checked: true },
    ]);
  });

  it('금액·제목이 쓸 수 없는 항목은 버리고 몇 건을 뺐는지 센다', () => {
    const result = parseReceipt(
      JSON.stringify({
        store: '',
        total: 0,
        items: [
          { title: '음수', amount: -100, date: '', category: 'food' },
          { title: '소수', amount: 10.5, date: '', category: 'food' },
          { title: '   ', amount: 1000, date: '', category: 'food' },
          { title: '과함', amount: 100_000_001, date: '', category: 'food' },
          { title: '정상', amount: 1000, date: '', category: 'food' },
        ],
      }),
    );
    expect(result.drafts.map((d) => d.title)).toEqual(['정상']);
    expect(result.dropped).toBe(4);
  });

  it('모르는 분류는 기타로, 없는 날짜는 빈 값으로 둔다', () => {
    const [draft] = parseReceipt(
      JSON.stringify({
        store: '',
        total: 0,
        items: [{ title: '택시', amount: 8000, date: '2026-02-30', category: 'taxi' }],
      }),
    ).drafts;
    expect(draft.category).toBe('other');
    expect(draft.date).toBe('');
  });

  it('제목은 40자로 자르고 항목은 30건까지만 받는다', () => {
    const items = Array.from({ length: 35 }, (_, i) => ({
      title: '가'.repeat(50),
      amount: 1000 + i,
      date: '',
      category: 'food',
    }));
    const result = parseReceipt(JSON.stringify({ store: '', total: 0, items }));
    expect(result.drafts).toHaveLength(30);
    expect(result.drafts[0].title).toHaveLength(40);
    expect(result.dropped).toBe(5);
  });

  it('JSON이 아니거나 모양이 다르면 빈 결과를 낸다', () => {
    expect(parseReceipt('not json').drafts).toEqual([]);
    expect(parseReceipt('{"items":"x"}').drafts).toEqual([]);
  });
});

describe('draftsToExpenses', () => {
  const drafts: ReceiptDraft[] = [
    { title: '생수', amount: 1500, date: '2026-05-01', category: 'food', checked: true },
    { title: '과자', amount: 3200, date: '', category: 'food', checked: false },
    { title: '맥주', amount: 4801, date: '', category: 'food', checked: true },
  ];
  const options = {
    people,
    paidBy: 'self',
    personal: false,
    merge: false,
    mergedTitle: '',
    fallbackDate: '2026-05-02',
  };

  it('체크한 항목만 지출 한 건씩으로 만들고 전원이 균등 분담한다', () => {
    const expenses = draftsToExpenses(drafts, options);
    expect(expenses.map((e) => e.title)).toEqual(['생수', '맥주']);
    expect(expenses[1].date).toBe('2026-05-02');
    expect(expenses[1].splits).toEqual([
      { personId: 'self', amount: 2401 },
      { personId: 'a', amount: 2400 },
    ]);
    expect(expenses.every((e) => e.memo === '사진에서 읽음' && e.paidBy === 'self')).toBe(true);
  });

  it('합치기를 켜면 체크한 금액의 합으로 한 건을 만든다', () => {
    const [merged, ...rest] = draftsToExpenses(drafts, {
      ...options,
      merge: true,
      mergedTitle: '편의점',
    });
    expect(rest).toEqual([]);
    expect(merged.title).toBe('편의점');
    expect(merged.amount).toBe(6301);
    expect(merged.date).toBe('2026-05-01');
    expect(merged.category).toBe('food');
  });

  it('개인 지출이면 분담 없이 결제자만 남긴다', () => {
    const [first] = draftsToExpenses(drafts, { ...options, personal: true });
    expect(first.personal).toBe(true);
    expect(first.splits).toEqual([]);
  });
});
