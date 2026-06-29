import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { RouteResult } from '../models/index';

@Injectable({ providedIn: 'root' })
export class RoutingService {
  private readonly api = inject(ApiService);

  startCoord: [number, number] | null = null;
  endCoord: [number, number] | null = null;

  getRoute(
    coordinates: [number, number][],
    profile: string = 'driving',
    options?: Record<string, any>,
  ): Observable<RouteResult> {
    const coordsStr = coordinates.map((c) => `${c[0]},${c[1]}`).join(';');
    const params: Record<string, any> = {
      coordinates: coordsStr,
      profile,
      geometries: 'geojson',
      steps: true,
      ...options,
    };
    return this.api.get<RouteResult>('/routing/route', params);
  }

  getNearest(lon: number, lat: number): Observable<any> {
    return this.api.get<any>('/routing/nearest', { lon, lat });
  }
}

