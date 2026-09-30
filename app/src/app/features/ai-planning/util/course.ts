import { haversineKm } from '../../trips/util/itinerary';
import type { ExpenseCategory } from '../../expenses/model/ledger';
import type { MoveMode, PlanItem } from '../model/ai-plan';

/** 카드 사이의 이동. 수단·분은 모델 추정, 직선거리는 확인된 좌표로 계산한 값이다. */
export interface CourseLeg {
  readonly mode: MoveMode | null;
  readonly minutes: number | null;
  readonly km: number | null;
}

export interface CourseEntry {
  /** day는 사용자가 옮긴 일차가 반영된 값이다. */
  readonly item: PlanItem;
  /** 옮긴 항목은 모델 시각이 맞지 않으므로 미정이다. */
  readonly start: string | null;
  readonly moved: boolean;
  readonly selected: boolean;
  /** 앞의 선택된 항목에서 오는 이동. 선택된 항목에만 있고 그날 첫 선택 항목은 null이다. */
  readonly legFromPrev: CourseLeg | null;
}

export interface DayCourse {
  readonly day: number;
  readonly entries: readonly CourseEntry[];
}

/**
 * 결과를 일차별 시간순 코스로 늘어놓는다. 순수 계산이라 화면과 담기가 같이 쓴다.
 *
 * 모델 이동시간은 모델이 짠 바로 다음 항목까지의 추정이다. 사이 항목이 빠졌거나(장소 확인
 * 실패·해제) 순서가 바뀌면(일차 이동) 맞지 않으므로 버리고, 확인된 좌표의 직선거리만 남긴다.
 * 숙소는 그날의 마지막 자리에 둔다. 옮겨 온 항목은 숙소 앞에 붙는다.
 */
export function buildCourses(
  results: readonly PlanItem[],
  selected: ReadonlySet<string>,
  overrides: Readonly<Record<string, number>>,
  days: readonly number[],
): DayCourse[] {
  const isMoved = (i: PlanItem) => overrides[i.id] !== undefined && overrides[i.id] !== i.day;
  const byOrder = (a: PlanItem, b: PlanItem) => a.order - b.order;
  const courses: DayCourse[] = [];
  for (const day of days) {
    const own = results.filter((i) => (overrides[i.id] ?? i.day) === day);
    const kept = own.filter((i) => i.kind !== 'stay' && !isMoved(i)).sort(byOrder);
    const moved = own.filter((i) => i.kind !== 'stay' && isMoved(i));
    const stays = [
      ...own.filter((i) => i.kind === 'stay' && !isMoved(i)).sort(byOrder),
      ...own.filter((i) => i.kind === 'stay' && isMoved(i)),
    ];
    const ordered = [...kept, ...moved, ...stays];
    if (!ordered.length) continue;

    let prev: PlanItem | null = null;
    const entries = ordered.map((raw): CourseEntry => {
      const wasMoved = isMoved(raw);
      const isSelected = selected.has(raw.id);
      let leg: CourseLeg | null = null;
      if (isSelected && prev) {
        // 모델이 바로 이어서 짠 두 곳일 때만 모델 이동을 믿는다.
        const adjacent = !isMoved(prev) && !wasMoved && prev.day === raw.day && raw.order === prev.order + 1;
        const move = adjacent ? prev.moveToNext : null;
        leg = {
          mode: move?.mode ?? null,
          minutes: move?.minutes ?? null,
          km:
            prev.location && raw.location
              ? Math.round(haversineKm(prev.location, raw.location) * 10) / 10
              : null,
        };
      }
      if (isSelected) prev = raw;
      return {
        item: wasMoved ? { ...raw, day } : raw,
        start: wasMoved ? null : raw.start,
        moved: wasMoved,
        selected: isSelected,
        legFromPrev: leg,
      };
    });
    courses.push({ day, entries });
  }
  return courses;
}

/** AI 예산 묶음. 가계부 분류와 같은 키를 쓰고, 계산하지 않는 교통만 뺀다. */
export type BudgetGroup = Exclude<ExpenseCategory, 'transport'>;
export const BUDGET_GROUPS: readonly BudgetGroup[] = ['food', 'stay', 'activity', 'shopping', 'other'];
