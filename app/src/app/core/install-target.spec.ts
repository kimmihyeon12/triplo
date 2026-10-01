import { describe, expect, it } from 'vitest';
import { installUrl, safeNext } from './install-target';

describe('앱 설치로 보내기', () => {
  it('돌아올 곳을 담은 설치 화면 주소를 만든다', () => {
    expect(installUrl('/join/ABCD-EFGH')).toBe('/install?next=%2Fjoin%2FABCD-EFGH');
  });

  it('앱 안 주소만 돌아갈 곳으로 받는다', () => {
    expect(safeNext('/join/ABCD-EFGH')).toBe('/join/ABCD-EFGH');
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
