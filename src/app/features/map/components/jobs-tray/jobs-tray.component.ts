import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { JobsTrayService, TrayJob } from '../../../../core/services/jobs-tray.service';
import { ExportService } from '../../../../core/services/export.service';
import { LocationPlanService } from '../../../../core/services/location-plan.service';

/**
 * Icône "tiroir de tâches" dans la barre du haut, à côté de l'assistant IA - voir plan "refonte
 * Statistiques" du 2026-08-05 : un plan de localisation (ou export/import) lancé ailleurs dans
 * l'app reste visible ici même si l'utilisateur a quitté l'outil qui l'a déclenché, au lieu de
 * dépendre d'un polling scopé au composant (tué par ngOnDestroy à la navigation).
 */
@Component({
  selector: 'app-jobs-tray',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './jobs-tray.component.html',
  styleUrl: './jobs-tray.component.scss',
})
export class JobsTrayComponent {
  private readonly jobsTrayService = inject(JobsTrayService);
  private readonly exportService = inject(ExportService);
  private readonly locationPlanService = inject(LocationPlanService);

  readonly jobs = toSignal(this.jobsTrayService.jobs$, { initialValue: [] as TrayJob[] });
  downloadingId: string | null = null;

  get processingCount(): number {
    return this.jobs().filter((j) => j.status === 'processing').length;
  }

  canDownload(job: TrayJob): boolean {
    return job.status === 'completed' && (job.type === 'export' || job.type === 'location-plan');
  }

  download(job: TrayJob): void {
    if (!this.canDownload(job) || this.downloadingId) return;
    this.downloadingId = job.id;
    const download$ =
      job.type === 'export'
        ? this.exportService.download(job.entityId)
        : this.locationPlanService.download(job.entityId);

    download$.subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${job.label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingId = null;
      },
      error: () => {
        this.downloadingId = null;
      },
    });
  }

  dismiss(job: TrayJob, event: Event): void {
    event.stopPropagation();
    this.jobsTrayService.dismiss(job.id);
  }
}
