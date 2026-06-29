import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatCardModule,
    MatDividerModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser$;
  readonly isDarkTheme = signal(false);

  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  ngOnInit(): void {
    // Check current theme
    this.isDarkTheme.set(document.body.classList.contains('dark-theme'));

    this.profileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
    });

    this.currentUser.subscribe(user => {
      if (user) {
        this.profileForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
        });
      }
    });
  }

  toggleTheme(checked: boolean): void {
    this.isDarkTheme.set(checked);
    if (checked) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('geosm_theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('geosm_theme', 'light');
    }
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;

    this.authService.updateProfile(this.profileForm.value).subscribe({
      next: () => {
        this.snackBar.open(
          this.translate.instant('settings.profileUpdated') || 'Profil mis à jour avec succès',
          'OK',
          { duration: 3000 }
        );
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('settings.profileUpdateError') || 'Erreur lors de la mise à jour',
          'OK',
          { duration: 3000 }
        );
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;

    this.authService.changePassword(this.passwordForm.value).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.snackBar.open(
          this.translate.instant('settings.passwordChanged') || 'Mot de passe changé avec succès',
          'OK',
          { duration: 3000 }
        );
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('settings.passwordChangeError') || 'Ancien mot de passe incorrect',
          'OK',
          { duration: 3000 }
        );
      }
    });
  }

  redirectToLogin(): void {
    this.router.navigate(['/login']);
  }
}
