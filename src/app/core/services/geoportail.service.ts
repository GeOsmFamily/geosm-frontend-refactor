import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ElevationProfile, LayerStats, ViewportSummary } from '../models/index';

@Injectable({ providedIn: 'root' })
export class GeoportailService {
  private readonly api = inject(ApiService);

  getAltitude(lon: number, lat: number): Observable<unknown> {
    return this.api.get<unknown>('/geoportail/altitude', { lon, lat });
  }

  /** narrative=true ajoute une synthèse textuelle générée par IA (Gemini), en plus des chiffres
   * bruts. `bbox` (voir MapService.getCurrentExtent()) restreint le calcul - et, avec
   * narrative, la synthèse - à la zone visible sur la carte au lieu de toute la couche (voir
   * plan "refonte Statistiques" du 2026-08-05). */
  getLayerStats(
    layerId: string,
    narrative = false,
    bbox?: number[],
  ): Observable<LayerStats> {
    const params = new URLSearchParams();
    if (narrative) params.set('narrative', 'true');
    if (bbox) params.set('bbox', bbox.join(','));
    const qs = params.toString();
    return this.api.post<LayerStats>(
      `/geoportail/layers/${layerId}/stats${qs ? `?${qs}` : ''}`,
      {},
    );
  }

  summarizeView(layerIds: string[]): Observable<ViewportSummary> {
    return this.api.post<ViewportSummary>('/geoportail/summarize-view', { layerIds });
  }

  getElevationProfile(
    geometry: GeoJSON.Geometry,
    numPoints?: number,
  ): Observable<ElevationProfile> {
    return this.api.post<ElevationProfile>('/geoportail/elevation-profile', {
      geometry,
      numPoints,
    });
  }

  getAdminBoundary(lat: number, lon: number, table?: string): Observable<unknown> {
    return this.api.get<unknown>('/geoportail/admin-boundary', { lat, lon, table });
  }

  geolocate(): Observable<unknown> {
    return this.api.get<unknown>('/geoportail/geolocate');
  }
}
