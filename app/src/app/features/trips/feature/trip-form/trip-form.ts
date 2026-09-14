import { UiField } from '../../../../shared/ui/field/field';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiButton } from '../../../../shared/ui/button/button';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TripEditorStore } from '../../data/trip-editor-store';
import { formatNights, validateTripDates } from '../../../../shared/util/dates';
import { createRegion, createTrip } from '../../util/factories';
import { type Trip, type TripRegion } from '../../model/trip';
import {
  applyPeriodChange,
  periodChangeImpact,
  regionRemovalImpact,
  removeRegion,
} from '../../util/period';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { PageBar } from '../../../../core/page-bar';
import { SaveStatusComponent } from '../../../../shared/ui/save-status/save-status';

interface RegionDraft {
  id: string;
  name: string;
  isNew: boolean;
}

@Component({
  selector: 'app-trip-form',
  imports: [
    UiButton,
    UiInput,
    UiBadge,
    UiNotice,
    UiActionBar,
    UiField,
    FormsModule,
    RouterLink,
    IconComponent,
    SaveStatusComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-form.html',
})
export class TripFormPage {
  readonly id = input<string | undefined>();
  readonly store = inject(TripEditorStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageBar = inject(PageBar);

  readonly isEdit = computed(() => !!this.id());
  readonly original = signal<Trip | null>(null);

  readonly title = signal('');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly regions = signal<RegionDraft[]>([]);
  readonly regionInput = signal('');
  readonly impactConfirmed = signal(false);

  readonly dateValidation = computed(() => validateTripDates(this.startDate(), this.endDate()));
  readonly dateError = computed(() =>
    this.dateValidation().ok ? null : (this.dateValidation() as { message: string }).message,
  );
  readonly nightsText = computed(() => {
    const v = this.dateValidation();
    return v.ok && !v.undecided ? formatNights(this.startDate(), this.endDate()) : '';
  });

  readonly backLink = computed(() => (this.id() ? ['/trips', this.id()!] : ['/trips']));

  /** 편집 시 기간 변경·지역 삭제 영향 설명 */
  readonly impactLines = computed(() => {
    const orig = this.original();
    if (!orig || !this.dateValidation().ok) return [];
    const lines: string[] = [];
    const start = this.startDate() || null;
    const end = this.endDate() || null;
    const impact = periodChangeImpact(orig, start, end);
    if (impact.displacedStops.length > 0) {
      lines.push(
        `장소 ${impact.displacedStops.length}개가 새 기간 밖에 있어 미배치로 이동합니다: ${impact.displacedStops.map((s) => s.name).join(', ')}`,
      );
    }
    if (impact.outOfRangeStays.length > 0) {
      lines.push(
        `숙소 ${impact.outOfRangeStays.length}개가 여행 기간 밖이 됩니다(보존됨): ${impact.outOfRangeStays.map((s) => s.name).join(', ')}`,
      );
    }
    const keptIds = new Set(this.regions().map((r) => r.id));
    for (const r of orig.regions) {
      if (keptIds.has(r.id)) continue;
      const ri = regionRemovalImpact(orig, r.id);
      if (ri.stopCount + ri.stayCount > 0) {
        lines.push(
          `지역 ‘${r.name}’ 삭제: 장소 ${ri.stopCount}개·숙소 ${ri.stayCount}개의 지역 표시가 해제됩니다(항목은 보존)`,
        );
      }
    }
    return lines;
  });

  readonly canSave = computed(
    () =>
      this.dateValidation().ok &&
      (this.impactLines().length === 0 || this.impactConfirmed()) &&
      this.store.saveState() !== 'saving',
  );

  constructor() {
    // 상단 바: ‹ 뒤로 + 화면 제목. 저장은 하단 고정 바에 둔다.
    effect(() => {
      this.pageBar.set({
        title: this.isEdit() ? '여행 편집' : '여행 만들기',
        back: this.backLink(),
        action: null,
      });
    });
    effect((onCleanup) => {
      let active = true;
      onCleanup(() => {
        active = false;
      });
      const id = this.id();
      this.original.set(null);
      this.title.set('');
      this.startDate.set('');
      this.endDate.set('');
      this.regions.set([]);
      this.regionInput.set('');
      this.impactConfirmed.set(false);
      if (!id) {
        this.original.set(null);
        return;
      }
      void this.store.open(id).then((trip) => {
        if (!active) return;
        this.original.set(trip);
        if (trip) {
          this.title.set(trip.title);
          this.startDate.set(trip.startDate ?? '');
          this.endDate.set(trip.endDate ?? '');
          this.regions.set(trip.regions.map((r) => ({ id: r.id, name: r.name, isNew: false })));
        }
      });
    });
  }

  addRegion(event?: Event): void {
    event?.preventDefault();
    const name = this.regionInput().trim();
    if (!name) return;
    this.regions.update((list) => [
      ...list,
      { id: createRegion(name, list.length).id, name, isNew: true },
    ]);
    this.regionInput.set('');
  }

  moveRegion(index: number, delta: number): void {
    this.regions.update((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  removeRegionDraft(index: number): void {
    this.regions.update((list) => list.filter((_, i) => i !== index));
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSave()) return;
    const start = this.startDate() || null;
    const end = this.endDate() || null;
    const regions: TripRegion[] = this.regions().map((r, i) => ({
      id: r.id,
      name: r.name,
      order: i,
    }));
    let next: Trip;
    const orig = this.original();
    if (orig) {
      next = applyPeriodChange(orig, start, end);
      const keptIds = new Set(regions.map((r) => r.id));
      for (const r of orig.regions) if (!keptIds.has(r.id)) next = removeRegion(next, r.id);
      next = { ...next, title: this.title().trim() || '새 여행', regions };
    } else {
      next = createTrip({ title: this.title(), startDate: start, endDate: end, regions });
    }
    const routeId = this.id();
    this.original.set(next);
    const ok = await this.store.commit(next);
    if (ok && !this.destroyRef.destroyed && this.id() === routeId)
      void this.router.navigate(['/trips', next.id]);
  }
}
