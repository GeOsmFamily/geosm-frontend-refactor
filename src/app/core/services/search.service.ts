import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service.js';
import { SearchResult } from '../models/index.js';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly api = inject(ApiService);

  globalSearch(q: string, limit?: number): Observable<SearchResult[]> {
    return this.api.get<SearchResult[]>('/search', { q, limit });
  }

  searchLayers(q: string, instanceId?: string, limit?: number): Observable<any> {
    return this.api.get<any>('/search/layers', { q, instanceId, limit });
  }

  searchFeatures(q: string, layerId: string, limit?: number): Observable<any> {
    return this.api.get<any>('/search/features', { q, layerId, limit });
  }
}
