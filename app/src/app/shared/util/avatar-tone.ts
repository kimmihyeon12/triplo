/**
 * 프로필 원의 색. 사람마다 무작위처럼 다르지만 같은 사람은 늘 같은 색이다
 * (2026-09-29 사용자 요청). 사용자 id를 해시해 라벨 색 짝 중 하나를 고른다.
 * 오류색(danger)은 경고로 읽히므로 쓰지 않는다.
 */
export const AVATAR_TONES = [
  { bg: 'var(--color-place-tint)', fg: 'var(--color-place-ink)' },
  { bg: 'var(--color-stay-tint)', fg: 'var(--color-stay-ink)' },
  { bg: 'var(--color-region-tint)', fg: 'var(--color-region-ink)' },
  { bg: 'var(--color-meal-tint)', fg: 'var(--color-meal-ink)' },
  { bg: 'var(--color-cafe-tint)', fg: 'var(--color-cafe-ink)' },
  { bg: 'var(--color-ok-tint)', fg: 'var(--color-ok-ink)' },
  { bg: 'var(--color-warn-tint)', fg: 'var(--color-warn-ink)' },
] as const;

export function avatarTone(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
