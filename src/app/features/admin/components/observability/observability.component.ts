import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { HealthService, DetailedHealth } from '../../../../core/services/health.service';
import { ApiService } from '../../../../core/services/api.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { OBSERVABILITY_LINKS } from '../../shared/constants/observability-links';

/** Shape exacte de GetDashboardUseCase (backend) - voir admin-home.component.ts. */
interface DashboardStats {
  instanceCount: number;
  userCount: number;
  exportCount: number;
  themeCount: number;
}

/**
 * Lot A7 admin - pas de nouvelle route backend : /health/detailed et /admin/dashboard couvrent
 * déjà tout ce dont on a besoin, pas de système de métriques métier custom à inventer.
 */
@Component({
  selector: 'app-observability',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
    StatCardComponent,
  ],
  templateUrl: './observability.component.html',
  styleUrl: './observability.component.scss',
})
export class ObservabilityComponent implements OnInit {
  private readonly healthService = inject(HealthService);
  private readonly api = inject(ApiService);

  readonly health = signal<DetailedHealth | null>(null);
  readonly dashboard = signal<DashboardStats | null>(null);
  readonly loading = signal(false);
  readonly links = OBSERVABILITY_LINKS;

  readonly serviceKeys = ['postgresql', 'redis', 'minio', 'meilisearch', 'qgisServer'] as const;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.healthService.getDetailed().subscribe({
      next: (res) => {
        this.health.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api
      .get<DashboardStats>('/admin/dashboard')
      .subscribe({ next: (res) => this.dashboard.set(res) });
  }

  formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  queueEntries(): { name: string; counts: Record<string, number> }[] {
    const queues = this.health()?.checks.queues;
    if (!queues) return [];
    return Object.entries(queues).map(([name, counts]) => ({ name, counts }));
  }
}
