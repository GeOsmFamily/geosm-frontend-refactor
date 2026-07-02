import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { ApiService } from './api.service';
import { Instance, PaginatedResponse } from '../models/index';

@Injectable({ providedIn: 'root' })
export class InstanceService {
  private readonly api = inject(ApiService);

  readonly currentInstance$ = new BehaviorSubject<Instance | null>(null);

  list(params?: Record<string, any>): Observable<PaginatedResponse<Instance>> {
    return this.api.getPaginated<Instance>('/instances', params);
  }

  getById(id: string): Observable<Instance> {
    return this.api.get<Instance>(`/instances/${id}`);
  }

  /** Route publique (pas d'authentification requise) - utilisée par les liens de partage. */
  getBySlug(slug: string): Observable<Instance> {
    return this.api.get<Instance>(`/instances/slug/${slug}`);
  }

  create(dto: Partial<Instance>): Observable<Instance> {
    return this.api.post<Instance>('/instances', dto);
  }

  update(id: string, dto: Partial<Instance>): Observable<Instance> {
    return this.api.patch<Instance>(`/instances/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/instances/${id}`);
  }

  setCurrentInstance(instance: Instance): void {
    this.currentInstance$.next(instance);
  }
}
