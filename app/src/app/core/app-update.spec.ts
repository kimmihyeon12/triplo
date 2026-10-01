import { describe, expect, it } from 'vitest';
import { freshlyOpened, RELOAD_WINDOW_MS } from './app-update';

describe('새 버전 반영', () => {
  it('열거나 돌아온 지 얼마 안 됐으면 바로 새로고침하고, 쓰는 중일 수 있으면 묻는다', () => {
    expect(freshlyOpened(1000, 1000 + RELOAD_WINDOW_MS)).toBe(true);
    expect(freshlyOpened(1000, 1001 + RELOAD_WINDOW_MS)).toBe(false);
  });
});
