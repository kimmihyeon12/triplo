import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../auth/data/auth-store';
import { FunctionError } from '../../auth/data/function-error';
import { AiQuota } from '../../../core/ai-quota';
import { EdgeReceiptScanner } from './edge-receipt-scanner';

const IMAGE = { base64: 'aGVsbG8=', mimeType: 'image/jpeg', highlighted: false } as const;

function setup(callFunction: ReturnType<typeof vi.fn>) {
  const injector = Injector.create({
    providers: [
      { provide: AuthStore, useValue: { available: () => true, user: () => ({ id: 'u' }), callFunction } },
      AiQuota,
      EdgeReceiptScanner,
    ],
  });
  return {
    scanner: runInInjectionContext(injector, () => injector.get(EdgeReceiptScanner)),
    quota: injector.get(AiQuota),
  };
}

describe('EdgeReceiptScanner', () => {
  it('성공하면 남은 횟수를 기록한다', async () => {
    const { scanner, quota } = setup(
      vi.fn(async () => ({ content: '{"store":"","total":0,"items":[]}', remaining: 0 })),
    );
    await scanner.scan(IMAGE, new AbortController().signal);
    expect(quota.hint('receipt')()).toBe('오늘 0번 남음');
  });

  it('한도 오류를 문장으로 바꾼다', async () => {
    const limited = setup(vi.fn(async () => { throw new FunctionError('user_limit', { limit: 10 }); }));
    await expect(limited.scanner.scan(IMAGE, new AbortController().signal)).rejects.toThrow(
      '오늘 사진 읽기를 10번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.',
    );
    const global = setup(vi.fn(async () => { throw new Error('quota_exceeded'); }));
    await expect(global.scanner.scan(IMAGE, new AbortController().signal)).rejects.toThrow(
      '지금은 직접 입력해 주세요.',
    );
  });
});
