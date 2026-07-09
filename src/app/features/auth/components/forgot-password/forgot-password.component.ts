import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../../../core/services/auth.service';
import { AuthCardLayoutComponent } from '../auth-card-layout/auth-card-layout.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    AuthCardLayoutComponent,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);

  email = '';
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal('');

  submit(): void {
    if (!this.email) return;

    this.loading.set(true);
    this.errorMessage.set('');

    // Le backend répond toujours succès (anti-énumération, voir ForgotPasswordUseCase) - le
    // message de succès s'affiche donc dans tous les cas, même si l'email n'existe pas.
    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.loading.set(false);
        this.submitted.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.submitted.set(true);
      },
    });
  }
}
