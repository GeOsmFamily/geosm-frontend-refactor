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
  mode: 'color-icon' | 'kml';
  color?: string;
  iconKey?: string;
  shape?: 'circle' | 'square' | 'triangle' | 'star' | 'pin';
  kmlFile?: File;
}

@Injectable({ providedIn: 'root' })
export class LayerService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  list(instanceId: string, params?: Record<string, any>): Observable<PaginatedResponse<Layer>> {
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

  getSourceFile(
    instanceId: string,
    id: string,
  ): Observable<{ layerId: string; name: string; url: string }> {
    return this.api.get<{ layerId: string; name: string; url: string }>(
      `/instances/${instanceId}/layers/${id}/source-file`,
    );
  }

  /**
   * Retourne une vraie GeoJSON FeatureCollection (pas une pagination classique
   * {data, meta}) - le backend renvoie {type, features}. Accepte bbox (chaîne
   * "minLon,minLat,maxLon,maxLat"), limit, offset en params.
   */
  getFeatures(
    layerId: string,
    params?: Record<string, any>,
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

  /** Multipart uniquement en mode 'kml' (fichier requis) ; JSON simple sinon. */
  applyStyle(instanceId: string, layerId: string, dto: ApplyLayerStyleDTO): Observable<Layer> {
    if (dto.mode === 'kml') {
      const formData = new FormData();
      formData.append('mode', dto.mode);
      if (dto.kmlFile) formData.append('file', dto.kmlFile);
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
