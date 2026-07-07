import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { DefaultTag, DefaultTheme } from '../models/index';

/** GET /default-themes est global (pas par instance) - sert de modèle réutilisé à la création
 * de nouvelles instances (voir 28.7 Pré-remplissage des Thèmes). Mutations réservées SUPER_ADMIN. */
@Injectable({ providedIn: 'root' })
export class DefaultThemeService {
  private readonly api = inject(ApiService);

  list(): Observable<DefaultTheme[]> {
    return this.api.get<DefaultTheme[]>('/default-themes');
  }

  getById(id: string): Observable<DefaultTheme> {
    return this.api.get<DefaultTheme>(`/default-themes/${id}`);
  }

  create(dto: Partial<DefaultTheme>): Observable<DefaultTheme> {
    return this.api.post<DefaultTheme>('/default-themes', dto);
  }

  update(id: string, dto: Partial<DefaultTheme>): Observable<DefaultTheme> {
    return this.api.patch<DefaultTheme>(`/default-themes/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/default-themes/${id}`);
  }

  listTags(themeId: string): Observable<DefaultTag[]> {
    return this.api.get<DefaultTag[]>(`/default-themes/${themeId}/tags`);
  }

  createTag(themeId: string, dto: { name: string; slug: string }): Observable<DefaultTag> {
    return this.api.post<DefaultTag>(`/default-themes/${themeId}/tags`, dto);
  }

  seed(): Observable<DefaultTheme[]> {
    return this.api.post<DefaultTheme[]>('/default-themes/seed', {});
  }
}
