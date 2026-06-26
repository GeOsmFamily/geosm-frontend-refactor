import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Draw from 'ol/interaction/Draw';
import Overlay from 'ol/Overlay';
import { getLength, getArea } from 'ol/sphere';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';
import { Geometry, LineString, Polygon } from 'ol/geom';
import Feature from 'ol/Feature';

import { MapService } from '../../map/services/map.service';
import { TranslateModule } from '@ngx-translate/core';

type MeasureMode = 'distance' | 'area';

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
  imports: [TranslateModule, 
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './measure-tool.component.html',
  styleUrl: './measure-tool.component.scss',
})
export class MeasureToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);

  private map!: Map;
  private vectorSource = new VectorSource();
  private vectorLayer!: VectorLayer<VectorSource>;
  private drawInteraction: Draw | null = null;
  private counter = 0;

  mode: MeasureMode = 'distance';
  measurements: MeasureResult[] = [];
  isActive = false;

  ngOnInit(): void {
    this.map = this.mapService.getMap();
    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: new Style({
        fill: new Fill({ color: 'rgba(25, 118, 210, 0.15)' }),
        stroke: new Stroke({ color: '#1976d2', width: 2 }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#1976d2' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      }),
    });
    this.map.addLayer(this.vectorLayer);
  }

  ngOnDestroy(): void {
    this.deactivate();
    this.clearMeasurements();
    if (this.vectorLayer) {
      this.map.removeLayer(this.vectorLayer);
    }
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
    const type = this.mode === 'distance' ? 'LineString' : 'Polygon';

    this.drawInteraction = new Draw({
      source: this.vectorSource,
      type: type as any,
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

      if (geom instanceof LineString) {
        overlay.setPosition(geom.getLastCoordinate());
      } else if (geom instanceof Polygon) {
        overlay.setPosition(geom.getInteriorPoint().getCoordinates());
      }

      this.map.addOverlay(overlay);

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
  }

  private formatMeasurement(geom: Geometry): string {
    if (geom instanceof LineString) {
      const length = getLength(geom);
      if (length >= 1000) {
        return (length / 1000).toFixed(2) + ' km';
      }
      return length.toFixed(1) + ' m';
    }

    if (geom instanceof Polygon) {
      const area = getArea(geom);
      if (area >= 1000000) {
        return (area / 1000000).toFixed(2) + ' km²';
      }
      if (area >= 10000) {
        return (area / 10000).toFixed(2) + ' ha';
      }
      return area.toFixed(1) + ' m²';
    }

    return '';
  }

  removeMeasurement(item: MeasureResult): void {
    this.vectorSource.removeFeature(item.feature);
    this.map.removeOverlay(item.overlay);
    this.measurements = this.measurements.filter(m => m.id !== item.id);
  }

  clearMeasurements(): void {
    for (const m of this.measurements) {
      this.map.removeOverlay(m.overlay);
    }
    this.vectorSource.clear();
    this.measurements = [];
    this.counter = 0;
  }
}
