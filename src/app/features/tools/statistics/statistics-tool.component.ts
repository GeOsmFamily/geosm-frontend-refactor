import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, interval, switchMap } from 'rxjs';
import Map from 'ol/Map';
import Draw from 'ol/interaction/Draw';
import GeoJSONFormat from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Stroke, Fill } from 'ol/style';
import { getArea, getLength } from 'ol/sphere';
import { MapLayerService, ActiveLayer } from '../../map/services/map-layer.service';
import { MapService } from '../../map/services/map.service';
import { LayerService } from '../../../core/services/layer.service';
import { GeoportailService } from '../../../core/services/geoportail.service';
import { InstanceService } from '../../../core/services/instance.service';
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

interface NumericStat {
  min: number;
  max: number;
  mean: number;
  sum: number;
  count: number;
}

interface LayerStats {
  totalFeatures: number;
  properties: string[];
  propertyDistribution: Record<string, ChartBar[]>;
  /** Agrégats min/max/moyenne/somme pour les attributs numériques - un top-10 de valeurs
   * uniques n'a pas de sens sur du numérique continu (voir plan "refonte Statistiques" du
   * 2026-08-05), remplace le comptage brut utilisé jusqu'ici pour ces colonnes. */
  numericStats: Record<string, NumericStat>;
  totalAreaM2: number | null;
  totalLengthM: number | null;
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
    MatButtonToggleModule,
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
  private readonly instanceService = inject(InstanceService);
  private readonly mapService = inject(MapService);

  private map: Map | null = null;
  private drawLayer: VectorLayer<VectorSource> | null = null;
  private drawInteraction: Draw | null = null;
  /** Vrai pendant que l'utilisateur trace le polygone de "Dessiner une zone" - voir
   * startDrawZone(). */
  drawingZone = false;

  activeLayers: ActiveLayer[] = [];
  selectedLayerId: string | null = null;
  selectedProperty: string | null = null;
  loading = false;
  stats: LayerStats | null = null;
  narrative: string | null = null;
  narrativeLoading = false;
  /** "extent" par défaut - répond directement à la demande "l'analyse doit prendre en compte
   * la zone zoomée" (voir plan "refonte Statistiques" du 2026-08-05). */
  statsScope: 'all' | 'extent' = 'extent';

  // --- Analyse raster (statistiques globales/zonales) - voir plan "Analyse raster" ---
  rasterAnalysisRunning = false;
  rasterAnalysisType: RasterAnalysisType | null = null;
  rasterStats: RasterStats | null = null;
  zonalStats: ZonalStat[] | null = null;
  rasterNarrative: string | null = null;
  rasterAnalysisError: string | null = null;
  private rasterPollSubscription: Subscription | null = null;

