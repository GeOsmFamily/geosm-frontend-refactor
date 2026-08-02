import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import {
  ApiResponse,
  Feature,
  Layer,
  OsmTagCondition,
  PaginatedResponse,
  StagedFileImport,
} from '../models/index';
import { environment } from '../../../environments/environment';

export interface FeatureCollectionResponse {
  type: 'FeatureCollection';
  features: Feature[];
}

export interface ConfirmFileImportDTO {
  stagingTable: string;
  name: string;
  description?: string;
  subGroupId: string;
  minZoom?: number;
  maxZoom?: number;
  opacity?: number;
  isVisible?: boolean;
  isQueryable?: boolean;
}

export interface ConfirmOsmImportDTO {
  name: string;
  description?: string;
  subGroupId: string;
  geometryType: string;
  conditions: OsmTagCondition[];
  minZoom?: number;
  maxZoom?: number;
  opacity?: number;
  isVisible?: boolean;
  isQueryable?: boolean;
}

export interface ApplyLayerStyleDTO {
  mode: 'color-icon' | 'kml' | 'qml';
  color?: string;
  iconKey?: string;
  shape?: 'circle' | 'square' | 'triangle' | 'star' | 'pin';
  kmlFile?: File;
  /** Fichier de style QGIS natif (.qml), appliqué directement sans conversion - le cas le plus
   * courant pour un admin qui a déjà stylé sa couche dans QGIS Desktop (le mode "kml" reste
   * pour le cas distinct d'un style OGR embarqué dans un fichier KML). */
  qmlFile?: File;
}

@Injectable({ providedIn: 'root' })
export class LayerService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  list(instanceId: string, params?: Record<string, unknown>): Observable<PaginatedResponse<Layer>> {
    return this.api.getPaginated<Layer>(`/instances/${instanceId}/layers`, params);
  }

  getById(instanceId: string, id: string): Observable<Layer> {
    return this.api.get<Layer>(`/instances/${instanceId}/layers/${id}`);
  }

  create(instanceId: string, dto: Partial<Layer>): Observable<Layer> {
    return this.api.post<Layer>(`/instances/${instanceId}/layers`, dto);
  }

  update(instanceId: string, id: string, dto: Partial<Layer>): Observable<Layer> {
    return this.api.patch<Layer>(`/instances/${instanceId}/layers/${id}`, dto);
  }

  delete(instanceId: string, id: string): Observable<void> {
    return this.api.delete<void>(`/instances/${instanceId}/layers/${id}`);
  }

  // Recharge une couche par défaut depuis les données OSM déjà importées (pas un nouveau
  // téléchargement) - voir ResyncLayerUseCase côté backend. Réservé SUPER_ADMIN/ADMIN_INSTANCE.
  resync(instanceId: string, id: string): Observable<Layer> {
    return this.api.post<Layer>(`/instances/${instanceId}/layers/${id}/resync`, {});
  }

  /**
   * Télécharge le contenu GeoJSON d'une couche directement depuis l'API (stream).
   * Le backend stream le fichier depuis MinIO (ou l'exporte à la demande depuis PostGIS)
   * sans exposer d'URL MinIO interne inaccessible depuis le navigateur.
   */
  downloadSourceFile(instanceId: string, id: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/instances/${instanceId}/layers/${id}/source-file`, {
      responseType: 'blob',
    });
  }

  /**
   * Retourne une vraie GeoJSON FeatureCollection (pas une pagination classique
   * {data, meta}) - le backend renvoie {type, features}. Accepte bbox (chaîne
   * "minLon,minLat,maxLon,maxLat"), limit, offset en params.
   */
  getFeatures(
    layerId: string,
    params?: Record<string, unknown>,
  ): Observable<FeatureCollectionResponse> {
    return this.api.get<FeatureCollectionResponse>(`/layers/${layerId}/features`, params);
  }

  /** Multipart - importe un fichier en staging (aperçu avant publication), voir StageFileImportUseCase. */
  importFileToStaging(instanceId: string, file: File): Observable<StagedFileImport> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiResponse<StagedFileImport>>(
        `${environment.apiUrl}/instances/${instanceId}/layers/import/file`,
        formData,
      )
      .pipe(map((res) => res.data));
  }

  confirmFileImport(instanceId: string, dto: ConfirmFileImportDTO): Observable<Layer> {
    return this.api.post<Layer>(`/instances/${instanceId}/layers/import/file/confirm`, dto);
  }

  confirmOsmImport(instanceId: string, dto: ConfirmOsmImportDTO): Observable<Layer> {
    return this.api.post<Layer>(`/instances/${instanceId}/layers/import/osm/confirm`, dto);
  }

  /** Multipart en mode 'kml'/'qml' (fichier requis) ; JSON simple sinon. */
  applyStyle(instanceId: string, layerId: string, dto: ApplyLayerStyleDTO): Observable<Layer> {
    if (dto.mode === 'kml' || dto.mode === 'qml') {
      const file = dto.mode === 'kml' ? dto.kmlFile : dto.qmlFile;
      const formData = new FormData();
      formData.append('mode', dto.mode);
      if (file) formData.append('file', file);
      return this.http
        .post<ApiResponse<Layer>>(
          `${environment.apiUrl}/instances/${instanceId}/layers/${layerId}/style/apply`,
          formData,
        )
        .pipe(map((res) => res.data));
    }
    return this.api.post<Layer>(`/instances/${instanceId}/layers/${layerId}/style/apply`, {
      mode: dto.mode,
      color: dto.color,
      iconKey: dto.iconKey,
      shape: dto.shape,
    });
  }
}
