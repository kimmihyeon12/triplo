import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { mapAppLink, mobilePlatform } from '../../util/map-app-link';

/** 아이폰에서 앱이 열리지 않았다고 보고 웹 지도로 보내기까지의 시간. */
const IOS_FALLBACK_MS = 1500;

/**
 * 네이버·카카오 지도 링크를 휴대폰에서 앱으로 바로 연다. href는 웹 주소 그대로 두어
 * 길게 눌러 복사하기·데스크톱 동작은 바뀌지 않는다. 눌렀을 때만 앱 주소로 바꾼다.
 */
@Directive({ selector: 'a[appMapLink]' })
export class UiMapLink {
  constructor() {
    const anchor = inject<ElementRef<HTMLAnchorElement>>(ElementRef).nativeElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => clearTimeout(timer);

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const platform = mobilePlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
      const web = anchor.href;
      const app = mapAppLink(web, platform, location.host);
      if (!app) return;
      event.preventDefault();
      location.href = app;
      // 안드로이드 intent는 앱이 없으면 브라우저가 스스로 웹으로 간다.
      if (platform !== 'ios') return;
      // 앱이 열리면 이 화면이 가려진다. 그대로 보이면 앱이 없다고 보고 웹 지도를 연다.
      cancel();
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible') window.open(web, '_blank', 'noopener');
      }, IOS_FALLBACK_MS);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') cancel();
    };

    anchor.addEventListener('click', onClick);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', cancel);
    inject(DestroyRef).onDestroy(() => {
      cancel();
      anchor.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', cancel);
    });
  }
}
