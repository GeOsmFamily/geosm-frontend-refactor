import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, timer } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

import { MapLayerService, ActiveLayer } from '../../map/services/map-layer.service';
import { ExportService } from '../../../core/services/export.service';
import { Export } from '../../../core/models/index';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TranslateModule } from '@ngx-translate/core';
import { getExportFileExtension } from '../../../core/utils/export-format.util';

type ExportMode = 'single' | 'all';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;

const FORMAT_ICONS: Record<string, string> = {
  GEOJSON: 'data_object',
  SHAPEFILE: 'folder_zip',
  GEOPACKAGE: 'inventory_2',
  KML: 'public',
  CSV: 'table_chart',
};

@Component({
  selector: 'app-export-tool',
  standalone: true,
  imports: [TranslateModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDividerModule,
    MatListModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './export-tool.component.html',
  styleUrl: './export-tool.component.scss',
})
export class ExportToolComponent implements OnInit, OnDestroy {
  private readonly mapLayerService = inject(MapLayerService);
  private readonly exportService = inject(ExportService);
  private readonly snackBar = inject(MatSnackBar);

  activeLayers: ActiveLayer[] = [];
  selectedLayerId = '';
  // Les valeurs doivent correspondre à l'enum backend ExportFormat (majuscules),
  // sinon la validation Zod côté API rejette la requête ("impossible de créer l'export").
  selectedFormat = 'GEOJSON';
  exportMode: ExportMode = 'single';
  exporting = false;
  exports: Export[] = [];
  readonly formatIcons = FORMAT_ICONS;

  showAllHistory = false;
  readonly historyLimit = 4;

  private readonly pollSubs = new Map<string, Subscription>();
  // Retient le nom des couches vues pendant la session pour garder un historique lisible
  // même après désactivation d'une couche (l'Export stocké côté API n'a que son id).
  private readonly layerNameCache = new Map<string, string>();

  readonly singleFormats = [
    { value: 'GEOJSON', label: 'GeoJSON' },
    { value: 'SHAPEFILE', label: 'Shapefile' },
    { value: 'GEOPACKAGE', label: 'GeoPackage' },
    { value: 'KML', label: 'KML' },
    { value: 'CSV', label: 'CSV' },
  ];

  readonly bulkFormats = [
    { value: 'GEOJSON', label: 'GeoJSON' },
    { value: 'SHAPEFILE', label: 'Shapefile' },
    { value: 'GEOPACKAGE', label: 'GeoPackage' },
    { value: 'KML', label: 'KML' },
  ];

  get formats() {
    return this.exportMode === 'all' ? this.bulkFormats : this.singleFormats;
  }

  ngOnInit(): void {
    this.mapLayerService.activeLayers$.subscribe(layers => {
      this.activeLayers = layers;
      for (const al of layers) this.layerNameCache.set(al.layer.id, al.layer.name);
      // Présélectionne la couche active si une seule est disponible (raccourci fréquent).
      if (!this.selectedLayerId && layers.length === 1) {
        this.selectedLayerId = layers[0].layer.id;
      }
    });

    this.loadExportHistory();
  }

  ngOnDestroy(): void {
    for (const sub of this.pollSubs.values()) sub.unsubscribe();
    this.pollSubs.clear();
  }

  setMode(mode: ExportMode): void {
    this.exportMode = mode;
    // CSV n'est pas proposé en mode groupé - repasser sur un format valide si besoin.
    if (mode === 'all' && this.selectedFormat === 'CSV') {
      this.selectedFormat = 'GEOJSON';
    }
  }

  private loadExportHistory(): void {
    this.exportService.list().subscribe({
      next: (result) => {
        this.exports = result.data;
        // Reprend le suivi de tout export encore en cours (ex. panneau rouvert entretemps).
        for (const exp of this.exports) {
          if (this.isPending(exp)) this.pollUntilDone(exp.id, false);
        }
      },
      error: () => {
        this.exports = [];
      },
    });
  }

  startExport(): void {
    if (!this.selectedFormat) return;

    if (this.exportMode === 'all') {
      if (this.activeLayers.length === 0) return;
      this.exporting = true;
      this.exportService.createBulk({
        format: this.selectedFormat,
        layerIds: this.activeLayers.map(al => al.layer.id),
      }).subscribe({
        next: (exp) => {
          this.exports.unshift(exp);
          this.exporting = false;
          this.pollUntilDone(exp.id, true);
        },
        error: (err) => {
          this.exporting = false;
          console.error('[ExportTool] Échec de la création de l\'export groupé', err);
          this.snackBar.open('Échec du lancement de l\'export.', 'OK', { duration: 4000 });
        },
      });
      return;
    }

    if (!this.selectedLayerId) return;
    this.exporting = true;
    this.exportService.create({
      layerId: this.selectedLayerId,
      format: this.selectedFormat,
    }).subscribe({
      next: (exp) => {
        this.exports.unshift(exp);
        this.exporting = false;
        this.pollUntilDone(exp.id, true);
      },
      error: (err) => {
        this.exporting = false;
        console.error('[ExportTool] Échec de la création de l\'export', err);
        this.snackBar.open('Échec du lancement de l\'export.', 'OK', { duration: 4000 });
      },
    });
  }

  private isPending(exp: Export): boolean {
    const status = (exp.status || '').toUpperCase();
    return status === 'PENDING' || status === 'PROCESSING';
  }

  /** Suit un export jusqu'à COMPLETED/FAILED et déclenche le téléchargement automatiquement. */
  private pollUntilDone(exportId: string, autoDownload: boolean): void {
    this.pollSubs.get(exportId)?.unsubscribe();

    const maxTicks = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);
    let ticks = 0;

    const sub = timer(0, POLL_INTERVAL_MS).pipe(
      takeWhile(() => ticks++ < maxTicks),
      switchMap(() => this.exportService.getById(exportId)),
    ).subscribe({
      next: (exp) => {
        const idx = this.exports.findIndex(e => e.id === exportId);
        if (idx !== -1) this.exports[idx] = exp;

        if (!this.isPending(exp)) {
          this.pollSubs.get(exportId)?.unsubscribe();
          this.pollSubs.delete(exportId);
          if ((exp.status || '').toUpperCase() === 'COMPLETED' && autoDownload) {
            this.downloadExport(exp);
          } else if ((exp.status || '').toUpperCase() === 'FAILED') {
            this.snackBar.open('L\'export a échoué. Réessayez.', 'OK', { duration: 4000 });
          }
        }
      },
      error: () => {
        this.pollSubs.delete(exportId);
      },
    });

    this.pollSubs.set(exportId, sub);
  }

  isExportPending(exp: Export): boolean {
    return this.isPending(exp);
  }

  isExportReady(exp: Export): boolean {
    return (exp.status || '').toUpperCase() === 'COMPLETED';
  }

  /** Nom lisible de ce qui est exporté (nom de couche plutôt que le format seul), pour que
   * l'utilisateur reconnaisse les données au premier coup d'œil dans l'historique. */
  getExportDisplayName(exp: Export): string {
    if (exp.isBulk) {
      const count = exp.layerIds?.length ?? 0;
      const suffix = count ? ` (${count})` : '';
      return `Toutes les couches actives${suffix}`;
    }
    return (exp.layerId && this.layerNameCache.get(exp.layerId)) || 'Couche';
  }

  get visibleExports(): Export[] {
    return this.showAllHistory ? this.exports : this.exports.slice(0, this.historyLimit);
  }

  toggleHistoryExpanded(): void {
    this.showAllHistory = !this.showAllHistory;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'export';
  }

  downloadExport(exp: Export): void {
    this.exportService.download(exp.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = exp.isBulk ? 'zip' : getExportFileExtension(exp.format);
        a.download = `${this.slugify(this.getExportDisplayName(exp))}-${exp.format.toLowerCase()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('[ExportTool] Échec du téléchargement', err);
        this.snackBar.open('Le fichier est prêt mais le téléchargement a échoué. Réessayez.', 'OK', { duration: 4000 });
      },
    });
  }

  getStatusColor(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'COMPLETED': return 'primary';
      case 'PENDING':
      case 'PROCESSING': return 'accent';
      case 'FAILED': return 'warn';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'COMPLETED': return 'Terminé';
      case 'PENDING': return 'En attente';
      case 'PROCESSING': return 'En cours';
      case 'FAILED': return 'Échoué';
      default: return status;
    }
  }
}