  // --- Sélecteur de niveau administratif pour "par zone" - voir plan "refonte Statistiques"
  // du 2026-08-05 : Instance.adminLevel n'est pas toujours configuré (ex. instance racine
  // "Cameroun"), donc "par zone" ne peut plus se contenter d'un défaut implicite qui échoue. ---
  availableAdminLevels: number[] = [];
  selectedAdminLevel: number | null = null;
  adminLevelsLoading = false;
  adminLevelsError: string | null = null;
  showZonalLevelPicker = false;

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
    this.stopDrawZone();
    if (this.drawLayer) this.mapService.removeLayer(this.drawLayer);
  }

  /** Bascule "Toute la couche" / "Zone visible" - recalcule immédiatement (voir plan "refonte
   * Statistiques" du 2026-08-05), pas besoin de rouvrir le panneau. */
  setStatsScope(scope: 'all' | 'extent'): void {
    if (this.statsScope === scope) return;
    this.statsScope = scope;
    if (this.selectedLayerId && !this.isRasterLayer) this.loadStats();
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
    const activeLayer = this.activeLayers.find((al) => al.layer.id === this.selectedLayerId);
    const geometryType = activeLayer?.layer.geometryType ?? '';
    const params: Record<string, unknown> = { limit: 10000 };
    if (this.statsScope === 'extent') {
      params['bbox'] = this.mapService.getCurrentExtent().join(',');
    }

    this.layerService.getFeatures(this.selectedLayerId, params).subscribe({
      next: (response) => {
        const features = response?.features || [];
        this.stats = this.computeStats(Array.isArray(features) ? features : [], geometryType);
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

    this.loadNarrative(
      this.selectedLayerId,
      this.statsScope === 'extent' ? this.mapService.getCurrentExtent() : undefined,
    );
  }

  /** Synthèse IA (Gemini) en complément des graphiques calculés côté client - jamais bloquant.
   * `bbox` fait produire une synthèse comparative ("zone visible" vs "toute la couche") plutôt
   * que purement descriptive - voir GetLayerStatsUseCase côté backend. */
  private loadNarrative(layerId: string, bbox?: number[]): void {
    this.narrativeLoading = true;
    this.geoportailService.getLayerStats(layerId, true, bbox).subscribe({
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
    this.rasterNarrative = null;
    this.rasterAnalysisError = null;
    this.showZonalLevelPicker = false;
    this.availableAdminLevels = [];
    this.selectedAdminLevel = null;
    this.adminLevelsError = null;
    this.stopDrawZone();
    this.drawLayer?.getSource()?.clear();
  }

  /** "Dessiner une zone" - trace un polygone libre sur la carte (même pattern que
   * SpatialAnalysisToolComponent.pick()) et lance directement une analyse raster dessus une
   * fois le tracé terminé, sans dépendre d'une limite administrative. */
  startDrawZone(): void {
    if (!this.selectedLayerId || this.drawingZone) return;
    this.rasterStats = null;
    this.zonalStats = null;
    this.rasterNarrative = null;
    this.rasterAnalysisError = null;
    this.showZonalLevelPicker = false;

    if (!this.map) this.map = this.mapService.getMap();
    if (!this.drawLayer) {
      this.drawLayer = this.mapService.addVectorLayer(
        'statistics-draw-zone',
        [],
        new Style({
          stroke: new Stroke({ color: '#023f5f', width: 2, lineDash: [6, 4] }),
          fill: new Fill({ color: 'rgba(2, 63, 95, 0.1)' }),
        }),
      );
    }
    this.drawLayer.getSource()?.clear();
    this.drawingZone = true;
    this.mapService.isPicking = true;

    this.drawInteraction = new Draw({ source: this.drawLayer.getSource()!, type: 'Polygon' });
    this.drawInteraction.on('drawend', (event) => {
      const format = new GeoJSONFormat();
      const geometry = format.writeGeometryObject(event.feature.getGeometry()!, {
        featureProjection: 'EPSG:3857',
        dataProjection: 'EPSG:4326',
      }) as unknown as GeoJSON.Geometry;
      this.stopDrawZone();
      this.runRasterAnalysis('custom', geometry);
    });
    this.map.addInteraction(this.drawInteraction);
  }

  private stopDrawZone(): void {
    if (this.map && this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
    }
    this.drawInteraction = null;
    this.drawingZone = false;
    // Différé (même raison que SpatialAnalysisToolComponent.stopPicking()) : le double-clic qui
    // termine le tracé est encore vu par FeatureInfoComponent juste après ce callback.
    setTimeout(() => {
      this.mapService.isPicking = false;
    }, 300);
  }

  /** "Statistiques par zone" ouvre d'abord un sélecteur de niveau administratif au lieu de
   * lancer l'analyse directement - Instance.adminLevel n'est pas toujours défini (ex. Cameroun),
   * donc on ne peut plus deviner un niveau par défaut sans risquer un échec silencieux. */
  openZonalLevelPicker(): void {
    if (!this.selectedLayerId) return;
    const instanceId = this.instanceService.currentInstance$.value?.id;
    if (!instanceId) return;

    this.rasterStats = null;
    this.zonalStats = null;
    this.rasterNarrative = null;
    this.rasterAnalysisError = null;
    this.showZonalLevelPicker = true;
    this.adminLevelsLoading = true;
    this.adminLevelsError = null;

    this.rasterAnalysisService.getAvailableAdminLevels(instanceId).subscribe({
      next: (levels) => {
        this.availableAdminLevels = levels;
        // Niveau le plus fin par défaut (le plus grand admin_level = le découpage le plus
        // détaillé, ex. arrondissement plutôt que région) - l'utilisateur peut changer.
        this.selectedAdminLevel = levels.length > 0 ? Math.max(...levels) : null;
        this.adminLevelsLoading = false;
      },
      error: () => {
        this.adminLevelsError = 'Impossible de récupérer les niveaux administratifs disponibles.';
        this.adminLevelsLoading = false;
      },
    });
  }

  /** Déclenche une analyse raster asynchrone et poll son résultat (même principe que
   * osm-import-progress-dialog.component.ts : interval + switchMap, arrêté dès que le job
   * termine ou échoue). */
  runRasterAnalysis(type: RasterAnalysisType, geometry?: GeoJSON.Geometry): void {
    if (!this.selectedLayerId) return;
    if (type === 'zonal' && this.selectedAdminLevel == null) return;

    this.rasterPollSubscription?.unsubscribe();
    this.rasterAnalysisRunning = true;
    this.rasterAnalysisType = type;
    this.rasterStats = null;
    this.zonalStats = null;
    this.rasterNarrative = null;
    this.rasterAnalysisError = null;
    this.showZonalLevelPicker = false;

    this.rasterAnalysisService
      .analyze(this.selectedLayerId, type, {
        adminLevel: type === 'zonal' ? (this.selectedAdminLevel ?? undefined) : undefined,
        geometry: type === 'custom' ? geometry : undefined,
      })
      .subscribe({
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
            this.rasterNarrative = res.narrative;
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

  private computeStats(features: unknown[], geometryType: string): LayerStats {
    if (features.length === 0) {
      return {
        totalFeatures: 0,
        properties: [],
        propertyDistribution: {},
        numericStats: {},
        totalAreaM2: null,
        totalLengthM: null,
      };
    }

    // Normalement un GeoJSON Feature avec `.properties`, mais certaines couches renvoient des
    // données déjà aplaties - d'où le repli sur l'objet lui-même quand `.properties` est absent.
    const first = features[0] as Record<string, unknown>;
    const sampleProps = (first?.['properties'] as Record<string, unknown>) || first || {};
    const isExcluded = (k: string) => k === 'id' || k === 'geometry' || k === 'geom';
    const stringProps = Object.keys(sampleProps).filter(
      (k) => typeof sampleProps[k] === 'string' && !isExcluded(k),
    );
    // Un top-10 de valeurs uniques n'a pas de sens sur du numérique continu (population,
    // superficie...) - ces colonnes vont dans numericStats (min/max/moyenne/somme) à la place.
    const numericProps = Object.keys(sampleProps).filter(
      (k) => typeof sampleProps[k] === 'number' && !isExcluded(k),
    );

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

    const numericStats: Record<string, NumericStat> = {};
    for (const prop of numericProps) {
      const values: number[] = [];
      for (const feature of features) {
        const f = feature as Record<string, unknown>;
        const val = ((f['properties'] as Record<string, unknown>) || f)[prop];
        if (typeof val === 'number' && !Number.isNaN(val)) values.push(val);
      }
      if (values.length === 0) continue;
      const sum = values.reduce((acc, v) => acc + v, 0);
      numericStats[prop] = {
        min: Math.min(...values),
        max: Math.max(...values),
        mean: sum / values.length,
        sum,
        count: values.length,
      };
    }

    const { totalAreaM2, totalLengthM } = this.computeGeometryTotals(features, geometryType);

    return {
      totalFeatures: features.length,
      properties: stringProps.slice(0, 10),
      propertyDistribution,
      numericStats,
      totalAreaM2,
      totalLengthM,
    };
  }

  /** Surface totale (polygones) ou longueur totale (lignes) des entités - absent des stats
   * jusqu'ici, demandé explicitement (voir plan "refonte Statistiques" du 2026-08-05). Les
   * points n'ont ni surface ni longueur, `null` dans ce cas. */
  private computeGeometryTotals(
    features: unknown[],
    geometryType: string,
  ): { totalAreaM2: number | null; totalLengthM: number | null } {
    const type = (geometryType || '').toUpperCase();
    const isPolygon = type.includes('POLYGON');
    const isLine = type.includes('LINE');
    if (!isPolygon && !isLine) return { totalAreaM2: null, totalLengthM: null };

    const format = new GeoJSONFormat();
    let total = 0;
    let any = false;
    for (const feature of features) {
      const f = feature as { geometry?: unknown };
      if (!f.geometry) continue;
      try {
        const geom = format.readGeometry(f.geometry as GeoJSON.Geometry, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        total += isPolygon ? getArea(geom) : getLength(geom);
        any = true;
      } catch {
        // Géométrie invalide/absente pour cette entité - ignorée, ne bloque pas le total.
      }
    }
    if (!any) return { totalAreaM2: null, totalLengthM: null };
    return {
      totalAreaM2: isPolygon ? total : null,
      totalLengthM: isLine ? total : null,
    };
  }

  get currentBars(): ChartBar[] {
    if (!this.stats || !this.selectedProperty) return [];
    return this.stats.propertyDistribution[this.selectedProperty] || [];
  }
}
