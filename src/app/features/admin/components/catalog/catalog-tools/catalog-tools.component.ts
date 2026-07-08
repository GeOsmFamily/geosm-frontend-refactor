import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { QgisProjectService } from '../../../../../core/services/qgis-project.service';
import { RasterService } from '../../../../../core/services/raster.service';
import { GroupService } from '../../../../../core/services/group.service';
import {
  Group,
  QgisProjectModel,
  RasterImportResult,
  SubGroup,
} from '../../../../../core/models/index';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-catalog-tools',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatSelectModule,
    MatExpansionModule,
    MatDialogModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './catalog-tools.component.html',
  styleUrl: './catalog-tools.component.scss',
})
export class CatalogToolsComponent implements OnChanges {
  @Input({ required: true }) instanceId!: string;

  private readonly fb = inject(FormBuilder);
  private readonly qgisService = inject(QgisProjectService);
  private readonly rasterService = inject(RasterService);
  private readonly groupService = inject(GroupService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly loadingProjects = signal(false);
  readonly reloading = signal(false);
  readonly projects = signal<QgisProjectModel[]>([]);
  readonly exportingProjectId = signal<string | null>(null);

  readonly uploading = signal(false);
  readonly rasterResult = signal<RasterImportResult | null>(null);
  private rasterFile: File | null = null;

  readonly groups = signal<Group[]>([]);
  readonly subGroups = signal<SubGroup[]>([]);
  readonly loadingSubGroups = signal(false);

  readonly rasterForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    tableName: ['', Validators.required],
    groupId: ['', Validators.required],
    subGroupId: ['', Validators.required],
    srid: [4326],
  });

  ngOnChanges(): void {
    this.loadProjects();
    this.loadGroups();
  }

  private loadGroups(): void {
    if (!this.instanceId) return;
    this.groupService
      .listGroups(this.instanceId)
      .subscribe({ next: (list) => this.groups.set(list) });
  }

  onRasterGroupChange(groupId: string): void {
    this.rasterForm.patchValue({ subGroupId: '' });
    this.subGroups.set([]);
    if (!groupId) return;
    this.loadingSubGroups.set(true);
    this.groupService.listSubGroups(groupId).subscribe({
      next: (list) => {
        this.subGroups.set(list);
        this.loadingSubGroups.set(false);
      },
      error: () => this.loadingSubGroups.set(false),
    });
  }

  private loadProjects(): void {
    if (!this.instanceId) return;
    this.loadingProjects.set(true);
    this.qgisService.get(this.instanceId).subscribe({
      next: (list) => {
        this.projects.set(list);
        this.loadingProjects.set(false);
      },
      error: () => this.loadingProjects.set(false),
    });
  }

  confirmReload(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.catalog.reloadQgisTitle'),
        message: this.translate.instant('admin.catalog.reloadQgisMessage'),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.reloading.set(true);
      this.qgisService.reload(this.instanceId).subscribe({
        next: (list) => {
          this.reloading.set(false);
          this.projects.set(list);
          this.notify('admin.catalog.reloadQgisDone');
        },
        error: (err) => {
          this.reloading.set(false);
          this.notifyError(err);
        },
      });
    });
  }

  exportProject(project: QgisProjectModel): void {
    this.exportingProjectId.set(project.id);
    this.qgisService.exportBundle(this.instanceId, project.id).subscribe({
      next: (result) => {
        this.exportingProjectId.set(null);
        window.open(result.url, '_blank');
        this.notify('admin.catalog.qgisExportDone');
      },
      error: (err) => {
        this.exportingProjectId.set(null);
        this.notifyError(err);
      },
    });
  }

  onRasterFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.rasterFile = input.files?.[0] ?? null;
  }

  uploadRaster(): void {
    if (!this.rasterFile || this.rasterForm.invalid) return;
    const value = this.rasterForm.getRawValue();
    this.uploading.set(true);
    this.rasterService
      .upload({
        file: this.rasterFile,
        tableName: value.tableName!,
        name: value.name!,
        description: value.description || undefined,
        instanceId: this.instanceId,
        subGroupId: value.subGroupId!,
        srid: value.srid ?? undefined,
      })
      .subscribe({
        next: (result) => {
          this.uploading.set(false);
          this.rasterResult.set(result);
          this.rasterFile = null;
          this.rasterForm.reset({ srid: 4326 });
          this.subGroups.set([]);
          if (result.postgisImportWarning) {
            this.snackBar.open(
              this.translate.instant('admin.catalog.rasterPostgisWarning'),
              undefined,
              { duration: 6000 },
            );
          } else {
            this.notify('admin.catalog.rasterUploaded');
          }
        },
        error: (err) => {
          this.uploading.set(false);
          this.notifyError(err);
        },
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
