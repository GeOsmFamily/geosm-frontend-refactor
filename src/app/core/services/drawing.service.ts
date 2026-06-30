import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { Drawing } from '../models/index';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DrawingService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Liste les dessins de l'utilisateur courant pour une instance.
   * Route backend : GET /api/v1/drawings?instanceId=...
   */
  list(instanceId: string): Observable<Drawing[]> {
    return this.api.get<Drawing[]>('/drawings', { instanceId });
  }

  getById(id: string): Observable<Drawing> {
    return this.api.get<Drawing>(`/drawings/${id}`);
  }

  create(dto: Partial<Drawing>): Observable<Drawing> {
    return this.api.post<Drawing>('/drawings', dto);
  }

  /**
   * Supprime un dessin. Le backend retourne 204 No Content →
   * on utilise HttpClient directement pour éviter l'erreur de parsing JSON.
   */
  delete(id: string): Observable<void> {
    return this.http
      .delete(`${this.baseUrl}/drawings/${id}`, { observe: 'response' })
      .pipe(map(() => undefined as void));
  }
}
