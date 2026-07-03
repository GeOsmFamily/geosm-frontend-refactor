import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { LocationPlan } from '../models/index';
import { environment } from '../../../environments/environment';

export interface CreateLocationPlanDTO {
  instanceId: string;
  title: string;
  description?: string;
  landmark?: string;
  lon: number;
  lat: number;
  scale?: number;
  paperSize?: 'A4' | 'A3';
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
}

@Injectable({ providedIn: 'root' })
export class LocationPlanService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  create(dto: CreateLocationPlanDTO): Observable<LocationPlan> {
    return this.api.post<LocationPlan>('/location-plans', dto);
  }

  getById(id: string): Observable<LocationPlan> {
    return this.api.get<LocationPlan>(`/location-plans/${id}`);
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/location-plans/${id}/download`, {
      responseType: 'blob',
    });
  }
}
