import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  AnalysisReportService,
  AnalysisReportSummary,
} from '../../../core/services/analysis-report.service';
import { ViewportSummary } from '../../../core/models/index';
import {
  RasterAnalysisService,
  RasterAnalysisType,
  RasterStats,
  ZonalStat,
} from '../../../core/services/raster-analysis.service';
import {
  ChoroplethService,
  ChoroplethZone,
  GridCell,
} from '../../../core/services/choropleth.service';
import {
  computeQuantileBreaks,
  buildGraduatedLegend,
  buildChoroplethStyleFn,
  buildGridStyleFn,
  GraduatedLegendEntry,
} from '../../map/utils/graduated-style.util';
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
    MatInputModule,
    MatTooltipModule,
    TranslateModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './statistics-tool.component.html',
  styleUrl: './statistics-tool.component.scss',
})
export class StatisticsToolComponent implements OnInit, OnDestroy {
  /** Désactivé le 2026-08-07 à la demande utilisateur (repasser à true pour réactiver). */
  protected readonly choroplethGridEnabled = false;

  private readonly mapLayerService = inject(MapLayerService);
  private readonly layerService = inject(LayerService);
  private readonly geoportailService = inject(GeoportailService);
  private readonly rasterAnalysisService = inject(RasterAnalysisService);
  private readonly choroplethService = inject(ChoroplethService);
  private readonly instanceService = inject(InstanceService);
  private readonly mapService = inject(MapService);
  private readonly analysisReportService = inject(AnalysisReportService);

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

  // --- Analyse multi-couches (onglet "vitrine" de l'agent IA directement dans Statistiques,
  // sans passer par le chat - voir plan "refonte Statistiques" du 2026-08-05, section G) ---
  multiLayerMode = false;
  viewSummary: ViewportSummary | null = null;
  viewSummaryLoading = false;
  viewSummaryError: string | null = null;
  reportTopic = '';
  reportGenerating = false;
  reportGenerated = false;
  reportError: string | null = null;

  // --- Historique persisté des rapports (voir ListMyAnalysisReportsUseCase côté backend) -
  // le tiroir de tâches ne montre que les événements temps réel reçus PENDANT que l'onglet est
  // ouvert ; un rapport terminé après une déconnexion WebSocket y reste invisible bien que
  // généré avec succès, d'où cette liste persistée comme filet de sécurité. ---
  myReports: AnalysisReportSummary[] = [];
  myReportsLoading = false;
  myReportsExpanded = false;
  downloadingReportId: string | null = null;
  /** Zone dessinée à la main (voir startDrawZoneForMultiLayer()) - remplace l'emprise carte
   * pour restreindre l'analyse/le rapport à une zone précise plutôt qu'à tout ce qui est
   * visible à l'écran. */
  multiLayerZoneGeometry: GeoJSON.Geometry | null = null;

  get canUseMultiLayerMode(): boolean {
    return this.activeLayers.length >= 2;
  }

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
  /** Le même sélecteur de niveau administratif sert deux déclencheurs (statistiques raster
   * "par zone" ET choroplèthe vectoriel) - ce flag détermine quelle analyse le bouton "Lancer
   * l'analyse" déclenche réellement, voir openZonalLevelPicker()/openChoroplethPicker(). */
  zonalPickerMode: 'raster' | 'choropleth' | null = null;

  // --- Choroplèthe (couches vectorielles) - voir plan "Choroplèthes + Carroyage" du
  // 2026-08-06. Réutilise les mêmes numericStats déjà calculés par computeStats() pour peupler
  // le sélecteur d'attribut, plutôt que d'ajouter une route backend de description de schéma. ---
  choroplethAttribute: string | null = null;
  choroplethRunning = false;
  choroplethResult: ChoroplethZone[] | null = null;
  choroplethError: string | null = null;
  choroplethLegend: GraduatedLegendEntry[] = [];

  // --- Carroyage/hexbin (couches vectorielles) - opère sur l'emprise carte courante, pas de
  // sélecteur de zone administrative nécessaire. ---
  gridCellSizeMeters = 500;
  gridType: 'square' | 'hexagon' = 'square';
  gridRunning = false;
  gridResult: GridCell[] | null = null;
  gridError: string | null = null;
  gridLegend: GraduatedLegendEntry[] = [];

  get numericAttributes(): string[] {
    return this.stats ? Object.keys(this.stats.numericStats) : [];
  }

