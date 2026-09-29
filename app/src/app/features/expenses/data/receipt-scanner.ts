import { InjectionToken } from '@angular/core';
import type { ReceiptScanResult } from '../util/receipt';

/**
 * 사진에서 지출 후보를 읽는 제공자. 화면은 이 인터페이스만 쓴다.
 * 실행 앱은 Edge Function을, 테스트 앱은 고정 응답을 쓴다.
 */
export interface ReceiptImage {
  /** base64 본문. data: 머리말은 붙이지 않는다. */
  readonly base64: string;
  readonly mimeType: 'image/jpeg';
  /** 사진에 형광펜을 칠해 합성했는지. */
  readonly highlighted: boolean;
}

export interface ReceiptScanner {
  /** 쓸 수 없으면 사용자에게 보일 이유를, 쓸 수 있으면 null을 돌려준다. */
  unavailableReason(): string | null;
  scan(image: ReceiptImage, signal: AbortSignal): Promise<ReceiptScanResult>;
}

export const RECEIPT_SCANNER = new InjectionToken<ReceiptScanner>('RECEIPT_SCANNER');
