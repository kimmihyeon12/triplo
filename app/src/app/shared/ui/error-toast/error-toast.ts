import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon';

@Component({
  host: {
    class:
      'fixed [z-index:1000] [inset-inline:16px] [bottom:calc(24px_+_env(safe-area-inset-bottom,_0px)_+_var(--toast-bottom-offset,_0px))] [width:min(440px,_calc(100%_-_32px))] [margin-inline:auto]',
  },
  selector: 'app-error-toast',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-toast.html',
})
export class ErrorToast {
  readonly message = input.required<string>();
  readonly dismissed = output<void>();

  /** 아래로 끈 거리(px). 휴대폰에서 X까지 손을 옮기지 않고 밀어서 닫게 한다. */
  readonly offset = signal(0);
  readonly dragging = signal(false);
  private startY: number | null = null;

  start(event: PointerEvent): void {
    // 닫기 버튼 누름은 끌기로 보지 않는다.
    if ((event.target as HTMLElement).closest('button')) return;
    this.startY = event.clientY;
    this.dragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  move(event: PointerEvent): void {
    if (this.startY === null) return;
    this.offset.set(Math.max(0, event.clientY - this.startY));
  }

  /** 40px 넘게 내렸으면 닫고, 아니면 제자리로 돌린다. */
  end(): void {
    if (this.startY === null) return;
    this.startY = null;
    this.dragging.set(false);
    if (this.offset() > 40) {
      this.offset.set(120);
      // 사라지는 사이 새 오류가 오면 그 오류까지 닫지 않는다.
      const message = this.message();
      setTimeout(() => {
        if (this.message() === message) this.dismissed.emit();
        else this.offset.set(0);
      }, 180);
    } else {
      this.offset.set(0);
    }
  }
}
