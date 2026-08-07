import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import {
  CreateInstanceTemplateDTO,
  InstanceService,
} from '../../../../../core/services/instance.service';
import { Instance } from '../../../../../core/models/index';
import { AdminFormDialogComponent } from '../../../shared/components/admin-form-dialog/admin-form-dialog.component';

/**
 * Alternative légère à la création classique (POST /instances, qui provisionne tout le
 * catalogue par défaut - couches, fonds de carte, projet QGIS) : POST /admin/instances/template
 * ne crée que l'instance et quelques groupes vides nommés par l'utilisateur, à remplir
 * manuellement ensuite. Utile pour un pays dont la structure thématique diffère du modèle
 * standard GeOsm.
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
    MatSelectModule,
    MatButtonModule,
    TranslateModule,
    AdminFormDialogComponent,
  ],
  templateUrl: './instance-template-dialog.component.html',
  styleUrl: './instance-template-dialog.component.scss',
})
export class InstanceTemplateDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly instanceService = inject(InstanceService);
  readonly dialogRef = inject(MatDialogRef<InstanceTemplateDialogComponent>);

  // Clone le catalogue (Group→SubGroup→Layer→LayerStyle→LayerAction) + BaseMap d'une instance
  // existante au lieu de créer des groupes vides (voir plan "Interopérabilité & sécurité des
  // données" du 2026-08-06) - optionnel, "Aucun (groupes vides)" reste le comportement d'origine.
  readonly sourceInstances = signal<Instance[]>([]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    description: [''],
    sourceInstanceId: [null as string | null],
    thematiques: ['Environnement, Transport, Administration, Urbanisme'],
  });

  ngOnInit(): void {
    this.instanceService.list({ limit: 100 }).subscribe({
      next: (res) => this.sourceInstances.set(res.data),
      error: () => undefined,
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const dto: CreateInstanceTemplateDTO = {
      name: value.name!,
      slug: value.slug!,
      description: value.description || undefined,
      sourceInstanceId: value.sourceInstanceId || undefined,
      thematiques:
        !value.sourceInstanceId && value.thematiques
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
