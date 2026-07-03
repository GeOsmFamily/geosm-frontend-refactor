import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiResponse, PaginatedResponse } from '../models/index';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
    return this.http
      .get<ApiResponse<T>>(`${this.baseUrl}${path}`, { params: httpParams })
      .pipe(map((res) => res.data));
  }

  getPaginated<T>(path: string, params?: Record<string, any>): Observable<PaginatedResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
    // Le backend (voir paginatedResponse() côté API) renvoie { success, data: T[],
    // meta: { pagination: {...}, timestamp } } - "data" est le tableau lui-même, pas un
    // objet { data, meta } imbriqué comme le suggérerait ApiResponse<PaginatedResponse<T>>.
    return this.http.get<{ success: boolean; data: T[]; meta: { pagination: { page: number; limit: number; total: number; totalPages: number } } }>(
      `${this.baseUrl}${path}`, { params: httpParams },
    ).pipe(
      map((res) => ({ data: res.data, meta: res.meta.pagination })),
    );
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`${this.baseUrl}${path}`, body)
      .pipe(map((res) => res.data));
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(`${this.baseUrl}${path}`, body)
      .pipe(map((res) => res.data));
  }

  patch<T>(path: string, body: any): Observable<T> {
    return this.http
      .patch<ApiResponse<T>>(`${this.baseUrl}${path}`, body)
      .pipe(map((res) => res.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiResponse<T>>(`${this.baseUrl}${path}`)
      .pipe(map((res) => res.data));
  }
}
