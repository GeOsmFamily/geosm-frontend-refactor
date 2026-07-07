import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';

import { InstanceService } from '../../../../core/services/instance.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Instance, Role } from '../../../../core/models/index';
import { AdminDataTableComponent, AdminTableColumn } from '../../shared/components/admin-data-table/admin-data-table.component';
import { InstanceFormDialogComponent, InstanceFormDialogData } from './instance-form-dialog/instance-form-dialog.component';
import { InstanceTemplateDialogComponent } from './instance-template-dialog/instance-template-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-instances',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslateModule,
    AdminDataTableComponent,
  ],
  templateUrl: './instances.component.html',
  styleUrl: './instances.component.scss',
})
export class InstancesComponent implements OnInit {
  private readonly instanceService = inject(InstanceService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'slug', label: 'Slug' },
    { key: 'isActive', label: 'Actif' },
  ];

  readonly instances = signal<Instance[]>([]);
  readonly loading = signal(false);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  searchTerm = '';

  get isSuperAdmin(): boolean {
    return this.authService.currentUser$.value?.role === Role.SUPER_ADMIN;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.instanceService
      .list({ page: this.pageIndex() + 1, limit: this.pageSize(), search: this.searchTerm || undefined })
      .subscribe({
        next: (res) => {
          this.instances.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onFilterChange(): void {
    this.pageIndex.set(0);
    this.load();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  onSortChange(_sort: Sort): void {
    // Tri côté client suffisant pour un premier jet.
  }

  openCreateDialog(): void {
    const ref = this.dialog.open<InstanceFormDialogComponent, InstanceFormDialogData>(InstanceFormDialogComponent, {
      data: { mode: 'create' },
    });
    ref.afterClosed().subscribe((dto) => {
      if (!dto) return;
      this.instanceService.create(dto).subscribe({
        next: () => {
          this.notify('admin.instances.created');
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  openTemplateDialog(): void {
    const ref = this.dialog.open(InstanceTemplateDialogComponent);
    ref.afterClosed().subscribe((dto) => {
      if (!dto) return;
      this.instanceService.createFromTemplate(dto).subscribe({
        next: () => {
          this.notify('admin.instances.created');
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  openEditDialog(instance: Instance): void {
    const ref = this.dialog.open<InstanceFormDialogComponent, InstanceFormDialogData>(InstanceFormDialogComponent, {
      data: { mode: 'edit', instance },
    });
    ref.afterClosed().subscribe((dto) => {
      if (!dto) return;
      this.instanceService.update(instance.id, dto).subscribe({
        next: () => {
          this.notify('admin.instances.updated');
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  manageUsers(instance: Instance): void {
    this.router.navigate(['/admin/instances', instance.id, 'users']);
  }

  confirmDelete(instance: Instance): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.instances.deleteTitle'),
        message: this.translate.instant('admin.instances.deleteMessage', { name: instance.name }),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.instanceService.delete(instance.id).subscribe({
        next: () => {
          this.notify('admin.instances.deleted');
          this.load();
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
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, { duration: 4000 });
  }
}
