import { Component, ContentChild, Input, Output, EventEmitter, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

export interface AdminTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

/**
 * Table générique réutilisée par tous les écrans admin (utilisateurs, instances, couches,
 * signalements, etc.) : tri, pagination côté serveur (émet page/sort, ne pagine pas elle-même
 * puisque les listes admin viennent de endpoints paginés via ApiService.getPaginated), colonne
 * "actions" fournie par le composant parent via ng-template #actions="let row".
 */
@Component({
  selector: 'app-admin-data-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './admin-data-table.component.html',
  styleUrl: './admin-data-table.component.scss',
})
export class AdminDataTableComponent<T> {
  @Input() columns: AdminTableColumn[] = [];
  @Input() rows: T[] = [];
  @Input() loading = false;
  @Input() total = 0;
  @Input() pageSize = 20;
  @Input() pageIndex = 0;
  @Input() hasActions = false;

  @Output() readonly sortChange = new EventEmitter<Sort>();
  @Output() readonly pageChange = new EventEmitter<PageEvent>();

  @ContentChild('actions') actionsTemplate?: TemplateRef<{ $implicit: T }>;

  get displayedColumns(): string[] {
    const keys = this.columns.map((c) => c.key);
    return this.hasActions ? [...keys, 'actions'] : keys;
  }
}
