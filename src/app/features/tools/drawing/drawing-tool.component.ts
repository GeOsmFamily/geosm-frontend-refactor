import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatDialog } from '@angular/material/dialog';
import Map from 'ol/Map.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Draw from 'ol/interaction/Draw.js';
import { Type as GeometryType } from 'ol/geom/Geometry.js';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style.js';
import Feature from 'ol/Feature.js';
import GeoJSON from 'ol/format/GeoJSON.js';

import { MapService } from '../../map/services/map.service.js';
import { DrawingService } from '../../../core/services/drawing.service.js';
import { InstanceService } from '../../../core/services/instance.service.js';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component.js';

type DrawType = 'Point' | 'LineString' | 'Polygon' | 'Circle';

interface DrawnFeature {
  id: string;
  type: string;
  color: string;
  label: string;
  feature: Feature;
}

@Component({
  selector: 'app-drawing-tool',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatListModule,
  ],
  templateUrl: './drawing-tool.component.html',
  styleUrl: './drawing-tool.component.scss',
})
export class DrawingToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly drawingService = inject(DrawingService);
  private readonly instanceService = inject(InstanceService);
  private readonly dialog = inject(MatDialog);

  private map!: Map;
  private vectorSource = new VectorSource();
  private vectorLayer!: VectorLayer<VectorSource>;
  private drawInteraction: Draw | null = null;
  private featureCounter = 0;

  activeDrawType: DrawType | 'Text' | null = null;
  selectedColor = '#1976d2';
  drawnFeatures: DrawnFeature[] = [];
  textLabel = '';

  readonly presetColors = [
    '#1976d2', '#d32f2f', '#388e3c', '#f57c00',
    '#7b1fa2', '#0097a7', '#fbc02d', '#455a64',
  ];

  readonly drawTypes: { type: DrawType | 'Text'; icon: string; label: string }[] = [
    { type: 'Point', icon: 'place', label: 'Point' },
    { type: 'LineString', icon: 'timeline', label: 'Ligne' },
    { type: 'Polygon', icon: 'pentagon', label: 'Polygone' },
    { type: 'Circle', icon: 'radio_button_unchecked', label: 'Cercle' },
    { type: 'Text', icon: 'text_fields', label: 'Texte' },
  ];

  customColor = '';

  ngOnInit(): void {
    this.map = this.mapService.getMap();
    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: (feature) => this.createStyle(feature as Feature),
    });
    this.map.addLayer(this.vectorLayer);
  }

  ngOnDestroy(): void {
    this.deactivateDrawing();
    if (this.vectorLayer) {
      this.map.removeLayer(this.vectorLayer);
    }
  }

  activateDraw(type: DrawType | 'Text'): void {
    if (this.activeDrawType === type) {
      this.deactivateDrawing();
      return;
    }

    this.deactivateDrawing();
    this.activeDrawType = type;

    const olType: GeometryType = type === 'Text' ? 'Point' : type as GeometryType;

    this.drawInteraction = new Draw({
      source: this.vectorSource,
      type: olType,
    });

    this.drawInteraction.on('drawend', (event) => {
      this.featureCounter++;
      const feature = event.feature;
      const id = `draw-${this.featureCounter}`;
      feature.setId(id);
      feature.set('color', this.selectedColor);
      feature.set('drawType', type);

      if (type === 'Text') {
        const label = this.textLabel || `Texte ${this.featureCounter}`;
        feature.set('label', label);
      }

      this.drawnFeatures.push({
        id,
        type,
        color: this.selectedColor,
        label: type === 'Text' ? (feature.get('label') as string) : `${type} ${this.featureCounter}`,
        feature,
      });
    });

    this.map.addInteraction(this.drawInteraction);
  }

  private deactivateDrawing(): void {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.drawInteraction = null;
    }
    this.activeDrawType = null;
  }

  selectColor(color: string): void {
    this.selectedColor = color;
  }

  applyCustomColor(): void {
    if (/^#[0-9a-fA-F]{6}$/.test(this.customColor)) {
      this.selectedColor = this.customColor;
    }
  }

  deleteFeature(item: DrawnFeature): void {
    this.vectorSource.removeFeature(item.feature);
    this.drawnFeatures = this.drawnFeatures.filter(f => f.id !== item.id);
  }

  clearAll(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Supprimer tous les dessins',
        message: 'Voulez-vous vraiment supprimer tous les dessins ?',
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.vectorSource.clear();
        this.drawnFeatures = [];
        this.featureCounter = 0;
      }
    });
  }

  saveDrawings(): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) return;

    const geojson = new GeoJSON().writeFeaturesObject(this.vectorSource.getFeatures(), {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });

    this.drawingService.create({
      name: `Dessin ${new Date().toLocaleDateString('fr-FR')}`,
      geojson: geojson as GeoJSON.GeoJSON,
      description: '',
      isPublic: false,
      instanceId: instance.id,
    }).subscribe();
  }

  loadDrawings(): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) return;

    this.drawingService.list(instance.id).subscribe(drawings => {
      if (drawings.length > 0) {
        const latest = drawings[drawings.length - 1];
        const features = new GeoJSON().readFeatures(latest.geojson, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326',
        });

        features.forEach(f => {
          this.featureCounter++;
          const id = `draw-${this.featureCounter}`;
          f.setId(id);
          if (!f.get('color')) f.set('color', this.selectedColor);
          this.vectorSource.addFeature(f);
          this.drawnFeatures.push({
            id,
            type: (f.get('drawType') as string) || 'Point',
            color: (f.get('color') as string) || this.selectedColor,
            label: (f.get('label') as string) || `Feature ${this.featureCounter}`,
            feature: f,
          });
        });
      }
    });
  }

  private createStyle(feature: Feature): Style {
    const color = (feature.get('color') as string) || this.selectedColor;
    const drawType = feature.get('drawType') as string;
    const label = feature.get('label') as string;

    return new Style({
      fill: new Fill({ color: color + '33' }),
      stroke: new Stroke({ color, width: 2 }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
      text: drawType === 'Text' && label
        ? new Text({
            text: label,
            font: '14px sans-serif',
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#fff', width: 3 }),
            offsetY: -15,
          })
        : undefined,
    });
  }
}
