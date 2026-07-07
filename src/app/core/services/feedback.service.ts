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

export type FeedbackStatus = 'NEW' | 'REVIEWED' | 'CLOSED';

export interface FeedbackSubmission {
  id: string;
  type: FeedbackType;
  description: string;
  contactEmail: string | null;
  page: string | null;
  userId: string | null;
  status: FeedbackStatus;
  adminNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AdminListFeedbackParams {
  page?: number;
  limit?: number;
  type?: FeedbackType;
  status?: FeedbackStatus;
}

export interface AdminFeedbackPage {
  data: FeedbackSubmission[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly api = inject(ApiService);

  submit(dto: SubmitFeedbackDTO): Observable<FeedbackSubmission> {
    return this.api.post<FeedbackSubmission>('/feedback', dto);
  }

  // --- Suivi admin (Lot A5, /admin/feedback) ---

  adminList(params: AdminListFeedbackParams): Observable<AdminFeedbackPage> {
    return this.api.get<AdminFeedbackPage>('/admin/feedback', params as Record<string, unknown>);
  }

  updateStatus(id: string, status: FeedbackStatus, adminNotes?: string): Observable<FeedbackSubmission> {
    return this.api.patch<FeedbackSubmission>(`/admin/feedback/${id}`, { status, adminNotes });
  }
}
