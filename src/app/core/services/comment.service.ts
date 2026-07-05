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
  createdAt: string;
  authorName?: string;
  replies?: Comment[];
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
    return this.http.delete(`${this.baseUrl}/comments/${id}`, { observe: 'response' }).pipe(
      map(() => undefined as void)
    );
  }
}
