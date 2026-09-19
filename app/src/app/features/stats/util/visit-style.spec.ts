import { describe, expect, it } from 'vitest';
import { visitStyle } from './visit-style';
const palette = { land: '#ffffff', low: '#e3f5ea', high: '#1e7a4e' };

describe('visitStyle', () => {
  it('leaves unvisited regions white and flat', () => {
    expect(visitStyle(0, 48, palette)).toEqual({ color: palette.land, height: 1 });
  });
  it('makes more frequently visited regions darker and taller', () => {
    const low = visitStyle(1, 48, palette);
    const high = visitStyle(48, 48, palette);
    expect(high.color).toBe(palette.high);
    expect(high.height).toBeGreaterThan(low.height);
    const brightness = (hex: string) => hex.slice(1).match(/../g)!.reduce((s, c) => s + parseInt(c, 16), 0);
    expect(brightness(high.color)).toBeLessThan(brightness(low.color));
  });
  it('uses the supplied application palette instead of a fixed map palette', () => {
    expect(visitStyle(21, 21, { land: '#ffffff', low: '#eeeeee', high: '#123456' }).color).toBe('#123456');
  });
  it.each([[1, 4], [2, 4], [3, 8], [5, 8], [6, 14], [10, 14], [11, 22], [20, 22], [21, 32], [100, 32]])('uses an absolute height for %i visits', (count, height) => {
    expect(visitStyle(count, 100, palette).height).toBe(height);
  });
  it('keeps the same frequency style when another province gains visits', () => {
    expect(visitStyle(5, 5, palette)).toEqual(visitStyle(5, 1000, palette));
  });
  it.each([NaN, Infinity, -1])('does not color invalid counts %s', count => {
    expect(visitStyle(count, 100, palette)).toEqual({ color: palette.land, height: 1 });
  });
});
