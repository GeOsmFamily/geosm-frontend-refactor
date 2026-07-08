import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';

import {
  AdminDockerService,
  ContainerSummary,
  ContainerStats,
} from '../../../../core/services/admin-docker.service';
import { ContainerLogsDialogComponent } from './container-logs-dialog/container-logs-dialog.component';

/**
 * Lot A8 admin - visibilité Docker en LECTURE SEULE (aucune action start/stop/restart, décision
 * produit explicite). Passe par docker-socket-proxy côté backend (voir DockerService).
 */
@Component({
  selector: 'app-infra',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    TranslateModule,
  ],
  templateUrl: './infra.component.html',
  styleUrl: './infra.component.scss',
})
export class InfraComponent implements OnInit {
  private readonly dockerService = inject(AdminDockerService);
  private readonly dialog = inject(MatDialog);

  readonly containers = signal<ContainerSummary[]>([]);
  readonly loading = signal(false);
  readonly unavailable = signal(false);
  readonly stats = signal<Record<string, ContainerStats>>({});

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.unavailable.set(false);
    this.dockerService.listContainers().subscribe({
      next: (res) => {
        this.containers.set(res);
        this.loading.set(false);
        for (const c of res) {
          if (c.state === 'running') this.loadStats(c.id);
        }
      },
      error: () => {
        this.unavailable.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadStats(id: string): void {
    this.dockerService.getStats(id).subscribe({
      next: (res) => this.stats.update((s) => ({ ...s, [id]: res })),
      error: () => {},
    });
  }

  statsFor(id: string): ContainerStats | undefined {
    return this.stats()[id];
  }

  showLogs(container: ContainerSummary): void {
    this.dialog.open(ContainerLogsDialogComponent, {
      data: { id: container.id, name: container.name },
    });
  }
}
