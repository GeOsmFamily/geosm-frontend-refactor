import { Component, OnInit, OnDestroy, inject, output, signal, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { fromLonLat, transformExtent } from 'ol/proj';
import { MapService } from '../../services/map.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { ZoomModalComponent } from '../zoom-modal/zoom-modal.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

const GEOLOCATION_LAYER_NAME = 'geolocation-marker';

interface MapPosition {
  center: [number, number];
  zoom: number;
}

@Component({
  selector: 'app-map-toolbar',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './map-toolbar.component.html',
  styleUrl: './map-toolbar.component.scss',
})
export class MapToolbarComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly dialog = inject(MatDialog);
  private readonly ngZone = inject(NgZone);
  private readonly instanceService = inject(InstanceService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private map!: Map;
  private history: MapPosition[] = [];
  private historyIndex = -1;
  private navigating = false;
  private moveEndListener: any;

  readonly locating = signal(false);
  readonly hasLocationMarker = signal(false);

  compareMode = output<boolean>();
  private isCompareMode = false;

  ngOnInit(): void {
    this.mapService.mapReady$.subscribe((ready) => {
      if (ready) {
        this.map = this.mapService.getMap();
        this.savePosition();
        this.moveEndListener = () => {
          if (!this.navigating) {
            this.ngZone.run(() => {
              this.savePosition();
            });
          }
        };
        this.map.on('moveend', this.moveEndListener);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.moveEndListener) {
      this.map.un('moveend', this.moveEndListener);
    }
  }

  private savePosition(): void {
    const view = this.map.getView();
    const center = view.getCenter();
    const zoom = view.getZoom();
    if (!center || zoom === undefined) return;

    // Check if the position is the same as the current history position to avoid duplicates
    if (this.historyIndex >= 0) {
      const current = this.history[this.historyIndex];
      const epsilon = 1e-6;
      if (
        Math.abs(current.center[0] - center[0]) < epsilon &&
        Math.abs(current.center[1] - center[1]) < epsilon &&
        Math.abs(current.zoom - zoom) < epsilon
      ) {
        return;
      }
    }

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push({ center: [center[0], center[1]], zoom });
    this.historyIndex = this.history.length - 1;
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  get canGoBack(): boolean {
    return this.historyIndex > 0;
  }
  get canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  goBack(): void {
    if (!this.canGoBack) return;
    this.historyIndex--;
    this.navigateTo(this.history[this.historyIndex]);
  }

  goForward(): void {
    if (!this.canGoForward) return;
    this.historyIndex++;
    this.navigateTo(this.history[this.historyIndex]);
  }

  private navigateTo(pos: MapPosition): void {
    this.navigating = true;
    const view = this.map.getView();
    view.animate({ center: pos.center, zoom: pos.zoom, duration: 300 }, () => {
      this.navigating = false;
    });
  }

  zoomIn(): void {
    const zoom = this.map.getView().getZoom();
    if (zoom !== undefined) this.map.getView().animate({ zoom: zoom + 1, duration: 200 });
  }

  zoomOut(): void {
    const zoom = this.map.getView().getZoom();
    if (zoom !== undefined) this.map.getView().animate({ zoom: zoom - 1, duration: 200 });
  }

  fitExtent(): void {
    const instance = this.instanceService.currentInstance$.value;
    const view = this.map.getView();
    if (instance) {
      if (instance?.bbox && instance?.bbox?.length === 4) {
        const extent = transformExtent(instance.bbox, 'EPSG:4326', 'EPSG:3857');
        view.fit(extent, { duration: 500, padding: [50, 50, 50, 50] });
      } else {
        view.animate({
          center: fromLonLat([instance.centerLon, instance.centerLat]),
          zoom: instance.defaultZoom,
          duration: 500,
        });
      }
    } else {
      view.animate({ center: fromLonLat([11.5, 3.85]), zoom: 6, duration: 500 });
    }
  }

  openZoomModal(): void {
    const ref = this.dialog.open(ZoomModalComponent, { width: '400px' });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        const center = fromLonLat([result.longitude, result.latitude]);
        this.map.getView().animate({ center, zoom: 14, duration: 500 });
      }
    });
  }

  toggleCompare(): void {
    this.isCompareMode = !this.isCompareMode;
    this.compareMode.emit(this.isCompareMode);
  }

  locateMe(): void {
    // Le bouton fait office de bascule : un second clic une fois la position affichée
    // l'efface plutôt que de relancer une géolocalisation.
    if (this.hasLocationMarker()) {
      this.clearLocationMarker();
      return;
    }

    if (!navigator.geolocation) {
      this.showLocationError();
      return;
    }

    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locating.set(false);
        const lonLat: [number, number] = [position.coords.longitude, position.coords.latitude];
        this.showPositionMarker(lonLat, position.coords.accuracy);
        this.hasLocationMarker.set(true);
        this.map.getView().animate({ center: fromLonLat(lonLat), zoom: 16, duration: 500 });
      },
      () => {
        this.locating.set(false);
        this.showLocationError();
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  private clearLocationMarker(): void {
    const layer = this.mapService.getLayerByName(GEOLOCATION_LAYER_NAME) as
      VectorLayer<VectorSource> | undefined;
    layer?.getSource()?.clear();
    this.hasLocationMarker.set(false);
  }

  private showLocationError(): void {
    this.snackBar.open(this.translate.instant('naviguation_tools.locate_me_denied'), 'OK', {
      duration: 4000,
    });
  }

  private showPositionMarker(lonLat: [number, number], accuracyMeters: number): void {
    const center = fromLonLat(lonLat);
    const accuracyRadiusPx = this.metersToMapUnits(accuracyMeters);

    const markerFeature = new Feature(new Point(center));
    markerFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: '#1a73e8' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
        }),
      }),
    );

    const accuracyFeature = new Feature(new Point(center));
    accuracyFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: accuracyRadiusPx,
          fill: new Fill({ color: 'rgba(26, 115, 232, 0.15)' }),
          stroke: new Stroke({ color: 'rgba(26, 115, 232, 0.4)', width: 1 }),
        }),
      }),
    );

    const existingLayer = this.mapService.getLayerByName(GEOLOCATION_LAYER_NAME) as
      VectorLayer<VectorSource> | undefined;
    if (existingLayer) {
      const source = existingLayer.getSource();
      source?.clear();
      source?.addFeatures([accuracyFeature, markerFeature]);
    } else {
      this.mapService.addVectorLayer(GEOLOCATION_LAYER_NAME, [accuracyFeature, markerFeature]);
    }
  }

  /** Convertit un rayon en mètres en pixels-carte à la résolution courante (approximation suffisante pour un cercle de précision). */
  private metersToMapUnits(meters: number): number {
    const resolution = this.map.getView().getResolution() ?? 1;
    return Math.max(6, meters / resolution);
  }
}
