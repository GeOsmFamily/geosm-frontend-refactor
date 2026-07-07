import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';

import { FeedbackSubmission, FeedbackStatus } from '../../../../../core/services/feedback.service';

export interface FeedbackDetailDialogData {
  feedback: FeedbackSubmission;
}

export interface FeedbackDetailDialogResult {
  status: FeedbackStatus;
  adminNotes?: string;
}

/** Détail d'un signalement (Lot A5 admin) - lecture + mise à jour du statut/notes internes. */
@Component({
  selector: 'app-feedback-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatChipsModule,
    TranslateModule,
  ],
  templateUrl: './feedback-detail-dialog.component.html',
  styleUrl: './feedback-detail-dialog.component.scss',
})
export class FeedbackDetailDialogComponent {
  readonly dialogRef = inject(MatDialogRef<FeedbackDetailDialogComponent, FeedbackDetailDialogResult>);
  readonly data = inject<FeedbackDetailDialogData>(MAT_DIALOG_DATA);

  status: FeedbackStatus = this.data.feedback.status;
  adminNotes = this.data.feedback.adminNotes || '';

  readonly statuses: FeedbackStatus[] = ['NEW', 'REVIEWED', 'CLOSED'];

  save(): void {
    this.dialogRef.close({ status: this.status, adminNotes: this.adminNotes });
  }
}
