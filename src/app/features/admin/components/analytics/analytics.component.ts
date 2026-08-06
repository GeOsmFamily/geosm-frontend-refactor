import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { AnalyticsService } from '../../../../core/services/analytics.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Instance, Role, UsageDashboard } from '../../../../core/models/index';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { ChartCardComponent, ChartCardDataset } from '../../shared/components/chart-card/chart-card.component';

/**
 * Tableau de bord d'usage produit (qui utilise quoi, combien de fois) - voir plan "tableau de
 * bord analytique" du 2026-08-05. Complémentaire de ObservabilityComponent (santé infra), pas
 * un doublon : ici, aucune notion de service up/down, uniquement de l'usage.
 */
@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
    StatCardComponent,
    ChartCardComponent,
  ],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly instanceService = inject(InstanceService);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly dashboard = signal<UsageDashboard | null>(null);
  readonly instances = signal<Instance[]>([]);
  readonly days = signal<number>(30);
  readonly selectedInstanceId = signal<string | undefined>(undefined);

  readonly isSuperAdmin = this.authService.currentUser$.value?.role === Role.SUPER_ADMIN;

  private onlineTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    if (this.isSuperAdmin) {
      this.instanceService.list({ limit: 100 }).subscribe({
        next: (res) => this.instances.set(res.data),
        // Erreur ignorée intentionnellement : le sélecteur d'instance reste vide, la vue
        // plateforme (par défaut) fonctionne quand même.
        error: () => {},
      });
    }
    this.load();
    // Rafraîchit uniquement le compteur "connectés maintenant" - pas tout le tableau de bord,
    // pour éviter de reclignoter les graphiques toutes les 20s.
    this.onlineTimer = setInterval(() => this.refreshOnlineNow(), 20000);
  }

  ngOnDestroy(): void {
    if (this.onlineTimer) clearInterval(this.onlineTimer);
  }

  load(): void {
    this.loading.set(true);
    this.analyticsService.getUsageDashboard(this.selectedInstanceId(), this.days()).subscribe({
      next: (res) => {
        this.dashboard.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private refreshOnlineNow(): void {
    this.analyticsService.getUsageDashboard(this.selectedInstanceId(), this.days()).subscribe({
      next: (res) => {
        const current = this.dashboard();
        if (current) this.dashboard.set({ ...current, onlineNow: res.onlineNow });
      },
      error: () => {},
    });
  }

  onDaysChange(days: number): void {
    this.days.set(days);
    this.load();
  }

  onInstanceChange(instanceId: string | undefined): void {
    this.selectedInstanceId.set(instanceId);
    this.load();
  }

  dailyActivityDatasets(): ChartCardDataset[] {
    const d = this.dashboard();
    if (!d) return [];
    return [
      { label: 'Événements', data: d.dailyEvents.map((e) => e.count), borderColor: '#00ada7' },
      {
        label: 'Utilisateurs actifs',
        data: d.dailyActiveUsers.map((e) => e.count),
        borderColor: '#f59e0b',
      },
    ];
  }

  dailyActivityLabels(): string[] {
    return this.dashboard()?.dailyEvents.map((e) => e.date.slice(5)) ?? [];
  }

  featureUsageDatasets(): ChartCardDataset[] {
    const d = this.dashboard();
    if (!d) return [];
    return [{ label: 'Utilisations', data: d.featureUsage.map((f) => f.count) }];
  }

  featureUsageLabels(): string[] {
    return this.dashboard()?.featureUsage.map((f) => f.label) ?? [];
  }

  toolUsageDatasets(): ChartCardDataset[] {
    const d = this.dashboard();
    if (!d) return [];
    return [{ label: 'Appels', data: d.aiUsage.toolUsage.map((t) => t.count), backgroundColor: 'rgba(0,173,166,0.5)' }];
  }

  toolUsageLabels(): string[] {
    return this.dashboard()?.aiUsage.toolUsage.map((t) => t.tool) ?? [];
  }

  downloadsDatasets(): ChartCardDataset[] {
    const d = this.dashboard();
    if (!d) return [];
    return [{ label: 'Téléchargements', data: d.downloads.map((x) => x.count), backgroundColor: 'rgba(245,158,11,0.5)' }];
  }

  downloadsLabels(): string[] {
    return this.dashboard()?.downloads.map((x) => x.label) ?? [];
  }

  totalEvents(): number {
    return this.dashboard()?.dailyEvents.reduce((sum, e) => sum + e.count, 0) ?? 0;
  }

  totalDownloads(): number {
    return this.dashboard()?.downloads.reduce((sum, d) => sum + d.count, 0) ?? 0;
  }

  /** Utilisateurs distincts actifs aujourd'hui - dernière entrée de la série quotidienne
   * (même définition, jour par jour, que le reste du tableau de bord - pas une notion
   * séparée de "période" qui compterait un même utilisateur plusieurs fois). */
  activeUsersToday(): number {
    const series = this.dashboard()?.dailyActiveUsers ?? [];
    const today = new Date().toISOString().slice(0, 10);
    return series.find((e) => e.date === today)?.count ?? 0;
  }
}