  get isRasterLayer(): boolean {
    const layer = this.activeLayers.find((al) => al.layer.id === this.selectedLayerId)?.layer;
    return layer?.metadata?.source === 'raster';
  }
  /** Distinct d'un vrai "0 entité" - une couche dont la donnée vient d'un projet QGIS (import
   * admin ou publication depuis "Mes données") n'a pas de table PostGIS suivie par GeOsm,
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
    this.mapLayerService.removeAnalysisLayer('choropleth');
    this.mapLayerService.removeAnalysisLayer('grid');
  }

  toggleMultiLayerMode(): void {
    this.multiLayerMode = !this.multiLayerMode;
    this.viewSummary = null;
    this.viewSummaryError = null;
    this.reportTopic = '';
    this.reportGenerated = false;
    this.reportError = null;
    this.clearMultiLayerZone();
  }

  /** "Analyser ces couches" - équivalent direct de l'outil `analyze_map_context` de l'assistant
   * IA (Lot 3), mais appelable sans passer par le chat - même endpoint, même moteur d'analyse
   * (SummarizeViewportUseCase), voir plan "refonte Statistiques" du 2026-08-05, section G. */
  analyzeActiveLayers(): void {
    const layerIds = this.activeLayers.map((al) => al.layer.id);
    if (layerIds.length === 0) return;
    this.viewSummaryLoading = true;
    this.viewSummaryError = null;
    this.viewSummary = null;

    this.geoportailService
      .summarizeView(
        layerIds,
        this.multiLayerZoneGeometry ? undefined : this.mapService.getCurrentExtent(),
        this.multiLayerZoneGeometry ?? undefined,
      )
      .subscribe({
        next: (summary) => {
          this.viewSummary = summary;
          this.viewSummaryLoading = false;
        },
        error: () => {
          this.viewSummaryError = "Impossible d'analyser les couches actives.";
          this.viewSummaryLoading = false;
        },
      });
  }

  /** "Générer un rapport PDF" - déclenche le même job que l'outil `generate_analysis_report` du
   * chat (Lot 4) ; le suivi se fait dans le tiroir de tâches (déjà abonné aux événements
   * `analysis-report:*` indépendamment de ce composant), pas ici. */
  generateReport(): void {
    const instanceId = this.instanceService.currentInstance$.value?.id;
    const layerIds = this.activeLayers.map((al) => al.layer.id);
    if (!instanceId || layerIds.length === 0 || !this.reportTopic.trim() || this.reportGenerating) {
      return;
    }
    this.reportGenerating = true;
    this.reportError = null;
    this.reportGenerated = false;

    this.analysisReportService
      .generate(
        instanceId,
        this.reportTopic.trim(),
        layerIds,
        this.multiLayerZoneGeometry
          ? undefined
          : (this.mapService.getCurrentExtent() as [number, number, number, number]),
        this.multiLayerZoneGeometry ?? undefined,
      )
      .subscribe({
        next: () => {
          this.reportGenerating = false;
          this.reportGenerated = true;
          this.reportTopic = '';
        },
        error: () => {
          this.reportGenerating = false;
          this.reportError = 'Impossible de lancer la génération du rapport.';
        },
      });
  }

  toggleMyReports(): void {
    this.myReportsExpanded = !this.myReportsExpanded;
    if (this.myReportsExpanded && this.myReports.length === 0) this.loadMyReports();
  }

  loadMyReports(): void {
    this.myReportsLoading = true;
    this.analysisReportService.listMine().subscribe({
      next: (reports) => {
        this.myReports = reports;
        this.myReportsLoading = false;
      },
      error: () => {
        this.myReportsLoading = false;
      },
    });
  }

  downloadReport(report: AnalysisReportSummary): void {
    if (this.downloadingReportId) return;
    this.downloadingReportId = report.id;
    this.analysisReportService.download(report.id).subscribe({
      next: (blob) => {
        this.downloadingReportId = null;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.topic.toLowerCase().replace(/\s+/g, '-')}-${report.id.slice(0, 8)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.downloadingReportId = null;
      },
    });
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
    this.zonalPickerMode = null;
    this.stopDrawZone();
    this.drawLayer?.getSource()?.clear();

    this.choroplethAttribute = null;
    this.choroplethRunning = false;
    this.choroplethResult = null;
    this.choroplethError = null;
    this.choroplethLegend = [];
    this.gridRunning = false;
    this.gridResult = null;
    this.gridError = null;
    this.gridLegend = [];
    this.mapLayerService.removeAnalysisLayer('choropleth');
    this.mapLayerService.removeAnalysisLayer('grid');
  }

