import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import BaseLayer from 'ol/layer/Base';

import { MapService } from '../../map/services/map.service';
import { geoJsonToFeatures, buildPersonalLayerStyle } from '../../map/helpers/map.helper';
import { AuthService } from '../../../core/services/auth.service';
import { InstanceService } from '../../../core/services/instance.service';
import {
  PersonalLayerService,
  ApplyPersonalLayerStyleDTO,
} from '../../../core/services/personal-layer.service';
import { PersonalLayer, PersonalLayerStatus, StagedFileImport } from '../../../core/models/index';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  FileDropZoneComponent,
  FileDropResult,
  FileDropRejection,
} from '../../../shared/components/file-drop-zone/file-drop-zone.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

interface ImportForm {
  name: string;
  groupName: string;
  subGroupName: string;
  color: string;
  shape: string;
}

const SHAPES = ['circle', 'square', 'triangle', 'star', 'pin'];
const DEFAULT_COLOR = '#00ada7';
const I18N_PREFIX = 'tools.personalData';

/**
 * Outil "Importer mes données" - accessible à n'importe quel utilisateur connecté (y compris
 * VIEWER, voir mémoire de session). Les données sont PRIVÉES à l'utilisateur tant qu'elles ne
 * sont pas publiées (voir PersonalLayer/ReviewPersonalLayerPublicationUseCase côté backend).
 */
