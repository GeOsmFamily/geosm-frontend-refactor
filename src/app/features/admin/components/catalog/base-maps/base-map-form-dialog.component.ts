import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { BaseMap } from '../../../../../core/models/index';
import { AdminFormDialogComponent } from '../../../shared/components/admin-form-dialog/admin-form-dialog.component';

export interface BaseMapFormDialogData {
  mode: 'create' | 'edit';
  baseMap?: BaseMap;
}

const BASE_MAP_TYPES: BaseMap['type'][] = ['XYZ', 'WMS', 'WMTS', 'MAPBOX'];

@Component({
  selector: 'app-base-map-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    TranslateModule,
    AdminFormDialogComponent,
  ],
  templateUrl: './base-map-form-dialog.component.html',
  styleUrl: './base-map-form-dialog.component.scss',
})
export class BaseMapFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<BaseMapFormDialogComponent>);
  readonly data: BaseMapFormDialogData = inject(MAT_DIALOG_DATA);

  readonly types = BASE_MAP_TYPES;
  readonly isEdit = this.data.mode === 'edit';

  readonly form = this.fb.group({
    name: [this.data.baseMap?.name ?? '', Validators.required],
    slug: [this.data.baseMap?.slug ?? '', Validators.required],
    type: [this.data.baseMap?.type ?? ('XYZ' as BaseMap['type']), Validators.required],
    url: [this.data.baseMap?.url ?? '', Validators.required],
    attribution: [this.data.baseMap?.attribution ?? ''],
    thumbnail: [this.data.baseMap?.thumbnail ?? ''],
    isDefault: [this.data.baseMap?.isDefault ?? false],
    order: [this.data.baseMap?.order ?? 0],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();

    // Le endpoint PATCH ne permet pas de modifier `slug`/`type` (ni ne les accepte dans
    // son body, dont le schéma refuse toute propriété additionnelle) - les envoyer lors
    // d'une édition fait échouer la requête entière, y compris pour les autres champs.
    this.dialogRef.close({
      ...(this.isEdit ? {} : { slug: value.slug, type: value.type }),
      name: value.name,
      url: value.url,
      attribution: value.attribution || '',
      thumbnail: value.thumbnail || null,
      isDefault: value.isDefault,
      order: value.order,
    });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
