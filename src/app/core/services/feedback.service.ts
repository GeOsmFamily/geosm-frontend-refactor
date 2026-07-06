import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export type FeedbackType = 'BUG' | 'SUGGESTION' | 'FEATURE_REQUEST';

export interface SubmitFeedbackDTO {
  type: FeedbackType;
  description: string;
  contactEmail?: string;
  page?: string;
}

export interface FeedbackSubmission {
  id: string;
  type: FeedbackType;
  description: string;
  contactEmail: string | null;
  page: string | null;
  userId: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly api = inject(ApiService);

  submit(dto: SubmitFeedbackDTO): Observable<FeedbackSubmission> {
    return this.api.post<FeedbackSubmission>('/feedback', dto);
  }
}
