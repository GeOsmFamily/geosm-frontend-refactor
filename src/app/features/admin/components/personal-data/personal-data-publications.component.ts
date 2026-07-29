import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { InstanceService } from '../../../../core/services/instance.service';
import { PersonalLayerService } from '../../../../core/services/personal-layer.service';
import { Instance, PersonalLayer } from '../../../../core/models/index';
import {
  AdminDataTableComponent,
  AdminTableColumn,
} from '../../shared/components/admin-data-table/admin-data-table.component';
import { AdminListPageComponent } from '../../shared/components/admin-list-page/admin-list-page.component';
import {
  PersonalDataReviewDialogComponent,
  PersonalDataReviewDialogData,
  PersonalDataReviewResult,
} from './personal-data-review-dialog/personal-data-review-dialog.component';

interface PublicationRow {
  id: string;
  name: string;
  groupName: string;
  subGroupName: string;
  sourceType: string;
  createdAt: string;
  raw: PersonalLayer;
}

/**
 * File d'attente de modération des demandes de publication de données personnelles -
 * scopée par instance comme le reste du catalogue (voir CatalogComponent, même sélecteur
 * d'instance en tête de page).
 */
@Component({
  selector: 'app-personal-data-publications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule,
    AdminDataTableComponent,
    AdminListPageComponent,
  ],
  templateUrl: './personal-data-publications.component.html',
  styleUrl: './personal-data-publications.component.scss',
})
export class PersonalDataPublicationsComponent implements OnInit {
  private readonly instanceService = inject(InstanceService);
  private readonly personalLayerService = inject(PersonalLayerService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Nom' },
    { key: 'groupName', label: 'Thématique' },
    { key: 'subGroupName', label: 'Sous-thématique' },
    { key: 'sourceType', label: 'Source' },
    { key: 'createdAt', label: 'Importé le' },
  ];

  readonly instances = signal<Instance[]>([]);
  readonly selectedInstanceId = signal<string | null>(null);
  readonly instancesLoading = signal(true);

  readonly rows = signal<PublicationRow[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  ngOnInit(): void {
    this.instanceService.list({ limit: 100 }).subscribe({
      next: (res) => {
        this.instances.set(res.data);
        if (res.data.length > 0) this.selectedInstanceId.set(res.data[0].id);
        this.instancesLoading.set(false);
        this.load();
      },
      error: () => this.instancesLoading.set(false),
    });
  }

  onInstanceChange(id: string): void {
    this.selectedInstanceId.set(id);
    this.load();
  }

  load(): void {
    const instanceId = this.selectedInstanceId();
    if (!instanceId) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.personalLayerService.listPendingPublications(instanceId).subscribe({
      next: (layers) => {
        this.rows.set(
          layers.map((l) => ({
            id: l.id,
            name: l.name,
            groupName: l.groupName,
            subGroupName: l.subGroupName,
            sourceType: l.sourceType === 'FILE' ? 'Fichier' : 'Projet QGIS',
            createdAt: new Date(l.createdAt).toLocaleDateString(),
            raw: l,
          })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  review(row: PublicationRow): void {
    const instanceId = this.selectedInstanceId();
    if (!instanceId) return;
    const ref = this.dialog.open<
      PersonalDataReviewDialogComponent,
      PersonalDataReviewDialogData,
      PersonalDataReviewResult
    >(PersonalDataReviewDialogComponent, {
      data: { instanceId, personalLayer: row.raw },
    });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.personalLayerService.reviewPublication(instanceId, row.id, result).subscribe({
        next: () => {
          this.notify(
            result.decision === 'APPROVE' ? 'Donnée publiée sur le catalogue.' : 'Demande refusée.',
          );
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, undefined, { duration: 3500 });
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, {
      duration: 4500,
    });
  }
}