  /** "Dessiner une zone" - trace un polygone libre sur la carte (même pattern que
   * SpatialAnalysisToolComponent.pick()) - générique : le tracé terminé est remis au callback
   * fourni par l'appelant (analyse raster sur zone dessinée, OU zone d'étude pour l'analyse
   * multi-couches - voir startDrawZoneForRaster()/startDrawZoneForMultiLayer()) plutôt que
   * d'avoir une méthode de dessin dupliquée pour chaque usage. */
  private startDrawZone(onComplete: (geometry: GeoJSON.Geometry) => void): void {
    if (this.drawingZone) return;

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
      onComplete(geometry);
    });
    this.map.addInteraction(this.drawInteraction);
  }

  /** Bouton "Dessiner une zone" du panneau raster - lance directement l'analyse dessus. */
  startDrawZoneForRaster(): void {
    if (!this.selectedLayerId) return;
    this.rasterStats = null;
    this.zonalStats = null;
    this.rasterNarrative = null;
    this.rasterAnalysisError = null;
    this.showZonalLevelPicker = false;
    this.startDrawZone((geometry) => this.runRasterAnalysis('custom', geometry));
  }

  /** Bouton "Dessiner une zone" de l'onglet analyse multi-couches - la géométrie remplace
   * l'emprise carte pour "Analyser ces couches"/"Générer un rapport PDF" (voir
   * analyzeActiveLayers()/generateReport()), pour circonscrire l'analyse à une zone précise
   * plutôt qu'à tout ce qui est visible à l'écran. */
  startDrawZoneForMultiLayer(): void {
    this.viewSummary = null;
    this.viewSummaryError = null;
    this.startDrawZone((geometry) => {
      this.multiLayerZoneGeometry = geometry;
    });
  }

  /** Efface la zone dessinée pour l'analyse multi-couches - revient à l'emprise carte. */
  clearMultiLayerZone(): void {
    this.multiLayerZoneGeometry = null;
    this.drawLayer?.getSource()?.clear();
    this.viewSummary = null;
    this.viewSummaryError = null;
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
    this.rasterStats = null;
    this.zonalStats = null;
    this.rasterNarrative = null;
    this.rasterAnalysisError = null;
    this.zonalPickerMode = 'raster';
    this.loadAdminLevelsForPicker();
  }

  /** "Choroplèthe" (couches vectorielles) - même sélecteur de niveau administratif que
   * "Statistiques par zone" raster, voir zonalPickerMode. */
  openChoroplethPicker(): void {
    if (!this.selectedLayerId || this.numericAttributes.length === 0) return;
    this.choroplethResult = null;
    this.choroplethError = null;
    this.choroplethAttribute = this.numericAttributes[0];
    this.zonalPickerMode = 'choropleth';
    this.loadAdminLevelsForPicker();
  }

  private loadAdminLevelsForPicker(): void {
    const instanceId = this.instanceService.currentInstance$.value?.id;
    if (!instanceId) return;

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

  /** Lance le choroplèthe pour l'attribut/niveau sélectionnés dans le picker partagé, puis
   * rend le résultat comme couche vectorielle graduée sur la carte (voir
   * MapLayerService.addAnalysisVectorLayer). */
  runChoropleth(): void {
    if (!this.selectedLayerId || !this.choroplethAttribute || this.selectedAdminLevel == null) {
      return;
    }
    this.choroplethRunning = true;
    this.choroplethError = null;
    this.choroplethResult = null;
    this.showZonalLevelPicker = false;

    this.choroplethService
      .getChoropleth(this.selectedLayerId, this.choroplethAttribute, this.selectedAdminLevel)
      .subscribe({
        next: (zones) => {
          this.choroplethRunning = false;
          this.choroplethResult = zones;
          this.renderChoropleth(zones);
        },
        error: () => {
          this.choroplethRunning = false;
          this.choroplethError = 'Impossible de calculer le choroplèthe.';
        },
      });
  }

  private renderChoropleth(zones: ChoroplethZone[]): void {
    const values = zones.map((z) => z.value).filter((v): v is number => v != null);
    if (values.length === 0) return;
    const numClasses = Math.min(5, new Set(values).size);
    const breaks = computeQuantileBreaks(values, numClasses);
    this.choroplethLegend = buildGraduatedLegend(breaks);

    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: zones
        .filter((z) => z.value != null)
        .map((z) => ({
          type: 'Feature',
          geometry: z.geometry as GeoJSON.Geometry,
          properties: { value: z.value, name: z.zoneName },
        })),
    };
    this.mapLayerService.addAnalysisVectorLayer(
      'choropleth',
      featureCollection,
      buildChoroplethStyleFn('value', breaks),
    );
  }

  /** "Carroyage" (couches vectorielles) - opère directement sur l'emprise carte courante, pas
   * de sélecteur de zone administrative (contrairement au choroplèthe). */
  runGrid(): void {
    if (!this.selectedLayerId) return;
    this.gridRunning = true;
    this.gridError = null;
    this.gridResult = null;

    const extent = this.mapService.getCurrentExtent() as [number, number, number, number];
    this.choroplethService
      .getGrid(this.selectedLayerId, extent, this.gridCellSizeMeters, this.gridType)
      .subscribe({
        next: (cells) => {
          this.gridRunning = false;
          this.gridResult = cells;
          this.renderGrid(cells);
        },
        error: () => {
          this.gridRunning = false;
          this.gridError = 'Impossible de générer la grille.';
        },
      });
  }

  private renderGrid(cells: GridCell[]): void {
    if (cells.length === 0) return;
    const values = cells.map((c) => c.value);
    const numClasses = Math.min(5, new Set(values).size);
    const breaks = computeQuantileBreaks(values, numClasses);
    this.gridLegend = buildGraduatedLegend(breaks);

    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: cells.map((c) => ({
        type: 'Feature',
        geometry: c.geometry as GeoJSON.Geometry,
        properties: { value: c.value },
      })),
    };
    this.mapLayerService.addAnalysisVectorLayer(
      'grid',
      featureCollection,
      buildGridStyleFn('value', breaks),
    );
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
