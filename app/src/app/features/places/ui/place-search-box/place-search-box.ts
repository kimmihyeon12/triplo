import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiButton } from '../../../../shared/ui/button/button';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PlaceCandidate } from '../../model/place';
import type { GeoPoint } from '../../model/place';
import { PLACE_SEARCH, type PlaceSearchAvailability } from '../../data/place-search';
import { IconComponent } from '../../../../shared/ui/icon/icon';

type SearchState =
  'checking' | 'unavailable' | 'idle' | 'searching' | 'results' | 'empty' | 'error';

/** 타이핑을 멈춘 뒤 검색을 시작하기까지 기다리는 시간 */
const DEBOUNCE_MS = 400;
/** 이 길이 미만은 결과가 너무 넓어 호출하지 않는다 */
const MIN_QUERY_LENGTH = 2;

/**
 * 장소 검색 상자. 검색 결과에서 사용자가 고른 후보만 상위 폼으로 넘긴다.
 * 제공자가 없으면(키 미설정) 사유를 보여주고 직접 입력을 안내한다.
 *
 * 타이핑을 멈추면 자동으로 검색한다. 글자마다 부르면 무료 한도를 빠르게 쓰므로
 * 일정 시간 기다린 뒤 한 번만 호출하고, 늦게 온 응답은 순번으로 걸러낸다.
 */
@Component({
  selector: 'app-place-search-box',
  imports: [UiButton, UiInput, UiNotice, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './place-search-box.html',
})
export class PlaceSearchBoxComponent implements OnInit {
  private readonly provider = inject(PLACE_SEARCH);
  private readonly destroyRef = inject(DestroyRef);

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

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * 요청 순번. 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않도록,
   * 응답을 반영하기 전에 자기 순번이 아직 최신인지 확인한다.
   */
  private requestSeq = 0;

  async ngOnInit(): Promise<void> {
    this.query.set(this.initialQuery());
    this.destroyRef.onDestroy(() => this.clearTimer());
    const a = await this.provider.availability();
    this.availability.set(a);
    this.state.set(a.available ? 'idle' : 'unavailable');
  }

  /**
   * 타이핑이 멈추면 자동으로 검색한다.
   * 글자마다 부르면 무료 한도를 빠르게 쓰므로 일정 시간 기다린 뒤 한 번만 호출한다.
   */
  onQueryChange(value: string): void {
    this.query.set(value);
    this.clearTimer();
    if (this.state() === 'unavailable' || this.state() === 'checking') return;

    const q = value.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      // 검색어가 지워지면 이전 결과도 함께 지운다.
      this.requestSeq++;
      this.results.set([]);
      this.total.set(0);
      this.state.set('idle');
      return;
    }
    this.debounceTimer = setTimeout(() => void this.search(), DEBOUNCE_MS);
  }

  onEnter(event: Event): void {
    event.preventDefault();
    // 기다리지 않고 바로 검색한다.
    this.clearTimer();
    void this.search();
  }

  /**
   * 편집 화면에서는 기존 이름이 검색어로 들어와 있다.
   * 다른 곳을 찾으려면 지우는 수고가 드니, 누르면 전체를 골라 바로 덮어쓸 수 있게 한다.
   */
  selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  async search(): Promise<void> {
    const q = this.query().trim();
    if (!q || this.state() === 'unavailable') return;
    this.clearTimer();
    const seq = ++this.requestSeq;
    this.state.set('searching');
    try {
      const r = await this.provider.search(q, { near: this.near() });
      if (seq !== this.requestSeq) return; // 더 새로운 요청이 있으면 버린다
      this.results.set(r.candidates);
      this.total.set(r.total);
      this.state.set(r.candidates.length === 0 ? 'empty' : 'results');
    } catch (e) {
      if (seq !== this.requestSeq) return;
      this.errorMessage.set(e instanceof Error ? e.message : '알 수 없는 오류');
      this.state.set('error');
    }
  }

  pick(candidate: PlaceCandidate): void {
    this.clearTimer();
    // 고른 뒤 남은 응답이 결과 목록을 되살리지 않도록 순번을 올린다.
    this.requestSeq++;
    this.picked.emit(candidate);
    this.results.set([]);
    this.state.set('idle');
  }

  private clearTimer(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
