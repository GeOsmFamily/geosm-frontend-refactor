import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { GroupService } from '../../../../../core/services/group.service';
import { LayerService } from '../../../../../core/services/layer.service';
import { Group, Layer, SubGroup } from '../../../../../core/models/index';
import { AdminDataTableComponent, AdminTableColumn } from '../../../shared/components/admin-data-table/admin-data-table.component';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { GroupFormDialogComponent, GroupFormDialogData } from '../shared-dialogs/group-form-dialog.component';
import { LayerDetailDialogComponent } from '../layer-detail/layer-detail-dialog.component';
import { LayerCreationWizardComponent, LayerCreationWizardData } from '../layer-detail/layer-creation-wizard/layer-creation-wizard.component';

type Level = 'groups' | 'subgroups' | 'layers';

@Component({
  selector: 'app-catalog-tree',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule,
    AdminDataTableComponent,
  ],
  templateUrl: './catalog-tree.component.html',
  styleUrl: './catalog-tree.component.scss',
})
export class CatalogTreeComponent implements OnChanges {
  @Input({ required: true }) instanceId!: string;

  private readonly groupService = inject(GroupService);
  private readonly layerService = inject(LayerService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly level = signal<Level>('groups');
  readonly loading = signal(false);

  readonly groups = signal<Group[]>([]);
  readonly subGroups = signal<SubGroup[]>([]);
  readonly layers = signal<Layer[]>([]);

  readonly currentGroup = signal<Group | null>(null);
  readonly currentSubGroup = signal<SubGroup | null>(null);

  readonly groupColumns: AdminTableColumn[] = [
    { key: 'order', label: '#' },
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'slug', label: 'Slug' },
  ];
  readonly subGroupColumns: AdminTableColumn[] = [
    { key: 'order', label: '#' },
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'slug', label: 'Slug' },
  ];
  readonly layerColumns: AdminTableColumn[] = [
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'geometryType', label: 'Type' },
    { key: 'sourceType', label: 'Source' },
    { key: 'isVisible', label: 'Visible' },
  ];

  ngOnChanges(): void {
    this.level.set('groups');
    this.currentGroup.set(null);
    this.currentSubGroup.set(null);
    this.loadGroups();
  }

  private loadGroups(): void {
    this.loading.set(true);
    this.groupService.listGroups(this.instanceId).subscribe({
      next: (groups) => {
        this.groups.set([...groups].sort((a, b) => a.order - b.order));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSubGroups(groupId: string): void {
    this.loading.set(true);
    this.groupService.listSubGroups(groupId).subscribe({
      next: (subGroups) => {
        this.subGroups.set([...subGroups].sort((a, b) => a.order - b.order));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadLayers(): void {
    this.loading.set(true);
    this.layerService.list(this.instanceId, { subGroupId: this.currentSubGroup()!.id, limit: 100 }).subscribe({
      next: (res) => {
        this.layers.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openGroup(group: Group): void {
    this.currentGroup.set(group);
    this.level.set('subgroups');
    this.loadSubGroups(group.id);
  }

  openSubGroup(subGroup: SubGroup): void {
    this.currentSubGroup.set(subGroup);
    this.level.set('layers');
    this.loadLayers();
  }

  openLayer(layer: Layer): void {
    const ref = this.dialog.open(LayerDetailDialogComponent, {
      data: { instanceId: this.instanceId, layer },
      width: '720px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((changed) => {
      if (changed) this.loadLayers();
    });
  }

  backToGroups(): void {
    this.level.set('groups');
    this.loadGroups();
  }

  backToSubGroups(): void {
    this.level.set('subgroups');
    this.loadSubGroups(this.currentGroup()!.id);
  }

  moveGroup(group: Group, direction: -1 | 1): void {
    const list = [...this.groups()];
    const index = list.findIndex((g) => g.id === group.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
    const orders = list.map((g, i) => ({ id: g.id, order: i }));
    this.groupService.reorderGroups(this.instanceId, orders).subscribe({
      next: () => this.loadGroups(),
      error: (err) => this.notifyError(err),
    });
  }

  openCreateGroupDialog(): void {
    const ref = this.dialog.open<GroupFormDialogComponent, GroupFormDialogData>(GroupFormDialogComponent, {
      data: { kind: 'group', mode: 'create' },
    });
    ref.afterClosed().subscribe((dto) => {
      if (!dto) return;
      this.groupService.createGroup(this.instanceId, dto).subscribe({
        next: () => { this.notify('admin.catalog.created'); this.loadGroups(); },
        error: (err) => this.notifyError(err),
      });
    });
  }

  openEditGroupDialog(group: Group): void {
    const ref = this.dialog.open<GroupFormDialogComponent, GroupFormDialogData>(GroupFormDialogComponent, {
      data: { kind: 'group', mode: 'edit', entity: group },
    });
    ref.afterClosed().subscribe((dto) => {
      if (!dto) return;
      this.groupService.updateGroup(this.instanceId, group.id, dto).subscribe({
        next: () => { this.notify('admin.catalog.updated'); this.loadGroups(); },
        error: (err) => this.notifyError(err),
      });
    });
  }

  confirmDeleteGroup(group: Group): void {
    this.confirmDelete(group.name, () =>
      this.groupService.deleteGroup(this.instanceId, group.id).subscribe({
        next: () => { this.notify('admin.catalog.deleted'); this.loadGroups(); },
        error: (err) => this.notifyError(err),
      }),
    );
  }

  openCreateSubGroupDialog(): void {
    const ref = this.dialog.open<GroupFormDialogComponent, GroupFormDialogData>(GroupFormDialogComponent, {
      data: { kind: 'subgroup', mode: 'create' },
    });
    ref.afterClosed().subscribe((dto) => {
      if (!dto) return;
      this.groupService.createSubGroup(this.currentGroup()!.id, dto).subscribe({
        next: () => { this.notify('admin.catalog.created'); this.loadSubGroups(this.currentGroup()!.id); },
        error: (err) => this.notifyError(err),
      });
    });
  }

  openEditSubGroupDialog(subGroup: SubGroup): void {
    const ref = this.dialog.open<GroupFormDialogComponent, GroupFormDialogData>(GroupFormDialogComponent, {
      data: { kind: 'subgroup', mode: 'edit', entity: subGroup },
    });
    ref.afterClosed().subscribe((dto) => {
      if (!dto) return;
      this.groupService.updateSubGroup(this.currentGroup()!.id, subGroup.id, dto).subscribe({
        next: () => { this.notify('admin.catalog.updated'); this.loadSubGroups(this.currentGroup()!.id); },
        error: (err) => this.notifyError(err),
      });
    });
  }

  confirmDeleteSubGroup(subGroup: SubGroup): void {
    this.confirmDelete(subGroup.name, () =>
      this.groupService.deleteSubGroup(this.currentGroup()!.id, subGroup.id).subscribe({
        next: () => { this.notify('admin.catalog.deleted'); this.loadSubGroups(this.currentGroup()!.id); },
        error: (err) => this.notifyError(err),
      }),
    );
  }

  openCreateLayerDialog(): void {
    const ref = this.dialog.open<LayerCreationWizardComponent, LayerCreationWizardData>(LayerCreationWizardComponent, {
      data: {
        instanceId: this.instanceId,
        subGroupId: this.currentSubGroup()!.id,
        themeColor: this.currentGroup()?.color ?? undefined,
      },
      width: '760px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((created) => {
      if (!created) return;
      this.loadLayers();
    });
  }

  confirmDeleteLayer(layer: Layer, event: Event): void {
    event.stopPropagation();
    this.confirmDelete(layer.name, () =>
      this.layerService.delete(this.instanceId, layer.id).subscribe({
        next: () => { this.notify('admin.catalog.deleted'); this.loadLayers(); },
        error: (err) => this.notifyError(err),
      }),
    );
  }

  private confirmDelete(name: string, onConfirm: () => void): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.catalog.deleteTitle'),
        message: this.translate.instant('admin.catalog.deleteMessage', { name }),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) onConfirm();
    });
  }

  private notify(key: string): void {
    this.snackBar.open(this.translate.instant(key), undefined, { duration: 3000 });
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, { duration: 4000 });
  }
}
