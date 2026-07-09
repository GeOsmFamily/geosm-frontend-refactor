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
import { MatCheckboxModule } from '@angular/material/checkbox';

import { AuthService } from '../../../../core/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthSplitLayoutComponent } from '../auth-split-layout/auth-split-layout.component';

@Component({
  selector: 'app-login',
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
    MatCheckboxModule,
    AuthSplitLayoutComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  email = '';
  password = '';
  rememberMe = true;
  hidePassword = true;
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly osmConfigured = signal(false);
  readonly osmLoading = signal(false);

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('osmError')) {
      this.errorMessage.set(
        this.translate.instant('auth.osmLoginFailed') ||
          'La connexion via OpenStreetMap a échoué. Veuillez réessayer.',
      );
    }
    this.authService.getOsmStatus().subscribe({
      next: (res) => this.osmConfigured.set(res.configured),
      error: () => this.osmConfigured.set(false),
    });
  }

  loginWithOsm(): void {
    this.osmLoading.set(true);
    this.authService.getOsmLoginUrl().subscribe({
      next: (res) => {
        globalThis.location.href = res.url;
      },
      error: () => {
        this.osmLoading.set(false);
        this.errorMessage.set(
          this.translate.instant('auth.osmUnavailable') ||
            'Connexion OpenStreetMap indisponible pour le moment.',
        );
      },
    });
  }

  login(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set(
        this.translate.instant('auth.enterEmailPassword') || 'Please enter email and password.',
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.email, this.password, this.rememberMe).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/map']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.error?.message ||
            this.translate.instant('auth.loginFailedGeneric') ||
            'Login failed. Please check your credentials.',
        );
      },
    });
  }
}
