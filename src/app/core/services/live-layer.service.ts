import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export interface LiveLayerData {
  data: unknown;
  cachedAt: string;
  fromCache: boolean;
}

/** Proxy+cache d'une couche vivante (capteur externe) - voir plan "Couches vivantes + rapport
 * de fraîcheur" du 2026-08-06. La couche doit avoir `metadata.live = {url, ttlSeconds,
 * refreshSeconds}` configuré côté admin (via le PATCH /layers/:id générique, aucune route
 * dédiée nécessaire pour la configuration). */
@Injectable({ providedIn: 'root' })
export class LiveLayerService {
  private readonly api = inject(ApiService);

  getLiveData(layerId: string): Observable<LiveLayerData> {
    return this.api.get<LiveLayerData>(`/layers/${layerId}/live`);
  }
}
