import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import {
  AdminDataTableComponent,
  AdminTableColumn,
} from '../../../shared/components/admin-data-table/admin-data-table.component';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { BaseMapService } from '../../../../../core/services/base-map.service';
import { BaseMap } from '../../../../../core/models/index';
import {
  BaseMapFormDialogComponent,
  BaseMapFormDialogData,
} from './base-map-form-dialog.component';

@Component({
  selector: 'app-base-maps',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    AdminDataTableComponent,
    TranslateModule,
  ],
  templateUrl: './base-maps.component.html',
  styleUrl: './base-maps.component.scss',
})
export class BaseMapsComponent implements OnChanges {
  @Input({ required: true }) instanceId!: string;

  private readonly baseMapService = inject(BaseMapService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly baseMaps = signal<BaseMap[]>([]);

  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'type', label: 'Type' },
    { key: 'order', label: '#' },
    { key: 'isDefault', label: 'Défaut' },
  ];

  ngOnChanges(): void {
    this.load();
  }

  private load(): void {
    if (!this.instanceId) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.baseMapService.list(this.instanceId).subscribe({
      next: (list) => {
        this.baseMaps.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  create(): void {
    this.openForm({ mode: 'create' });
  }

  edit(baseMap: BaseMap): void {
    this.openForm({ mode: 'edit', baseMap });
  }

  private openForm(data: BaseMapFormDialogData): void {
    const ref = this.dialog.open(BaseMapFormDialogComponent, {
      data,
      width: '520px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      const request$ =
        data.mode === 'edit' && data.baseMap
          ? this.baseMapService.update(this.instanceId, data.baseMap.id, result)
          : this.baseMapService.create(this.instanceId, result);
      request$.subscribe({
        next: () => {
          this.load();
          this.notify('admin.catalog.saved');
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  confirmDelete(baseMap: BaseMap): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.catalog.deleteBaseMapTitle'),
        message: this.translate.instant('admin.catalog.deleteBaseMapMessage', {
          name: baseMap.name,
        }),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.baseMapService.delete(this.instanceId, baseMap.id).subscribe({
        next: () => {
          this.load();
          this.notify('admin.catalog.deleted');
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  private notify(key: string): void {
    this.snackBar.open(this.translate.instant(key), undefined, { duration: 3000 });
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, {
      duration: 4000,
    });
  }
}
