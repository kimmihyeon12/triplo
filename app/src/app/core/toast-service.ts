import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'error';

/** 알림에서 바로 할 수 있는 일. 누르면 알림을 닫고 실행한다. */
export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export interface Toast {
  readonly kind: ToastKind;
  readonly message: string;
  readonly action?: ToastAction;
}

/** 성공·안내가 스스로 닫히기까지의 시간. 한 문장을 읽기에 충분하고 화면을 오래 가리지 않는다. */
const AUTO_CLOSE_MS = 3000;

/**
 * 앱 전체의 알림 토스트. 화면 위쪽 한 자리(app.html)에 띄운다(2026-09-29 사용자 결정).
 * 화면마다 알림을 따로 두면 화면을 옮길 때 사라지고 자리도 달라진다.
 *
 * - 성공(복사했어요·기록했어요)과 안내(정렬했어요·위치 확인 중)는 3초 뒤 스스로 닫힌다.
 * - 오류는 무엇을 할지 읽어야 하므로 닫기·밀어 닫기 전까지 남는다.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly state = signal<Toast | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;
  readonly current = this.state.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  info(message: string): void {
    this.show('info', message);
  }

  /**
   * 오류를 알린다. 할 일이 있으면 알림 안에 버튼으로 둔다. 알림이 상단 바 아래를
   * 덮으므로, 그 자리에 있던 버튼(예: 여행 상세의 다시 저장)을 대신 누를 수 있어야 한다.
   */
  error(message: string, action?: ToastAction): void {
    this.show('error', message, action);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.state.set(null);
  }

  private show(kind: ToastKind, message: string, action?: ToastAction): void {
    clearTimeout(this.timer);
    this.state.set(action ? { kind, message, action } : { kind, message });
    if (kind !== 'error') this.timer = setTimeout(() => this.state.set(null), AUTO_CLOSE_MS);
  }
}
