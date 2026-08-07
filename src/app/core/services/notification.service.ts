import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  data: AppNotification[];
  total: number;
  unreadCount: number;
}

/** Centre de notifications unifié (voir plan "Centre de notifications unifié + plan de
 * scalabilité documenté" du 2026-08-06) - complète le tiroir de tâches (JobsTrayService,
 * événements de jobs asynchrones) plutôt que de le remplacer : couvre des événements "métier"
 * sans tâche de fond associée (réponse à un commentaire, changement de statut d'un
 * signalement...). Persisté côté backend (voir NotificationService.notifyUser), donc visible
 * même après une déconnexion/reconnexion, contrairement au tiroir de tâches qui ne vit qu'en
 * localStorage côté client. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);

  list(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Observable<NotificationsPage> {
    return this.api.get<NotificationsPage>('/notifications', params as Record<string, unknown>);
  }

  markRead(id: string): Observable<AppNotification> {
    return this.api.post<AppNotification>(`/notifications/${id}/read`, {});
  }

  markAllRead(): Observable<{ count: number }> {
    return this.api.post<{ count: number }>('/notifications/read-all', {});
  }
}
