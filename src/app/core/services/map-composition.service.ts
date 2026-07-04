import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { MapComposition, MapCompositionLayerRef } from '../models/index';
import { environment } from '../../../environments/environment';

export interface CreateMapCompositionDTO {
  name: string;
  slug: string;
  description?: string;
  layers: MapCompositionLayerRef[];
  center: { lat: number; lon: number };
  zoom?: number;
  isPublic?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MapCompositionService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  list(instanceId: string): Observable<MapComposition[]> {
    return this.api.get<MapComposition[]>(`/instances/${instanceId}/maps`);
  }

  create(instanceId: string, dto: CreateMapCompositionDTO): Observable<MapComposition> {
    return this.api.post<MapComposition>(`/instances/${instanceId}/maps`, dto);
  }

  delete(instanceId: string, id: string): Observable<void> {
    // Le backend renvoie 204 No Content - ApiService.delete() attend un corps JSON
    // { success, data }, on contourne donc avec http.delete direct (même pattern que
    // GeosignetService.delete()).
    return this.http
      .delete(`${this.baseUrl}/instances/${instanceId}/maps/${id}`, { observe: 'response' })
      .pipe(map(() => undefined as void));
  }
}
