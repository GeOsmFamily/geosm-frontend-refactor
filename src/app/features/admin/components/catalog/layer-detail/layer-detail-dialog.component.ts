import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LayerService } from '../../../../../core/services/layer.service';
import { StyleService } from '../../../../../core/services/style.service';
import { Layer, LayerStyleModel } from '../../../../../core/models/index';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';

export interface LayerDetailDialogData {
  instanceId: string;
  layer: Layer;
}

@Component({
  selector: 'app-layer-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './layer-detail-dialog.component.html',
  styleUrl: './layer-detail-dialog.component.scss',
})
export class LayerDetailDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly layerService = inject(LayerService);
  private readonly styleService = inject(StyleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  readonly dialogRef = inject(MatDialogRef<LayerDetailDialogComponent>);
  readonly data: LayerDetailDialogData = inject(MAT_DIALOG_DATA);

  private changed = false;
  readonly resyncing = signal(false);
  readonly loadingSource = signal(false);
  readonly loadingStyle = signal(true);
  readonly savingStyle = signal(false);
  readonly styles = signal<LayerStyleModel[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: [this.data.layer.name],
    description: [this.data.layer.description ?? ''],
    minZoom: [this.data.layer.minZoom ?? 0],
    maxZoom: [this.data.layer.maxZoom ?? 22],
    opacity: [this.data.layer.opacity ?? 1],
    isVisible: [this.data.layer.isVisible ?? true],
    isQueryable: [this.data.layer.isQueryable ?? true],
  });

  readonly sldForm = this.fb.nonNullable.group({ sldBody: [''] });
  readonly mapboxForm = this.fb.nonNullable.group({ mapboxStyle: [''] });

  constructor() {
    this.styleService.getStyles(this.data.layer.id).subscribe({
      next: (styles) => {
        this.styles.set(styles);
        const primary = styles[0];
        if (primary) {
          this.sldForm.patchValue({ sldBody: primary.sldBody ?? '' });
          this.mapboxForm.patchValue({ mapboxStyle: primary.mapboxStyle ? JSON.stringify(primary.mapboxStyle, null, 2) : '' });
        }
        this.loadingStyle.set(false);
      },
      error: () => this.loadingStyle.set(false),
    });
  }

  saveLayer(): void {
    const value = this.form.getRawValue();
    this.layerService.update(this.data.instanceId, this.data.layer.id, value).subscribe({
      next: () => {
        this.changed = true;
        this.notify('admin.catalog.updated');
      },
      error: (err) => this.notifyError(err),
    });
  }

  saveSld(): void {
    const sldBody = this.sldForm.value.sldBody ?? '';
    if (!sldBody.trim()) return;
    this.savingStyle.set(true);
    this.styleService.updateSld(this.data.layer.id, sldBody).subscribe({
      next: () => {
        this.savingStyle.set(false);
        this.changed = true;
        this.notify('admin.catalog.styleUpdated');
      },
      error: (err) => { this.savingStyle.set(false); this.notifyError(err); },
    });
  }

  saveMapbox(): void {
    const raw = this.mapboxForm.value.mapboxStyle ?? '';
    if (!raw.trim()) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.snackBar.open(this.translate.instant('admin.catalog.invalidJson'), undefined, { duration: 4000 });
      return;
    }
    this.savingStyle.set(true);
    this.styleService.updateMapbox(this.data.layer.id, parsed).subscribe({
      next: () => {
        this.savingStyle.set(false);
        this.changed = true;
        this.notify('admin.catalog.styleUpdated');
      },
      error: (err) => { this.savingStyle.set(false); this.notifyError(err); },
    });
  }

  confirmResetStyle(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.catalog.resetStyleTitle'),
        message: this.translate.instant('admin.catalog.resetStyleMessage'),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.styleService.reset(this.data.layer.id).subscribe({
        next: () => {
          this.changed = true;
          this.notify('admin.catalog.styleReset');
          this.dialogRef.close(true);
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  confirmResync(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.catalog.resyncTitle'),
        message: this.translate.instant('admin.catalog.resyncMessage'),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.resyncing.set(true);
      this.layerService.resync(this.data.instanceId, this.data.layer.id).subscribe({
        next: () => {
          this.resyncing.set(false);
          this.changed = true;
          this.notify('admin.catalog.resyncDone');
        },
        error: (err) => { this.resyncing.set(false); this.notifyError(err); },
      });
    });
  }

  downloadSourceFile(): void {
    this.loadingSource.set(true);
    this.layerService.getSourceFile(this.data.instanceId, this.data.layer.id).subscribe({
      next: (result) => {
        this.loadingSource.set(false);
        window.open(result.url, '_blank');
      },
      error: (err) => { this.loadingSource.set(false); this.notifyError(err); },
    });
  }

  close(): void {
    this.dialogRef.close(this.changed);
  }

  private notify(key: string): void {
    this.snackBar.open(this.translate.instant(key), undefined, { duration: 3000 });
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, { duration: 4000 });
  }
}
