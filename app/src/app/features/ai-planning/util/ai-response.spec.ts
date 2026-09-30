import { expect, it, describe } from 'vitest';
import { parseAiItems } from './ai-response';

describe('parseAiItems', () => {
  it('일차와 이름이 있는 항목을 받아들인다', () => {
    const items = parseAiItems(
      JSON.stringify({
        items: [
          { day: 1, name: '안목해변', kind: '장소' },
          { day: 2, name: '오죽헌', kind: '장소' },
        ],
      }),
      2,
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ day: 1, name: '안목해변', kind: 'place' });
  });

  it('종류를 우리 분류로 바꾼다', () => {
    const items = parseAiItems(
      JSON.stringify({
        items: [
          { day: 1, name: 'ㄱ', kind: '식사' },
          { day: 1, name: 'ㄴ', kind: '카페' },
          { day: 1, name: 'ㄷ', kind: '장소' },
        ],
      }),
      1,
    );
    expect(items.map((i) => i.kind)).toEqual(['meal', 'break', 'place']);
  });

  it('모르는 종류는 관광으로 둔다', () => {
    const items = parseAiItems(JSON.stringify({ items: [{ day: 1, name: 'ㄱ', kind: '구경' }] }), 1);
    expect(items[0]!.kind).toBe('place');
  });

  it('여행 기간을 벗어난 일차는 버린다', () => {
    const items = parseAiItems(
      JSON.stringify({
        items: [
          { day: 1, name: '있음', kind: '장소' },
          { day: 5, name: '기간 밖', kind: '장소' },
          { day: 0, name: '0일차', kind: '장소' },
        ],
      }),
      2,
    );
    expect(items.map((i) => i.name)).toEqual(['있음']);
  });

  it('이름이 비었거나 공백뿐이면 버린다', () => {
    const items = parseAiItems(
      JSON.stringify({
        items: [
          { day: 1, name: '', kind: '장소' },
          { day: 1, name: '   ', kind: '장소' },
          { day: 1, name: '정상', kind: '장소' },
        ],
      }),
      1,
    );
    expect(items.map((i) => i.name)).toEqual(['정상']);
  });

  it('같은 이름이 여러 번 오면 한 번만 남긴다', () => {
    const items = parseAiItems(
      JSON.stringify({
        items: [
          { day: 1, name: '안목해변', kind: '장소' },
          { day: 2, name: '안목해변', kind: '장소' },
          { day: 2, name: ' 안목해변 ', kind: '장소' },
        ],
      }),
      2,
    );
    expect(items).toHaveLength(1);
  });

  it('너무 많이 오면 앞에서부터 자른다', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      day: 1,
      name: `장소${i}`,
      kind: '장소',
    }));
    expect(parseAiItems(JSON.stringify({ items: many }), 1).length).toBeLessThanOrEqual(40);
  });

  it('JSON이 아니면 빈 배열을 낸다', () => {
    expect(parseAiItems('이건 JSON이 아닙니다', 2)).toEqual([]);
  });

  it('items가 배열이 아니면 빈 배열을 낸다', () => {
    expect(parseAiItems(JSON.stringify({ items: '문자열' }), 2)).toEqual([]);
    expect(parseAiItems(JSON.stringify({}), 2)).toEqual([]);
  });

  it('일차가 숫자가 아니면 버린다', () => {
    const items = parseAiItems(
      JSON.stringify({
        items: [
          { day: '1', name: '문자열 일차', kind: '장소' },
          { day: 1.5, name: '소수 일차', kind: '장소' },
          { day: 1, name: '정상', kind: '장소' },
        ],
      }),
      2,
    );
    expect(items.map((i) => i.name)).toEqual(['정상']);
  });

  it('아주 긴 이름은 잘라 담는다', () => {
    const items = parseAiItems(
      JSON.stringify({ items: [{ day: 1, name: '가'.repeat(200), kind: '장소' }] }),
      1,
    );
    expect(items[0]!.name.length).toBeLessThanOrEqual(60);
  });
});

