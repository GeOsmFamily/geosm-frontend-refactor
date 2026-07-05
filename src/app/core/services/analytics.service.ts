import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { AnalyticsEvent } from '../models/index';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiService);

  // Corrigé : pointait vers /analytics/events et /analytics/views/:type/:id, des routes qui
  // n'ont jamais existé côté backend (les vraies routes sont /analytics/track et
  // /analytics/view, body-based) - ces deux méthodes échouaient silencieusement (404) et
  // n'ont donc jamais enregistré le moindre événement depuis la création de ce service.
  trackEvent(dto: AnalyticsEvent): Observable<void> {
    return this.api.post<void>('/analytics/track', dto);
  }

  incrementView(type: 'layer' | 'instance', id: string): Observable<void> {
    return this.api.post<void>('/analytics/view', { type, id });
  }
}
