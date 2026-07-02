import { Component, OnInit, inject } from '@angular/core';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MapLayerService, ActiveLayer } from '../../map/services/map-layer.service';
import { ExportService } from '../../../core/services/export.service';
import { Export } from '../../../core/models/index';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TranslateModule } from '@ngx-translate/core';
import { getExportFileExtension } from '../../../core/utils/export-format.util';

type ExportMode = 'single' | 'all';

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
    MatSnackBarModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './export-tool.component.html',
  styleUrl: './export-tool.component.scss',
})
export class ExportToolComponent implements OnInit {
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
    });

    this.loadExportHistory();
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
      },
      error: (err) => {
        this.exporting = false;
        console.error('[ExportTool] Échec de la création de l\'export', err);
        this.snackBar.open('Échec du lancement de l\'export.', 'OK', { duration: 4000 });
      },
    });
  }

  isExportReady(exp: Export): boolean {
    return (exp.status || '').toUpperCase() === 'COMPLETED';
  }

  downloadExport(exp: Export): void {
    this.exportService.download(exp.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = exp.isBulk ? 'zip' : getExportFileExtension(exp.format);
        a.download = `export-${exp.id}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      error: (err) => console.error('[ExportTool] Échec du téléchargement', err),
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
