import { inject, Injectable } from '@angular/core';
import { TRIP_REPOSITORY } from '../../trips/data/trip-repository';
import type { VisitFilter } from '../model/visit-stats';
import { savedMarkers } from '../util/saved-markers';

@Injectable()
export class SavedMapPlaces {
  private readonly trips = inject(TRIP_REPOSITORY);
  async read(filter: VisitFilter) { return savedMarkers(await this.trips.list(), filter); }
}