describe('parseAiItems 코스 필드', () => {
  const json = (items: unknown[]) => JSON.stringify({ items });
  it('일곱 분류와 이전 라벨 장소를 읽는다', () => {
    const out = parseAiItems(json(['관광', '액티비티', '식사', '카페', '쇼핑', '기타', '숙소', '장소', '???'].map((kind, i) => ({ day: 1, name: `곳${i}`, kind }))), 1);
    expect(out.map(i => i.kind)).toEqual(['place', 'activity', 'meal', 'break', 'shopping', 'other', 'stay', 'place', 'place']);
  });
  it('순서·시각·이동을 읽고 잘못된 값만 미정으로 둔다', () => {
    const out = parseAiItems(json([
      { day: 1, order: 1, name: 'A', kind: '관광', start: '10:00', moveToNext: { mode: '도보', minutes: 10 } },
      { day: 1, order: 2, name: 'B', kind: '식사', start: '25:00', moveToNext: { mode: '비행기', minutes: 10 } },
      { day: 1, order: 3, name: 'C', kind: '카페', start: '13:30', moveToNext: { mode: '도보', minutes: 0 } },
    ]), 1);
    expect(out.map(i => [i.order, i.start, i.moveToNext])).toEqual([
      [1, '10:00', { mode: '도보', minutes: 10 }], [2, null, null], [3, '13:30', null],
    ]);
  });
  it('같은 날 시각이 거꾸로 가면 순서는 두고 뒤 항목 시각만 미정으로 둔다', () => {
    const out = parseAiItems(json([
      { day: 1, order: 1, name: 'A', kind: '관광', start: '14:00' },
      { day: 1, order: 2, name: 'B', kind: '관광', start: '11:00' },
    ]), 1);
    expect(out.map(i => [i.name, i.start])).toEqual([['A', '14:00'], ['B', null]]);
  });
  it('순서가 없거나 겹치면 응답 순서로 다시 매긴다', () => {
    const out = parseAiItems(json([
      { day: 1, name: 'A', kind: '관광' }, { day: 2, order: 1, name: 'C', kind: '관광' },
      { day: 1, order: 1, name: 'B', kind: '관광' },
    ]), 2);
    expect(out.map(i => [i.name, i.day, i.order])).toEqual([['A', 1, 1], ['C', 2, 1], ['B', 1, 2]]);
  });
  it('이전 응답도 시각 없이 읽는다', () => {
    expect(parseAiItems(json([{ day: 1, name: 'A', kind: '장소' }]), 1)[0]).toMatchObject({ order: 1, start: null, moveToNext: null, kind: 'place' });
  });
});

describe('parseAiItems 최종 검토 보완', () => {
  const json = (items: unknown[]) => JSON.stringify({ items });
  it('같은 숙소가 다른 날에 나오면 날마다 남긴다', () => {
    const out = parseAiItems(json([
      { day: 1, order: 1, name: '호텔', kind: '숙소' },
      { day: 2, order: 1, name: '호텔', kind: '숙소' },
      { day: 2, order: 2, name: '호텔', kind: '숙소' },
      { day: 2, order: 3, name: '경포대', kind: '관광' },
      { day: 3, order: 1, name: '경포대', kind: '관광' },
    ]), 3);
    expect(out.map((i) => [i.day, i.name])).toEqual([[1, '호텔'], [2, '호텔'], [2, '경포대']]);
  });
  it('모델 순서를 쓸 수 있으면 빠진 자리를 그대로 남긴다', () => {
    const out = parseAiItems(json([
      { day: 1, order: 1, name: 'A', kind: '관광' },
      { day: 1, order: 2, name: '', kind: '관광' },
      { day: 1, order: 3, name: 'C', kind: '관광' },
    ]), 1);
    expect(out.map((i) => [i.name, i.order])).toEqual([['A', 1], ['C', 3]]);
  });
});

describe('parseAiItems 휴무 정보', () => {
  const json = (items: unknown[]) => JSON.stringify({ items });
  it('휴무 정보를 읽고 잘못된 값은 버린다', () => {
    const out = parseAiItems(json([
      { day: 1, name: 'A', kind: '관광', closed: { onDay: true, note: '매주 월요일 휴무' } },
      { day: 1, name: 'B', kind: '관광', closed: { onDay: false, note: '  매주 화요일 휴무 ' } },
      { day: 1, name: 'C', kind: '관광', closed: { onDay: 'yes', note: '월' } },
      { day: 1, name: 'D', kind: '관광', closed: { onDay: true, note: '' } },
      { day: 1, name: 'E', kind: '관광' },
    ]), 1);
    expect(out.map((i) => i.closed)).toEqual([
      { onDay: true, note: '매주 월요일 휴무' },
      { onDay: false, note: '매주 화요일 휴무' },
      null, null, null,
    ]);
  });
});
