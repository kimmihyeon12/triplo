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
import type { DayMapModel, MapBounds, PlacePin } from '../../model/map';
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
  /** 큰 지도의 주변 장소 핀(2026-10-01). 작은 지도는 비워 둔다. */
  readonly places = input<readonly PlacePin[]>([]);
  readonly selectedPlaceId = input<string | null>(null);
  readonly placeSelect = output<string>();
  /** 지도 이동·확대가 끝났을 때 보이는 범위 */
  readonly boundsChange = output<MapBounds>();
  /**
   * 일정이 바뀔 때마다 마커에 맞춰 지도를 옮길지. 큰 지도는 처음에만 맞춘다.
   * 지도에서 담을 때마다 화면이 튀면 사용자가 보던 자리를 잃는다.
   */
  readonly fitOnChange = input(true);
  /** 이 값이 바뀌면(큰 지도의 날짜 바꾸기) fitOnChange와 상관없이 다시 맞춘다 */
  readonly fitKey = input<string | null>(null);
  private lastFitKey: string | null | undefined = undefined;
  /** 범례 없이 지도만 그린다(큰 지도) */
  readonly bare = input(false);
  private fitted = false;

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  readonly state = signal<MapState>('checking');
  readonly availability = signal<MapProviderAvailability | null>(null);
  readonly errorMessage = signal('');
  private instance: MapInstance | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => void this.init());
    effect(() => {
      const m = this.model();
      if (!this.instance || this.state() !== 'ready') return;
      const key = this.fitKey();
      const keyChanged = this.lastFitKey !== undefined && key !== this.lastFitKey;
      this.lastFitKey = key;
      this.instance.render(m, this.fitOnChange() || !this.fitted || keyChanged);
      if (m.markers.length) this.fitted = true;
    });
    effect(() => {
      const pins = this.places();
      const selected = this.selectedPlaceId();
      if (this.instance && this.state() === 'ready') this.instance.renderPlaces(pins, selected);
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
      const el = this.container().nativeElement;
      this.instance = await this.provider.mount(
        el,
        {
          center,
          onPlaceClick: (id) => this.placeSelect.emit(id),
          onIdle: (bounds) => this.boundsChange.emit(bounds),
        },
        (id) => this.markerSelect.emit(id),
      );
      // 화면을 돌리거나 크기가 바뀌면 지도를 다시 맞춘다(큰 지도).
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.instance?.relayout());
        this.resize.observe(el);
      }
      this.state.set('ready');
      // 컨테이너가 보이게 된 뒤 크기를 다시 계산하고 그린다.
      requestAnimationFrame(() => {
        this.instance?.relayout();
        this.instance?.render(this.model());
        if (this.model().markers.length) this.fitted = true;
        this.instance?.renderPlaces(this.places(), this.selectedPlaceId());
        this.instance?.highlight(this.selectedId());
      });
    } catch (e) {
      this.errorMessage.set(e instanceof Error ? e.message : '알 수 없는 오류');
      this.state.set('error');
    }
  }

  /** 큰 지도의 지도 조작(확대·축소·옮기기·내 위치). 지도가 아직 없으면 아무것도 하지 않는다. */
  zoom(step: 1 | -1): void {
    this.instance?.zoom(step);
  }

  moveTo(point: { lat: number; lng: number }): void {
    this.instance?.moveTo(point);
  }

  showMyLocation(point: { lat: number; lng: number } | null): void {
    this.instance?.showMyLocation(point);
  }

  ngOnDestroy(): void {
    this.resize?.disconnect();
    this.instance?.destroy();
    this.instance = null;
  }
}
