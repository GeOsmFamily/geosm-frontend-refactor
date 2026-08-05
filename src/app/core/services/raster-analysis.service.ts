import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export type RasterAnalysisType = 'global' | 'zonal';

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
  error: string | null;
}

/** Analyse raster (statistiques globales/zonales, valeur au clic) - voir plan "Analyse raster". */
@Injectable({ providedIn: 'root' })
export class RasterAnalysisService {
  private readonly api = inject(ApiService);

  analyze(layerId: string, type: RasterAnalysisType): Observable<{ resultId: string }> {
    return this.api.post<{ resultId: string }>(`/rasters/${layerId}/analyze`, { type });
  }

  getResult(resultId: string): Observable<RasterAnalysisResult> {
    return this.api.get<RasterAnalysisResult>(`/rasters/analysis/${resultId}`);
  }

  getPixelValue(layerId: string, lon: number, lat: number): Observable<{ value: number | null }> {
    return this.api.get<{ value: number | null }>(`/rasters/${layerId}/value`, { lon, lat });
  }
}
