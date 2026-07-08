import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export interface NearestFeatureResult {
  id: string;
  name: string | null;
  lon: number;
  lat: number;
  distance: number;
  duration: number | null;
  routed: boolean;
}

@Injectable({ providedIn: 'root' })
export class NearestFeatureService {
  private readonly api = inject(ApiService);

  find(layerId: string, lon: number, lat: number, limit = 3): Observable<NearestFeatureResult[]> {
    return this.api.get<NearestFeatureResult[]>('/routing/nearest-feature', {
      layerId,
      lon,
      lat,
      limit,
    });
  }
}
