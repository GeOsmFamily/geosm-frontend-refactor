import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import Draw from 'ol/interaction/Draw';
import { Type as GeometryType } from 'ol/geom/Geometry';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';

import { MapService } from '../../map/services/map.service';
import { DrawingService } from '../../../core/services/drawing.service';
import { InstanceService } from '../../../core/services/instance.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

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
    TranslateModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatListModule,
    MatSnackBarModule,
  ],
  templateUrl: './drawing-tool.component.html',
  styleUrl: './drawing-tool.component.scss',
})
export class DrawingToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly drawingService = inject(DrawingService);
  private readonly instanceService = inject(InstanceService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  private map!: Map;
  private vectorSource!: VectorSource;
  private drawInteraction: Draw | null = null;
  private featureCounter = 0;

  activeDrawType: DrawType | 'Text' | null = null;
  selectedColor = '#1976d2';
  drawnFeatures: DrawnFeature[] = [];
  textLabel = '';

  readonly presetColors = [
    '#1976d2',
    '#d32f2f',
    '#388e3c',
    '#f57c00',
    '#7b1fa2',
    '#0097a7',
    '#fbc02d',
    '#455a64',
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
    this.vectorSource = this.mapService.drawingSource;

    // Apply the drawing style function to the shared persistent layer
    this.mapService.drawingLayer.setStyle((feature) => this.createStyle(feature as Feature));

    // Restore drawn features from the shared vector source to keep the UI list in sync
    const features = this.vectorSource.getFeatures();
    this.drawnFeatures = features.map((f) => {
      const type = (f.get('drawType') as string) || 'Point';
      const id = (f.getId() as string) || `draw-${++this.featureCounter}`;
      if (!f.getId()) f.setId(id);

      const numericId = Number.parseInt(id.replace('draw-', ''), 10);
      if (!Number.isNaN(numericId) && numericId > this.featureCounter) {
        this.featureCounter = numericId;
      }

      return {
        id,
        type,
        color: (f.get('color') as string) || this.selectedColor,
        label: (f.get('label') as string) || `${type} ${id.replace('draw-', '')}`,
        feature: f,
      };
    });
  }

  ngOnDestroy(): void {
    this.deactivateDrawing();
  }

  activateDraw(type: DrawType | 'Text'): void {
    if (this.activeDrawType === type) {
      this.deactivateDrawing();
      return;
    }

    this.deactivateDrawing();
    this.activeDrawType = type;
    // Empêche la fiche descriptive de s'ouvrir sur les clics de tracé (chaque sommet, et le
    // double-clic final) tant que l'outil de dessin est actif - voir FeatureInfoComponent qui
    // ignore les clics quand ce flag est vrai.
    this.mapService.isPicking = true;

    const olType: GeometryType = type === 'Text' ? 'Point' : (type as GeometryType);

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
        label:
          type === 'Text' ? (feature.get('label') as string) : `${type} ${this.featureCounter}`,
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
    this.mapService.isPicking = false;
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
    this.drawnFeatures = this.drawnFeatures.filter((f) => f.id !== item.id);
  }

  clearAll(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Supprimer tous les dessins',
        message: 'Voulez-vous vraiment supprimer tous les dessins ?',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.vectorSource.clear();
        this.drawnFeatures = [];
        this.featureCounter = 0;
      }
    });
  }

  saveDrawings(): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) {
      this.snackBar.open(
        this.translate.instant('drawing.noInstance') || 'Aucune instance active',
        'OK',
        { duration: 3000 },
      );
      return;
    }

    if (this.vectorSource.getFeatures().length === 0) {
      this.snackBar.open(
        this.translate.instant('drawing.empty') || 'Aucun dessin à sauvegarder',
        'OK',
        { duration: 3000 },
      );
      return;
    }

    const geojson = new GeoJSON().writeFeaturesObject(this.vectorSource.getFeatures(), {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });

    this.drawingService
      .create({
        name: `Dessin ${new Date().toLocaleDateString('fr-FR')}`,
        geojson: geojson as GeoJSON.GeoJSON,
        description: '',
        isPublic: false,
        instanceId: instance.id,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.translate.instant('drawing.saved') || 'Dessins sauvegardés avec succès !',
            'OK',
            { duration: 3000 },
          );
        },
        error: (err) => {
          console.error('[DrawingTool] save error', err);
          this.snackBar.open(
            this.translate.instant('drawing.saveError') || 'Erreur lors de la sauvegarde',
            'OK',
            { duration: 4000 },
          );
        },
      });
  }

  loadDrawings(): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) {
      this.snackBar.open(
        this.translate.instant('drawing.noInstance') || 'Aucune instance active',
        'OK',
        { duration: 3000 },
      );
      return;
    }

    this.drawingService.list(instance.id).subscribe({
      next: (drawings) => {
        if (drawings.length === 0) {
          this.snackBar.open(
            this.translate.instant('drawing.noneFound') || 'Aucun dessin sauvegardé trouvé',
            'OK',
            { duration: 3000 },
          );
          return;
        }

        const latest = drawings[drawings.length - 1];
        const features = new GeoJSON().readFeatures(latest.geojson, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326',
        });

        features.forEach((f) => {
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

        this.snackBar.open(
          this.translate.instant('drawing.loaded') || `${features.length} dessin(s) chargé(s)`,
          'OK',
          { duration: 3000 },
        );
      },
      error: (err) => {
        console.error('[DrawingTool] load error', err);
        this.snackBar.open(
          this.translate.instant('drawing.loadError') || 'Erreur lors du chargement',
          'OK',
          { duration: 4000 },
        );
      },
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
      text:
        drawType === 'Text' && label
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
