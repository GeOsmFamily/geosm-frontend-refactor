import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export type SpatialAnalysisOperation = 'buffer' | 'intersection' | 'union' | 'difference';

export interface SpatialAnalysisInput {
  operation: SpatialAnalysisOperation;
  geometryA: Record<string, unknown>;
  geometryB?: Record<string, unknown>;
  distance?: number;
}

export interface SpatialAnalysisResult {
  type: string;
  geometry: Record<string, unknown> | null;
}

@Injectable({ providedIn: 'root' })
export class SpatialAnalysisService {
  private readonly api = inject(ApiService);

  analyze(input: SpatialAnalysisInput): Observable<SpatialAnalysisResult> {
    return this.api.post<SpatialAnalysisResult>('/analysis/spatial', input);
  }
}
