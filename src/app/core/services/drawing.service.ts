import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service.js';
import { Drawing } from '../models/index.js';

@Injectable({ providedIn: 'root' })
export class DrawingService {
  private readonly api = inject(ApiService);

  list(instanceId: string): Observable<Drawing[]> {
    return this.api.get<Drawing[]>(`/instances/${instanceId}/drawings`);
  }

  getById(id: string): Observable<Drawing> {
    return this.api.get<Drawing>(`/drawings/${id}`);
  }

  create(dto: Partial<Drawing>): Observable<Drawing> {
    return this.api.post<Drawing>('/drawings', dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/drawings/${id}`);
  }
}
