import { AfterViewInit, Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import Map from 'ol/Map';
import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Geometry, Polygon, LineString } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';
import { getArea, getLength } from 'ol/sphere';

import { MapService } from '../../map/services/map.service';
import { SpatialAnalysisService, SpatialAnalysisOperation } from '../../../core/services/spatial-analysis.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

type DrawGeomType = 'Point' | 'LineString' | 'Polygon';
type PickTarget = 'A' | 'B' | null;

@Component({
  selector: 'app-spatial-analysis-tool',
  standalone: true,
  imports: [
    TranslateModule, CommonModule, FormsModule, MatButtonModule, MatButtonToggleModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatDividerModule, MatSnackBarModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './spatial-analysis-tool.component.html',
  styleUrl: './spatial-analysis-tool.component.scss',
})
export class SpatialAnalysisToolComponent implements AfterViewInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly spatialAnalysisService = inject(SpatialAnalysisService);
  private readonly snackBar = inject(MatSnackBar);

  private map!: Map;
  private inputLayer!: VectorLayer<VectorSource>;
  private resultLayer!: VectorLayer<VectorSource>;
  private drawInteraction: Draw | null = null;

  private geomA3857: Geometry | null = null;
  private geomB3857: Geometry | null = null;

  readonly operation = signal<SpatialAnalysisOperation>('buffer');
  readonly geomType = signal<DrawGeomType>('Polygon');
  readonly pickingTarget = signal<PickTarget>(null);
  readonly hasA = signal(false);
  readonly hasB = signal(false);
  readonly distance = signal(500);
  readonly loading = signal(false);
  readonly resultStat = signal<string | null>(null);

  readonly needsB = () => this.operation() !== 'buffer';
  readonly canCalculate = () => this.hasA() && (!this.needsB() || this.hasB());

  ngAfterViewInit(): void {
    this.map = this.mapService.getMap();
    this.inputLayer = this.mapService.addVectorLayer(
      'spatial-analysis-input',
      [],
      new Style({
        stroke: new Stroke({ color: '#023f5f', width: 2, lineDash: [6, 4] }),
        fill: new Fill({ color: 'rgba(2, 63, 95, 0.06)' }),
        image: new CircleStyle({ radius: 6, stroke: new Stroke({ color: '#023f5f', width: 2 }), fill: new Fill({ color: '#ffffff' }) }),
      }),
    );
    this.resultLayer = this.mapService.addVectorLayer(
      'spatial-analysis-result',
      [],
      new Style({
        stroke: new Stroke({ color: '#00ada7', width: 3 }),
        fill: new Fill({ color: 'rgba(0, 173, 167, 0.25)' }),
        image: new CircleStyle({ radius: 7, stroke: new Stroke({ color: '#00ada7', width: 2 }), fill: new Fill({ color: '#ffffff' }) }),
      }),
    );
  }

  ngOnDestroy(): void {
    this.stopPicking();
    if (this.inputLayer) this.mapService.removeLayer(this.inputLayer);
    if (this.resultLayer) this.mapService.removeLayer(this.resultLayer);
  }

  setOperation(op: SpatialAnalysisOperation): void {
    this.operation.set(op);
    this.resultStat.set(null);
  }

  setGeomType(type: DrawGeomType): void {
    this.geomType.set(type);
  }

  pick(target: 'A' | 'B'): void {
    if (this.pickingTarget()) return;
    this.pickingTarget.set(target);
    this.mapService.isPicking = true;

    this.drawInteraction = new Draw({ source: this.inputLayer.getSource()!, type: this.geomType() });
    this.drawInteraction.on('drawend', (event) => {
      event.feature.set('role', target);
      if (target === 'A') {
        this.geomA3857 = event.feature.getGeometry()!;
        this.hasA.set(true);
      } else {
        this.geomB3857 = event.feature.getGeometry()!;
        this.hasB.set(true);
      }
      this.stopPicking();
    });
    this.map.addInteraction(this.drawInteraction);
  }

  private stopPicking(): void {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.drawInteraction = null;
    }
    this.pickingTarget.set(null);
    // Différé (voir AltimetryToolComponent.stopPicking()) : le clic qui termine le tracé
    // (double-clic pour Ligne/Polygone) est vu par FeatureInfoComponent APRÈS ce callback ;
    // sans ce délai, isPicking repasserait à false trop tôt et ouvrirait la fiche descriptive.
    setTimeout(() => { this.mapService.isPicking = false; }, 300);
  }

  calculate(): void {
    if (!this.geomA3857 || !this.canCalculate()) return;
    this.loading.set(true);
    this.resultStat.set(null);

    const format = new GeoJSON();
    const geometryA = format.writeGeometryObject(this.geomA3857, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
    const geometryB = this.geomB3857
      ? format.writeGeometryObject(this.geomB3857, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' })
      : undefined;

    this.spatialAnalysisService.analyze({
      operation: this.operation(),
      geometryA: geometryA as unknown as Record<string, unknown>,
      geometryB: geometryB as unknown as Record<string, unknown>,
      distance: this.operation() === 'buffer' ? this.distance() : undefined,
    }).subscribe({
      next: (result) => {
        this.loading.set(false);
        if (!result.geometry) {
          this.snackBar.open('Aucun résultat (géométries disjointes ?).', 'OK', { duration: 4000 });
          return;
        }
        const resultGeom = format.readGeometry(result.geometry, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
        this.resultLayer.getSource()!.clear();
        this.resultLayer.getSource()!.addFeature(new Feature(resultGeom));
        this.map.getView().fit(resultGeom.getExtent(), { padding: [80, 80, 80, 80], duration: 400, maxZoom: 18 });
        this.resultStat.set(this.formatStat(resultGeom));
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Échec de l\'analyse spatiale. Vérifiez les géométries tracées.', 'OK', { duration: 4000 });
      },
    });
  }

  private formatStat(geom: Geometry): string {
    if (geom instanceof Polygon) {
      const area = getArea(geom);
      return area >= 1_000_000 ? `${(area / 1_000_000).toFixed(2)} km²` : `${area.toFixed(0)} m²`;
    }
    if (geom instanceof LineString) {
      const length = getLength(geom);
      return length >= 1000 ? `${(length / 1000).toFixed(2)} km` : `${length.toFixed(0)} m`;
    }
    return '';
  }

  clear(): void {
    this.stopPicking();
    this.inputLayer?.getSource()?.clear();
    this.resultLayer?.getSource()?.clear();
    this.geomA3857 = null;
    this.geomB3857 = null;
    this.hasA.set(false);
    this.hasB.set(false);
    this.resultStat.set(null);
  }
}
