import { describe, expect, it } from 'vitest';
import { AVATAR_TONES, avatarTone } from './avatar-tone';

describe('avatarTone', () => {
  it('같은 사람은 어느 화면에서나 같은 색이다', () => {
    expect(avatarTone('58b7e70a-8d4a')).toEqual(avatarTone('58b7e70a-8d4a'));
  });

  it('라벨 색 짝 중 하나를 고르고, 사람이 다르면 여러 색으로 나뉜다', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `user-${i}`);
    const tones = ids.map(avatarTone);
    for (const tone of tones) expect(AVATAR_TONES).toContainEqual(tone);
    expect(new Set(tones.map((t) => t.bg)).size).toBeGreaterThanOrEqual(5);
  });
});
