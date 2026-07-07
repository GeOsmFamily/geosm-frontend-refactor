import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

export interface DetailedHealth {
  status: string;
  uptime: number;
  timestamp: string;
  checks: {
    postgresql: HealthCheckResult;
    redis: HealthCheckResult;
    minio: HealthCheckResult;
    meilisearch: HealthCheckResult;
    qgisServer: HealthCheckResult;
    disk: { usagePercent: number; free: string; total: string };
    memory: { usagePercent: number; totalMB: number; freeMB: number; heapUsedMB: number };
    queues: Record<string, Record<string, number>>;
  };
}

/**
 * GET /health/detailed est monté hors du préfixe /api/v1 (public, pas d'auth - voir
 * health.routes.ts) - contrairement à tous les autres services qui utilisent ApiService,
 * on construit ici l'URL depuis l'origine brute.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly origin = environment.apiUrl.replace(/\/api\/v\d+$/, '');

  getDetailed(): Observable<DetailedHealth> {
    return this.http
      .get<{ success: boolean; data: DetailedHealth }>(`${this.origin}/health/detailed`)
      .pipe(map((res) => res.data));
  }
}
