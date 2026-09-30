import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('클립보드에 쓰면 true를 돌려준다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('정산')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('정산');
  });

  it('클립보드가 없거나 권한이 막히면 false를 돌려준다', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyText('x')).toBe(false);
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(await copyText('x')).toBe(false);
  });
});
