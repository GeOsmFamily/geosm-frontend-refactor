import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, interval, switchMap } from 'rxjs';
import { MapLayerService, ActiveLayer } from '../../map/services/map-layer.service';
import { LayerService } from '../../../core/services/layer.service';
import { GeoportailService } from '../../../core/services/geoportail.service';
import {
  RasterAnalysisService,
  RasterAnalysisType,
  RasterStats,
  ZonalStat,
} from '../../../core/services/raster-analysis.service';
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
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDividerModule,
    MatCardModule,
    TranslateModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './statistics-tool.component.html',
  styleUrl: './statistics-tool.component.scss',
})
export class StatisticsToolComponent implements OnInit, OnDestroy {
  private readonly mapLayerService = inject(MapLayerService);
  private readonly layerService = inject(LayerService);
  private readonly geoportailService = inject(GeoportailService);
  private readonly rasterAnalysisService = inject(RasterAnalysisService);

  activeLayers: ActiveLayer[] = [];
  selectedLayerId: string | null = null;
  selectedProperty: string | null = null;
  loading = false;
  stats: LayerStats | null = null;
  narrative: string | null = null;
  narrativeLoading = false;

  // --- Analyse raster (statistiques globales/zonales) - voir plan "Analyse raster" ---
  rasterAnalysisRunning = false;
  rasterAnalysisType: RasterAnalysisType | null = null;
  rasterStats: RasterStats | null = null;
  zonalStats: ZonalStat[] | null = null;
  rasterAnalysisError: string | null = null;
  private rasterPollSubscription: Subscription | null = null;

  get isRasterLayer(): boolean {
    const layer = this.activeLayers.find((al) => al.layer.id === this.selectedLayerId)?.layer;
    return layer?.metadata?.source === 'raster';
  }
  /** Distinct d'un vrai "0 entité" - une couche dont la donnée vient d'un projet QGIS (import
   * admin ou publication depuis "Mes données") n'a pas de table PostGIS suivie par GeOSM,
   * /layers/:id/features échoue alors avec un 404 : sans ce distinguo, l'ancien code affichait
   * silencieusement "0 entités", ce qui semblait indiquer une couche vide plutôt qu'une
   * limitation connue (statistiques non calculables pour une source WMS externe). */
  statsUnavailable = false;

  private readonly colors = [
    '#023f5f',
    '#00ada7',
    '#f44336',
    '#FF9800',
    '#4CAF50',
    '#2196F3',
    '#9C27B0',
    '#795548',
    '#607D8B',
    '#E91E63',
  ];

  ngOnInit(): void {
    this.mapLayerService.activeLayers$.subscribe((layers) => {
      this.activeLayers = layers;
    });
  }

  ngOnDestroy(): void {
    this.rasterPollSubscription?.unsubscribe();
  }

