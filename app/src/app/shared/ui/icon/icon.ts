import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * 아이콘 도형은 Lucide(https://lucide.dev, ISC 라이선스) v1.48.0에서 가져왔다.
 * 원·사각형·선 요소를 경로 하나로 합쳐 한 `<path>`로 그린다. 모두 둥근 선
 * 끝·모서리로 맞춰져 있다. 전에는 직접 그린 경로라 아이콘마다 비율과
 * 모서리 처리가 달라 촌스럽게 보였다(2026-09-28 교체).
 *
 * 새 아이콘은 Lucide에서 고르고 이 표에 원본 이름을 주석으로 남긴다.
 * 이모지·유니코드로 대신하지 않는다.
 */
const PATHS = {
  // lucide: luggage
  luggage:
    'M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14M10 20h4M14 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  // lucide: plus
  plus:
    'M5 12h14M12 5v14',
  // lucide: arrow-up
  'arrow-up':
    'M5 12l7-7 7 7M12 19V5',
  // lucide: arrow-down
  'arrow-down':
    'M12 5v14M19 12l-7 7-7-7',
  // lucide: arrow-right
  'arrow-right':
    'M5 12h14M12 5l7 7-7 7',
  // lucide: pencil
  edit:
    'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4',
  // lucide: trash-2
  trash:
    'M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  // lucide: check
  check:
    'M20 6 9 17l-5-5',
  // lucide: x
  x:
    'M18 6 6 18M6 6l12 12',
  // lucide: map
  map:
    'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0zM15 5.764v15M9 3.236v15',
  // lucide: copy
  copy:
    'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2ZM4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2',
  // lucide: share-2
  share:
    'M15 5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M15 19a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M8.59 13.51L15.42 17.49M15.41 6.51L8.59 10.49',
  // lucide: bed-double
  bed:
    'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20',
  // lucide: house
  home:
    'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  // lucide: wallet
  wallet:
    'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4',
  // lucide: map-pin
  place:
    'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  // lucide: utensils
  meal:
    'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',
  // lucide: coffee
  break:
    'M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2',
  // lucide: ticket
  activity:
    'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2',
  // lucide: shopping-bag
  shopping:
    'M16 10a4 4 0 0 1-8 0M3.103 6.034h17.794M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z',
  // lucide: circle-ellipsis
  other:
    'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M17 12h.01M12 12h.01M7 12h.01',
  // lucide: clock
  buffer:
    'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M12 6v6l4 2',
  // lucide: lock
  lock:
    'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2ZM7 11V7a5 5 0 0 1 10 0v4',
  // lucide: triangle-alert
  alert:
    'M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01',
  // lucide: circle-check
  'circle-check': 'M12 22a10 10 0 1 0 0-20a10 10 0 1 0 0 20M9 12l2 2l4-4',
  // lucide: info
  info: 'M12 22a10 10 0 1 0 0-20a10 10 0 1 0 0 20M12 16v-4M12 8h.01',
  // lucide: eye
  eye:
    'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  // lucide: eye-off
  'eye-off':
    'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49M14.084 14.158a3 3 0 0 1-4.242-4.242M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143M2 2l20 20',
  // lucide: refresh-cw
  refresh:
    'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5',
  // lucide: calendar
  calendar:
    'M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2ZM3 9h18',
  // lucide: save
  save:
    'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7',
  // lucide: arrow-left
  back:
    'M12 19l-7-7 7-7M19 12H5',
  // lucide: chevron-right
  'chevron-right':
    'M9 18l6-6-6-6',
  // lucide: chevron-left
  'chevron-left':
    'M15 18l-6-6 6-6',
  // lucide: sparkles
  sparkle:
    'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4M22 4h-4M2 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  // lucide: car
  car:
    'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M9 17h6M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  // lucide: search
  search:
    'M21 21l-4.34-4.34M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0',
  // lucide: map-pin-check
  pin:
    'M19.43 12.935c.357-.967.57-1.955.57-2.935a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32.197 32.197 0 0 0 .813-.728M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M16 18l2 2 4-4',
  // lucide: megaphone
  megaphone:
    'M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14M8 6v8',
  // lucide: mail
  mail:
    'M22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2Z',
  // lucide: bell
  bell:
    'M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  // lucide: file-text
  document:
    'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5M10 9H8M16 13H8M16 17H8',
  // lucide: arrow-up-down
  sort:
    'M21 16l-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16',
} as const satisfies Record<string, string>;

/**
 * 그릴 수 있는 아이콘 이름.
 *
 * `string`으로 두면 없는 이름을 적어도 컴파일이 지나가고 화면에는 조용히
 * 경고 아이콘(⚠️)이 나타난다. 2026-09-21에 `chevron-left`·`chevron-down`을
 * 적어 실제로 그렇게 됐다. 이름을 좁혀 두면 빌드가 먼저 막는다.
 */
export type IconName = keyof typeof PATHS;

@Component({
  host: { class: 'inline-flex leading-[0] flex-none' },
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.html',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly d = computed(() => PATHS[this.name()] ?? PATHS['alert']);
}
