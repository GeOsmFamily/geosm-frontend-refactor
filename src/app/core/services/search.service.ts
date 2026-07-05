import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { SearchResult } from '../models/index';

export interface LayerSuggestion {
  id: string;
  name: string;
  description: string | null;
}

export interface LayerRecommendation extends LayerSuggestion {
  coUserCount: number;
}

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

  /** Suggestions contextuelles (classement déterministe par fréquence d'activation passée). */
  getSuggestions(instanceId: string, limit?: number): Observable<LayerSuggestion[]> {
    return this.api.get<LayerSuggestion[]>('/search/suggestions', { instanceId, limit });
  }

  /** "Les utilisateurs qui ont activé X ont aussi activé Y" (co-occurrence). */
  getLayerRecommendations(layerId: string, instanceId: string, limit?: number): Observable<LayerRecommendation[]> {
    return this.api.get<LayerRecommendation[]>('/search/layer-recommendations', { layerId, instanceId, limit });
  }
}
