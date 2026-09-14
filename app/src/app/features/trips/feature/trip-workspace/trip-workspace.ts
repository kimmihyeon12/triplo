import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TripEditorStore } from '../../data/trip-editor-store';

/** Kept alive when moving between a trip's detail, place, and stay routes. */
@Component({
  selector: 'app-trip-workspace',
  imports: [RouterOutlet],
  providers: [TripEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-workspace.html',
})
export class TripWorkspace {}
