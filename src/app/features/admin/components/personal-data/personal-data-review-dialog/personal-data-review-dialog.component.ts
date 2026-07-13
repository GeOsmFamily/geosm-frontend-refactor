import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';

import { PersonalLayerService } from '../../../../../core/services/personal-layer.service';
import { PersonalLayer } from '../../../../../core/models/index';
import { geoJsonToFeatures } from '../../../../map/helpers/map.helper';

export interface PersonalDataReviewDialogData {
  instanceId: string;
  personalLayer: PersonalLayer;
}

export interface PersonalDataReviewResult {
  decision: 'APPROVE' | 'REJECT';
  reviewNote?: string;
  overrideName?: string;
  overrideGroupName?: string;
  overrideSubGroupName?: string;
}

/**
 * Revue d'une demande de publication : aperçu cartographique réel de la donnée (même patron que
 * BoundaryPickerDialogComponent - fond OSM + couche superposée) et override optionnel nom/
 * thématique/sous-thématique avant validation (voir ReviewPersonalLayerPublicationUseCase côté
 * backend, qui applique ces overrides à la création de la couche catalogue).
 */
@Component({
  selector: 'app-personal-data-review-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './personal-data-review-dialog.component.html',
  styleUrl: './personal-data-review-dialog.component.scss',
})
export class PersonalDataReviewDialogComponent implements AfterViewInit, OnDestroy {
  private readonly personalLayerService = inject(PersonalLayerService);
  readonly dialogRef = inject(MatDialogRef<PersonalDataReviewDialogComponent>);
  readonly data: PersonalDataReviewDialogData = inject(MAT_DIALOG_DATA);

  @ViewChild('previewMap') private readonly previewMapEl?: ElementRef<HTMLDivElement>;

  readonly previewLoading = signal(false);
  readonly previewError = signal(false);

  overrideName = this.data.personalLayer.name;
  overrideGroupName = this.data.personalLayer.groupName;
  overrideSubGroupName = this.data.personalLayer.subGroupName;
  reviewNote = '';

  private map: Map | null = null;

  ngAfterViewInit(): void {
    // @ViewChild('previewMap') n'est peuplé qu'à partir de ngAfterViewInit (query de vue, pas de
    // contenu) - l'appeler depuis ngOnInit fonctionnait "par chance" pour les données FILE (l'appel
    // HTTP getFeatures() laisse largement le temps à la vue de s'initialiser avant la réponse),
    // mais échouait silencieusement à chaque fois pour les projets QGIS (renderWmsPreview() est
    // synchrone, donc previewMapEl était encore undefined et la carte n'était jamais créée).
    this.loadPreview();
  }

  ngOnDestroy(): void {
    this.map?.setTarget();
  }

  private loadPreview(): void {
    const layer = this.data.personalLayer;
    if (layer.sourceType === 'FILE') {
      this.previewLoading.set(true);
      this.personalLayerService.getFeatures(this.data.instanceId, layer.id).subscribe({
        next: (fc) => {
          this.previewLoading.set(false);
          this.renderVectorPreview(fc);
        },
        error: () => {
          this.previewLoading.set(false);
          this.previewError.set(true);
        },
      });
      return;
    }

    const sourceUrl = layer.sourceUrl;
    if (!sourceUrl || !layer.sourceLayerName) {
      this.previewError.set(true);
      return;
    }
    this.renderWmsPreview(sourceUrl, layer.sourceLayerName);
  }

  private ensureMap(): Map {
    if (this.map) {
      this.map.getLayers().clear();
      this.map.addLayer(new TileLayer({ source: new OSM() }));
      return this.map;
    }
    this.map = new Map({
      target: this.previewMapEl!.nativeElement,
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({ center: [0, 0], zoom: 2 }),
      controls: [],
    });
    return this.map;
  }

  private renderVectorPreview(geojson: GeoJSON.FeatureCollection): void {
    if (!this.previewMapEl) return;
    const map = this.ensureMap();

    const features = geoJsonToFeatures(geojson);
    const source = new VectorSource({ features });
    const layer = new VectorLayer({
      source,
      style: new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({ color: this.data.personalLayer.style?.color || '#00ada7' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        stroke: new Stroke({ color: '#00ada7', width: 2 }),
        fill: new Fill({ color: 'rgba(0, 173, 166, 0.15)' }),
      }),
    });
    map.addLayer(layer);

    const extent = source.getExtent();
    if (extent && Number.isFinite(extent[0])) {
      map.getView().fit(extent, { padding: [16, 16, 16, 16], maxZoom: 14 });
    }
  }

  private renderWmsPreview(url: string, layerName: string): void {
    if (!this.previewMapEl) return;
    const map = this.ensureMap();
    map.addLayer(
      new TileLayer({
        source: new TileWMS({
          url,
          params: { LAYERS: layerName, TILED: true, FORMAT: 'image/png', TRANSPARENT: true },
          serverType: 'qgis',
        }),
      }),
    );
  }

  get canApprove(): boolean {
    return !!(
      this.overrideName.trim() &&
      this.overrideGroupName.trim() &&
      this.overrideSubGroupName.trim()
    );
  }

  approve(): void {
    if (!this.canApprove) return;
    const original = this.data.personalLayer;
    const result: PersonalDataReviewResult = {
      decision: 'APPROVE',
      reviewNote: this.reviewNote.trim() || undefined,
      overrideName: this.overrideName.trim() !== original.name ? this.overrideName.trim() : undefined,
      overrideGroupName:
        this.overrideGroupName.trim() !== original.groupName
          ? this.overrideGroupName.trim()
          : undefined,
      overrideSubGroupName:
        this.overrideSubGroupName.trim() !== original.subGroupName
          ? this.overrideSubGroupName.trim()
          : undefined,
    };
    this.dialogRef.close(result);
  }

  reject(): void {
    const result: PersonalDataReviewResult = {
      decision: 'REJECT',
      reviewNote: this.reviewNote.trim() || undefined,
    };
    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
