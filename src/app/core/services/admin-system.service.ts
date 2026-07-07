import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/index';

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
}

export interface SequenceInfo {
  sequence_name: string;
  start_value: string;
  increment: string;
}

export interface TableInfo {
  schema: string;
  table: string;
  sizeBytes: number;
  sizePretty: string;
  rowEstimate: number;
}

export interface DatabaseOverview {
  totalSizeBytes: number;
  totalSizePretty: string;
  tableCount: number;
  tables: TableInfo[];
}

/** Lot A9 admin - surface les utilitaires système déjà exposés côté backend mais jamais dans l'UI. */
@Injectable({ providedIn: 'root' })
export class AdminSystemService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  clearCache(): Observable<void> {
    return this.api.post<void>('/admin/cache/clear', {});
  }

  getDbConfig(): Observable<DbConfig> {
    return this.api.get<DbConfig>('/admin/config/db');
  }

  getDatabaseOverview(): Observable<DatabaseOverview> {
    return this.api.get<DatabaseOverview>('/admin/database/overview');
  }

  listSequences(): Observable<SequenceInfo[]> {
    return this.api.get<SequenceInfo[]>('/admin/sequences');
  }

  createSequence(name: string, start = 1, increment = 1): Observable<SequenceInfo> {
    return this.api.post<SequenceInfo>('/admin/sequences', { name, start, increment });
  }

  // Le backend lit "name" depuis le corps de la requête DELETE (voir admin.routes.ts) -
  // ApiService.delete() ne supporte pas de corps, on passe donc par HttpClient directement.
  deleteSequence(name: string): Observable<{ name: string; dropped: boolean }> {
    return this.http
      .delete<ApiResponse<{ name: string; dropped: boolean }>>(`${this.baseUrl}/admin/sequences`, { body: { name } })
      .pipe(map((res) => res.data));
  }
}
