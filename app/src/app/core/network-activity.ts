import { computed, Injectable, signal } from '@angular/core';

/**
 * 진행 중인 네트워크 요청 수. 상단 바의 로딩 표시가 이 값만 본다
 * (2026-09-29 사용자 결정: 네트워크 요청이 있을 때만, 지연 없이).
 *
 * 전에는 화면 이동이 200ms를 넘을 때 띄웠다. 그러면 여행 목록처럼 이동이 끝난
 * 뒤 서버에서 받아오는 요청은 표시되지 않고, 요청이 없어도 이동이 느리면 떴다.
 * Supabase·서버 함수·설정 파일 요청이 모두 fetch를 거치므로 fetch를 감싼다.
 * 처음 여는 화면의 코드 내려받기는 fetch가 아니므로 라우터 이벤트로 begin·end를 부른다.
 */
@Injectable({ providedIn: 'root' })
export class NetworkActivity {
  private readonly pending = signal(0);
  readonly busy = computed(() => this.pending() > 0);

  wrap(fetcher: typeof fetch): typeof fetch {
    return (...args: Parameters<typeof fetch>) => {
      this.begin();
      return fetcher(...args).finally(() => this.end());
    };
  }

  begin(): void {
    this.pending.update((n) => n + 1);
  }

  /** 짝이 맞지 않게 불려도 0 밑으로 내려가지 않는다. */
  end(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }

  /** 앱 시작 때 한 번 브라우저의 fetch를 감싼다. */
  install(): void {
    globalThis.fetch = this.wrap(globalThis.fetch.bind(globalThis));
  }
}
