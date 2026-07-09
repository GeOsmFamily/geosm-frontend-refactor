import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';

import { UserService } from '../../../../core/services/user.service';
import { Role, User } from '../../../../core/models/index';
import {
  AdminDataTableComponent,
  AdminTableColumn,
} from '../../shared/components/admin-data-table/admin-data-table.component';
import { AdminListPageComponent } from '../../shared/components/admin-list-page/admin-list-page.component';
import {
  UserFormDialogComponent,
  UserFormDialogData,
} from './user-form-dialog/user-form-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule,
    AdminDataTableComponent,
    AdminListPageComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly roles = Object.values(Role);
  readonly columns: AdminTableColumn[] = [
    { key: 'email', label: 'Email', sortable: true },
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom' },
    { key: 'role', label: 'Rôle' },
    { key: 'isActive', label: 'Actif' },
  ];

  readonly users = signal<User[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  searchTerm = '';
  roleFilter: Role | null = null;
  activeFilter: boolean | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.userService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        search: this.searchTerm || undefined,
        role: this.roleFilter ?? undefined,
        isActive: this.activeFilter ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.users.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
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
    // Tri côté client suffisant pour un premier jet - la table est déjà paginée côté serveur.
  }

  openCreateDialog(): void {
    const ref = this.dialog.open<UserFormDialogComponent, UserFormDialogData>(
      UserFormDialogComponent,
      {
        data: { mode: 'create' },
      },
    );
    ref.afterClosed().subscribe((dto) => {
      if (!dto) return;
      this.userService.create(dto).subscribe({
        next: () => {
          this.notify('admin.users.created');
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  openEditDialog(user: User): void {
    const ref = this.dialog.open<UserFormDialogComponent, UserFormDialogData>(
      UserFormDialogComponent,
      {
        data: { mode: 'edit', user },
      },
    );
    ref.afterClosed().subscribe((dto) => {
      if (!dto) return;
      this.userService.update(user.id, dto).subscribe({
        next: () => {
          this.notify('admin.users.updated');
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  changeRole(user: User, role: Role): void {
    if (role === user.role) return;
    this.userService.changeRole(user.id, role).subscribe({
      next: () => {
        this.notify('admin.users.roleChanged');
        this.load();
      },
      error: (err) => this.notifyError(err),
    });
  }

  toggleActive(user: User): void {
    this.userService.toggleActive(user.id, !user.isActive).subscribe({
      next: () => {
        this.notify(user.isActive ? 'admin.users.deactivated' : 'admin.users.activated');
        this.load();
      },
      error: (err) => this.notifyError(err),
    });
  }

  confirmDelete(user: User): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.users.deleteTitle'),
        message: this.translate.instant('admin.users.deleteMessage', { email: user.email }),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.userService.delete(user.id).subscribe({
        next: () => {
          this.notify('admin.users.deleted');
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
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, {
      duration: 4000,
    });
  }
}
