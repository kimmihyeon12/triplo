import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiBarcode } from '../../../../shared/ui/barcode/barcode';
import { UiPostmark } from '../../../../shared/ui/postmark/postmark';
import {
  sectionSummary,
  type ItinerarySection,
  type ItineraryTicket,
} from '../../util/itinerary-image';

@Component({
  selector: 'app-itinerary-snapshot',
  templateUrl: './itinerary-snapshot.html',
  imports: [IconComponent, UiBarcode, UiPostmark],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItinerarySnapshot {
  readonly ticket = input.required<ItineraryTicket>();
  readonly sections = input.required<ItinerarySection[]>();
  readonly includeCosts = input(false);
  /** 접힌 날짜 키. 비어 있으면 전부 펼친 상태다. */
  readonly collapsed = input<ReadonlySet<string>>(new Set<string>());
  /** 날짜를 접고 펼 수 있게 할지. 끄면 제목을 버튼으로 만들지 않는다. */
  readonly foldable = input(false);
  readonly toggled = output<string>();

  /** 전부 접혔으면 일정 목록 자리를 비우고 티켓 한 장만 남긴다. */
  readonly allFolded = computed(() => {
    const sections = this.sections();
    return sections.length > 0 && sections.every((s) => this.collapsed().has(s.key));
  });

  summary(section: ItinerarySection): string {
    return sectionSummary(section, this.includeCosts());
  }
}
