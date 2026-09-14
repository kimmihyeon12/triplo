import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ItinerarySection } from '../../util/itinerary-image';

@Component({
  selector: 'app-itinerary-snapshot',
  templateUrl: './itinerary-snapshot.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItinerarySnapshot {
  readonly title = input.required<string>();
  readonly sections = input.required<ItinerarySection[]>();
  readonly includeCosts = input(false);
}
