import { AfterViewInit, Component, ElementRef, Injector, OnDestroy, ViewChild, afterNextRender, inject, signal } from '@angular/core';
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
import { TranslateModule } from '@ngx-translate/core';

interface ProfileStats {
  distanceM: number;
  minAltitude: number;
  maxAltitude: number;
  ascent: number;
  descent: number;
}

@Component({
  selector: 'app-altimetry-tool',
  standalone: true,
  imports: [TranslateModule, CommonModule, MatButtonModule, MatIconModule, MatDividerModule, MatSnackBarModule, LoadingSpinnerComponent],
  templateUrl: './altimetry-tool.component.html',
  styleUrl: './altimetry-tool.component.scss',
})
export class AltimetryToolComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly mapService = inject(MapService);
  private readonly geoportailService = inject(GeoportailService);
  private readonly snackBar = inject(MatSnackBar);
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
  readonly stats = signal<ProfileStats | null>(null);

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
    setTimeout(() => { this.mapService.isPicking = false; }, 300);
  }

  private fetchProfile(geom3857: LineString): void {
    this.loading.set(true);
    this.hasProfile.set(false);

    const geojson = new GeoJSON().writeGeometryObject(geom3857, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });

    const length = geom3857.getLength();
    const numPoints = Math.max(20, Math.min(300, Math.round(length / 50)));

    this.geoportailService.getElevationProfile(geojson as unknown as GeoJSON.Geometry, numPoints).subscribe({
      next: (result) => {
        this.loading.set(false);
        const points = result?.profile || [];
        if (points.length === 0) {
          this.snackBar.open('Aucune donnée d\'altitude disponible pour cette zone.', 'OK', { duration: 4000 });
          return;
        }
        this.stats.set(this.computeStats(points));
        this.hasProfile.set(true);
        // Le <canvas #chartCanvas> est dans un bloc @if(hasProfile()) : il n'existe pas encore
        // dans le DOM au moment de ce set() (Angular ne l'a pas encore rendu). afterNextRender()
        // attend le prochain rendu effectif avant d'initialiser Chart.js sur le canvas.
        afterNextRender(() => void this.renderChart(points), { injector: this.injector });
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Échec de la récupération du profil altimétrique. Réessayez.', 'OK', { duration: 4000 });
      },
    });
  }

  private computeStats(points: ElevationPoint[]): ProfileStats {
    let ascent = 0;
    let descent = 0;
    let minAltitude = points[0].altitude;
    let maxAltitude = points[0].altitude;

    for (let i = 1; i < points.length; i++) {
      const delta = points[i].altitude - points[i - 1].altitude;
      if (delta > 0) ascent += delta;
      else descent += -delta;
      minAltitude = Math.min(minAltitude, points[i].altitude);
      maxAltitude = Math.max(maxAltitude, points[i].altitude);
    }

    return {
      distanceM: points[points.length - 1].distance,
      minAltitude,
      maxAltitude,
      ascent,
      descent,
    };
  }

  private async renderChart(points: ElevationPoint[]): Promise<void> {
    if (!this.chartCanvas) return;
    const { Chart } = await import('chart.js/auto');

    this.chart?.destroy();

    const labels = points.map(p => (p.distance / 1000).toFixed(2));
    const data = points.map(p => p.altitude);

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#00ada7',
          backgroundColor: 'rgba(0, 173, 167, 0.15)',
          fill: true,
          tension: 0.15,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#e74c3c',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { title: { display: true, text: 'Distance (km)' }, ticks: { maxTicksLimit: 8 } },
          y: { title: { display: true, text: 'Altitude (m)' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `${items[0].label} km`,
              label: (item) => `${item.formattedValue} m`,
            },
          },
        },
        onHover: (_event, elements) => {
          if (elements.length === 0 || !this.lineGeom3857) return;
          const idx = elements[0].index;
          const fraction = points[idx].distance / (this.stats()?.distanceM || 1);
          const coord = this.lineGeom3857.getCoordinateAt(Math.min(1, Math.max(0, fraction)));
          this.showMarker(coord);
        },
      },
    });
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
