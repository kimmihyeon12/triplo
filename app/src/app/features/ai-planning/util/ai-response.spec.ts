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
    expect(items[0]).toEqual({ day: 1, name: '안목해변', kind: 'place' });
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

  it('모르는 종류는 장소로 둔다', () => {
    const items = parseAiItems(JSON.stringify({ items: [{ day: 1, name: 'ㄱ', kind: '쇼핑' }] }), 1);
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
