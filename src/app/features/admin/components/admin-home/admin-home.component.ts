import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '../../../../core/services/api.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';

/** Shape exacte de GetDashboardUseCase (backend) - voir get-dashboard.use-case.ts. */
interface DashboardStats {
  instanceCount: number;
  userCount: number;
  exportCount: number;
  themeCount: number;
}

/**
 * Page d'accueil admin - squelette de KPI au Lot A1 (comptages globaux via GET /admin/dashboard,
 * seul endpoint existant qui agrège tous les utilisateurs/toutes les instances). Un comptage de
 * couches n'est pas inclus ici : GET /layers est scopé par instance
 * (/instances/:instanceId/layers, pas un endpoint global) - un compteur global de couches sera
 * ajouté côté backend au Lot A7 en même temps que les autres enrichissements de ce endpoint.
 */
@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, TranslateModule, StatCardComponent],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss',
})
export class AdminHomeComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly stats = signal<DashboardStats | null>(null);

  ngOnInit(): void {
    this.api.get<DashboardStats>('/admin/dashboard').subscribe({
      next: (dashboard) => {
        this.stats.set(dashboard);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
