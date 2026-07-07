import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminJobService, JobQueue, JobInfo } from '../../../../core/services/admin-job.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Lot A6 admin - le backend couvre déjà tout (BullMQ, pas de gap) : cette vue est
 * essentiellement de la lecture/déclenchement, aucune nouvelle route n'a été nécessaire.
 */
@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    TranslateModule,
    StatCardComponent,
  ],
  templateUrl: './jobs.component.html',
  styleUrl: './jobs.component.scss',
})
export class JobsComponent implements OnInit {
  private readonly jobService = inject(AdminJobService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly queues = signal<JobQueue[]>([]);
  readonly loading = signal(false);
  readonly retryingId = signal<string | null>(null);

  readonly triggeringOsm = signal(false);
  readonly triggeringBackup = signal(false);
  readonly triggeringReindex = signal(false);

  pbfPath = '/data/cameroon-latest.osm.pbf';

  // Plannings cron : valeurs par défaut documentées (voir env.config.ts), configurées via
  // variables d'environnement - pas d'endpoint pour les lire dynamiquement, affichage statique.
  readonly osmImportCron = '0 2 1 * * (mensuel)';
  readonly backupCron = '0 3 * * * (quotidien)';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.jobService.list().subscribe({
      next: (res) => {
        this.queues.set(res.queues);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  countFor(queue: JobQueue, status: string): number {
    return queue.counts[status] ?? 0;
  }

  retry(job: JobInfo): void {
    this.retryingId.set(job.id);
    this.jobService.retry(job.id).subscribe({
      next: (res) => {
        this.retryingId.set(null);
        this.snackBar.open(res.message, undefined, { duration: 3000 });
        this.load();
      },
      error: (err) => {
        this.retryingId.set(null);
        this.notifyError(err);
      },
    });
  }

  confirmAndTrigger(action: 'osm' | 'backup' | 'reindex'): void {
    const titles = {
      osm: 'admin.jobs.confirmOsmImport',
      backup: 'admin.jobs.confirmBackup',
      reindex: 'admin.jobs.confirmReindex',
    };
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.jobs.confirmTitle'),
        message: this.translate.instant(titles[action]),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      if (action === 'osm') this.triggerOsmImport();
      if (action === 'backup') this.triggerBackup();
      if (action === 'reindex') this.triggerReindex();
    });
  }

  private triggerOsmImport(): void {
    this.triggeringOsm.set(true);
    this.jobService.triggerOsmImport(this.pbfPath).subscribe({
      next: (res) => {
        this.triggeringOsm.set(false);
        this.snackBar.open(res.message, undefined, { duration: 4000 });
      },
      error: (err) => {
        this.triggeringOsm.set(false);
        this.notifyError(err);
      },
    });
  }

  private triggerBackup(): void {
    this.triggeringBackup.set(true);
    this.jobService.triggerBackup().subscribe({
      next: (res) => {
        this.triggeringBackup.set(false);
        this.snackBar.open(
          this.translate.instant('admin.jobs.backupDone', { size: this.formatBytes(res.sizeBytes) }),
          undefined,
          { duration: 4000 },
        );
      },
      error: (err) => {
        this.triggeringBackup.set(false);
        this.notifyError(err);
      },
    });
  }

  private triggerReindex(): void {
    this.triggeringReindex.set(true);
    this.jobService.triggerReindex().subscribe({
      next: (res) => {
        this.triggeringReindex.set(false);
        this.snackBar.open(
          this.translate.instant('admin.jobs.reindexDone', { count: res.layersIndexed }),
          undefined,
          { duration: 4000 },
        );
      },
      error: (err) => {
        this.triggeringReindex.set(false);
        this.notifyError(err);
      },
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, { duration: 4000 });
  }
}
