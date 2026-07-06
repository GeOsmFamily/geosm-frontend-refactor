import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FeedbackService, FeedbackType } from '../../../../core/services/feedback.service';

@Component({
  selector: 'app-info-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  templateUrl: './info-panel.component.html',
  styleUrl: './info-panel.component.scss',
})
export class InfoPanelComponent {
  private readonly fb = inject(FormBuilder);
  private readonly feedbackService = inject(FeedbackService);
  private readonly translate = inject(TranslateService);
  private readonly snackBar = inject(MatSnackBar);

  readonly developerName = 'Boris Gautier TCHOUKOUAHA';
  readonly developerEmail = 'me@borisgauty.com';
  readonly repoUrl = 'https://github.com/GeOsmFamily/geosm-frontend-refactor';

  readonly submitting = signal(false);

  readonly feedbackTypes: { value: FeedbackType; label: string }[] = [
    { value: 'BUG', label: 'infoPanel.feedback.types.bug' },
    { value: 'SUGGESTION', label: 'infoPanel.feedback.types.suggestion' },
    { value: 'FEATURE_REQUEST', label: 'infoPanel.feedback.types.featureRequest' },
  ];

  readonly feedbackForm: FormGroup = this.fb.group({
    type: ['BUG', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    contactEmail: ['', Validators.email],
  });

  get guidePdfUrl(): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'fr';
    return `assets/docs/geosm-guide-${lang === 'en' ? 'en' : 'fr'}.pdf`;
  }

  submitFeedback(): void {
    if (this.feedbackForm.invalid) {
      this.feedbackForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { type, description, contactEmail } = this.feedbackForm.value;

    this.feedbackService.submit({
      type,
      description,
      contactEmail: contactEmail || undefined,
      page: globalThis.location?.pathname,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.feedbackForm.reset({ type: 'BUG', description: '', contactEmail: '' });
        this.snackBar.open(
          this.translate.instant('infoPanel.feedback.success') || 'Merci pour votre retour !',
          'OK',
          { duration: 3000 },
        );
      },
      error: () => {
        this.submitting.set(false);
        this.snackBar.open(
          this.translate.instant('infoPanel.feedback.error') || "Une erreur est survenue lors de l'envoi.",
          'OK',
          { duration: 4000 },
        );
      },
    });
  }
}
