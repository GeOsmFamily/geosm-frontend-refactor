import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { InstanceService } from '../../../../core/services/instance.service';
import { FaqService, InstanceFaq } from '../../../../core/services/faq.service';
import { Instance } from '../../../../core/models/index';
import {
  AdminDataTableComponent,
  AdminTableColumn,
} from '../../shared/components/admin-data-table/admin-data-table.component';
import { AdminListPageComponent } from '../../shared/components/admin-list-page/admin-list-page.component';

interface DraftRow {
  id: string;
  question: string;
  answer: string;
  sourceCount: number;
  raw: InstanceFaq;
}

/**
 * File de revue des FAQ générées automatiquement (job faq-generation) - calquée sur
 * PersonalDataPublicationsComponent (même sélecteur d'instance en tête de page), mais sans
 * dialog séparée : publier/refuser sont des actions directes, une FAQ générée n'a pas besoin
 * d'overrides de thématique/nom comme une donnée personnelle.
 */
@Component({
  selector: 'app-faq-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    TranslateModule,
    AdminDataTableComponent,
    AdminListPageComponent,
  ],
  templateUrl: './faq-review.component.html',
  styleUrl: './faq-review.component.scss',
})
export class FaqReviewComponent implements OnInit {
  private readonly instanceService = inject(InstanceService);
  private readonly faqService = inject(FaqService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly columns: AdminTableColumn[] = [
    { key: 'question', label: 'Question' },
    { key: 'answer', label: 'Réponse' },
    { key: 'sourceCount', label: 'Occurrences' },
  ];

  readonly instances = signal<Instance[]>([]);
  readonly selectedInstanceId = signal<string | null>(null);
  readonly instancesLoading = signal(true);

  readonly rows = signal<DraftRow[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly reviewingId = signal<string | null>(null);

  ngOnInit(): void {
    this.instanceService.list({ limit: 100 }).subscribe({
      next: (res) => {
        this.instances.set(res.data);
        if (res.data.length > 0) this.selectedInstanceId.set(res.data[0].id);
        this.instancesLoading.set(false);
        this.load();
      },
      error: () => this.instancesLoading.set(false),
    });
  }

  onInstanceChange(id: string): void {
    this.selectedInstanceId.set(id);
    this.load();
  }

  load(): void {
    const instanceId = this.selectedInstanceId();
    if (!instanceId) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.faqService.listDrafts(instanceId).subscribe({
      next: (faqs) => {
        this.rows.set(
          faqs.map((f) => ({
            id: f.id,
            question: f.question,
            answer: f.answer,
            sourceCount: f.sourceCount,
            raw: f,
          })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  publish(row: DraftRow): void {
    this.decide(row, 'PUBLISH', 'FAQ publiée.');
  }

  reject(row: DraftRow): void {
    this.decide(row, 'REJECT', 'FAQ refusée.');
  }

  private decide(row: DraftRow, decision: 'PUBLISH' | 'REJECT', successMessage: string): void {
    const instanceId = this.selectedInstanceId();
    if (!instanceId || this.reviewingId()) return;
    this.reviewingId.set(row.id);
    this.faqService.review(instanceId, row.id, { decision }).subscribe({
      next: () => {
        this.notify(successMessage);
        this.reviewingId.set(null);
        this.load();
      },
      error: (err) => {
        this.reviewingId.set(null);
        this.notifyError(err);
      },
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, undefined, { duration: 3500 });
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, {
      duration: 4500,
    });
  }
}
