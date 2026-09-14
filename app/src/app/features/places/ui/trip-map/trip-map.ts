import { UiBadge } from '../../../../shared/ui/badge/badge';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { DayMapModel } from '../../model/map';
import {
  KOREA_CENTER,
  MAP_PROVIDER,
  type MapInstance,
  type MapProviderAvailability,
} from '../../data/map-provider';
import { IconComponent } from '../../../../shared/ui/icon/icon';

type MapState = 'checking' | 'unavailable' | 'loading' | 'ready' | 'error';

/**
 * 날짜별 지도. 확인된 좌표의 항목만 순번 마커로 그리고, 순번 마커를 잇는 점선은 ‘방문 순서 안내선’이며 경로가 아니다.
 */
@Component({
  selector: 'app-trip-map',
  imports: [UiBadge, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-map.html',
})
export class TripMapComponent implements OnDestroy {
  private readonly provider = inject(MAP_PROVIDER);
  readonly model = input.required<DayMapModel>();
  readonly selectedId = input<string | null>(null);
  readonly markerSelect = output<string>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  readonly state = signal<MapState>('checking');
  readonly availability = signal<MapProviderAvailability | null>(null);
  readonly errorMessage = signal('');
  private instance: MapInstance | null = null;

  constructor() {
    afterNextRender(() => void this.init());
    effect(() => {
      const m = this.model();
      if (this.instance && this.state() === 'ready') this.instance.render(m);
    });
    effect(() => {
      const id = this.selectedId();
      this.instance?.highlight(id);
    });
  }

  private async init(): Promise<void> {
    const a = await this.provider.availability();
    this.availability.set(a);
    if (!a.available) {
      this.state.set('unavailable');
      return;
    }
    this.state.set('loading');
    try {
      const m = this.model();
      const center = m.markers[0]?.position ?? KOREA_CENTER;
      this.instance = await this.provider.mount(this.container().nativeElement, { center }, (id) =>
        this.markerSelect.emit(id),
      );
      this.state.set('ready');
      // 컨테이너가 보이게 된 뒤 크기를 다시 계산하고 그린다.
      requestAnimationFrame(() => {
        this.instance?.relayout();
        this.instance?.render(this.model());
        this.instance?.highlight(this.selectedId());
      });
    } catch (e) {
      this.errorMessage.set(e instanceof Error ? e.message : '알 수 없는 오류');
      this.state.set('error');
    }
  }

  ngOnDestroy(): void {
    this.instance?.destroy();
    this.instance = null;
  }
}
