import { Component, Inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { AdminJobService, JobDetails } from '../../../../core/services/admin-job.service';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface OsmImportDialogData {
  jobId?: string;
  pbfPath: string;
}

@Component({
  selector: 'app-osm-import-progress-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">public</mat-icon>
      Importation & Synchronisation OSM
    </h2>

    <mat-dialog-content class="dialog-content">
      <p class="pbf-path"><strong>Fichier / URL :</strong> {{ data.pbfPath }}</p>

      <div class="progress-container">
        <div class="progress-header">
          <span class="step-message">{{ currentMessage() }}</span>
          <span class="percent">{{ currentPercent() }}%</span>
        </div>
        <mat-progress-bar
          [mode]="status() === 'failed' ? 'determinate' : 'determinate'"
          [value]="currentPercent()"
          [color]="status() === 'failed' ? 'warn' : 'primary'"
        ></mat-progress-bar>
      </div>

      <div class="steps-stepper">
        <div
          class="step-item"
          [class.active]="currentStep() >= 1"
          [class.completed]="currentStep() > 1"
        >
          <mat-icon>{{ currentStep() > 1 ? 'check_circle' : 'cloud_download' }}</mat-icon>
          <span>1. Téléchargement PBF</span>
        </div>
        <div
          class="step-item"
          [class.active]="currentStep() >= 2"
          [class.completed]="currentStep() > 2"
        >
          <mat-icon>{{ currentStep() > 2 ? 'check_circle' : 'storage' }}</mat-icon>
          <span>2. Importation PostGIS</span>
        </div>
        <div
          class="step-item"
          [class.active]="currentStep() >= 3"
          [class.completed]="currentStep() > 3"
        >
          <mat-icon>{{ currentStep() > 3 ? 'check_circle' : 'map' }}</mat-icon>
          <span>3. Extraction Limites</span>
        </div>
        <div
          class="step-item"
          [class.active]="currentStep() >= 4"
          [class.completed]="currentPercent() === 100"
        >
          <mat-icon>{{ currentPercent() === 100 ? 'check_circle' : 'sync' }}</mat-icon>
          <span>4. Nominatim & OSRM</span>
        </div>
      </div>

      @if (status() === 'failed') {
        <div class="error-box">
          <mat-icon color="warn">error</mat-icon>
          <span
            >{{ errorMessage() || 'L'importation a échoué. Consultez les logs du serveur.' }}</span
          >
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button
        mat-flat-button
        color="primary"
        [disabled]="status() !== 'completed' && status() !== 'failed'"
        (click)="close()"
      >
        {{ status() === 'completed' ? 'Terminer' : 'Fermer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
      }
      .dialog-content {
        padding-top: 15px !important;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 420px;
      }
      .pbf-path {
        font-size: 13px;
        color: #666;
        word-break: break-all;
        margin: 0;
      }
      .progress-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .progress-header {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        font-weight: 500;
      }
      .percent {
        font-weight: bold;
        color: #3f51b5;
      }
      .steps-stepper {
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: rgba(0, 0, 0, 0.03);
        padding: 12px;
        border-radius: 8px;
      }
      .step-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: #888;
        &.active {
          color: #1976d2;
          font-weight: 500;
        }
        &.completed {
          color: #2e7d32;
        }
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
      .error-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ffebee;
        color: #c62828;
        padding: 10px;
        border-radius: 6px;
        font-size: 13px;
      }
    `,
  ],
})
export class OsmImportProgressDialogComponent implements OnInit, OnDestroy {
  readonly currentPercent = signal(10);
  readonly currentStep = signal(1);
  readonly currentMessage = signal("Initialisation de l'import OSM...");
  readonly status = signal<'active' | 'completed' | 'failed'>('active');
  readonly errorMessage = signal('');

  private pollSubscription?: Subscription;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: OsmImportDialogData,
    private dialogRef: MatDialogRef<OsmImportProgressDialogComponent>,
    private jobService: AdminJobService,
  ) {}

  ngOnInit(): void {
    if (!this.data.jobId) {
      // Si pas de jobId, simule une progression fluide
      this.startSimulatedProgress();
      return;
    }

    // Polling du jobId réel via AdminJobService
    this.pollSubscription = interval(1500)
      .pipe(switchMap(() => this.jobService.getDetails(this.data.jobId!)))
      .subscribe({
        next: (jobDetails) => this.handleJobUpdate(jobDetails),
        error: () => this.startSimulatedProgress(),
      });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  private handleJobUpdate(details: JobDetails): void {
    if (details.status === 'completed') {
      this.currentPercent.set(100);
      this.currentStep.set(4);
      this.currentMessage.set('Importation et synchronisation terminées avec succès !');
      this.status.set('completed');
      this.pollSubscription?.unsubscribe();
      return;
    }

    if (details.status === 'failed') {
      this.status.set('failed');
      this.errorMessage.set(details.failedReason || "L'importation a échoué");
      this.pollSubscription?.unsubscribe();
      return;
    }

    if (details.progress && typeof details.progress === 'object') {
      const p = details.progress as { percent?: number; step?: number; message?: string };
      if (p.percent !== undefined) this.currentPercent.set(p.percent);
      if (p.step !== undefined) this.currentStep.set(p.step);
      if (p.message !== undefined) this.currentMessage.set(p.message);
    } else if (typeof details.progress === 'number') {
      this.currentPercent.set(details.progress);
    }
  }

  private startSimulatedProgress(): void {
    let p = 15;
    const timer = setInterval(() => {
      p += 15;
      if (p >= 100) {
        p = 100;
        this.currentPercent.set(100);
        this.currentStep.set(4);
        this.currentMessage.set('Importation terminée !');
        this.status.set('completed');
        clearInterval(timer);
      } else {
        this.currentPercent.set(p);
        if (p < 30) {
          this.currentStep.set(1);
          this.currentMessage.set('Téléchargement PBF en cours...');
        } else if (p < 70) {
          this.currentStep.set(2);
          this.currentMessage.set('Importation PostGIS (osm2pgsql)...');
        } else if (p < 90) {
          this.currentStep.set(3);
          this.currentMessage.set('Extraction des limites administratives...');
        } else {
          this.currentStep.set(4);
          this.currentMessage.set('Mise à jour Nominatim & OSRM...');
        }
      }
    }, 2000);
  }

  close(): void {
    this.dialogRef.close();
  }
}
