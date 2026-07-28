import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { Group, SubGroup } from '../../../../../core/models/index';
import { AdminFormDialogComponent } from '../../../shared/components/admin-form-dialog/admin-form-dialog.component';

/** Group.icon/SubGroup.icon sont rendus tels quels comme ligature `<mat-icon>` (voir
 * CatalogBrowserComponent) - un simple champ texte libre n'aide en rien l'admin à savoir quelles
 * valeurs sont valides. Liste non-exhaustive de noms Material Symbols pertinents pour des
 * thématiques cartographiques, avec aperçu visuel en direct (voir le template) - n'importe quel
 * autre nom Material Symbols valide reste utilisable, cette liste n'est qu'une suggestion.
 */
export const COMMON_GROUP_ICONS: string[] = [
  'folder',
  'layers',
  'map',
  'public',
  'place',
  'location_on',
  'terrain',
  'landscape',
  'forest',
  'park',
  'eco',
  'water_drop',
  'water',
  'waves',
  'agriculture',
  'grass',
  'pets',
  'local_florist',
  'local_hospital',
  'medical_services',
  'vaccines',
  'local_pharmacy',
  'school',
  'local_library',
  'account_balance',
  'gavel',
  'security',
  'local_police',
  'local_fire_department',
  'church',
  'mosque',
  'temple_buddhist',
  'home',
  'apartment',
  'business',
  'store',
  'shopping_cart',
  'restaurant',
  'hotel',
  'local_gas_station',
  'ev_station',
  'directions_car',
  'directions_bus',
  'train',
  'directions_boat',
  'local_airport',
  'route',
  'traffic',
  'construction',
  'engineering',
  'factory',
  'warehouse',
  'power',
  'wifi',
  'cell_tower',
  'recycling',
  'museum',
  'theater_comedy',
  'sports_soccer',
  'hiking',
  'beach_access',
  'flood',
];

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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatTooltipModule,
    TranslateModule,
    AdminFormDialogComponent,
  ],
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

  readonly allIcons = COMMON_GROUP_ICONS;
  readonly filteredIcons = signal<string[]>(COMMON_GROUP_ICONS);

  filterIcons(value: string | null): void {
    const query = (value || '').trim().toLowerCase();
    this.filteredIcons.set(query ? this.allIcons.filter((i) => i.includes(query)) : this.allIcons);
  }

  get titleKey(): string {
    if (this.isGroup) {
      return this.isCreate ? 'admin.catalog.createGroupTitle' : 'admin.catalog.editGroupTitle';
    }
    return this.isCreate ? 'admin.catalog.createSubGroupTitle' : 'admin.catalog.editSubGroupTitle';
  }

  readonly form = this.fb.group({
    name: [this.entity?.name ?? '', Validators.required],
    slug: [{ value: this.entity?.slug ?? '', disabled: !this.isCreate }, Validators.required],
    description: [this.entity?.description ?? ''],
    icon: [this.entity?.icon ?? ''],
    color: [(this.entity as Group)?.color ?? ''],
  });

  constructor() {
    this.form.get('icon')!.valueChanges.subscribe((v) => this.filterIcons(v));
  }

  get iconPreview(): string {
    return this.form.get('icon')!.value?.trim() || 'folder';
  }

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
