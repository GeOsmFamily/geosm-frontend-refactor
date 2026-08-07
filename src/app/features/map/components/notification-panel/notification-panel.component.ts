import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import {
  NotificationService,
  AppNotification,
} from '../../../../core/services/notification.service';
import { NotificationSocketService } from '../../../../core/services/notification-socket.service';

// Types de job (voir JobsTrayService) déjà couverts par le tiroir de tâches, avec leurs
// événements ":progress" très fréquents (plusieurs par job) - notifyUser() les persiste tous
// côté backend (voir plan "Centre de notifications unifié" du 2026-08-06), mais les réafficher
// ICI noierait le panneau sous du bruit déjà visible ailleurs. Seuls les événements "métier"
// sans tâche de fond associée (réponse à un commentaire, changement de statut d'un
// signalement...) sont affichés dans CE panneau.
const JOB_EVENT_PREFIXES = ['export:', 'import:', 'location-plan:', 'analysis-report:'];

function isJobEvent(type: string): boolean {
  return JOB_EVENT_PREFIXES.some((prefix) => type.startsWith(prefix));
}

/**
 * Centre de notifications (icône "boîte de réception" dans la barre du haut, à côté du tiroir
 * de tâches) - voir plan "Centre de notifications unifié + plan de scalabilité documenté" du
 * 2026-08-06. Réutilise la connexion WebSocket déjà ouverte par NotificationSocketService
 * (voir MapLayoutComponent), pas de second socket.
 */
@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
  ],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
})
export class NotificationPanelComponent implements OnInit, OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly notificationSocket = inject(NotificationSocketService);

  private socketSubscription?: Subscription;

  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.load();
    this.socketSubscription = this.notificationSocket.events$.subscribe((evt) => {
      if (isJobEvent(evt.event)) return;
      // Un événement live juste reçu n'a pas encore d'id/createdAt réels connus côté client -
      // on refait un aller-retour léger vers l'API plutôt que de construire un objet
      // approximatif, pour rester la source de vérité unique (id, readAt, etc.).
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.socketSubscription?.unsubscribe();
  }

  load(): void {
    this.notificationService.list({ limit: 20 }).subscribe({
      next: (page) => {
        this.notifications.set(page.data.filter((n) => !isJobEvent(n.type)));
        this.unreadCount.set(page.unreadCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  markRead(notification: AppNotification, event: Event): void {
    event.stopPropagation();
    if (notification.readAt) return;
    this.notificationService.markRead(notification.id).subscribe({
      next: () => this.load(),
      error: () => undefined,
    });
  }

  markAllRead(): void {
    this.notificationService.markAllRead().subscribe({
      next: () => this.load(),
      error: () => undefined,
    });
  }

  label(notification: AppNotification): string {
    if (notification.type === 'comment-reply') {
      const text = notification.payload?.['replyText'];
      return typeof text === 'string'
        ? `Nouvelle réponse : « ${text.slice(0, 60)} »`
        : 'Nouvelle réponse à votre commentaire';
    }
    if (notification.type === 'feedback-status-change') {
      const status = notification.payload?.['status'];
      return `Votre signalement a été mis à jour : ${status}`;
    }
    return notification.type;
  }
}
