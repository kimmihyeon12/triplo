import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * 티켓 반권 아래에 서는 줄무늬. 실제로 읽히는 코드가 아니라 장식이므로
 * 값을 담지 않고 폭만 번갈아 둔다. 티켓을 쓰는 화면끼리 같은 모양을 공유한다.
 */
const BAR_WIDTHS = [3, 2, 1, 1, 2, 5, 2, 1, 4, 1, 3];
/** 좁은 자리에서도 줄무늬가 이어져 보이도록 넉넉히 반복한다. 넘치는 만큼은 잘린다. */
const REPEAT = 6;

@Component({
  selector: 'app-barcode',
  templateUrl: './barcode.html',
  host: { class: 'block text-ink-3/55' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiBarcode {
  readonly height = input(22);
  readonly bars = Array.from(
    { length: BAR_WIDTHS.length * REPEAT },
    (_, i) => BAR_WIDTHS[i % BAR_WIDTHS.length]!,
  );
}
