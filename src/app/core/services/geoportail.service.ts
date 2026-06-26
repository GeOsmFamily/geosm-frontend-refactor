import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ElevationProfile } from '../models/index';

@Injectable({ providedIn: 'root' })
export class GeoportailService {
  private readonly api = inject(ApiService);

  getAltitude(lon: number, lat: number): Observable<any> {
    return this.api.get<any>('/geoportail/altitude', { lon, lat });
  }

  getElevationProfile(geometry: GeoJSON.Geometry, numPoints?: number): Observable<ElevationProfile> {
    return this.api.post<ElevationProfile>('/geoportail/elevation-profile', { geometry, numPoints });
  }

  getAdminBoundary(lat: number, lon: number, table?: string): Observable<any> {
    return this.api.get<any>('/geoportail/admin-boundary', { lat, lon, table });
  }

  geolocate(): Observable<any> {
    return this.api.get<any>('/geoportail/geolocate');
  }
}
