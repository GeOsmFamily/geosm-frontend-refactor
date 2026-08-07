import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

export interface AnalysisReport {
  id: string;
  topic: string;
  layerIds: string[];
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  resultJson: unknown;
  filePath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  rating: number | null;
  ratingComment: string | null;
}

/** Rapports d'analyse IA en PDF (voir plan "refonte Statistiques" du 2026-08-05) - même pattern
 * que LocationPlanService (génération asynchrone, téléchargement en blob via proxy API car
 * MinIO n'est pas joignable depuis le navigateur). */
@Injectable({ providedIn: 'root' })
export class AnalysisReportService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  generate(
    instanceId: string,
    topic: string,
    layerIds: string[],
    extent?: [number, number, number, number],
    geometry?: GeoJSON.Geometry,
  ): Observable<{ reportId: string }> {
    return this.api.post<{ reportId: string }>('/analysis-reports', {
      instanceId,
      topic,
      layerIds,
      extent,
      geometry,
    });
  }

  getById(id: string): Observable<AnalysisReport> {
    return this.api.get<AnalysisReport>(`/analysis-reports/${id}`);
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/analysis-reports/${id}/download`, {
      responseType: 'blob',
    });
  }

  /** Retour qualité (voir plan "Gouvernance citoyenne & qualité IA" du 2026-08-06) - réservé à
   * l'auteur du rapport côté backend. */
  rate(id: string, rating: 1 | -1, ratingComment?: string): Observable<void> {
    return this.api.post<void>(`/analysis-reports/${id}/rate`, { rating, ratingComment });
  }
}
