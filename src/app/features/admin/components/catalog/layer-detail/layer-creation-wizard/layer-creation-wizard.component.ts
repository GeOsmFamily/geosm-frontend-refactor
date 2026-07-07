import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map as rxMap } from 'rxjs';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Stroke, Style } from 'ol/style';
import { createClusterLayer } from '../../../../../map/helpers/map.helper';

import { LayerService } from '../../../../../../core/services/layer.service';
import { OsmService, OsmGeometryKind } from '../../../../../../core/services/osm.service';
import { QgisProjectService } from '../../../../../../core/services/qgis-project.service';
import { GeometryTypeEnum, Layer, OsmTagCondition, QgisProjectLayerInfo, StagedFileImport } from '../../../../../../core/models/index';
import { IconPickerComponent, IconShape } from '../../../../shared/components/icon-picker/icon-picker.component';

export interface LayerCreationWizardData {
  instanceId: string;
  subGroupId: string;
  /** Couleur principale du groupe/thème parent, utilisée pour préremplir le sélecteur de
   * style à l'étape 4 (cohérence visuelle avec le reste du catalogue). */
  themeColor?: string;
}

type SourceType = 'file' | 'osm' | 'qgis';

const GEOMETRY_TYPES: GeometryTypeEnum[] = ['POINT', 'LINESTRING', 'POLYGON', 'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON'];

