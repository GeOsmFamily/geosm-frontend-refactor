import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime } from 'rxjs';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Stroke, Style } from 'ol/style';

import { BoundaryService } from '../../../../../core/services/boundary.service';
import { BoundarySearchResult } from '../../../../../core/models/index';

export interface BoundaryPickerDialogData {
  initialTable?: string;
}

export interface BoundaryPickerResult {
  boundaryTable: string;
  boundaryId: number;
  boundaryGeomCol: string;
  adminLevel: number | null;
  name: string;
}

/**
 * Sélecteur avec recherche pour Instance.boundaryTable/boundaryId - recherche par nom dans une
 * table de limites administratives (importée manuellement hors de l'application, voir
 * docs/deploiement.md), avec aperçu géométrique avant validation.
 */
@Component({
  selector: 'app-boundary-picker-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatExpansionModule,
    TranslateModule,
  ],
  templateUrl: './boundary-picker-dialog.component.html',
  styleUrl: './boundary-picker-dialog.component.scss',
})
export class BoundaryPickerDialogComponent implements OnDestroy {
  private readonly boundaryService = inject(BoundaryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  readonly dialogRef = inject(MatDialogRef<BoundaryPickerDialogComponent>);
  readonly data: BoundaryPickerDialogData = inject(MAT_DIALOG_DATA);

  @ViewChild('previewMap') private previewMapEl?: ElementRef<HTMLDivElement>;

  table = this.data.initialTable ?? 'admin_boundaries';
  searchQuery = '';

  importFileRef: File | null = null;
  importNameField = 'name';
  importAdminLevel = 2;
  importMode: 'append' | 'replace' = 'append';
  readonly importing = signal(false);

  readonly results = signal<BoundarySearchResult[]>([]);
  readonly loading = signal(false);
  readonly selected = signal<BoundarySearchResult | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal(false);

  private readonly search$ = new Subject<void>();
  private map: Map | null = null;

  constructor() {
    // distinctUntilChanged() n'a pas sa place ici : ce Subject n'émet jamais de valeur (juste un
    // signal "re-cherche"), donc chaque next() produit `undefined`, identique au précédent -
    // distinctUntilChanged filtrait alors TOUTE recherche après la toute première frappe, ce qui
    // donnait l'impression d'une autocomplétion cassée/peu réactive (la liste ne se mettait à
    // jour qu'une seule fois puis restait figée quoi qu'on tape ensuite).
    this.search$.pipe(debounceTime(300)).subscribe(() => this.runSearch());
    this.runSearch();
  }

  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
  }

  onTableOrQueryChange(): void {
    this.selected.set(null);
    this.search$.next();
  }

  private runSearch(): void {
    if (!this.table.trim()) return;
    this.loading.set(true);
    this.boundaryService.search(this.table.trim(), this.searchQuery.trim() || undefined).subscribe({
      next: (results) => {
        this.results.set(results);
        this.loading.set(false);
      },
      error: () => {
        this.results.set([]);
        this.loading.set(false);
      },
    });
  }

  selectResult(result: BoundarySearchResult): void {
    this.selected.set(result);
    this.previewError.set(false);
    this.previewLoading.set(true);
    this.boundaryService.getDetail(this.table.trim(), result.id).subscribe({
      next: (detail) => {
        this.previewLoading.set(false);
        this.renderPreview(detail.geojson);
      },
      error: () => {
        this.previewLoading.set(false);
        this.previewError.set(true);
      },
    });
  }

  private renderPreview(geojson: unknown): void {
    if (!this.previewMapEl) return;

    const source = new VectorSource({
      features: new GeoJSON().readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
        dataProjection: 'EPSG:4326',
      }),
    });

    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: '#00ada7', width: 2 }),
        fill: new Fill({ color: 'rgba(0, 173, 166, 0.15)' }),
      }),
    });

    if (!this.map) {
      // Fond OSM (même source que la carte publique, ol/source/OSM) - sans lui l'aperçu n'était
      // qu'un fond blanc, la géométrie flottant sans aucun repère géographique.
      this.map = new Map({
        target: this.previewMapEl.nativeElement,
        layers: [new TileLayer({ source: new OSM() }), layer],
        view: new View({ center: [0, 0], zoom: 2 }),
        controls: [],
      });
    } else {
      this.map.getLayers().clear();
      this.map.addLayer(new TileLayer({ source: new OSM() }));
      this.map.addLayer(layer);
    }

    const extent = source.getExtent();
    if (extent) {
      this.map.getView().fit(extent, { padding: [16, 16, 16, 16], maxZoom: 12 });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFileRef = input.files?.[0] ?? null;
  }

  runImport(): void {
    if (!this.importFileRef || !this.importNameField.trim()) return;
    this.importing.set(true);
    this.boundaryService
      .importFile({
        file: this.importFileRef,
        nameField: this.importNameField.trim(),
        adminLevel: this.importAdminLevel,
        mode: this.importMode,
      })
      .subscribe({
        next: (result) => {
          this.importing.set(false);
          this.importFileRef = null;
          this.snackBar.open(
            this.translate.instant('admin.instances.boundaryImportSuccess', { count: result.importedCount }),
            undefined,
            { duration: 4000 },
          );
          this.onTableOrQueryChange();
        },
        error: (err) => {
          this.importing.set(false);
          const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
          this.snackBar.open(message ?? this.translate.instant('admin.instances.boundaryImportError'), undefined, { duration: 5000 });
        },
      });
  }

  confirm(): void {
    const selected = this.selected();
    if (!selected) return;
    const result: BoundaryPickerResult = {
      boundaryTable: this.table.trim(),
      boundaryId: selected.id,
      boundaryGeomCol: 'geom',
      adminLevel: selected.adminLevel,
      name: selected.name,
    };
    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
