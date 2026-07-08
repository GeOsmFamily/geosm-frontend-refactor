import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

export interface Comment {
  id: string;
  userId: string;
  instanceId: string;
  text: string;
  lat: number;
  lon: number;
  parentId: string | null;
  resolved: boolean;
  flagged: boolean;
  flagReason: string | null;
  flaggedAt: string | null;
  createdAt: string;
  authorName?: string;
  replies?: Comment[];
}

export interface AdminListCommentsParams {
  page?: number;
  limit?: number;
  instanceId?: string;
  flagged?: boolean;
  resolved?: boolean;
}

export interface AdminCommentsPage {
  data: Comment[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  list(instanceId: string): Observable<Comment[]> {
    // Use params object so HttpParams properly encodes the query
    return this.api.get<Comment[]>('/comments', { instanceId });
  }

  create(dto: { instanceId: string; text: string; lat: number; lon: number }): Observable<Comment> {
    return this.api.post<Comment>('/comments', dto);
  }

  reply(commentId: string, text: string): Observable<Comment> {
    return this.api.post<Comment>(`/comments/${commentId}/reply`, { text });
  }

  setResolved(commentId: string, resolved: boolean): Observable<Comment> {
    return this.api.patch<Comment>(`/comments/${commentId}/resolve`, { resolved });
  }

  delete(id: string): Observable<void> {
    // The backend returns 204 No Content — bypass ApiService which expects a JSON envelope
    return this.http
      .delete(`${this.baseUrl}/comments/${id}`, { observe: 'response' })
      .pipe(map(() => undefined as void));
  }

  // --- Modération admin (Lot A4, /admin/comments) ---

  adminList(params: AdminListCommentsParams): Observable<AdminCommentsPage> {
    return this.api.get<AdminCommentsPage>('/admin/comments', params as Record<string, unknown>);
  }

  flag(id: string, reason?: string): Observable<Comment> {
    return this.api.post<Comment>(`/admin/comments/${id}/flag`, reason ? { reason } : {});
  }

  unflag(id: string): Observable<Comment> {
    return this.api.post<Comment>(`/admin/comments/${id}/unflag`, {});
  }

  adminDelete(id: string): Observable<void> {
    return this.http
      .delete(`${this.baseUrl}/admin/comments/${id}`, { observe: 'response' })
      .pipe(map(() => undefined as void));
  }
}
