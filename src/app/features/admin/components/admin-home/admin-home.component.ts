import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

import { ApiService } from '../../../../core/services/api.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';

export interface StaleLayer {
  id: string;
  name: string;
  instanceName: string;
  updatedAt: string;
  daysSinceUpdate: number;
}

export interface DashboardStats {
  instanceCount: number;
  userCount: number;
  exportCount: number;
  themeCount: number;
  layerCount: number;
  boundaryCount: number;
  spatialObjectsCount?: {
    points: number;
    polygons: number;
    lines: number;
  };
  servicesHealth?: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
  lastBackupInfo?: {
    key: string;
    sizeBytes: number;
    lastModified: string;
  };
}

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, TranslateModule, StatCardComponent, MatIconModule, MatCardModule],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss',
})
export class AdminHomeComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly stats = signal<DashboardStats | null>(null);
  readonly staleLayers = signal<StaleLayer[]>([]);
  readonly staleLayersLoading = signal(true);

  ngOnInit(): void {
    this.api.get<DashboardStats>('/admin/dashboard').subscribe({
      next: (dashboard) => {
        this.stats.set(dashboard);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    // Rapport de fraîcheur (voir plan "Couches vivantes + rapport de fraîcheur" du 2026-08-06) -
    // même seuil par défaut (90 jours) que SendLayerFreshnessReportUseCase côté backend.
    this.api.get<StaleLayer[]>('/admin/layers/freshness').subscribe({
      next: (layers) => {
        this.staleLayers.set(layers.slice(0, 8));
        this.staleLayersLoading.set(false);
      },
      error: () => this.staleLayersLoading.set(false),
    });
  }

  formatSizeMb(sizeBytes?: number): string {
    if (!sizeBytes) return '0 Mo';
    return (sizeBytes / (1024 * 1024)).toFixed(2) + ' Mo';
  }
}
