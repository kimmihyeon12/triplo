import { afterNextRender, ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import type { DayMapModel } from '../domain/map-markers';
import { KOREA_CENTER, MAP_PROVIDER, type MapInstance, type MapProviderAvailability } from '../integrations/map-provider';
import { IconComponent } from './icon';

type MapState = 'checking' | 'unavailable' | 'loading' | 'ready' | 'error';

/**
 * 날짜별 지도. 확인된 좌표의 항목만 순번 마커로 그리고, 순번 마커를 잇는 점선은 ‘방문 순서 안내선’이며 경로가 아니다.
 */
@Component({
  selector: 'app-trip-map',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" data-testid="trip-map" [attr.data-state]="state()">
      <div #container class="canvas" [class.canvas--hidden]="state() !== 'ready'" aria-label="일정 지도"></div>

      @switch (state()) {
        @case ('checking') {
          <div class="overlay"><p class="muted small" role="status">지도 제공자 확인 중…</p></div>
        }
        @case ('loading') {
          <div class="overlay" role="status" data-testid="map-loading"><span class="spinner" aria-hidden="true"></span><p class="muted small">{{ availability()?.providerLabel }} 불러오는 중…</p></div>
        }
        @case ('unavailable') {
          <div class="overlay overlay--notice" data-testid="map-unavailable">
            <app-icon name="map" [size]="22" />
            <strong>지도 키가 아직 없습니다</strong>
            <p class="small">지도 없이도 일정은 계속 편집할 수 있습니다.</p>
            <p class="small muted">설정 방법: app/public/app-config.json에 카카오 JavaScript 키를 넣고 새로고침 (예시 파일 app-config.example.json)</p>
          </div>
        }
        @case ('error') {
          <div class="overlay overlay--notice" role="alert" data-testid="map-error">
            <app-icon name="alert" [size]="22" />
            <strong>지도를 표시하지 못했습니다</strong>
            <p class="small">{{ errorMessage() }}</p>
          </div>
        }
        @case ('ready') {
          @if (model().markers.length === 0) {
            <div class="overlay overlay--notice" data-testid="map-empty">
              <strong>이 날 지도에 표시할 확인된 위치가 없습니다</strong>
              <p class="small muted">장소·숙소를 검색으로 등록하면 순번 마커로 표시됩니다.</p>
            </div>
          }
        }
      }

      <div class="legend small" data-testid="map-legend">
        <span class="legend__item"><span class="tc-marker tc-marker--stop tc-marker--mini">1</span> 방문 순서</span>
        <span class="legend__item"><span class="tc-marker tc-marker--stay tc-marker--mini">숙</span> 숙소</span>
        <span class="legend__item"><span class="legend__dash"></span> 방문 순서 안내선 · 경로 아님</span>
        @if (model().unverifiedActiveCount + model().unverifiedStayCount > 0) {
          <span class="cell cell--warn" data-testid="map-unverified">지도에 없음 {{ model().unverifiedActiveCount + model().unverifiedStayCount }}개 · 위치 미확인</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .wrap {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .canvas {
        width: 100%;
        height: var(--map-height, 280px);
        border-radius: var(--radius-panel);
        overflow: hidden;
        background: var(--ground-2);
        box-shadow: var(--shadow-panel);
      }
      .wrap[data-state='error'] .canvas,
      .wrap[data-state='error'] .overlay {
        outline: 1px solid var(--danger-ink);
        outline-offset: -1px;
      }
      .spinner {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 3px solid var(--border);
        border-top-color: var(--accent-deep);
        animation: spin 800ms linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
          border-top-color: var(--border);
        }
      }
      .canvas--hidden {
        visibility: hidden;
      }
      .overlay {
        position: absolute;
        inset: 0 0 auto 0;
        height: var(--map-height, 280px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 16px;
        text-align: center;
        border-radius: var(--radius-panel);
      }
      .overlay {
        background: var(--ground-2);
      }
      .overlay--notice {
        background: var(--panel-2);
        color: var(--ink);
      }
      .overlay--notice strong {
        font-size: var(--fs-15);
      }
      .overlay--notice app-icon {
        color: var(--ink-3);
      }
      .wrap[data-state='error'] .overlay--notice app-icon {
        color: var(--danger-ink);
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        align-items: center;
        color: var(--ink-2);
      }
      .legend__item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .legend__dash {
        width: 22px;
        height: 0;
        border-top: 3px dashed var(--accent-deep);
        opacity: 0.7;
      }
    `,
  ],
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
      this.instance = await this.provider.mount(this.container().nativeElement, { center }, (id) => this.markerSelect.emit(id));
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
