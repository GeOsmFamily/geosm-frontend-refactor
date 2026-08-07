import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export type RasterAnalysisType = 'global' | 'zonal' | 'custom';

export interface RasterStats {
  min: number | null;
  max: number | null;
  mean: number | null;
  stddev: number | null;
  count: number;
}

export interface ZonalStat {
  zoneId: number;
  zoneName: string;
  sum: number | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export interface RasterAnalysisResult {
  id: string;
  layerId: string;
  type: RasterAnalysisType;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  result: RasterStats | ZonalStat[] | null;
  /** Synthèse IA comparative/conclusive (voir raster-analysis.worker.ts) - null si Gemini est
   * indisponible/en échec, jamais bloquant. */
  narrative: string | null;
  error: string | null;
}

/** Analyse raster (statistiques globales/zonales, valeur au clic) - voir plan "Analyse raster". */
@Injectable({ providedIn: 'root' })
export class RasterAnalysisService {
  private readonly api = inject(ApiService);

  analyze(
    layerId: string,
    type: RasterAnalysisType,
    options?: { adminLevel?: number; geometry?: GeoJSON.Geometry },
  ): Observable<{ resultId: string }> {
    return this.api.post<{ resultId: string }>(`/rasters/${layerId}/analyze`, {
      type,
      ...options,
    });
  }

  getResult(resultId: string): Observable<RasterAnalysisResult> {
    return this.api.get<RasterAnalysisResult>(`/rasters/analysis/${resultId}`);
  }

  /** Niveaux administratifs (admin_level) disponibles pour l'instance - alimente le sélecteur
   * "Statistiques par zone" (voir FindAdminBoundariesByLevelUseCase.findAvailableLevels côté
   * backend, corrige le cas d'une instance sans Instance.adminLevel configuré, ex. Cameroun). */
  getAvailableAdminLevels(instanceId: string): Observable<number[]> {
    return this.api.get<number[]>(`/geoportail/instances/${instanceId}/admin-levels`);
  }

  getPixelValue(
    layerId: string,
    lon: number,
    lat: number,
  ): Observable<{ value: number | null; cellAreaM2?: number | null }> {
    return this.api.get<{ value: number | null; cellAreaM2?: number | null }>(
      `/rasters/${layerId}/value`,
      { lon, lat },
    );
  }
}
