import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FaqService, PublicFaqEntry } from '../../core/services/faq.service';
import { InstanceService } from '../../core/services/instance.service';
import { Instance } from '../../core/models/index';

/** Page publique de consultation de la FAQ d'une instance - calquée sur SharedMapComponent
 * (même principe : résolution par slug via la route publique GET /instances/slug/:slug,
 * jamais GET /instances/:id qui exige une authentification), accessible sans compte. */
@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatExpansionModule,
    TranslateModule,
  ],
  templateUrl: './faq-page.component.html',
  styleUrl: './faq-page.component.scss',
})
export class FaqPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly faqService = inject(FaqService);
  private readonly instanceService = inject(InstanceService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly instance = signal<Instance | null>(null);
  readonly entries = signal<PublicFaqEntry[]>([]);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('instanceSlug');
    if (!slug) {
      this.error.set(this.translate.instant('faq.errors.invalidLink'));
      this.loading.set(false);
      return;
    }

    this.instanceService.getBySlug(slug).subscribe({
      next: (instance) => this.instance.set(instance),
      error: () => undefined,
    });

    this.faqService.getPublished(slug).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('faq.errors.notFound'));
        this.loading.set(false);
      },
    });
  }
}
