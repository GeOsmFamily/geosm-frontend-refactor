import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';

import { MapLayerService, ActiveLayer } from '../../map/services/map-layer.service.js';
import { ExportService } from '../../../core/services/export.service.js';
import { Export } from '../../../core/models/index.js';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component.js';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-export-tool',
  standalone: true,
  imports: [TranslateModule, 
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDividerModule,
    MatListModule,
    MatChipsModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './export-tool.component.html',
  styleUrl: './export-tool.component.scss',
})
export class ExportToolComponent implements OnInit {
  private readonly mapLayerService = inject(MapLayerService);
  private readonly exportService = inject(ExportService);

  activeLayers: ActiveLayer[] = [];
  selectedLayerId = '';
  selectedFormat = 'geojson';
  exporting = false;
  exports: Export[] = [];

  readonly formats = [
    { value: 'geojson', label: 'GeoJSON' },
    { value: 'shapefile', label: 'Shapefile' },
    { value: 'geopackage', label: 'GeoPackage' },
    { value: 'kml', label: 'KML' },
    { value: 'csv', label: 'CSV' },
  ];

  ngOnInit(): void {
    this.mapLayerService.activeLayers$.subscribe(layers => {
      this.activeLayers = layers;
    });

    this.loadExportHistory();
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
    if (!this.selectedLayerId || !this.selectedFormat) return;

    this.exporting = true;
    this.exportService.create({
      layerId: this.selectedLayerId,
      format: this.selectedFormat,
    }).subscribe({
      next: (exp) => {
        this.exports.unshift(exp);
        this.exporting = false;
      },
      error: () => {
        this.exporting = false;
      },
    });
  }

  downloadExport(exp: Export): void {
    this.exportService.download(exp.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${exp.id}.${exp.format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'primary';
      case 'pending':
      case 'processing': return 'accent';
      case 'failed': return 'warn';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Terminé';
      case 'pending': return 'En attente';
      case 'processing': return 'En cours';
      case 'failed': return 'Échoué';
      default: return status;
    }
  }
}
