import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MapLayerService } from '../../map/services/map-layer.service';
import { LayerService } from '../../../core/services/layer.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

interface ChartBar {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

interface LayerStats {
  totalFeatures: number;
  properties: string[];
  propertyDistribution: Record<string, ChartBar[]>;
}

@Component({
  selector: 'app-statistics-tool',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatDividerModule, MatCardModule, TranslateModule, LoadingSpinnerComponent],
  templateUrl: './statistics-tool.component.html',
  styleUrl: './statistics-tool.component.scss',
})
export class StatisticsToolComponent implements OnInit {
  private readonly mapLayerService = inject(MapLayerService);
  private readonly layerService = inject(LayerService);

  activeLayers: any[] = [];
  selectedLayerId: string | null = null;
  selectedProperty: string | null = null;
  loading = false;
  stats: LayerStats | null = null;

  private readonly colors = [
    '#023f5f', '#00ada7', '#f44336', '#FF9800', '#4CAF50',
    '#2196F3', '#9C27B0', '#795548', '#607D8B', '#E91E63',
  ];

  ngOnInit(): void {
    this.mapLayerService.activeLayers$.subscribe(layers => {
      this.activeLayers = layers;
    });
  }

  loadStats(): void {
    if (!this.selectedLayerId) return;
    this.loading = true;
    this.stats = null;
    this.selectedProperty = null;

    this.layerService.getFeatures(this.selectedLayerId, { limit: 10000 }).subscribe({
      next: (response) => {
        const features = response?.features || [];
        this.stats = this.computeStats(Array.isArray(features) ? features : []);
        if (this.stats.properties.length > 0) {
          this.selectedProperty = this.stats.properties[0];
        }
        this.loading = false;
      },
      error: () => {
        this.stats = { totalFeatures: 0, properties: [], propertyDistribution: {} };
        this.loading = false;
      },
    });
  }

  private computeStats(features: any[]): LayerStats {
    if (features.length === 0) {
      return { totalFeatures: 0, properties: [], propertyDistribution: {} };
    }

    const sampleProps = features[0]?.properties || features[0] || {};
    const stringProps = Object.keys(sampleProps).filter(k => {
      const val = sampleProps[k];
      return typeof val === 'string' && k !== 'id' && k !== 'geometry' && k !== 'geom';
    });

    const propertyDistribution: Record<string, ChartBar[]> = {};

    for (const prop of stringProps) {
      const counts: Record<string, number> = {};
      for (const f of features) {
        const val = (f.properties || f)[prop];
        if (val != null && val !== '') {
          const key = String(val).substring(0, 30);
          counts[key] = (counts[key] || 0) + 1;
        }
      }

      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

      propertyDistribution[prop] = sorted.map(([label, value], i) => ({
        label,
        value,
        percentage: (value / maxVal) * 100,
        color: this.colors[i % this.colors.length],
      }));
    }

    return {
      totalFeatures: features.length,
      properties: stringProps.slice(0, 10),
      propertyDistribution,
    };
  }

  get currentBars(): ChartBar[] {
    if (!this.stats || !this.selectedProperty) return [];
    return this.stats.propertyDistribution[this.selectedProperty] || [];
  }
}
