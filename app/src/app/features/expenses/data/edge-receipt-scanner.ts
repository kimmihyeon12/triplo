import { inject, Injectable } from '@angular/core';
import { AuthStore } from '../../auth/data/auth-store';
import { AiQuota, aiLimitMessage } from '../../../core/ai-quota';
import { parseReceipt, type ReceiptScanResult } from '../util/receipt';
import type { ReceiptImage, ReceiptScanner } from './receipt-scanner';

/**
 * Supabase Edge Function을 거쳐 사진을 읽는다. 모델 키와 지시문은 서버에만
 * 있다. 사진은 이 요청 본문에만 실리고 저장하지 않는다.
 */
@Injectable({ providedIn: 'root' })
export class EdgeReceiptScanner implements ReceiptScanner {
  private readonly auth = inject(AuthStore);
  private readonly quota = inject(AiQuota);

  unavailableReason(): string | null {
    if (!this.auth.available()) return 'AI 서버에 연결되지 않았어요. 직접 입력해 주세요.';
    if (!this.auth.user()) return '사진으로 입력하려면 로그인이 필요해요.';
    return null;
  }

  async scan(image: ReceiptImage, signal: AbortSignal): Promise<ReceiptScanResult> {
    try {
      const { content, remaining } = await this.auth.callFunction<{
        content: string;
        remaining?: number;
      }>(
        'receipt-scan',
        { image: image.base64, mimeType: image.mimeType, highlighted: image.highlighted },
        signal,
      );
      this.quota.record('receipt', remaining);
      return parseReceipt(content ?? '');
    } catch (error) {
      if (signal.aborted) throw error;
      throw toUserError(error);
    }
  }
}

function toUserError(error: unknown): Error {
  const limit = aiLimitMessage('receipt', error);
  if (limit) return new Error(limit);
  switch (error instanceof Error ? error.message : '') {
    case 'authentication_required':
      return new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
    case 'image_too_large':
      return new Error('사진이 너무 커요. 화면을 캡처해서 다시 올려 주세요.');
    case 'server_unavailable':
      return new Error('AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    default:
      return new Error('사진을 읽지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}
