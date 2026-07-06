import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { OsmProfile } from '../../../../core/models/index';

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
    MatCardModule,
    MatDividerModule,
    MatTooltipModule,
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

  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  readonly osmConfigured = signal(false);
  readonly osmProfile = signal<OsmProfile | null>(null);
  readonly osmLoading = signal(false);
  readonly linkingOsm = signal(false);

  ngOnInit(): void {
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
        this.loadOsmProfile();
      }
    });

    this.authService.getOsmStatus().subscribe({
      next: (res) => this.osmConfigured.set(res.configured),
      error: () => this.osmConfigured.set(false),
    });
  }

  private loadOsmProfile(): void {
    this.osmLoading.set(true);
    this.authService.getOsmProfile().subscribe({
      next: (profile) => {
        this.osmProfile.set(profile);
        this.osmLoading.set(false);
      },
      error: () => {
        this.osmProfile.set(null);
        this.osmLoading.set(false);
      },
    });
  }

  linkOsmAccount(): void {
    this.linkingOsm.set(true);
    this.authService.getOsmLinkUrl().subscribe({
      next: (res) => {
        globalThis.location.href = res.url;
      },
      error: () => {
        this.linkingOsm.set(false);
        this.snackBar.open(this.translate.instant('settings.osmLinkStartError') || 'Impossible de démarrer la liaison OpenStreetMap', 'OK', { duration: 3000 });
      },
    });
  }

  unlinkOsmAccount(): void {
    this.authService.unlinkOsm().subscribe({
      next: () => {
        this.osmProfile.set(null);
        this.snackBar.open(this.translate.instant('settings.osmUnlinked') || 'Compte OpenStreetMap délié', 'OK', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open(this.translate.instant('settings.osmUnlinkError') || 'Erreur lors de la déliaison', 'OK', { duration: 3000 });
      },
    });
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
