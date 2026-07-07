import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { PaginatedResponse, Role, User } from '../models/index';

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string | null;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

/**
 * Gestion globale des utilisateurs - GET/POST/PATCH/DELETE /users sont réservés à SUPER_ADMIN
 * côté backend (voir user.routes.ts) ; ADMIN_INSTANCE gère ses utilisateurs uniquement via
 * InstanceService (endpoints /instances/:instanceId/users, portée différente).
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  list(params?: ListUsersParams): Observable<PaginatedResponse<User>> {
    return this.api.getPaginated<User>('/users', params as Record<string, unknown>);
  }

  getById(id: string): Observable<User> {
    return this.api.get<User>(`/users/${id}`);
  }

  create(dto: CreateUserDTO): Observable<User> {
    return this.api.post<User>('/users', dto);
  }

  update(id: string, dto: UpdateUserDTO): Observable<User> {
    return this.api.patch<User>(`/users/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/users/${id}`);
  }

  changeRole(id: string, role: Role): Observable<User> {
    return this.api.patch<User>(`/users/${id}/role`, { role });
  }

  toggleActive(id: string, isActive: boolean): Observable<User> {
    return this.api.patch<User>(`/users/${id}/activate`, { isActive });
  }
}
