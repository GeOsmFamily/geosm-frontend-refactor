import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service.js';
import { BaseMap } from '../models/index.js';

@Injectable({ providedIn: 'root' })
export class BaseMapService {
  private readonly api = inject(ApiService);

  list(instanceId: string): Observable<BaseMap[]> {
    return this.api.get<BaseMap[]>(`/instances/${instanceId}/base-maps`);
  }

  create(instanceId: string, dto: Partial<BaseMap>): Observable<BaseMap> {
    return this.api.post<BaseMap>(`/instances/${instanceId}/base-maps`, dto);
  }

  update(instanceId: string, id: string, dto: Partial<BaseMap>): Observable<BaseMap> {
    return this.api.patch<BaseMap>(`/instances/${instanceId}/base-maps/${id}`, dto);
  }

  delete(instanceId: string, id: string): Observable<void> {
    return this.api.delete<void>(`/instances/${instanceId}/base-maps/${id}`);
  }
}
