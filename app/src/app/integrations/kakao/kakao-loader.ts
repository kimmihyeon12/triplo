import { inject, Injectable } from '@angular/core';
import { MapConfig } from '../map-config';

declare global {
  interface Window {
    // 카카오 지도 SDK 전역. 타입 패키지 없이 최소한으로 다룬다.
    kakao?: { maps: any };
  }
}

/**
 * 카카오 지도 JavaScript SDK를 한 번만 로드한다.
 * 키는 `public/app-config.json`의 JavaScript 키이며, 카카오 디벨로퍼스에 등록한 도메인에서만 동작한다.
 */
@Injectable({ providedIn: 'root' })
export class KakaoSdkLoader {
  private readonly config = inject(MapConfig);
  private loading: Promise<any> | null = null;

  get hasKey(): boolean {
    return this.config.status() === 'ready' && !!this.config.kakaoJsKey();
  }

  load(): Promise<any> {
    if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps);
    if (this.loading) return this.loading;
    const key = this.config.kakaoJsKey();
    if (!key) return Promise.reject(new Error('카카오 JavaScript 키가 없습니다.'));
    this.loading = new Promise<any>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
      script.async = true;
      script.onload = () => {
        if (!window.kakao?.maps) {
          reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.'));
          return;
        }
        window.kakao.maps.load(() => resolve(window.kakao!.maps));
      };
      script.onerror = () => {
        this.loading = null;
        reject(new Error('카카오 지도 SDK 로드 실패. 키와 등록 도메인(예: http://localhost:4200)을 확인하세요.'));
      };
      document.head.appendChild(script);
    });
    return this.loading;
  }
}
