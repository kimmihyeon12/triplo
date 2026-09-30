import { describe, expect, it } from 'vitest';
import { buildCourses } from './course';
import type { PlanItem } from '../model/ai-plan';

const P = (id: string, day: number, order: number, extra: Partial<PlanItem> = {}): PlanItem => ({
  id, day, order, name: id, kind: 'place', start: `1${order}:00`, moveToNext: { mode: '도보', minutes: 10 },
  verified: true, note: '', address: '', location: { lat: 37.5, lng: 127 + order * 0.01 }, placeRef: null, ...extra,
});
const all = (items: PlanItem[]) => new Set(items.map((i) => i.id));

describe('buildCourses', () => {
  it('일차별로 순서대로 늘어놓고 인접 항목 사이에 모델 이동과 직선거리를 붙인다', () => {
    const items = [P('b', 1, 2), P('a', 1, 1), P('c', 2, 1)];
    const [d1, d2] = buildCourses(items, all(items), {}, [1, 2]);
    expect(d1!.entries.map((e) => e.item.id)).toEqual(['a', 'b']);
    expect(d1!.entries[0]!.legFromPrev).toBeNull();
    expect(d1!.entries[1]!.legFromPrev).toMatchObject({ mode: '도보', minutes: 10 });
    expect(d1!.entries[1]!.legFromPrev!.km).toBeGreaterThan(0);
    expect(d2!.entries.map((e) => e.item.id)).toEqual(['c']);
  });

  it('중간 항목이 빠졌거나 해제되면 건너뛴 구간은 직선거리만 보인다', () => {
    // order 3은 장소 확인 실패로 빠졌다.
    const items = [P('a', 1, 1), P('b', 1, 2), P('c', 1, 4)];
    const [d1] = buildCourses(items, new Set(['a', 'c']), {}, [1]);
    const [a, b, c] = d1!.entries;
    expect(b!.selected).toBe(false);
    expect(b!.legFromPrev).toBeNull();
    expect(c!.legFromPrev).toMatchObject({ mode: null, minutes: null });
    expect(c!.legFromPrev!.km).toBeGreaterThan(0);
    expect(a!.start).toBe('11:00');
  });

  it('확인 실패로 빠진 자리를 건너뛴 인접 항목도 모델 이동을 쓰지 않는다', () => {
    const items = [P('a', 1, 1), P('c', 1, 3)];
    const [d1] = buildCourses(items, all(items), {}, [1]);
    expect(d1!.entries[1]!.legFromPrev).toMatchObject({ mode: null, minutes: null });
  });

  it('다른 일차로 옮긴 항목은 그날 끝(숙소 앞)에 붙고 시각·모델 이동이 없다', () => {
    const items = [P('a', 1, 1), P('h', 1, 2, { kind: 'stay' }), P('x', 2, 1)];
    const [d1] = buildCourses(items, all(items), { x: 1 }, [1, 2]);
    expect(d1!.entries.map((e) => e.item.id)).toEqual(['a', 'x', 'h']);
    const x = d1!.entries[1]!;
    expect(x).toMatchObject({ moved: true, start: null });
    expect(x.item.day).toBe(1);
    expect(x.legFromPrev).toMatchObject({ mode: null, minutes: null });
    expect(d1!.entries[2]!.legFromPrev).toMatchObject({ mode: null, minutes: null });
  });

  it('좌표가 없으면 직선거리도 비우고, 항목이 없는 일차는 뺀다', () => {
    const items = [P('a', 1, 1, { location: null }), P('b', 1, 2)];
    const courses = buildCourses(items, all(items), {}, [1, 2]);
    expect(courses).toHaveLength(1);
    expect(courses[0]!.entries[1]!.legFromPrev).toMatchObject({ mode: '도보', minutes: 10, km: null });
  });
});
