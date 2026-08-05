import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface NotificationEvent {
  event: string;
  data: unknown;
  timestamp: number;
}

const RECONNECT_DELAY_MS = 3000;

/**
 * Client du canal temps réel `GET /ws/notifications` (voir NotificationService côté backend) -
 * déjà utilisé par export/import/plan de localisation, mais jusqu'ici sans aucun consommateur
 * frontend (vérifié avant le lot "tiroir de tâches" du 2026-08-05). Connexion unique au niveau
 * racine de l'app (voir MapLayoutComponent), reconnexion automatique.
 *
 * Le WebSocket natif du navigateur ne permet pas de fixer d'en-tête `Authorization` sur la
 * requête de handshake - le token passe donc en query string (`?token=...`), seule option
 * praticable ; voir le préHandler `authenticateWs` côté backend qui l'accepte en plus de l'en-tête.
 */
@Injectable({ providedIn: 'root' })
export class NotificationSocketService {
  private readonly authService = inject(AuthService);

  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyDisconnected = false;

  private readonly eventsSubject = new Subject<NotificationEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  /** Idempotent - appeler plusieurs fois ne rouvre pas une connexion déjà active. */
  connect(): void {
    this.manuallyDisconnected = false;
    if (this.socket) return;

    const token = this.authService.getToken();
    if (!token) return;

    const socket = new WebSocket(this.buildWsUrl(token));
    this.socket = socket;

    socket.onmessage = (ev: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(ev.data) as { type?: string; event?: string };
        if (parsed.type === 'pong' || !parsed.event) return;
        this.eventsSubject.next(parsed as unknown as NotificationEvent);
      } catch {
        // Message non-JSON ou inattendu - ignoré.
      }
    };
    socket.onclose = () => {
      this.socket = null;
      if (!this.manuallyDisconnected) this.scheduleReconnect();
    };
    socket.onerror = () => socket.close();
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private buildWsUrl(token: string): string {
    let base: string;
    if (environment.apiUrl.startsWith('http')) {
      // Dev: "http://localhost:3005/api/v1" -> "ws://localhost:3005" ("/ws/notifications" est
      // monté à la racine côté backend, pas sous le préfixe "/api/v1" des routes REST).
      base = environment.apiUrl.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '');
    } else {
      // Prod: apiUrl relatif ("/api/v1"), même origine que la page servie.
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      base = `${protocol}://${window.location.host}`;
    }
    return `${base}/ws/notifications?token=${encodeURIComponent(token)}`;
  }
}
