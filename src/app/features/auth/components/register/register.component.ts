import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../../core/services/auth.service';
import { RegisterRequest } from '../../../../core/models/index';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthSplitLayoutComponent } from '../auth-split-layout/auth-split-layout.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AuthSplitLayoutComponent,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';
  hidePassword = true;
  hideConfirm = true;
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  register(): void {
    if (!this.firstName || !this.lastName || !this.email || !this.password) {
      this.errorMessage.set(
        this.translate.instant('auth.allFieldsRequired') || 'All fields are required.',
      );
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set(
        this.translate.instant('auth.passwordsDoNotMatch') || 'Passwords do not match.',
      );
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage.set(
        this.translate.instant('auth.passwordTooShort') ||
          'Password must be at least 8 characters.',
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const dto: RegisterRequest = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
    };

    this.authService.register(dto).subscribe({
      next: () => {
        this.loading.set(false);
        // Inscription = connexion immédiate (voir RegisterUseCase backend, qui renvoie des
        // tokens comme LoginUseCase) - la connexion n'exige déjà pas d'email vérifié, donc
        // repasser par /login serait de la friction sans bénéfice de sécurité. Le mail de
        // vérification part quand même en tâche de fond.
        this.router.navigate(['/map'], { queryParams: { verifyEmailSent: '1' } });
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.error?.message ||
            this.translate.instant('auth.registrationFailedGeneric') ||
            'Registration failed. Please try again.',
        );
      },
    });
  }
}
