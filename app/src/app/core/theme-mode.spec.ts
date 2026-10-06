import { describe, expect, it } from 'vitest';
import { THEME_KEY, readTheme } from './theme-mode';

const store = (value: string | null) => ({ getItem: (key: string) => (key === THEME_KEY ? value : null) });

describe('화면 테마 읽기', () => {
  it('기본은 라이트다', () => {
    expect(readTheme(store(null))).toBe('light');
    expect(readTheme(null)).toBe('light');
  });

  it('다크로 저장한 기기만 다크다', () => {
    expect(readTheme(store('dark'))).toBe('dark');
    expect(readTheme(store('light'))).toBe('light');
    expect(readTheme(store('blue'))).toBe('light');
  });

  it('저장소가 막혀도 라이트로 연다', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readTheme(blocked)).toBe('light');
  });
});
