import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import Draw from 'ol/interaction/Draw';
import Overlay from 'ol/Overlay';
import { getLength, getArea } from 'ol/sphere';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';
import { Geometry, LineString, Polygon, Circle } from 'ol/geom';
import { fromCircle } from 'ol/geom/Polygon';
import Feature from 'ol/Feature';

import { MapService } from '../../map/services/map.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type MeasureMode = 'distance' | 'area' | 'circle';

interface MeasureResult {
  id: number;
  mode: MeasureMode;
  value: string;
  feature: Feature;
  overlay: Overlay;
}

@Component({
  selector: 'app-measure-tool',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './measure-tool.component.html',
  styleUrl: './measure-tool.component.scss',
})
export class MeasureToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly translate = inject(TranslateService);

  private map!: Map;
  private vectorSource!: VectorSource;
  private drawInteraction: Draw | null = null;
  private counter = 0;

  mode: MeasureMode = 'distance';
  measurements: MeasureResult[] = [];
  isActive = false;

  ngOnInit(): void {
    this.map = this.mapService.getMap();
    this.vectorSource = this.mapService.measureSource;
    this.measurements = this.mapService.measurements;

    // Apply standard styling to the shared persistent measure layer
    this.mapService.measureLayer.setStyle(
      new Style({
        fill: new Fill({ color: 'rgba(25, 118, 210, 0.15)' }),
        stroke: new Stroke({ color: '#1976d2', width: 2 }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#1976d2' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      }),
    );

    // Initialize local counter to avoid ID conflicts
    this.counter = this.measurements.reduce((max, m) => Math.max(max, m.id), 0);
  }

  ngOnDestroy(): void {
    this.deactivate();
  }

  setMode(mode: MeasureMode): void {
    this.mode = mode;
    if (this.isActive) {
      this.deactivate();
      this.activate();
    }
  }

  toggleActive(): void {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  private activate(): void {
    this.isActive = true;
    // Empêche la fiche descriptive de s'ouvrir sur les clics de tracé (chaque sommet, et le
    // double-clic final) tant que l'outil de mesure est actif - voir FeatureInfoComponent
    // qui ignore les clics quand ce flag est vrai.
    this.mapService.isPicking = true;

    let olType = 'Polygon';
    if (this.mode === 'distance') {
      olType = 'LineString';
    } else if (this.mode === 'circle') {
      olType = 'Circle';
    }

    this.drawInteraction = new Draw({
      source: this.vectorSource,
      type: olType as any,
    });

    this.drawInteraction.on('drawend', (event) => {
      this.counter++;
      const feature = event.feature;
      const geom = feature.getGeometry()!;
      const formatted = this.formatMeasurement(geom);

      const tooltipElement = document.createElement('div');
      tooltipElement.className = 'measure-tooltip';
      tooltipElement.textContent = formatted;

      const overlay = new Overlay({
        element: tooltipElement,
        offset: [0, -15],
        positioning: 'bottom-center',
        stopEvent: false,
      });

      // Position the tooltip on the drawn geometry
      if (geom instanceof LineString) {
        overlay.setPosition(geom.getLastCoordinate());
      } else if (geom instanceof Polygon) {
        overlay.setPosition(geom.getInteriorPoint().getCoordinates());
      } else if (geom instanceof Circle) {
        overlay.setPosition(geom.getCenter());
      }

      this.map.addOverlay(overlay);
      this.mapService.measureOverlays.push(overlay);

      this.measurements.push({
        id: this.counter,
        mode: this.mode,
        value: formatted,
        feature,
        overlay,
      });
    });

    this.map.addInteraction(this.drawInteraction);
  }

  private deactivate(): void {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.drawInteraction = null;
    }
    this.isActive = false;
    this.mapService.isPicking = false;
  }

  private formatLength(geom: LineString): string {
    const length = getLength(geom);
    if (length >= 1000) {
      return (length / 1000).toFixed(2) + ' km';
    }
    return length.toFixed(1) + ' m';
  }

  private formatArea(geom: Polygon): string {
    const area = getArea(geom);
    if (area >= 1000000) {
      return (area / 1000000).toFixed(2) + ' km²';
    }
    if (area >= 10000) {
      return (area / 10000).toFixed(2) + ' ha';
    }
    return area.toFixed(1) + ' m²';
  }

  private formatCircle(geom: Circle): string {
    const polygon = fromCircle(geom, 64);
    const area = getArea(polygon);
    const radiusM = Math.sqrt(area / Math.PI);

    let areaStr: string;
    if (area >= 1000000) {
      areaStr = (area / 1000000).toFixed(3) + ' km²';
    } else if (area >= 10000) {
      areaStr = (area / 10000).toFixed(2) + ' ha';
    } else {
      areaStr = area.toFixed(1) + ' m²';
    }

    let radiusStr: string;
    if (radiusM >= 1000) {
      radiusStr = (radiusM / 1000).toFixed(2) + ' km';
    } else {
      radiusStr = radiusM.toFixed(1) + ' m';
    }

    return `r = ${radiusStr} | S = ${areaStr}`;
  }

  private formatMeasurement(geom: Geometry): string {
    if (geom instanceof LineString) {
      return this.formatLength(geom);
    }
    if (geom instanceof Polygon) {
      return this.formatArea(geom);
    }
    if (geom instanceof Circle) {
      return this.formatCircle(geom);
    }
    return '';
  }

  /** Icon to display in the results list for a given mode */
  getModeIcon(mode: MeasureMode): string {
    if (mode === 'distance') {
      return 'straighten';
    }
    if (mode === 'circle') {
      return 'radio_button_unchecked';
    }
    return 'square_foot';
  }

  removeMeasurement(item: MeasureResult): void {
    this.vectorSource.removeFeature(item.feature);
    this.map.removeOverlay(item.overlay);

    const overlayIdx = this.mapService.measureOverlays.indexOf(item.overlay);
    if (overlayIdx > -1) {
      this.mapService.measureOverlays.splice(overlayIdx, 1);
    }

    const idx = this.measurements.findIndex((m) => m.id === item.id);
    if (idx > -1) {
      this.measurements.splice(idx, 1);
    }
  }

  clearMeasurements(): void {
    for (const overlay of this.mapService.measureOverlays) {
      this.map.removeOverlay(overlay);
    }
    this.mapService.measureOverlays.length = 0;
    this.vectorSource.clear();
    this.measurements.length = 0;
    this.counter = 0;
  }
}
