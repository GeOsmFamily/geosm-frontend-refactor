import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { Feature, Layer, PaginatedResponse } from '../models/index';

export interface FeatureCollectionResponse {
  type: 'FeatureCollection';
  features: Feature[];
}

@Injectable({ providedIn: 'root' })
export class LayerService {
  private readonly api = inject(ApiService);

  list(instanceId: string, params?: Record<string, any>): Observable<PaginatedResponse<Layer>> {
    return this.api.getPaginated<Layer>(`/instances/${instanceId}/layers`, params);
  }

  getById(instanceId: string, id: string): Observable<Layer> {
    return this.api.get<Layer>(`/instances/${instanceId}/layers/${id}`);
  }

  create(instanceId: string, dto: Partial<Layer>): Observable<Layer> {
    return this.api.post<Layer>(`/instances/${instanceId}/layers`, dto);
  }

  update(instanceId: string, id: string, dto: Partial<Layer>): Observable<Layer> {
    return this.api.patch<Layer>(`/instances/${instanceId}/layers/${id}`, dto);
  }

  delete(instanceId: string, id: string): Observable<void> {
    return this.api.delete<void>(`/instances/${instanceId}/layers/${id}`);
  }

  /**
   * Retourne une vraie GeoJSON FeatureCollection (pas une pagination classique
   * {data, meta}) - le backend renvoie {type, features}. Accepte bbox (chaîne
   * "minLon,minLat,maxLon,maxLat"), limit, offset en params.
   */
  getFeatures(layerId: string, params?: Record<string, any>): Observable<FeatureCollectionResponse> {
    return this.api.get<FeatureCollectionResponse>(`/layers/${layerId}/features`, params);
  }
}
