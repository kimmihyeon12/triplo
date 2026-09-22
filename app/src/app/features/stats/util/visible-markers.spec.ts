import { describe, expect, it } from 'vitest';
import { visibleMarkers } from './visible-markers';

const at = (id: string, x: number, y: number, extra: Partial<{ name: string; temporary: boolean; count: number }> = {}) =>
  ({ id, name: extra.name ?? id, x, y, temporary: extra.temporary ?? false, count: extra.count ?? 0 });

/** 이름표가 보이는 것만. 점은 모두 남으므로 이 목록으로 겹침을 본다. */
const named = (labels: readonly { id: string; labelHidden?: boolean }[]) =>
  labels.filter((l) => !l.labelHidden).map((l) => l.id);

describe('visibleMarkers', () => {
  /*
    자리는 모두 돌려준다. 겹치는 것을 통째로 버리면 광주와 나주처럼 격자에서
    바로 이웃한 시·군이 지도에서 사라져 '내가 간 곳이 없다'로 읽힌다
    (2026-09-22 결정).
  */
  it('겹쳐도 자리는 모두 남는다', () => {
    const labels = [at('a', 60, 80), at('b', 66, 80), at('c', 72, 80)];
    expect(visibleMarkers(labels, 1, null)).toHaveLength(3);
  });

  it('겹치는 이름표만 가린다', () => {
    const labels = [at('a', 60, 80, { count: 1 }), at('b', 66, 80, { count: 9 })];
    expect(named(visibleMarkers(labels, 1, null))).toEqual(['b']);
  });

  it('충분히 떨어지면 둘 다 이름을 보인다', () => {
    const labels = [at('a', 60, 80), at('b', 200, 80)];
    expect(named(visibleMarkers(labels, 1, null))).toHaveLength(2);
  });

  it('확대하면 더 가까워도 이름이 나온다', () => {
    const labels = [at('a', 60, 80), at('b', 102, 80)];
    expect(named(visibleMarkers(labels, 1, null))).toHaveLength(1);
    expect(named(visibleMarkers(labels, 2, null))).toHaveLength(2);
  });

  it('이름표 수에 상한을 둔다', () => {
    const labels = Array.from({ length: 17 }, (_, i) => at(String(i), i * 110, 80));
    expect(named(visibleMarkers(labels, 1, null))).toHaveLength(6);
    expect(named(visibleMarkers(labels, 2, null))).toHaveLength(10);
    // 상한을 넘어도 자리 자체는 사라지지 않는다.
    expect(visibleMarkers(labels, 1, null)).toHaveLength(17);
  });

  it('선택한 마커의 이름은 늘 보인다', () => {
    const labels = [at('a', 60, 80, { count: 1 }), at('b', 66, 80, { count: 9 })];
    expect(named(visibleMarkers(labels, 1, 'a'))).toEqual(['a']);
  });

  it('임시 선택은 저장된 마커보다 우선한다', () => {
    const labels = [at('a', 60, 80, { count: 9 }), at('temporary', 66, 80, { temporary: true })];
    expect(named(visibleMarkers(labels, 1, null))).toEqual(['temporary']);
  });

  it('방문 수가 같으면 이름 순으로 정한다', () => {
    const labels = [at('b', 66, 80, { name: '나', count: 3 }), at('a', 60, 80, { name: '가', count: 3 })];
    expect(named(visibleMarkers(labels, 1, null))).toEqual(['a']);
  });
});
