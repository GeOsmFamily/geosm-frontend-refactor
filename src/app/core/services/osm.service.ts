import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { OsmTagCondition } from '../models/index';

export type OsmGeometryKind = 'point' | 'line' | 'polygon';

/** Découverte de tags OSM + aperçu, pour la source "Données OSM" de l'assistant de création
 * de couche - introspecte les données déjà importées (osm.planet_osm_*), pas de dépendance
 * externe type Taginfo/Overpass (déploiement hors-ligne). */
@Injectable({ providedIn: 'root' })
export class OsmService {
  private readonly api = inject(ApiService);

  listTagKeys(geometryType: OsmGeometryKind): Observable<string[]> {
    return this.api.get<string[]>('/osm/tags', { geometryType });
  }

  listTagValues(geometryType: OsmGeometryKind, key: string): Observable<string[]> {
    return this.api.get<string[]>(`/osm/tags/${encodeURIComponent(key)}/values`, { geometryType });
  }

  preview(conditions: OsmTagCondition[], tables?: OsmGeometryKind[], limit = 200): Observable<GeoJSON.FeatureCollection> {
    return this.api.post<GeoJSON.FeatureCollection>('/osm/query', { conditions, tables, limit });
  }
}
