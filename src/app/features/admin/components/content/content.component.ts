import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';

import { CommentService, Comment } from '../../../../core/services/comment.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { Instance } from '../../../../core/models/index';
import {
  AdminDataTableComponent,
  AdminTableColumn,
} from '../../shared/components/admin-data-table/admin-data-table.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FlagCommentDialogComponent } from './flag-comment-dialog/flag-comment-dialog.component';

/**
 * File de modération de contenu (Lot A4) - liste TOUS les commentaires (pas seulement les
 * signalés par défaut) avec filtres, pour qu'un modérateur puisse aussi bien traiter la file de
 * signalements que parcourir l'activité générale d'une instance.
 */
@Component({
  selector: 'app-content',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule,
    TranslateModule,
    AdminDataTableComponent,
  ],
  templateUrl: './content.component.html',
  styleUrl: './content.component.scss',
})
export class ContentComponent implements OnInit {
  private readonly commentService = inject(CommentService);
  private readonly instanceService = inject(InstanceService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly columns: AdminTableColumn[] = [
    { key: 'text', label: 'Contenu' },
    { key: 'authorName', label: 'Auteur' },
    { key: 'flagged', label: 'Signalé' },
    { key: 'resolved', label: 'Résolu' },
    { key: 'createdAt', label: 'Créé le', sortable: true },
  ];

  readonly comments = signal<Comment[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);
  readonly instances = signal<Instance[]>([]);

  instanceFilter: string | null = null;
  flaggedFilter: boolean | null = null;
  resolvedFilter: boolean | null = null;

  ngOnInit(): void {
    this.instanceService.list({ limit: 100 }).subscribe({
      next: (res) => this.instances.set(res.data),
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.commentService
      .adminList({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        instanceId: this.instanceFilter ?? undefined,
        flagged: this.flaggedFilter ?? undefined,
        resolved: this.resolvedFilter ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.comments.set(res.data);
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

  flag(comment: Comment): void {
    const ref = this.dialog.open(FlagCommentDialogComponent);
    ref.afterClosed().subscribe((reason: string | undefined) => {
      if (reason === undefined) return;
      this.commentService.flag(comment.id, reason || undefined).subscribe({
        next: () => {
          this.notify('admin.content.flaggedSuccess');
          this.load();
        },
        error: (err) => this.notifyError(err),
      });
    });
  }

  unflag(comment: Comment): void {
    this.commentService.unflag(comment.id).subscribe({
      next: () => {
        this.notify('admin.content.unflaggedSuccess');
        this.load();
      },
      error: (err) => this.notifyError(err),
    });
  }

  confirmDelete(comment: Comment): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.content.deleteTitle'),
        message: this.translate.instant('admin.content.deleteMessage'),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.commentService.adminDelete(comment.id).subscribe({
        next: () => {
          this.notify('admin.content.deleted');
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
