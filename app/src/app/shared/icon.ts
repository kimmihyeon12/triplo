import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** 한 가지 선 굵기(2px, round)로 그린 아이콘 세트. 이모지·유니코드 대체 없이 SVG만 사용한다. */
const PATHS: Record<string, string> = {
  luggage: 'M6 8h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M9 12v4M15 12v4',
  plus: 'M12 5v14M5 12h14',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  map: 'M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3zM9 3v15M15 6v15',
  copy: 'M9 9h10v12H9zM5 15V3h10',
  bed: 'M3 18v-8h18v8M3 14h18M7 10V7h4v3M3 18v2M21 18v2',
  place: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  meal: 'M4 3v8a2 2 0 0 0 2 2h1v8M7 3v6M10 3v6M17 3c-2 0-3 2.5-3 5v3h3v10',
  break: 'M17 8h1a3 3 0 0 1 0 6h-1M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM7 3v2M11 3v2',
  buffer: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.7',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
  save: 'M4 4h12l4 4v12H4zM8 4v5h7V4M7 20v-6h10v6',
  back: 'M19 12H5M12 19l-7-7 7-7',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  pin: 'M12 22s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z',
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
