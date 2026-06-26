import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service.js';
import { RouteResult } from '../models/index.js';

@Injectable({ providedIn: 'root' })
export class RoutingService {
  private readonly api = inject(ApiService);

  getRoute(
    coordinates: [number, number][],
    profile: string = 'driving',
    options?: Record<string, any>,
  ): Observable<RouteResult> {
    return this.api.post<RouteResult>('/routing/route', { coordinates, profile, ...options });
  }

  getNearest(lon: number, lat: number): Observable<any> {
    return this.api.get<any>('/routing/nearest', { lon, lat });
  }
}
