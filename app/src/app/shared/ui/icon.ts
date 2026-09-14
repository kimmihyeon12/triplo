import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** 한 가지 선 굵기(2px, round)로 그린 아이콘 세트. 이모지·유니코드 대체 없이 SVG만 사용한다. */
const PATHS: Record<string, string> = {
  // 여행 가방: 손잡이·몸통·잠금 걸쇠·바퀴를 24 뷰박스 안에서 좌우 대칭으로 맞췄다.
  luggage:
    'M6 7.5h12a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V9A1.5 1.5 0 0 1 6 7.5zM9 7.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2.5M7.5 19.5V21M16.5 19.5V21M9.5 11.5v4M14.5 11.5v4',
  plus: 'M12 5v14M5 12h14',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  // 접힌 지도: 세 폭이 같은 너비로 접히도록 x좌표를 3/9/15/21로 정렬했다.
  map: 'M9 17.5L3 20.5V5.5l6-3 6 3 6-3v15l-6 3-6-3zM9 2.5v15M15 5.5v15',
  // 복사: 뒷장은 앞장에 가려지는 두 변만 그려 겹침이 또렷하다.
  copy: 'M9.5 8.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM5.5 15.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1',
  // 침대: 머리판·매트리스·베개·다리를 같은 기준선에 올렸다.
  bed: 'M3.5 19v-8.5M3.5 14.5h17M20.5 19v-4.5M3.5 10.5h11a6 6 0 0 1 6 6M7 13V11h3.5v2',
  place: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  meal: 'M4 3v8a2 2 0 0 0 2 2h1v8M7 3v6M10 3v6M17 3c-2 0-3 2.5-3 5v3h3v10',
  break: 'M17 8h1a3 3 0 0 1 0 6h-1M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM7 3v2M11 3v2',
  buffer: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.7',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  // 달력: 모서리를 둥글리고 머리줄 아래를 본문 영역으로 비웠다.
  calendar: 'M5 5.5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM4 10h16M8 3.5v4M16 3.5v4',
  // 저장(플로피): 잘린 모서리·셔터·라벨의 세 덩어리를 같은 여백 안에 넣었다.
  save: 'M5.5 4.5h10L19.5 8.5v11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1zM8.5 4.5v5h6v-5M7.5 20.5v-6h9v6',
  back: 'M15 5l-7 7 7 7',
  'chevron-right': 'M9 5l7 7-7 7',
  // AI: 큰 별 하나 + 작은 별 하나. 반짝임을 뜻하며 장식이 아니다.
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM18 16l.7 2.1L21 19l-2.3.9L18 22l-.7-2.1L15 19l2.3-.9L18 16z',
  // 자동차: 이동 구간 표시용. 이동시간을 뜻하지 않는다(시간은 미확인으로 유지).
  car: 'M4 16.5v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-1M16.5 17.5v1a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1v-2M3.5 16.5v-4l2-5a1.5 1.5 0 0 1 1.4-1h10.2a1.5 1.5 0 0 1 1.4 1l2 5v4a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1zM4.5 12.5h15M7.5 14.8h.01M16.5 14.8h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  pin: 'M12 22s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z',

  // 정보 없음: 구름 실루엣 + 물음표 자리의 점선 느낌 대신 가운데 대시 하나
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="d()" />
    </svg>
  `,
  styles: [':host{display:inline-flex;line-height:0;flex:none}'],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(18);
  readonly d = computed(() => PATHS[this.name()] ?? PATHS['alert']);
}
