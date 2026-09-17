import { expect, it, describe } from 'vitest';
import { kindTone } from './kind-tone';

describe('kindTone', () => {
  it('종류마다 다른 색을 준다', () => {
    const tones = (['place', 'meal', 'break', 'buffer'] as const).map(kindTone);
    expect(new Set(tones).size).toBe(4);
  });

  it('장소는 파랑 계열을 쓴다', () => {
    expect(kindTone('place')).toBe('place');
  });

  it('식사와 카페는 서로 다른 색이다', () => {
    // 하루 일정에서 밥과 커피를 눈으로 구분할 수 있어야 한다.
    expect(kindTone('meal')).not.toBe(kindTone('break'));
  });

  it('완료를 뜻하는 색을 분류에 쓰지 않는다', () => {
    // ok는 '확인됨·완료' 자리에 이미 쓰고 있다. 분류가 같은 색을 쓰면
    // 식사 배지가 완료 표시로 읽힌다.
    const tones = (['place', 'meal', 'break', 'buffer'] as const).map(kindTone);
    expect(tones).not.toContain('ok');
  });

  it('숙소 색을 분류에 쓰지 않는다', () => {
    // stay는 숙소 배지가 이미 쓰고 있다.
    const tones = (['place', 'meal', 'break', 'buffer'] as const).map(kindTone);
    expect(tones).not.toContain('stay');
  });
});
