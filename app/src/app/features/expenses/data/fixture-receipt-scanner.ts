import { Injectable } from '@angular/core';
import { parseReceipt, type ReceiptScanResult } from '../util/receipt';
import type { ReceiptImage, ReceiptScanner } from './receipt-scanner';

/**
 * 테스트 앱용. 외부를 부르지 않고 정해진 응답을 파서에 그대로 넣는다.
 * 형광펜을 칠했으면 한 줄만 돌려줘 범위 지정 경로를 확인할 수 있게 한다.
 * 마지막 항목은 금액이 음수라 파서가 버리는지 본다.
 */
const FULL = {
  store: 'GS25 강릉역점',
  total: 9500,
  items: [
    { title: '생수', amount: 1500, date: '2026-05-01', category: 'food' },
    { title: '과자', amount: 3200, date: '2026-05-01', category: 'food' },
    { title: '맥주', amount: 4800, date: '2026-05-01', category: 'food' },
    { title: '할인', amount: -500, date: '', category: 'other' },
  ],
};
const HIGHLIGHTED = { ...FULL, items: [FULL.items[2]] };

const FAIL_FLAG = 'tc.test.receiptFail';

@Injectable({ providedIn: 'root' })
export class FixtureReceiptScanner implements ReceiptScanner {
  unavailableReason(): string | null {
    return null;
  }

  async scan(image: ReceiptImage): Promise<ReceiptScanResult> {
    if (localStorage.getItem(FAIL_FLAG) === '1') throw new Error('사진을 읽지 못했어요.');
    return parseReceipt(JSON.stringify(image.highlighted ? HIGHLIGHTED : FULL));
  }
}
