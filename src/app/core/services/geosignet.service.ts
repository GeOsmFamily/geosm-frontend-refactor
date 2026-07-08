import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

export interface Geosignet {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
}

@Injectable({ providedIn: 'root' })
export class GeosignetService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  list(): Observable<Geosignet[]> {
    return this.api.get<Geosignet[]>('/geosignets');
  }

  create(dto: { name: string; center: number[]; zoom: number }): Observable<Geosignet> {
    return this.api.post<Geosignet>('/geosignets', dto);
  }

  delete(id: string): Observable<void> {
    // The backend returns 204 No Content — bypass ApiService which expects a JSON envelope
    return this.http
      .delete(`${this.baseUrl}/geosignets/${id}`, { observe: 'response' })
      .pipe(map(() => undefined as void));
  }
}
