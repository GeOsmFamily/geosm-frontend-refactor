import { AfterViewInit, Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Fill, Stroke, Style, Circle as CircleStyle, Text } from 'ol/style';
import { Subscription } from 'rxjs';

import { MapService } from '../../map/services/map.service';
import { MapLayerService, ActiveLayer } from '../../map/services/map-layer.service';
import { NearestFeatureService, NearestFeatureResult } from '../../../core/services/nearest-feature.service';
import { ToolActionService } from '../../../core/services/tool-action.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-nearest-search-tool',
  standalone: true,
  imports: [
    TranslateModule, CommonModule, MatButtonModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatDividerModule, MatTooltipModule, MatSnackBarModule, LoadingSpinnerComponent,
  ],
  templateUrl: './nearest-search-tool.component.html',
  styleUrl: './nearest-search-tool.component.scss',
})
export class NearestSearchToolComponent implements AfterViewInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly nearestFeatureService = inject(NearestFeatureService);
  private readonly toolAction = inject(ToolActionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  private map!: Map;
  private markerLayer!: VectorLayer<VectorSource>;
  private clickListener: ((evt: any) => void) | null = null;
  private activeLayersSub?: Subscription;

  readonly activeLayers = signal<ActiveLayer[]>([]);
  readonly selectedLayerId = signal<string | null>(null);
  readonly picking = signal(false);
  readonly loading = signal(false);
  readonly results = signal<NearestFeatureResult[]>([]);
  private originCoord: [number, number] | null = null;

  ngAfterViewInit(): void {
    this.map = this.mapService.getMap();
    this.markerLayer = this.mapService.addVectorLayer('nearest-search-markers');
    this.activeLayersSub = this.mapLayerService.activeLayers$.subscribe((layers) => {
      this.activeLayers.set(layers);
      if (this.selectedLayerId() && !layers.some((l) => l.layer.id === this.selectedLayerId())) {
        this.selectedLayerId.set(null);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPicking();
    this.activeLayersSub?.unsubscribe();
    if (this.markerLayer) this.mapService.removeLayer(this.markerLayer);
  }

  selectLayer(layerId: string): void {
    this.selectedLayerId.set(layerId);
    this.results.set([]);
  }

  togglePicking(): void {
    if (this.picking()) {
      this.stopPicking();
      return;
    }
    if (!this.selectedLayerId()) return;

    this.picking.set(true);
    this.mapService.isPicking = true;

    this.clickListener = (evt: any) => {
      const [lon, lat] = toLonLat(evt.coordinate) as [number, number];
      this.originCoord = [lon, lat];
      this.stopPicking();
      this.search(lon, lat);
    };
    this.map.on('singleclick', this.clickListener);
  }

  private stopPicking(): void {
    if (this.clickListener) {
      this.map.un('singleclick', this.clickListener);
      this.clickListener = null;
    }
    this.picking.set(false);
    setTimeout(() => { this.mapService.isPicking = false; }, 300);
  }

  private search(lon: number, lat: number): void {
    const layerId = this.selectedLayerId();
    if (!layerId) return;

    this.loading.set(true);
    this.results.set([]);
    this.updateMarkers(lon, lat, []);

    this.nearestFeatureService.find(layerId, lon, lat, 3).subscribe({
      next: (results) => {
        this.loading.set(false);
        this.results.set(results);
        this.updateMarkers(lon, lat, results);
        if (results.length === 0) {
          this.snackBar.open(this.translate.instant('tools.nearestSearchErrors.noResult') || 'Aucun résultat trouvé pour cette couche.', 'OK', { duration: 3000 });
        }
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open(this.translate.instant('tools.nearestSearchErrors.searchFailed') || 'Échec de la recherche du plus proche.', 'OK', { duration: 4000 });
      },
    });
  }

  private updateMarkers(originLon: number, originLat: number, results: NearestFeatureResult[]): void {
    const source = this.markerLayer.getSource()!;
    source.clear();

    const originFeature = new Feature(new Point(fromLonLat([originLon, originLat])));
    originFeature.setStyle(new Style({
      image: new CircleStyle({ radius: 8, fill: new Fill({ color: '#023f5f' }), stroke: new Stroke({ color: '#ffffff', width: 2.5 }) }),
    }));
    source.addFeature(originFeature);

    results.forEach((r, i) => {
      const feature = new Feature(new Point(fromLonLat([r.lon, r.lat])));
      feature.setStyle(new Style({
        image: new CircleStyle({ radius: 12, fill: new Fill({ color: '#00ada7' }), stroke: new Stroke({ color: '#ffffff', width: 2 }) }),
        text: new Text({ text: String(i + 1), fill: new Fill({ color: '#ffffff' }), font: 'bold 12px sans-serif' }),
      }));
      source.addFeature(feature);
    });
  }

  zoomToResult(result: NearestFeatureResult): void {
    this.mapService.zoomTo([result.lon, result.lat], 17);
  }

  routeToResult(result: NearestFeatureResult): void {
    if (!this.originCoord) return;
    this.toolAction.emit({ tool: 'routing', action: 'setStart', data: this.originCoord });
    this.toolAction.emit({ tool: 'routing', action: 'setEnd', data: [result.lon, result.lat] });
  }

  formatDistance(meters: number): string {
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
  }

  formatDuration(seconds: number | null): string {
    if (seconds == null) return '';
    const minutes = Math.round(seconds / 60);
    return minutes < 1 ? '< 1 min' : `${minutes} min`;
  }

  clear(): void {
    this.stopPicking();
    this.results.set([]);
    this.originCoord = null;
    this.markerLayer?.getSource()?.clear();
  }
}