@Component({
  selector: 'app-layer-creation-wizard',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    TranslateModule,
    IconPickerComponent,
  ],
  templateUrl: './layer-creation-wizard.component.html',
  styleUrl: './layer-creation-wizard.component.scss',
})
export class LayerCreationWizardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly layerService = inject(LayerService);
  private readonly osmService = inject(OsmService);
  private readonly qgisProjectService = inject(QgisProjectService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly dialogRef = inject(MatDialogRef<LayerCreationWizardComponent>);
  readonly data: LayerCreationWizardData = inject(MAT_DIALOG_DATA);

  readonly stepperOrientation = this.breakpointObserver.observe(Breakpoints.Handset).pipe(
    rxMap((result) => (result.matches ? 'vertical' : 'horizontal')),
  );

  @ViewChild('previewMap') private previewMapEl?: ElementRef<HTMLDivElement>;
  private map?: Map;

  readonly geometryTypes = GEOMETRY_TYPES;
  readonly sourceType = signal<SourceType>('file');

  // ── Source Fichier ──
  private fileRef: File | null = null;
  readonly staging = signal<StagedFileImport | null>(null);
  readonly stagingLoading = signal(false);

  // ── Source OSM ──
  readonly osmGeometryType = signal<OsmGeometryKind>('point');
  readonly osmConditions = signal<OsmTagCondition[]>([]);
  readonly osmTagKeys = signal<string[]>([]);
  readonly osmTagValues = signal<string[]>([]);
  osmKeyInput = '';
  osmValueInput = '';
  readonly osmPreview = signal<GeoJSON.FeatureCollection | null>(null);
  readonly osmLoading = signal(false);

  // ── Source Projet QGIS ──
  private qgisFileRef: File | null = null;
  qgisProjectName = '';
  readonly qgisUploading = signal(false);
  readonly qgisProject = signal<{ id: string } | null>(null);
  readonly qgisLayers = signal<QgisProjectLayerInfo[]>([]);
  readonly qgisSelected = signal<Record<string, { selected: boolean; displayName: string; geometryType: GeometryTypeEnum }>>({});

  // ── Publication ──
  readonly publishForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    isVisible: [false],
  });
  readonly publishing = signal(false);
  readonly createdLayer = signal<Layer | null>(null);
  readonly createdLayers = signal<Layer[]>([]);

  // ── Style ──
  readonly styleColor = signal(this.data.themeColor ?? '#00ada7');
  readonly styleIconKey = signal('default');
  readonly styleShape = signal<IconShape>('circle');
  readonly shapes: IconShape[] = ['circle', 'square', 'triangle', 'star', 'pin'];
  private kmlStyleFile: File | null = null;
  readonly styleMode = signal<'color-icon' | 'kml'>('color-icon');
  readonly applyingStyle = signal(false);
  readonly styleApplied = signal(false);

  chooseSource(kind: SourceType): void {
    this.sourceType.set(kind);
    // La valeur par défaut du select de géométrie OSM ('point') n'a jamais déclenché
    // (selectionChange) puisqu'elle n'a fait l'objet d'aucune interaction utilisateur - sans
    // cet appel explicite, la liste des clés reste vide tant que l'admin ne change pas
    // manuellement la géométrie une première fois.
    if (kind === 'osm' && this.osmTagKeys().length === 0) {
      this.onOsmGeometryTypeChange(this.osmGeometryType());
    }
  }

  // ── Fichier ──
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileRef = input.files?.[0] ?? null;
  }

  uploadFile(): void {
    if (!this.fileRef) return;
    this.stagingLoading.set(true);
    this.layerService.importFileToStaging(this.data.instanceId, this.fileRef).subscribe({
      next: (result) => {
        this.stagingLoading.set(false);
        this.staging.set(result);
        this.renderPreview(result.preview);
      },
      error: (err) => { this.stagingLoading.set(false); this.notifyError(err); },
    });
  }

  // ── OSM ──
  onOsmGeometryTypeChange(kind: OsmGeometryKind): void {
    this.osmGeometryType.set(kind);
    this.osmTagKeys.set([]);
    this.osmService.listTagKeys(kind).subscribe({ next: (keys) => this.osmTagKeys.set(keys) });
  }

  onOsmKeyInput(): void {
    this.osmValueInput = '';
    this.osmTagValues.set([]);
    if (!this.osmKeyInput.trim()) return;
    this.osmService.listTagValues(this.osmGeometryType(), this.osmKeyInput.trim()).subscribe({
      next: (values) => this.osmTagValues.set(values),
    });
  }

  addOsmCondition(): void {
    if (!this.osmKeyInput.trim() || !this.osmValueInput.trim()) return;
    this.osmConditions.set([...this.osmConditions(), { key: this.osmKeyInput.trim(), value: this.osmValueInput.trim() }]);
    this.osmKeyInput = '';
    this.osmValueInput = '';
    this.osmTagValues.set([]);
  }

  removeOsmCondition(index: number): void {
    this.osmConditions.set(this.osmConditions().filter((_, i) => i !== index));
  }

  previewOsm(): void {
    if (this.osmConditions().length === 0) return;
    this.osmLoading.set(true);
    this.osmService.preview(this.osmConditions(), [this.osmGeometryType()], 200).subscribe({
      next: (fc) => { this.osmLoading.set(false); this.osmPreview.set(fc); this.renderPreview(fc); },
      error: (err) => { this.osmLoading.set(false); this.notifyError(err); },
    });
  }

  // ── Projet QGIS ──
  onQgisFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.qgisFileRef = input.files?.[0] ?? null;
  }

  uploadQgisProject(): void {
    if (!this.qgisFileRef || !this.qgisProjectName.trim()) return;
    this.qgisUploading.set(true);
    this.qgisProjectService.upload(this.data.instanceId, { file: this.qgisFileRef, name: this.qgisProjectName.trim() }).subscribe({
      next: (project) => {
        this.qgisProject.set({ id: project.id });
        this.qgisProjectService.listLayers(this.data.instanceId, project.id).subscribe({
          next: (layers) => {
            this.qgisUploading.set(false);
            this.qgisLayers.set(layers);
            const selection: Record<string, { selected: boolean; displayName: string; geometryType: GeometryTypeEnum }> = {};
            for (const l of layers) {
              selection[l.name] = { selected: false, displayName: l.title || l.name, geometryType: 'POLYGON' };
            }
            this.qgisSelected.set(selection);
          },
          error: (err) => { this.qgisUploading.set(false); this.notifyError(err); },
        });
      },
      error: (err) => { this.qgisUploading.set(false); this.notifyError(err); },
    });
  }

  toggleQgisLayer(name: string, checked: boolean): void {
    this.qgisSelected.set({ ...this.qgisSelected(), [name]: { ...this.qgisSelected()[name], selected: checked } });
  }

  updateQgisDisplayName(name: string, value: string): void {
    this.qgisSelected.set({ ...this.qgisSelected(), [name]: { ...this.qgisSelected()[name], displayName: value } });
  }

  updateQgisGeometryType(name: string, value: GeometryTypeEnum): void {
    this.qgisSelected.set({ ...this.qgisSelected(), [name]: { ...this.qgisSelected()[name], geometryType: value } });
  }

  // ── Publication ──
  canPublish(): boolean {
    if (this.sourceType() === 'file') return !!this.staging();
    if (this.sourceType() === 'osm') return this.osmConditions().length > 0;
    if (this.sourceType() === 'qgis') return Object.values(this.qgisSelected()).some((s) => s.selected);
    return false;
  }

  publish(): void {
    if (this.publishForm.invalid) return;
    const { name, description, isVisible } = this.publishForm.getRawValue();
    this.publishing.set(true);

    if (this.sourceType() === 'file') {
      const staging = this.staging();
      if (!staging) return;
      this.layerService.confirmFileImport(this.data.instanceId, {
        stagingTable: staging.stagingTable,
        name,
        description: description || undefined,
        subGroupId: this.data.subGroupId,
        isVisible,
      }).subscribe({
        next: (layer) => { this.publishing.set(false); this.createdLayer.set(layer); this.notify('admin.catalog.wizard.published'); },
        error: (err) => { this.publishing.set(false); this.notifyError(err); },
      });
    } else if (this.sourceType() === 'osm') {
      this.layerService.confirmOsmImport(this.data.instanceId, {
        name,
        description: description || undefined,
        subGroupId: this.data.subGroupId,
        geometryType: this.osmGeometryType().toUpperCase(),
        conditions: this.osmConditions(),
        isVisible,
      }).subscribe({
        next: (layer) => { this.publishing.set(false); this.createdLayer.set(layer); this.notify('admin.catalog.wizard.published'); },
        error: (err) => { this.publishing.set(false); this.notifyError(err); },
      });
    } else if (this.sourceType() === 'qgis') {
      const project = this.qgisProject();
      if (!project) return;
      const layers = Object.entries(this.qgisSelected())
        .filter(([, v]) => v.selected)
        .map(([layerName, v]) => ({ layerName, displayName: v.displayName, geometryType: v.geometryType }));
      this.qgisProjectService.confirmLayers(this.data.instanceId, project.id, this.data.subGroupId, layers).subscribe({
        next: (created) => { this.publishing.set(false); this.createdLayers.set(created); this.notify('admin.catalog.wizard.published'); },
        error: (err) => { this.publishing.set(false); this.notifyError(err); },
      });
    }
  }

  // ── Style (fichier/OSM uniquement - une seule couche créée) ──
  onKmlStyleSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.kmlStyleFile = input.files?.[0] ?? null;
  }

  applyStyle(): void {
    const layer = this.createdLayer();
    if (!layer) return;
    this.applyingStyle.set(true);

    if (this.styleMode() === 'kml') {
      if (!this.kmlStyleFile) { this.applyingStyle.set(false); return; }
      this.layerService.applyStyle(this.data.instanceId, layer.id, { mode: 'kml', kmlFile: this.kmlStyleFile }).subscribe({
        next: () => { this.applyingStyle.set(false); this.styleApplied.set(true); this.notify('admin.catalog.wizard.styleApplied'); },
        error: (err) => { this.applyingStyle.set(false); this.notifyError(err); },
      });
    } else {
      this.layerService.applyStyle(this.data.instanceId, layer.id, { mode: 'color-icon', color: this.styleColor(), iconKey: this.styleIconKey(), shape: this.styleShape() }).subscribe({
        next: () => { this.applyingStyle.set(false); this.styleApplied.set(true); this.notify('admin.catalog.wizard.styleApplied'); },
        error: (err) => { this.applyingStyle.set(false); this.notifyError(err); },
      });
    }
  }

  finish(): void {
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close(this.createdLayer() || this.createdLayers().length > 0 ? true : null);
  }

  private renderPreview(fc: GeoJSON.FeatureCollection): void {
    if (!this.previewMapEl) return;
    const olFeatures = new GeoJSON().readFeatures(fc, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
    const source = new VectorSource({ features: olFeatures });

    // Les points proches se chevauchent visuellement sur une petite carte d'aperçu (des
    // dizaines d'entités peuvent tenir sur quelques pixels) - un clustering avec badge de
    // comptage évite de laisser croire que l'aperçu affiche moins d'entités qu'il n'y en a
    // réellement (même mécanisme que le rendu des couches ponctuelles sur la vraie carte).
    const isPointGeometry = olFeatures.length > 0 && ['Point', 'MultiPoint'].includes(olFeatures[0].getGeometry()?.getType() ?? '');
    const layer: VectorLayer<any> = isPointGeometry
      ? createClusterLayer(source, undefined, 40, undefined, '#00ada7')
      : new VectorLayer({
          source,
          style: new Style({
            stroke: new Stroke({ color: '#00ada7', width: 2 }),
            fill: new Fill({ color: 'rgba(0, 173, 166, 0.15)' }),
          }),
        });

    if (!this.map) {
      this.map = new Map({
        target: this.previewMapEl.nativeElement,
        layers: [layer],
        view: new View({ center: [0, 0], zoom: 2 }),
        controls: [],
      });
    } else {
      this.map.getLayers().clear();
      this.map.addLayer(layer);
    }

    const extent = source.getExtent();
    if (extent && isFinite(extent[0])) {
      this.map.getView().fit(extent, { padding: [16, 16, 16, 16], maxZoom: 15 });
    }
  }

  private notify(key: string): void {
    this.snackBar.open(this.translate.instant(key), undefined, { duration: 3000 });
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, { duration: 4000 });
  }
}
