import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { InstanceService } from '../../../../../core/services/instance.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { Instance, InstanceUser, Role } from '../../../../../core/models/index';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-instance-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './instance-users.component.html',
  styleUrl: './instance-users.component.scss',
})
export class InstanceUsersComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly instanceService = inject(InstanceService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly roles = Object.values(Role);
  readonly instance = signal<Instance | null>(null);
  readonly users = signal<InstanceUser[]>([]);
  readonly loading = signal(true);

  newUserId = '';
  newUserRole: Role = Role.VIEWER;

  private instanceId = '';

  /** L'ajout d'un utilisateur nécessite de connaître son UUID (GET /users, qui liste les
   * utilisateurs par email, est réservé à SUPER_ADMIN côté backend - ADMIN_INSTANCE peut ajouter
   * un utilisateur à son instance mais n'a aucun moyen d'en chercher un dans cette UI). */
  get canSearchUsers(): boolean {
    return this.authService.currentUser$.value?.role === Role.SUPER_ADMIN;
  }

  ngOnInit(): void {
    this.instanceId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      instance: this.instanceService.getById(this.instanceId),
      users: this.instanceService.getUsers(this.instanceId),
    }).subscribe({
      next: ({ instance, users }) => {
        this.instance.set(instance);
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  addUser(): void {
    if (!this.newUserId.trim()) return;
    this.instanceService
      .addUser(this.instanceId, this.newUserId.trim(), this.newUserRole)
      .subscribe({
        next: () => {
          this.newUserId = '';
          this.notify('admin.instances.userAdded');
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
  }

  changeRole(instanceUser: InstanceUser, role: Role): void {
    if (role === instanceUser.role) return;
    this.instanceService.changeUserRole(this.instanceId, instanceUser.userId, role).subscribe({
      next: () => {
        this.notify('admin.instances.roleChanged');
        this.load();
      },
      error: (err) => this.notifyError(err),
    });
  }

  confirmRemove(instanceUser: InstanceUser): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.instances.removeUserTitle'),
        message: this.translate.instant('admin.instances.removeUserMessage', {
          email: instanceUser.user?.email ?? instanceUser.userId,
        }),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.instanceService.removeUser(this.instanceId, instanceUser.userId).subscribe({
        next: () => {
          this.notify('admin.instances.userRemoved');
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  backToInstances(): void {
    this.router.navigate(['/admin/instances']);
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
