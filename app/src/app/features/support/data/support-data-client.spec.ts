import { describe, expect, it } from 'vitest';
import { toSupportError } from './support-data-client';

describe('toSupportError', () => {
  it('문의를 너무 자주 보내면 잠시 뒤 보내라고 알린다', () => {
    const error = toSupportError({ code: 'P0429' });
    expect(error.message).toBe('문의를 너무 자주 보냈어요. 1시간 뒤에 다시 보내 주세요.');
    expect(error.code).toBe('P0429');
  });

  it('모르는 오류는 연결 실패로 알린다', () => {
    expect(toSupportError({ code: 'XX000' }).message).toBe('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  });
});
