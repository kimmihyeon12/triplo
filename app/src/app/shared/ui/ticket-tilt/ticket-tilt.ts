import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

/**
 * 티켓을 손에 든 종이처럼 기울여 보여 주는 무대. 안쪽 내용은 그대로 두고
 * 바깥에서 원근과 회전만 맡는다. 티켓을 쓰는 화면끼리 같은 반응을 공유한다.
 */

/** 기울어지는 최대 각도(도). 넘어가면 종이가 아니라 장난감처럼 보인다. */
const MAX_TILT = 9;

@Component({
  selector: 'app-ticket-tilt',
  templateUrl: './ticket-tilt.html',
  // 빛 효과는 티켓 본권 안에 있어야 하므로 바깥에서 값을 읽을 수 있게 내보낸다.
  exportAs: 'ticketTilt',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiTicketTilt {
  /** 기울기는 -1~1 범위의 상대 좌표로 들고 있다가 각도로 환산한다. */
  private readonly tilt = signal({ x: 0, y: 0 });
  readonly lifted = signal(false);

  readonly ticketTransform = computed(() => {
    const { x, y } = this.tilt();
    const lift = this.lifted() ? 'translateZ(14px)' : 'translateZ(0)';
    return `rotateX(${(-y * MAX_TILT).toFixed(2)}deg) rotateY(${(x * MAX_TILT).toFixed(2)}deg) ${lift}`;
  });

  /** 빛이 기울인 반대쪽에서 들어오는 것처럼 보이게 한다. */
  readonly sheenTransform = computed(() => {
    const { x, y } = this.tilt();
    return `translate(${(x * 26).toFixed(1)}%, ${(y * 26).toFixed(1)}%)`;
  });

  /**
   * 카드 위 좌표를 -1~1로 환산한다. 터치는 제외한다. 손가락으로 쓰는 동작은
   * 대부분 스크롤 의도라서 기울기가 함께 반응하면 화면이 흔들리는 것처럼 보인다.
   */
  onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    this.applyFrom(event);
  }

  /**
   * 터치 기기에서는 누르는 순간에만 한 번 기울인다.
   * 손을 떼면 돌아오므로 스크롤을 막지 않으면서 반응은 남는다.
   */
  onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return;
    this.applyFrom(event);
  }

  /** 손을 떼면 제자리로 돌아온다. */
  onPointerLeave(): void {
    this.tilt.set({ x: 0, y: 0 });
    this.lifted.set(false);
  }

  private applyFrom(event: PointerEvent): void {
    const el = event.currentTarget as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    this.tilt.set({
      x: ((event.clientX - r.left) / r.width) * 2 - 1,
      y: ((event.clientY - r.top) / r.height) * 2 - 1,
    });
    this.lifted.set(true);
  }
}