  loadStats(): void {
    if (!this.selectedLayerId) return;
    this.resetRasterState();
    this.stats = null;
    this.statsUnavailable = false;
    this.selectedProperty = null;
    this.narrative = null;

    if (this.isRasterLayer) {
      // Une couche raster n'a pas de "features" au sens vectoriel - voir runRasterAnalysis(),
      // déclenché explicitement par l'utilisateur (bouton "Statistiques globales"/"par zone"),
      // pas de chargement automatique ici.
      return;
    }

    this.loading = true;

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
        this.statsUnavailable = true;
        this.loading = false;
      },
    });

    this.loadNarrative(this.selectedLayerId);
  }

  /** Synthèse IA (Gemini) en complément des graphiques calculés côté client - jamais bloquant. */
  private loadNarrative(layerId: string): void {
    this.narrativeLoading = true;
    this.geoportailService.getLayerStats(layerId, true).subscribe({
      next: (result) => {
        this.narrative = result.narrative ?? null;
        this.narrativeLoading = false;
      },
      error: () => {
        this.narrative = null;
        this.narrativeLoading = false;
      },
    });
  }

  private resetRasterState(): void {
    this.rasterPollSubscription?.unsubscribe();
    this.rasterPollSubscription = null;
    this.rasterAnalysisRunning = false;
    this.rasterAnalysisType = null;
    this.rasterStats = null;
    this.zonalStats = null;
    this.rasterAnalysisError = null;
  }

  /** Déclenche une analyse raster asynchrone et poll son résultat (même principe que
   * osm-import-progress-dialog.component.ts : interval + switchMap, arrêté dès que le job
   * termine ou échoue). */
  runRasterAnalysis(type: RasterAnalysisType): void {
    if (!this.selectedLayerId) return;
    this.rasterPollSubscription?.unsubscribe();
    this.rasterAnalysisRunning = true;
    this.rasterAnalysisType = type;
    this.rasterStats = null;
    this.zonalStats = null;
    this.rasterAnalysisError = null;

    this.rasterAnalysisService.analyze(this.selectedLayerId, type).subscribe({
      next: ({ resultId }) => this.pollRasterAnalysis(resultId),
      error: () => {
        this.rasterAnalysisRunning = false;
        this.rasterAnalysisError = "Impossible de lancer l'analyse.";
      },
    });
  }

  private pollRasterAnalysis(resultId: string): void {
    this.rasterPollSubscription = interval(1500)
      .pipe(switchMap(() => this.rasterAnalysisService.getResult(resultId)))
      .subscribe({
        next: (res) => {
          if (res.status === 'COMPLETED') {
            this.rasterAnalysisRunning = false;
            if (res.type === 'global') this.rasterStats = res.result as RasterStats;
            else this.zonalStats = res.result as ZonalStat[];
            this.rasterPollSubscription?.unsubscribe();
          } else if (res.status === 'FAILED') {
            this.rasterAnalysisRunning = false;
            this.rasterAnalysisError = res.error ?? "L'analyse a échoué.";
            this.rasterPollSubscription?.unsubscribe();
          }
        },
        error: () => {
          this.rasterAnalysisRunning = false;
          this.rasterAnalysisError = "Impossible de récupérer le résultat de l'analyse.";
          this.rasterPollSubscription?.unsubscribe();
        },
      });
  }

  /** Pour le mini bar-chart des stats zonales - même palette/logique que currentBars, sur les
   * ZonalStat plutôt que les ChartBar vectoriels. */
  get zonalBars(): ChartBar[] {
    if (!this.zonalStats || this.zonalStats.length === 0) return [];
    const maxVal = Math.max(...this.zonalStats.map((z) => z.sum ?? 0), 1);
    return this.zonalStats.map((z, i) => ({
      label: z.zoneName,
      value: z.sum ?? 0,
      percentage: ((z.sum ?? 0) / maxVal) * 100,
      color: this.colors[i % this.colors.length],
    }));
  }

  private computeStats(features: unknown[]): LayerStats {
    if (features.length === 0) {
      return { totalFeatures: 0, properties: [], propertyDistribution: {} };
    }

    // Normalement un GeoJSON Feature avec `.properties`, mais certaines couches renvoient des
    // données déjà aplaties - d'où le repli sur l'objet lui-même quand `.properties` est absent.
    const first = features[0] as Record<string, unknown>;
    const sampleProps = (first?.['properties'] as Record<string, unknown>) || first || {};
    const stringProps = Object.keys(sampleProps).filter((k) => {
      const val = sampleProps[k];
      return typeof val === 'string' && k !== 'id' && k !== 'geometry' && k !== 'geom';
    });

    const propertyDistribution: Record<string, ChartBar[]> = {};

    for (const prop of stringProps) {
      const counts: Record<string, number> = {};
      for (const feature of features) {
        const f = feature as Record<string, unknown>;
        const val = ((f['properties'] as Record<string, unknown>) || f)[prop];
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
