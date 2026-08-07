import {
  AfterViewInit,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  ViewChild,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import Map from 'ol/Map';
import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';

import { MapService } from '../../map/services/map.service';
import { GeoportailService } from '../../../core/services/geoportail.service';
import { ElevationPoint } from '../../../core/models/index';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  computeElevationStats,
  renderElevationChart,
  elevationSampleCount,
  ElevationProfileStats,
} from '../shared/elevation-chart.util';

@Component({
  selector: 'app-altimetry-tool',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './altimetry-tool.component.html',
  styleUrl: './altimetry-tool.component.scss',
})
export class AltimetryToolComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly mapService = inject(MapService);
  private readonly geoportailService = inject(GeoportailService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly injector = inject(Injector);

  private map!: Map;
  private lineLayer!: VectorLayer<VectorSource>;
  private markerLayer!: VectorLayer<VectorSource>;
  private drawInteraction: Draw | null = null;
  private lineGeom3857: LineString | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chart: any = null;

  readonly picking = signal(false);
  readonly loading = signal(false);
  readonly hasProfile = signal(false);
  readonly stats = signal<ElevationProfileStats | null>(null);

  ngAfterViewInit(): void {
    this.map = this.mapService.getMap();

    this.lineLayer = this.mapService.addVectorLayer(
      'altimetry-line',
      [],
      new Style({ stroke: new Stroke({ color: '#023f5f', width: 3 }) }),
    );
    this.markerLayer = this.mapService.addVectorLayer(
      'altimetry-marker',
      [],
      new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({ color: '#e74c3c' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
      }),
    );
  }

  ngOnDestroy(): void {
    this.stopPicking();
    if (this.lineLayer) this.mapService.removeLayer(this.lineLayer);
    if (this.markerLayer) this.mapService.removeLayer(this.markerLayer);
    this.chart?.destroy();
  }

  togglePicking(): void {
    if (this.picking()) {
      this.stopPicking();
      return;
    }
    this.clear();
    this.picking.set(true);
    this.mapService.isPicking = true;

    this.drawInteraction = new Draw({
      source: this.lineLayer.getSource()!,
      type: 'LineString',
    });
    this.drawInteraction.on('drawend', (event) => {
      const geom = event.feature.getGeometry() as LineString;
      this.lineGeom3857 = geom;
      this.stopPicking();
      this.fetchProfile(geom);
    });
    this.map.addInteraction(this.drawInteraction);
  }

  private stopPicking(): void {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.drawInteraction = null;
    }
    this.picking.set(false);
    // Différé de 300ms (> le délai de reconnaissance du double-clic d'OpenLayers, ~250ms) :
    // 'drawend' se déclenche dès le PREMIER clic du double-clic qui termine le tracé, avant
    // que le second clic physique n'ait eu lieu. Un setTimeout(0) remettrait isPicking à false
    // avant même que l'événement 'click' du second clic n'atteigne FeatureInfoComponent, qui
    // ouvrirait alors à tort la fiche descriptive sur la ligne qui vient d'être tracée.
    setTimeout(() => {
      this.mapService.isPicking = false;
    }, 300);
  }

  private fetchProfile(geom3857: LineString): void {
    this.loading.set(true);
    this.hasProfile.set(false);

    const geojson = new GeoJSON().writeGeometryObject(geom3857, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });

    const numPoints = elevationSampleCount(geom3857.getLength());

    this.geoportailService
      .getElevationProfile(geojson as unknown as GeoJSON.Geometry, numPoints)
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          const points = result?.profile || [];
          if (points.length === 0) {
            this.snackBar.open(
              this.translate.instant('tools.altimetryErrors.noData') ||
                "Aucune donnée d'altitude disponible pour cette zone.",
              'OK',
              { duration: 4000 },
            );
            return;
          }
          this.stats.set(computeElevationStats(points));
          this.hasProfile.set(true);
          // Le <canvas #chartCanvas> est dans un bloc @if(hasProfile()) : il n'existe pas encore
          // dans le DOM au moment de ce set() (Angular ne l'a pas encore rendu). afterNextRender()
          // attend le prochain rendu effectif avant d'initialiser Chart.js sur le canvas.
          afterNextRender(() => void this.renderChart(points), { injector: this.injector });
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open(
            this.translate.instant('tools.altimetryErrors.fetchFailed') ||
              'Échec de la récupération du profil altimétrique. Réessayez.',
            'OK',
            { duration: 4000 },
          );
        },
      });
  }

  private async renderChart(points: ElevationPoint[]): Promise<void> {
    if (!this.chartCanvas) return;
    this.chart = await renderElevationChart(
      this.chartCanvas.nativeElement,
      points,
      this.chart,
      (fraction) => {
        if (!this.lineGeom3857) return;
        const coord = this.lineGeom3857.getCoordinateAt(fraction);
        this.showMarker(coord);
      },
    );
  }

  private showMarker(coord: number[]): void {
    const source = this.markerLayer.getSource()!;
    source.clear();
    source.addFeature(new Feature(new Point(coord)));
  }

  clear(): void {
    this.stopPicking();
    this.lineLayer?.getSource()?.clear();
    this.markerLayer?.getSource()?.clear();
    this.lineGeom3857 = null;
    this.hasProfile.set(false);
    this.stats.set(null);
    this.chart?.destroy();
    this.chart = null;
  }
}