@Component({
  selector: 'app-personal-data-tool',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDividerModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    FileDropZoneComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './personal-data-tool.component.html',
  styleUrl: './personal-data-tool.component.scss',
})
export class PersonalDataToolComponent implements OnInit, OnDestroy {
  private readonly personalLayerService = inject(PersonalLayerService);
  private readonly mapService = inject(MapService);
  private readonly instanceService = inject(InstanceService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser$;
  readonly shapes = SHAPES;

  readonly layers = signal<PersonalLayer[]>([]);
  readonly loading = signal(false);
  readonly importing = signal(false);
  readonly stagedImport = signal<StagedFileImport | null>(null);
  readonly publishNoteOpenId = signal<string | null>(null);
  readonly qmlUploadingId = signal<string | null>(null);

  form: ImportForm = {
    name: '',
    groupName: '',
    subGroupName: '',
    color: DEFAULT_COLOR,
    shape: 'circle',
  };
  publishNote = '';
  styleEditId: string | null = null;
  styleForm: { color: string; shape: string } = { color: DEFAULT_COLOR, shape: 'circle' };

  private readonly activeMapLayers = new Map<string, BaseLayer>();

  private get instanceId(): string | null {
    return this.instanceService.currentInstance$.value?.id ?? null;
  }

  ngOnInit(): void {
    this.loadMine();
  }

  ngOnDestroy(): void {
    for (const layer of this.activeMapLayers.values()) this.mapService.removeLayer(layer);
    this.activeMapLayers.clear();
  }

  loadMine(): void {
    const instanceId = this.instanceId;
    if (!instanceId) return;
    this.loading.set(true);
    this.personalLayerService.listMine(instanceId).subscribe({
      next: (layers) => {
        this.layers.set(layers);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFilesDropped(results: FileDropResult[]): void {
    const instanceId = this.instanceId;
    const first = results[0];
    if (!instanceId || !first) return;

    if (first.kind === 'qgis-project') {
      this.importing.set(true);
      this.personalLayerService.importQgisProject(instanceId, first.file).subscribe({
        next: (created) => {
          this.importing.set(false);
          this.layers.set([...created, ...this.layers()]);
          this.notify(
            this.translate.instant(`${I18N_PREFIX}.notify.qgisImported`, { count: created.length }),
          );
        },
        error: (err) => {
          this.importing.set(false);
          this.notifyError(err, `${I18N_PREFIX}.errors.qgisImportFailed`);
        },
      });
      return;
    }

    this.importing.set(true);
    this.personalLayerService.importFileToStaging(instanceId, first.file).subscribe({
      next: (staged) => {
        this.importing.set(false);
        this.stagedImport.set(staged);
        this.form = {
          name: first.file.name.replace(/\.[^./]+$/, ''),
          groupName: '',
          subGroupName: '',
          color: DEFAULT_COLOR,
          shape: 'circle',
        };
      },
      error: (err) => {
        this.importing.set(false);
        this.notifyError(err, `${I18N_PREFIX}.errors.fileImportFailed`);
      },
    });
  }

  onFilesRejected(rejections: FileDropRejection[]): void {
    const reason = rejections[0]?.reason;
    this.notify(
      this.translate.instant(
        reason === 'tooLarge' ? `${I18N_PREFIX}.errors.tooLarge` : `${I18N_PREFIX}.errors.unsupportedFormat`,
      ),
    );
  }

  get canConfirmImport(): boolean {
    return !!(this.form.name.trim() && this.form.groupName.trim() && this.form.subGroupName.trim());
  }

  cancelStagedImport(): void {
    this.stagedImport.set(null);
  }

  confirmImport(): void {
    const instanceId = this.instanceId;
    const staged = this.stagedImport();
    if (!instanceId || !staged || !this.canConfirmImport) return;

    this.importing.set(true);
    this.personalLayerService
      .confirmFileImport(instanceId, {
        stagingTable: staged.stagingTable,
        name: this.form.name.trim(),
        groupName: this.form.groupName.trim(),
        subGroupName: this.form.subGroupName.trim(),
        style: { color: this.form.color, shape: this.form.shape },
      })
      .subscribe({
        next: (layer) => {
          this.importing.set(false);
          this.layers.set([layer, ...this.layers()]);
          this.stagedImport.set(null);
          this.notify(this.translate.instant(`${I18N_PREFIX}.notify.dataImported`));
        },
        error: (err) => {
          this.importing.set(false);
          this.notifyError(err, `${I18N_PREFIX}.errors.saveFailed`);
        },
      });
  }

  isVisible(layer: PersonalLayer): boolean {
    return this.activeMapLayers.has(layer.id);
  }

  toggleVisibility(layer: PersonalLayer): void {
    const instanceId = this.instanceId;
    if (!instanceId) return;

    const existing = this.activeMapLayers.get(layer.id);
    if (existing) {
      this.mapService.removeLayer(existing);
      this.activeMapLayers.delete(layer.id);
      return;
    }

    if (layer.sourceType === 'FILE') {
      this.personalLayerService.getFeatures(instanceId, layer.id).subscribe({
        next: (fc) => {
          const style = buildPersonalLayerStyle(
            layer.geometryType,
            layer.style?.color || DEFAULT_COLOR,
            layer.style?.shape || 'circle',
          );
          const olLayer = this.mapService.addVectorLayer(
            `personal-${layer.id}`,
            geoJsonToFeatures(fc),
            style,
          );
          // Rend cette couche éligible au clic "fiche descriptive" (voir
          // FeatureInfoComponent.setupClickHandler(), qui n'accepte par défaut que les couches
          // du catalogue enregistrées dans MapLayerService) sans avoir à l'enregistrer comme une
          // vraie couche catalogue - cette donnée reste privée.
          olLayer.set('isIdentifiable', true);
          this.activeMapLayers.set(layer.id, olLayer);
        },
        error: (err) => this.notifyError(err, `${I18N_PREFIX}.errors.featuresLoadFailed`),
      });
      return;
    }

    const sourceUrl = layer.sourceUrl;
    if (!sourceUrl || !layer.sourceLayerName) return;
    const olLayer = this.mapService.addWmsLayer(`personal-${layer.id}`, sourceUrl, {
      LAYERS: layer.sourceLayerName,
      FORMAT: 'image/png',
      TRANSPARENT: 'true',
    });
    // Même repli que pour le rendu vectoriel (FILE) ci-dessus : rend la couche éligible au clic
    // "fiche descriptive" côté FeatureInfoComponent (GetFeatureInfo WMS), et lui donne un nom
    // lisible pour le titre de la fiche à la place de l'id technique "personal-<uuid>".
    olLayer.set('isIdentifiable', true);
    olLayer.set('name', layer.name);
    this.activeMapLayers.set(layer.id, olLayer);
  }

  openStyleEditor(layer: PersonalLayer): void {
    this.styleEditId = this.styleEditId === layer.id ? null : layer.id;
    this.styleForm = {
      color: layer.style?.color || DEFAULT_COLOR,
      shape: layer.style?.shape || 'circle',
    };
  }

  isStyleEditorOpen(layer: PersonalLayer): boolean {
    return this.styleEditId === layer.id;
  }

  saveStyle(layer: PersonalLayer): void {
    const instanceId = this.instanceId;
    if (!instanceId) return;
    const dto: ApplyPersonalLayerStyleDTO = {
      color: this.styleForm.color,
      shape: this.styleForm.shape,
    };
    this.personalLayerService.applyStyle(instanceId, layer.id, dto).subscribe({
      next: (updated) => {
        this.layers.set(this.layers().map((l) => (l.id === updated.id ? updated : l)));
        this.styleEditId = null;
        // Rafraîchit le rendu si la couche est actuellement affichée sur la carte.
        if (this.activeMapLayers.has(layer.id)) {
          this.toggleVisibility(layer);
          this.toggleVisibility(updated);
        }
        this.notify(this.translate.instant(`${I18N_PREFIX}.notify.styleUpdated`));
      },
      error: (err) => this.notifyError(err, `${I18N_PREFIX}.errors.styleUpdateFailed`),
    });
  }

  onQmlFileSelected(event: Event, layer: PersonalLayer): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const instanceId = this.instanceId;
    if (!file || !instanceId) return;

    this.qmlUploadingId.set(layer.id);
    this.personalLayerService.uploadQmlStyle(instanceId, layer.id, file).subscribe({
      next: (updated) => {
        this.qmlUploadingId.set(null);
        this.layers.set(this.layers().map((l) => (l.id === updated.id ? updated : l)));
        this.notify(this.translate.instant(`${I18N_PREFIX}.notify.qmlUploaded`));
      },
      error: (err) => {
        this.qmlUploadingId.set(null);
        this.notifyError(err, `${I18N_PREFIX}.errors.qmlUploadFailed`);
      },
    });
  }

  isQmlUploading(layer: PersonalLayer): boolean {
    return this.qmlUploadingId() === layer.id;
  }

  deleteLayer(layer: PersonalLayer): void {
    const instanceId = this.instanceId;
    if (!instanceId) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant(`${I18N_PREFIX}.deleteConfirm.title`),
        message: this.translate.instant(`${I18N_PREFIX}.deleteConfirm.message`, { name: layer.name }),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.personalLayerService.delete(instanceId, layer.id).subscribe({
        next: () => {
          const active = this.activeMapLayers.get(layer.id);
          if (active) {
            this.mapService.removeLayer(active);
            this.activeMapLayers.delete(layer.id);
          }
          this.layers.set(this.layers().filter((l) => l.id !== layer.id));
        },
        error: (err) => this.notifyError(err, `${I18N_PREFIX}.errors.deleteFailed`),
      });
    });
  }

  togglePublishForm(layer: PersonalLayer): void {
    this.publishNoteOpenId.set(this.publishNoteOpenId() === layer.id ? null : layer.id);
    this.publishNote = '';
  }

  isPublishFormOpen(layer: PersonalLayer): boolean {
    return this.publishNoteOpenId() === layer.id;
  }

  submitPublication(layer: PersonalLayer): void {
    const instanceId = this.instanceId;
    if (!instanceId) return;
    this.personalLayerService
      .requestPublication(instanceId, layer.id, this.publishNote.trim() || undefined)
      .subscribe({
        next: (updated) => {
          this.layers.set(this.layers().map((l) => (l.id === updated.id ? updated : l)));
          this.publishNoteOpenId.set(null);
          this.notify(this.translate.instant(`${I18N_PREFIX}.notify.publicationRequested`));
        },
        error: (err) => this.notifyError(err, `${I18N_PREFIX}.errors.publishFailed`),
      });
  }

  canRequestPublication(layer: PersonalLayer): boolean {
    return layer.status === 'PRIVATE' || layer.status === 'REJECTED';
  }

  statusLabelKey(status: PersonalLayerStatus): string {
    return `${I18N_PREFIX}.status.${status.toLowerCase()}`;
  }

  statusIcon(status: PersonalLayerStatus): string {
    switch (status) {
      case 'PRIVATE':
        return 'lock';
      case 'PENDING_PUBLICATION':
        return 'hourglass_top';
      case 'PUBLISHED':
        return 'public';
      case 'REJECTED':
        return 'block';
    }
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 3500 });
  }

  private notifyError(err: unknown, fallbackKey: string): void {
    const message =
      (err as { error?: { message?: string } })?.error?.message ||
      this.translate.instant(fallbackKey);
    this.snackBar.open(message, 'OK', { duration: 4500 });
  }
}
