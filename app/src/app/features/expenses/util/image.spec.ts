import { describe, expect, it } from 'vitest';
import { fitSize } from './image';

describe('fitSize', () => {
  it('긴 변을 한도에 맞추고 비율을 유지한다', () => {
    expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(4000, 1000)).toEqual({ width: 1600, height: 400 });
  });

  it('작은 사진은 키우지 않는다', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
