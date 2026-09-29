import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast-service';

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('성공·안내는 3초 뒤 스스로 닫힌다', () => {
    const toast = new ToastService();
    toast.success('복사했어요.');
    expect(toast.current()).toMatchObject({ kind: 'success', message: '복사했어요.' });
    vi.advanceTimersByTime(2999);
    expect(toast.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toast.current()).toBeNull();
    toast.info('현재 위치를 확인하고 있어요.');
    vi.advanceTimersByTime(3000);
    expect(toast.current()).toBeNull();
  });

  it('오류는 닫을 때까지 남는다', () => {
    const toast = new ToastService();
    toast.error('저장하지 못했어요.');
    vi.advanceTimersByTime(60_000);
    expect(toast.current()).toMatchObject({ kind: 'error' });
    toast.dismiss();
    expect(toast.current()).toBeNull();
  });

  it('새 알림은 앞의 알림과 그 타이머를 대신한다', () => {
    const toast = new ToastService();
    toast.success('복사했어요.');
    vi.advanceTimersByTime(2000);
    toast.error('저장하지 못했어요.');
    vi.advanceTimersByTime(5000);
    expect(toast.current()).toMatchObject({ kind: 'error', message: '저장하지 못했어요.' });
  });
});
