import { describe, expect, it } from 'vitest';
import { createStop, createTrip } from '../../trips/util/factories';
import { commandTargets } from './local-command-targets';

const TODAY = '2026-09-30';
const trip = createTrip({
  stops: [
    createStop({ id: 'p', name: '경포대', kind: 'place' }),
    createStop({ id: 'a', name: '해변열차', kind: 'activity' }),
    createStop({ id: 's', name: '기념품점', kind: 'shopping' }),
    createStop({ id: 'o', name: '강릉역', kind: 'other' }),
    createStop({ id: 'm', name: '순두부', kind: 'meal' }),
  ],
});

describe('commandTargets 분류 범위', () => {
  it.each([
    ['관광 전부 빼줘', ['p']],
    ['액티비티 전부 빼줘', ['a']],
    ['쇼핑 전부 빼줘', ['s']],
    ['기타 전부 빼줘', ['o']],
  ])('%s', (text, ids) => {
    const targets = commandTargets(text, trip, TODAY);
    expect(Array.isArray(targets) ? targets.map((s) => s.id) : targets).toEqual(ids);
  });
});
