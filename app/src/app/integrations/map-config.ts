import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * 브라우저 공개용 지도 키 설정. 저장소에 커밋하지 않는 `public/app-config.json`에서 읽는다.
 * 파일이 없으면 지도·검색은 '키 없음' 상태로 동작하고 나머지 기능은 그대로 쓸 수 있다.
 */
export interface AppConfigFile {
  /** 카카오 디벨로퍼스 JavaScript 키(도메인 제한 필수). 비밀키가 아니다. */
  kakaoJsKey?: string;
}

export type MapConfigStatus = 'loading' | 'ready' | 'missing' | 'error';

@Injectable({ providedIn: 'root' })
export class MapConfig {
  readonly status = signal<MapConfigStatus>('loading');
  readonly kakaoJsKey = signal<string | null>(null);
  readonly provider = environment.mapProvider;

  async load(): Promise<void> {
    if (this.provider !== 'kakao') {
      // 테스트 픽스처 제공자는 키가 필요 없다.
      this.status.set('ready');
      return;
    }
    try {
      const res = await fetch('app-config.json', { cache: 'no-store' });
      if (!res.ok) {
        this.status.set('missing');
        return;
      }
      const file = (await res.json()) as AppConfigFile;
      const key = (file.kakaoJsKey ?? '').trim();
      if (!key || key.startsWith('여기에')) {
        this.status.set('missing');
        return;
      }
      this.kakaoJsKey.set(key);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
