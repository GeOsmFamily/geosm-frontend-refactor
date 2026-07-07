import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminSystemService, DbConfig, SequenceInfo, DatabaseOverview } from '../../../../core/services/admin-system.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-system-tools',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './system-tools.component.html',
  styleUrl: './system-tools.component.scss',
})
export class SystemToolsComponent implements OnInit {
  private readonly systemService = inject(AdminSystemService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly dbConfig = signal<DbConfig | null>(null);
  readonly sequences = signal<SequenceInfo[]>([]);
  readonly clearingCache = signal(false);
  readonly creatingSequence = signal(false);
  readonly deletingSequence = signal<string | null>(null);

  readonly dbOverview = signal<DatabaseOverview | null>(null);
  readonly loadingOverview = signal(false);
  tableSearch = '';
  schemaFilter: string | null = null;

  newSequenceName = '';
  newSequenceStart = 1;
  newSequenceIncrement = 1;

  ngOnInit(): void {
    this.systemService.getDbConfig().subscribe({ next: (res) => this.dbConfig.set(res) });
    this.loadSequences();
    this.loadDatabaseOverview();
  }

  loadDatabaseOverview(): void {
    this.loadingOverview.set(true);
    this.systemService.getDatabaseOverview().subscribe({
      next: (res) => {
        this.dbOverview.set(res);
        this.loadingOverview.set(false);
      },
      error: () => this.loadingOverview.set(false),
    });
  }

  get schemas(): string[] {
    const overview = this.dbOverview();
    if (!overview) return [];
    return [...new Set(overview.tables.map((t) => t.schema))].sort((a, b) => a.localeCompare(b));
  }

  get filteredTables() {
    const overview = this.dbOverview();
    if (!overview) return [];
    const search = this.tableSearch.trim().toLowerCase();
    return overview.tables.filter((t) => {
      const matchesSchema = !this.schemaFilter || t.schema === this.schemaFilter;
      const matchesSearch = !search || t.table.toLowerCase().includes(search) || t.schema.toLowerCase().includes(search);
      return matchesSchema && matchesSearch;
    });
  }

  loadSequences(): void {
    this.systemService.listSequences().subscribe({ next: (res) => this.sequences.set(res) });
  }

  confirmClearCache(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.systemTools.confirmClearCacheTitle'),
        message: this.translate.instant('admin.systemTools.confirmClearCacheMessage'),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.clearingCache.set(true);
      this.systemService.clearCache().subscribe({
        next: () => {
          this.clearingCache.set(false);
          this.notify('admin.systemTools.cacheCleared');
        },
        error: (err) => {
          this.clearingCache.set(false);
          this.notifyError(err);
        },
      });
    });
  }

  createSequence(): void {
    if (!this.newSequenceName.trim()) return;
    this.creatingSequence.set(true);
    this.systemService.createSequence(this.newSequenceName.trim(), this.newSequenceStart, this.newSequenceIncrement).subscribe({
      next: () => {
        this.creatingSequence.set(false);
        this.newSequenceName = '';
        this.notify('admin.systemTools.sequenceCreated');
        this.loadSequences();
      },
      error: (err) => {
        this.creatingSequence.set(false);
        this.notifyError(err);
      },
    });
  }

  confirmDeleteSequence(sequence: SequenceInfo): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.systemTools.confirmDeleteSequenceTitle'),
        message: this.translate.instant('admin.systemTools.confirmDeleteSequenceMessage', { name: sequence.sequence_name }),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.deletingSequence.set(sequence.sequence_name);
      this.systemService.deleteSequence(sequence.sequence_name).subscribe({
        next: () => {
          this.deletingSequence.set(null);
          this.notify('admin.systemTools.sequenceDeleted');
          this.loadSequences();
        },
        error: (err) => {
          this.deletingSequence.set(null);
          this.notifyError(err);
        },
      });
    });
  }

  private notify(key: string): void {
    this.snackBar.open(this.translate.instant(key), undefined, { duration: 3000 });
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, { duration: 4000 });
  }
}
