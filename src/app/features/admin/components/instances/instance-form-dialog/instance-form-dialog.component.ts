import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { Instance } from '../../../../../core/models/index';
import {
  BoundaryPickerDialogComponent,
  BoundaryPickerResult,
} from '../boundary-picker-dialog/boundary-picker-dialog.component';
import { AdminFormDialogComponent } from '../../../shared/components/admin-form-dialog/admin-form-dialog.component';

export interface InstanceFormDialogData {
  mode: 'create' | 'edit';
  instance?: Instance;
}

@Component({
  selector: 'app-instance-form-dialog',
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
    TranslateModule,
    AdminFormDialogComponent,
  ],
  templateUrl: './instance-form-dialog.component.html',
  styleUrl: './instance-form-dialog.component.scss',
})
export class InstanceFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  readonly dialogRef = inject(MatDialogRef<InstanceFormDialogComponent>);
  readonly data: InstanceFormDialogData = inject(MAT_DIALOG_DATA);

  readonly isCreate = this.data.mode === 'create';
  private readonly instance = this.data.instance;

  readonly boundary = signal<BoundaryPickerResult | null>(
    this.instance?.boundaryTable && this.instance.boundaryId !== null
      ? {
          boundaryTable: this.instance.boundaryTable,
          boundaryId: this.instance.boundaryId,
          boundaryGeomCol: this.instance.boundaryGeomCol ?? 'geom',
          adminLevel: this.instance.adminLevel,
          name: this.instance.boundaryTable, // nom réel indisponible sans un aller-retour API ; le nom de la table sert de repère
        }
      : null,
  );

  readonly form = this.fb.group({
    name: [this.instance?.name ?? '', Validators.required],
    slug: [{ value: this.instance?.slug ?? '', disabled: !this.isCreate }, Validators.required],
    description: [this.instance?.description ?? ''],
    centerLat: [this.instance?.centerLat ?? 0, Validators.required],
    centerLon: [this.instance?.centerLon ?? 0, Validators.required],
    defaultZoom: [
      this.instance?.defaultZoom ?? 6,
      [Validators.required, Validators.min(0), Validators.max(22)],
    ],
    isActive: [this.instance?.isActive ?? true],
  });

  openBoundaryPicker(): void {
    const ref = this.dialog.open<
      BoundaryPickerDialogComponent,
      { initialTable?: string },
      BoundaryPickerResult | null
    >(BoundaryPickerDialogComponent, { data: { initialTable: this.boundary()?.boundaryTable } });
    ref.afterClosed().subscribe((result) => {
      if (result) this.boundary.set(result);
    });
  }

  clearBoundary(): void {
    this.boundary.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const boundary = this.boundary();

    if (this.isCreate) {
      this.dialogRef.close({
        name: value.name,
        slug: value.slug,
        description: value.description || undefined,
        centerLat: value.centerLat,
        centerLon: value.centerLon,
        defaultZoom: value.defaultZoom,
        boundaryTable: boundary?.boundaryTable,
        boundaryId: boundary?.boundaryId,
        boundaryGeomCol: boundary?.boundaryGeomCol,
        adminLevel: boundary?.adminLevel ?? undefined,
      });
    } else {
      this.dialogRef.close({
        name: value.name,
        description: value.description,
        centerLat: value.centerLat,
        centerLon: value.centerLon,
        defaultZoom: value.defaultZoom,
        isActive: value.isActive,
        boundaryTable: boundary?.boundaryTable ?? null,
        boundaryId: boundary?.boundaryId ?? null,
        boundaryGeomCol: boundary?.boundaryGeomCol ?? null,
        adminLevel: boundary?.adminLevel ?? null,
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
