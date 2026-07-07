import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

/** Petite boîte de dialogue pour saisir un motif optionnel avant de signaler un commentaire. */
@Component({
  selector: 'app-flag-comment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ 'admin.content.flagDialogTitle' | translate }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'admin.content.flagReason' | translate }}</mat-label>
        <textarea matInput [(ngModel)]="reason" rows="3"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">{{ 'common.cancel' | translate }}</button>
      <button mat-flat-button color="warn" (click)="dialogRef.close(reason)">{{ 'admin.content.flag' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [`.full-width { width: 100%; min-width: 320px; }`],
})
export class FlagCommentDialogComponent {
  readonly dialogRef = inject(MatDialogRef<FlagCommentDialogComponent>);
  reason = '';
}
