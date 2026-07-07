import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export interface ContainerSummary {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
}

/** Lot A8 admin - infra Docker en lecture seule (pas de start/stop/restart, décision produit). */
@Injectable({ providedIn: 'root' })
export class AdminDockerService {
  private readonly api = inject(ApiService);

  listContainers(): Observable<ContainerSummary[]> {
    return this.api.get<ContainerSummary[]>('/admin/docker/containers');
  }

  getStats(id: string): Observable<ContainerStats> {
    return this.api.get<ContainerStats>(`/admin/docker/containers/${id}/stats`);
  }

  getLogs(id: string, tail = 200): Observable<{ logs: string }> {
    return this.api.get<{ logs: string }>(`/admin/docker/containers/${id}/logs`, { tail });
  }
}
