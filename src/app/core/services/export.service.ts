import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { Export, PaginatedResponse } from '../models/index';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  create(dto: { format: string; layerId: string; featureId?: string }): Observable<Export> {
    return this.api.post<Export>('/exports', dto);
  }

  createBulk(dto: { format: string; layerIds: string[] }): Observable<Export> {
    return this.api.post<Export>('/exports/bulk', dto);
  }

  list(params?: Record<string, any>): Observable<PaginatedResponse<Export>> {
    return this.api.getPaginated<Export>('/exports', params);
  }

  getById(id: string): Observable<Export> {
    return this.api.get<Export>(`/exports/${id}`);
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/exports/${id}/download`, {
      responseType: 'blob',
    });
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/exports/${id}`);
  }
}
