import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export interface InstanceFaq {
  id: string;
  instanceId: string;
  question: string;
  answer: string;
  sourceCount: number;
  status: 'DRAFT' | 'PUBLISHED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  generatedAt: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicFaqEntry {
  id: string;
  question: string;
  answer: string;
}

export interface ReviewInstanceFaqDTO {
  decision: 'PUBLISH' | 'REJECT';
  question?: string;
  answer?: string;
}

/** FAQ générée automatiquement à partir des questions réelles posées à l'assistant IA (voir
 * plan "FAQ dynamique par instance" du 2026-08-06). getPublished() est la route publique
 * (aucune authentification requise), les autres méthodes sont réservées à l'admin. */
@Injectable({ providedIn: 'root' })
export class FaqService {
  private readonly api = inject(ApiService);

  getPublished(instanceSlug: string): Observable<PublicFaqEntry[]> {
    return this.api.get<PublicFaqEntry[]>(`/faq/${instanceSlug}`);
  }

  listDrafts(instanceId: string): Observable<InstanceFaq[]> {
    return this.api.get<InstanceFaq[]>(`/instances/${instanceId}/faq/admin`);
  }

  review(instanceId: string, faqId: string, dto: ReviewInstanceFaqDTO): Observable<InstanceFaq> {
    return this.api.post<InstanceFaq>(`/instances/${instanceId}/faq/admin/${faqId}/review`, dto);
  }
}
