import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';

import {
  FeedbackService,
  FeedbackSubmission,
  FeedbackType,
  FeedbackStatus,
} from '../../../../core/services/feedback.service';
import {
  AdminDataTableComponent,
  AdminTableColumn,
} from '../../shared/components/admin-data-table/admin-data-table.component';
import {
  FeedbackDetailDialogComponent,
  FeedbackDetailDialogResult,
} from './feedback-detail-dialog/feedback-detail-dialog.component';
import { AdminListPageComponent } from '../../shared/components/admin-list-page/admin-list-page.component';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule,
    TranslateModule,
    AdminDataTableComponent,
    AdminListPageComponent,
  ],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.scss',
})
export class FeedbackComponent implements OnInit {
  private readonly feedbackService = inject(FeedbackService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly types: FeedbackType[] = ['BUG', 'SUGGESTION', 'FEATURE_REQUEST'];
  readonly statuses: FeedbackStatus[] = ['NEW', 'REVIEWED', 'CLOSED'];

  readonly columns: AdminTableColumn[] = [
    { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Statut' },
    { key: 'createdAt', label: 'Créé le', sortable: true },
  ];

  readonly items = signal<FeedbackSubmission[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  typeFilter: FeedbackType | null = null;
  statusFilter: FeedbackStatus | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.feedbackService
      .adminList({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        type: this.typeFilter ?? undefined,
        status: this.statusFilter ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

  onFilterChange(): void {
    this.pageIndex.set(0);
    this.load();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  onSortChange(_sort: Sort): void {
    // Tri côté client suffisant - la table est déjà paginée côté serveur.
  }

  openDetail(item: FeedbackSubmission): void {
    const ref = this.dialog.open<
      FeedbackDetailDialogComponent,
      { feedback: FeedbackSubmission },
      FeedbackDetailDialogResult
    >(FeedbackDetailDialogComponent, { data: { feedback: item } });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.feedbackService.updateStatus(item.id, result.status, result.adminNotes).subscribe({
        next: () => {
          this.notify('admin.feedback.updated');
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  private notify(key: string): void {
    this.snackBar.open(this.translate.instant(key), undefined, { duration: 3000 });
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, {
      duration: 4000,
    });
  }
}
