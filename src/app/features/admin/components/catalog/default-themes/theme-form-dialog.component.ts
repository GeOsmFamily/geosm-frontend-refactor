import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { DefaultTheme } from '../../../../../core/models/index';
import { AdminFormDialogComponent } from '../../../shared/components/admin-form-dialog/admin-form-dialog.component';

export interface ThemeFormDialogData {
  mode: 'create' | 'edit';
  theme?: DefaultTheme;
}

@Component({
  selector: 'app-theme-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslateModule,
    AdminFormDialogComponent,
  ],
  templateUrl: './theme-form-dialog.component.html',
  styleUrl: './theme-form-dialog.component.scss',
})
export class ThemeFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<ThemeFormDialogComponent>);
  readonly data: ThemeFormDialogData = inject(MAT_DIALOG_DATA);

  readonly isEdit = this.data.mode === 'edit';

  readonly form = this.fb.nonNullable.group({
    name: [this.data.theme?.name ?? '', Validators.required],
    slug: [{ value: this.data.theme?.slug ?? '', disabled: this.isEdit }, Validators.required],
    icon: [this.data.theme?.icon ?? ''],
    color: [this.data.theme?.color ?? ''],
    order: [this.data.theme?.order ?? 0],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const dto: Partial<DefaultTheme> = {
      name: value.name,
      icon: value.icon || undefined,
      color: value.color || undefined,
      order: value.order,
    };
    if (!this.isEdit) {
      dto.slug = value.slug;
    }
    this.dialogRef.close(dto);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
