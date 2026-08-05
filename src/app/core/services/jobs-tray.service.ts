import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationSocketService } from './notification-socket.service';

export type TrayJobType = 'export' | 'import' | 'location-plan';
export type TrayJobStatus = 'processing' | 'completed' | 'failed';

export interface TrayJob {
  /** `${type}:${entityId}` - clé stable pour dédupliquer les mises à jour successives d'un même job. */
  id: string;
  type: TrayJobType;
  /** ID brut (exportId/locationPlanId...) - nécessaire pour appeler le bon service de téléchargement. */
  entityId: string;
  status: TrayJobStatus;
  label: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'geosm_jobs_tray';
// Un historique indéfiniment croissant dans localStorage n'a pas de sens - 24h couvre largement
// le cas d'usage ("je reviens demain, je veux quand même voir hier") sans accumuler pour rien.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_JOBS = 30;

const TYPE_LABELS: Record<TrayJobType, string> = {
  export: 'Export de couche',
  import: 'Import de couche',
  'location-plan': 'Plan de localisation',
};

/**
 * Liste persistante des tâches asynchrones (export, import, plan de localisation - bientôt
 * rapport IA) en cours/récemment terminées, alimentée par NotificationSocketService. Résout le
 * bug "je perds le fil quand je quitte le chat/l'outil" (voir plan "refonte Statistiques" du
 * 2026-08-05) : ces tâches restent visibles depuis n'importe où dans l'app, pas seulement dans
 * le composant qui les a lancées.
 */
@Injectable({ providedIn: 'root' })
export class JobsTrayService {
  private readonly notificationSocket = inject(NotificationSocketService);

  private readonly jobsSubject = new BehaviorSubject<TrayJob[]>(this.loadFromStorage());
  readonly jobs$ = this.jobsSubject.asObservable();

  constructor() {
    this.notificationSocket.events$.subscribe((evt) => this.handleEvent(evt.event, evt.data));
  }

  private handleEvent(event: string, data: unknown): void {
    const [type, phase] = event.split(':') as [TrayJobType | string, string];
    if (type !== 'export' && type !== 'import' && type !== 'location-plan') return;
    const payload = data as {
      exportId?: string;
      locationPlanId?: string;
      status?: string;
      error?: string;
    };
    const entityId = payload.locationPlanId ?? payload.exportId;
    if (!entityId) return;

    const id = `${type}:${entityId}`;
    const status: TrayJobStatus =
      phase === 'completed' ? 'completed' : phase === 'failed' ? 'failed' : 'processing';

    this.upsert({
      id,
      type,
      entityId,
      status,
      label: TYPE_LABELS[type],
      error: payload.error,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  private upsert(job: TrayJob): void {
    const current = this.jobsSubject.value;
    const existing = current.find((j) => j.id === job.id);
    const merged: TrayJob = existing ? { ...existing, ...job, createdAt: existing.createdAt } : job;
    const next = [merged, ...current.filter((j) => j.id !== job.id)]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_JOBS);
    this.jobsSubject.next(next);
    this.saveToStorage(next);
  }

  /** Retire une entrée du tiroir (ex: bouton "fermer" sur un job terminé/échoué). */
  dismiss(id: string): void {
    const next = this.jobsSubject.value.filter((j) => j.id !== id);
    this.jobsSubject.next(next);
    this.saveToStorage(next);
  }

  private loadFromStorage(): TrayJob[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as TrayJob[];
      const cutoff = Date.now() - MAX_AGE_MS;
      return Array.isArray(parsed) ? parsed.filter((j) => j.updatedAt >= cutoff) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(jobs: TrayJob[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    } catch {
      // Quota localStorage dépassé ou navigation privée - le tiroir reste fonctionnel en
      // mémoire pour la session en cours, juste sans persistance entre rechargements.
    }
  }
}
