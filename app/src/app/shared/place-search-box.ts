import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PlaceCandidate } from '../domain/location';
import type { GeoPoint } from '../domain/model';
import { PLACE_SEARCH, type PlaceSearchAvailability } from '../integrations/place-search';
import { IconComponent } from './icon';

type SearchState = 'checking' | 'unavailable' | 'idle' | 'searching' | 'results' | 'empty' | 'error';

/**
 * 장소 검색 상자. 검색 결과에서 사용자가 고른 후보만 상위 폼으로 넘긴다.
 * 제공자가 없으면(키 미설정) 사유를 보여주고 직접 입력을 안내한다.
 */
@Component({
  selector: 'app-place-search-box',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box" data-testid="place-search">
      <div class="row search-row">
        <label class="visually-hidden" [for]="inputId()">장소 검색어</label>
        <input
          [id]="inputId()"
          class="input"
          type="search"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          name="placeQuery"
          [placeholder]="placeholder()"
          [disabled]="state() === 'unavailable' || state() === 'checking'"
          (keydown.enter)="onEnter($event)"
          autocomplete="off"
          data-testid="place-query"
        />
        <button type="button" class="btn" (click)="search()" [disabled]="state() === 'unavailable' || state() === 'checking' || state() === 'searching'" data-testid="place-search-btn">
          <app-icon name="search" [size]="16" /> 검색
        </button>
      </div>

      @switch (state()) {
        @case ('checking') {
          <p class="small muted" role="status">검색 제공자 확인 중…</p>
        }
        @case ('unavailable') {
          <div class="notice notice--warn" data-testid="place-search-unavailable">
            <app-icon name="alert" />
            <div class="notice__body">
              <strong>장소 검색이 연결되지 않았습니다.</strong>
              <div class="small">{{ availability()?.reason }}</div>
              <div class="small">이름과 주소를 직접 입력하면 ‘위치 미확인’으로 저장됩니다.</div>
            </div>
          </div>
        }
        @case ('searching') {
          <p class="small muted" role="status">{{ availability()?.providerLabel }}에서 검색 중…</p>
        }
        @case ('empty') {
          <p class="small muted" role="status" data-testid="place-search-empty">검색 결과가 없습니다. 다른 이름이나 주소로 다시 검색하거나 직접 입력하세요.</p>
        }
        @case ('error') {
          <div class="notice notice--danger" role="alert" data-testid="place-search-error">
            <app-icon name="alert" />
            <div class="notice__body">
              <strong>검색에 실패했습니다.</strong>
              <div class="small">{{ errorMessage() }}</div>
              <div class="notice__actions"><button type="button" class="btn btn--sm btn--danger" (click)="search()">다시 검색</button></div>
            </div>
          </div>
        }
        @case ('results') {
          <p class="small muted" role="status">{{ availability()?.providerLabel }} 검색 결과 {{ results().length }}개{{ total() > results().length ? ' (전체 ' + total() + '개 중)' : '' }}. 고르면 이름·주소·좌표가 채워집니다.</p>
          <ul class="results" data-testid="place-results">
            @for (c of results(); track c.provider + c.id) {
              <li>
                <button type="button" class="result" (click)="pick(c)" [attr.data-testid]="'place-result-' + c.id">
                  <span class="result__name">{{ c.name }}</span>
                  <span class="result__meta small muted">
                    @if (c.category) {
                      <span>{{ c.category }} · </span>
                    }
                    {{ c.roadAddress || c.address }}
                  </span>
                </button>
              </li>
            }
          </ul>
        }
        @default {
          <p class="small muted">{{ availability()?.providerLabel }} 검색으로 위치를 확인하거나, 아래에 직접 입력하세요.</p>
        }
      }
    </div>
  `,
  styles: [
    `
      .box {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border-radius: var(--radius-control);
        background: var(--panel-2);
        border: 1px solid var(--border);
      }
      .search-row .input {
        flex: 1;
        min-width: 160px;
      }
      .results {
        display: flex;
        flex-direction: column;
        max-height: 280px;
        overflow-y: auto;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
      }
      .results li + li .result {
        border-top: 1px solid var(--border);
      }
      .result {
        width: 100%;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        border: 0;
        background: var(--panel);
        transition: background-color var(--dur) var(--ease-out);
      }
      .result:hover {
        background: var(--panel-2);
      }
      .result__name {
        font-weight: 700;
      }
    `,
  ],
})
export class PlaceSearchBoxComponent implements OnInit {
  private readonly provider = inject(PLACE_SEARCH);

  readonly inputId = input('place-query');
  readonly placeholder = input('예: 안목해변, 강릉 카페');
  readonly initialQuery = input('');
  /** 검색 결과 우선 지역(선택) */
  readonly near = input<GeoPoint | null>(null);
  readonly picked = output<PlaceCandidate>();

  readonly state = signal<SearchState>('checking');
  readonly availability = signal<PlaceSearchAvailability | null>(null);
  readonly query = signal('');
  readonly results = signal<PlaceCandidate[]>([]);
  readonly total = signal(0);
  readonly errorMessage = signal('');

  async ngOnInit(): Promise<void> {
    this.query.set(this.initialQuery());
    const a = await this.provider.availability();
    this.availability.set(a);
    this.state.set(a.available ? 'idle' : 'unavailable');
  }

  onEnter(event: Event): void {
    event.preventDefault();
    void this.search();
  }

  async search(): Promise<void> {
    const q = this.query().trim();
    if (!q || this.state() === 'unavailable') return;
    this.state.set('searching');
    try {
      const r = await this.provider.search(q, { near: this.near() });
      this.results.set(r.candidates);
      this.total.set(r.total);
      this.state.set(r.candidates.length === 0 ? 'empty' : 'results');
    } catch (e) {
      this.errorMessage.set(e instanceof Error ? e.message : '알 수 없는 오류');
      this.state.set('error');
    }
  }

  pick(candidate: PlaceCandidate): void {
    this.picked.emit(candidate);
    this.results.set([]);
    this.state.set('idle');
  }
}
