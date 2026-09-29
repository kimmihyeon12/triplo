import { Injectable, signal } from '@angular/core';

/**
 * 앱 전체에서 쓰는 오류 토스트. 여행 목록·상세를 불러오지 못했거나 저장·삭제에
 * 실패했을 때처럼 여러 화면에서 나는 오류를 한 자리(app.html)에 띄운다.
 * 화면마다 토스트를 따로 두면 화면을 옮길 때 알림이 사라진다.
 *
 * 네트워크 오류는 잠깐 지나가는 일이 많아 6초 뒤 스스로 닫힌다. 닫기 버튼으로
 * 먼저 닫을 수 있다.
 */
@Injectable({ providedIn: 'root' })
export class ErrorToastService {
  private readonly current = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;
  readonly message = this.current.asReadonly();

  show(message: string): void {
    clearTimeout(this.timer);
    this.current.set(message);
    this.timer = setTimeout(() => this.current.set(''), 6000);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.current.set('');
  }
}
