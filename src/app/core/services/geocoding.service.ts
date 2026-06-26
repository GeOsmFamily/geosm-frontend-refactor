import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { GeocodingResult } from '../models/index';

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly api = inject(ApiService);

  search(q: string, options?: Record<string, any>): Observable<GeocodingResult[]> {
    return this.api.get<GeocodingResult[]>('/geocoding/search', { q, ...options });
  }

  reverse(lat: number, lon: number): Observable<GeocodingResult> {
    return this.api.get<GeocodingResult>('/geocoding/reverse', { lat, lon });
  }

  lookup(osmIds: string[]): Observable<GeocodingResult[]> {
    return this.api.get<GeocodingResult[]>('/geocoding/lookup', { osm_ids: osmIds.join(',') });
  }
}
