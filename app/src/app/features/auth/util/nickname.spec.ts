import { describe, expect, it } from 'vitest';
import { nicknameFrom, normalizeNickname } from './nickname';

describe('chosen travel nickname', () => {
  it('requires a manually saved nickname rather than an OAuth provider name', () => {
    expect(nicknameFrom({ full_name: 'Google Name', nickname: 'Kakao Name' })).toBeNull();
    expect(nicknameFrom({ travel_nickname: '여행친구' })).toBe('여행친구');
  });
  it('trims and validates the nickname', () => {
    expect(normalizeNickname('  여행친구  ')).toBe('여행친구');
    for (const value of ['', '가', '가'.repeat(21), '닉\n네임'])
      expect(normalizeNickname(value)).toBeNull();
  });
});
