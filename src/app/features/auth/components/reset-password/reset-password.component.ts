import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
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
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  private token: string | null = null;
  password = '';
  confirmPassword = '';
  hidePassword = true;
  readonly loading = signal(false);
  readonly success = signal(false);
  readonly errorMessage = signal('');
  readonly missingToken = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.missingToken.set(true);
    }
  }

  submit(): void {
    if (!this.token) return;

    if (!this.password || this.password.length < 8) {
      this.errorMessage.set('auth.passwordTooShort');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('auth.passwordsDoNotMatch');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.error?.message || 'auth.resetPasswordInvalidToken');
      },
    });
  }
}
