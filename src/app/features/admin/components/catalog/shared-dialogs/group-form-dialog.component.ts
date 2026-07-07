import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { Group, SubGroup } from '../../../../../core/models/index';

export interface GroupFormDialogData {
  kind: 'group' | 'subgroup';
  mode: 'create' | 'edit';
  entity?: Group | SubGroup;
}

/** Réutilisé pour Groupes ET Sous-groupes - structurellement identiques (name/slug/description/
 * icon/order), seul le groupe a un champ couleur en plus. */
@Component({
  selector: 'app-group-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslateModule],
  templateUrl: './group-form-dialog.component.html',
  styleUrl: './group-form-dialog.component.scss',
})
export class GroupFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<GroupFormDialogComponent>);
  readonly data: GroupFormDialogData = inject(MAT_DIALOG_DATA);

  readonly isCreate = this.data.mode === 'create';
  readonly isGroup = this.data.kind === 'group';
  private readonly entity = this.data.entity;

  readonly form = this.fb.group({
    name: [this.entity?.name ?? '', Validators.required],
    slug: [{ value: this.entity?.slug ?? '', disabled: !this.isCreate }, Validators.required],
    description: [this.entity?.description ?? ''],
    icon: [this.entity?.icon ?? ''],
    color: [(this.entity as Group)?.color ?? ''],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const dto: Record<string, unknown> = {
      name: value.name,
      description: value.description || undefined,
      icon: value.icon || undefined,
    };
    if (this.isCreate) dto['slug'] = value.slug;
    if (this.isGroup) dto['color'] = value.color || undefined;
    this.dialogRef.close(dto);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
