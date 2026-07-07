import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { ApiService } from './api.service';
import { Instance, InstanceUser, PaginatedResponse, Role } from '../models/index';

export interface CreateInstanceTemplateDTO {
  name: string;
  slug: string;
  description?: string;
  thematiques?: string[];
}

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

  /** Reservé SUPER_ADMIN côté backend - crée une instance pré-remplie avec la structure par défaut (thèmes, couches, fonds de carte). */
  createFromTemplate(dto: CreateInstanceTemplateDTO): Observable<Instance> {
    return this.api.post<Instance>('/admin/instances/template', dto);
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

  // --- Utilisateurs d'une instance (SUPER_ADMIN ou ADMIN_INSTANCE) ---

  getUsers(instanceId: string): Observable<InstanceUser[]> {
    return this.api.get<InstanceUser[]>(`/instances/${instanceId}/users`);
  }

  addUser(instanceId: string, userId: string, role?: Role): Observable<InstanceUser> {
    return this.api.post<InstanceUser>(`/instances/${instanceId}/users`, { userId, role });
  }

  removeUser(instanceId: string, userId: string): Observable<void> {
    return this.api.delete<void>(`/instances/${instanceId}/users/${userId}`);
  }

  changeUserRole(instanceId: string, userId: string, role: Role): Observable<InstanceUser> {
    return this.api.patch<InstanceUser>(`/instances/${instanceId}/users/${userId}/role`, { role });
  }
}
