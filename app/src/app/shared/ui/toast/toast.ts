import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent, type IconName } from '../icon/icon';
import type { ToastKind } from '../../../core/toast-service';

/** 종류마다 바탕·테두리·아이콘 색을 나눈다. 글자는 모두 본문색이라 읽기 쉽다. */
const TONE: Record<ToastKind, { card: string; icon: string; close: string; glyph: IconName; label: string }> = {
  success: {
    card: 'bg-ok-tint/70',
    icon: 'text-ok-ink',
    close: 'hover:bg-ok-fill/60',
    glyph: 'circle-check',
    label: '알림 닫기',
  },
  info: {
    card: 'bg-accent-tint/70',
    icon: 'text-accent-deep',
    close: 'hover:bg-accent-fill/60',
    glyph: 'info',
    label: '알림 닫기',
  },
  error: {
    card: 'bg-danger-tint/70',
    icon: 'text-danger-ink',
    close: 'hover:bg-danger-fill/50',
    glyph: 'alert',
    label: '오류 알림 닫기',
  },
};

/** 위로 이만큼 넘게 밀면 닫는다. */
const DISMISS_PX = 40;

@Component({
  host: {
    class:
      'fixed [z-index:10008] [inset-inline:16px] [top:calc(env(safe-area-inset-top,_0px)_+_64px)] [width:min(440px,_calc(100%_-_32px))] [margin-inline:auto]',
  },
  selector: 'app-toast',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast.html',
})
export class UiToast {
  readonly kind = input<ToastKind>('error');
  readonly message = input.required<string>();
  readonly dismissed = output<void>();
  readonly tone = computed(() => TONE[this.kind()]);

  /** 위로 끈 거리(px, 0 이하). 휴대폰에서 X까지 손을 옮기지 않고 밀어서 닫게 한다. */
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
    this.offset.set(Math.min(0, event.clientY - this.startY));
  }

  /** 40px 넘게 올렸으면 닫고, 아니면 제자리로 돌린다. */
  end(): void {
    if (this.startY === null) return;
    this.startY = null;
    this.dragging.set(false);
    if (this.offset() < -DISMISS_PX) {
      this.offset.set(-120);
      // 사라지는 사이 새 알림이 오면 그 알림까지 닫지 않는다.
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
