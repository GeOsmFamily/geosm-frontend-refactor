import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { CreateInstanceTemplateDTO } from '../../../../../core/services/instance.service';

/**
 * Alternative légère à la création classique (POST /instances, qui provisionne tout le
 * catalogue par défaut - couches, fonds de carte, projet QGIS) : POST /admin/instances/template
 * ne crée que l'instance et quelques groupes vides nommés par l'utilisateur, à remplir
 * manuellement ensuite. Utile pour un pays dont la structure thématique diffère du modèle
 * standard GeOSM.
 */
@Component({
  selector: 'app-instance-template-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './instance-template-dialog.component.html',
  styleUrl: './instance-template-dialog.component.scss',
})
export class InstanceTemplateDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<InstanceTemplateDialogComponent>);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    description: [''],
    thematiques: ['Environnement, Transport, Administration, Urbanisme'],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const dto: CreateInstanceTemplateDTO = {
      name: value.name!,
      slug: value.slug!,
      description: value.description || undefined,
      thematiques: value.thematiques
        ? value.thematiques
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    };
    this.dialogRef.close(dto);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
