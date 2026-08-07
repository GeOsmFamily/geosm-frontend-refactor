import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export interface ChoroplethZone {
  zoneId: number;
  zoneName: string;
  geometry: GeoJSON.Geometry;
  value: number | null;
}

export interface GridCell {
  geometry: GeoJSON.Geometry;
  value: number;
}

/** Statistiques spatiales dérivées d'une couche (choroplèthe + carroyage) - voir plan
 * "Choroplèthes + Carroyage" du 2026-08-06, routes publiques (mêmes données géographiques en
 * lecture seule que LayerService.getFeatures). */
@Injectable({ providedIn: 'root' })
export class ChoroplethService {
  private readonly api = inject(ApiService);

  getChoropleth(
    layerId: string,
    attribute: string,
    adminLevel: number,
  ): Observable<ChoroplethZone[]> {
    return this.api.get<ChoroplethZone[]>(`/layers/${layerId}/analysis/choropleth`, {
      attribute,
      adminLevel,
    });
  }

  getGrid(
    layerId: string,
    extent: [number, number, number, number],
    cellSizeMeters: number,
    gridType: 'square' | 'hexagon',
  ): Observable<GridCell[]> {
    return this.api.get<GridCell[]>(`/layers/${layerId}/analysis/grid`, {
      bbox: extent.join(','),
      cellSizeMeters,
      gridType,
    });
  }
}
