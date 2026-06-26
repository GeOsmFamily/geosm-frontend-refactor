import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service.js';
import { AnalyticsEvent } from '../models/index.js';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiService);

  trackEvent(dto: AnalyticsEvent): Observable<void> {
    return this.api.post<void>('/analytics/events', dto);
  }

  incrementView(type: string, id: string): Observable<void> {
    return this.api.post<void>(`/analytics/views/${type}/${id}`, {});
  }
}
