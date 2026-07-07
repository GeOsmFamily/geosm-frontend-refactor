import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { Role, User } from '../../../../../core/models/index';
import { CreateUserDTO, UpdateUserDTO } from '../../../../../core/services/user.service';

export interface UserFormDialogData {
  mode: 'create' | 'edit';
  user?: User;
}

@Component({
  selector: 'app-user-form-dialog',
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
  ],
  templateUrl: './user-form-dialog.component.html',
  styleUrl: './user-form-dialog.component.scss',
})
export class UserFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<UserFormDialogComponent>);
  readonly data: UserFormDialogData = inject(MAT_DIALOG_DATA);

  readonly roles = Object.values(Role);
  readonly isCreate = this.data.mode === 'create';

  readonly form = this.fb.group({
    email: [this.data.user?.email ?? '', [Validators.required, Validators.email]],
    password: ['', this.isCreate ? [Validators.required, Validators.minLength(8)] : []],
    firstName: [this.data.user?.firstName ?? '', Validators.required],
    lastName: [this.data.user?.lastName ?? '', Validators.required],
    role: [this.data.user?.role ?? Role.VIEWER],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();

    if (this.isCreate) {
      const dto: CreateUserDTO = {
        email: value.email!,
        password: value.password!,
        firstName: value.firstName!,
        lastName: value.lastName!,
        role: value.role ?? undefined,
      };
      this.dialogRef.close(dto);
    } else {
      const dto: UpdateUserDTO = {
        email: value.email!,
        firstName: value.firstName!,
        lastName: value.lastName!,
      };
      this.dialogRef.close(dto);
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
