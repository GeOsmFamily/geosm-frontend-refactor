import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse, PersonalLayer, StagedFileImport } from '../models/index';
import { environment } from '../../../environments/environment';

export interface ConfirmPersonalFileImportDTO {
  stagingTable: string;
  name: string;
  description?: string;
  groupName: string;
  subGroupName: string;
  style?: { color?: string; iconKey?: string; shape?: string };
}

export interface ApplyPersonalLayerStyleDTO {
  color?: string;
  iconKey?: string;
  shape?: string;
}

export interface ReviewPersonalLayerPublicationDTO {
  decision: 'APPROVE' | 'REJECT';
  reviewNote?: string;
  overrideName?: string;
  overrideGroupName?: string;
  overrideSubGroupName?: string;
}

export interface FeatureCollectionResponse {
  type: 'FeatureCollection';
  features: GeoJSON.Feature[];
}

/** Données PRIVÉES d'un utilisateur (n'importe quel rôle) sur une instance - voir
 * personal-layers.routes.ts côté backend pour le contrat exact. */
@Injectable({ providedIn: 'root' })
export class PersonalLayerService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  listMine(instanceId: string): Observable<PersonalLayer[]> {
    return this.api.get<PersonalLayer[]>(`/instances/${instanceId}/personal-layers`);
  }

  /** Multipart - étape 1 : dépose un fichier en staging (aperçu). */
  importFileToStaging(instanceId: string, file: File): Observable<StagedFileImport> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiResponse<StagedFileImport>>(
        `${environment.apiUrl}/instances/${instanceId}/personal-layers/import/file`,
        formData,
      )
      .pipe(map((res) => res.data));
  }

  /** Étape 2 : confirme thématique/sous-thématique/nom/style et enregistre la donnée privée. */
  confirmFileImport(
    instanceId: string,
    dto: ConfirmPersonalFileImportDTO,
  ): Observable<PersonalLayer> {
    return this.api.post<PersonalLayer>(
      `/instances/${instanceId}/personal-layers/import/file/confirm`,
      dto,
    );
  }

  /** Multipart - importe un projet QGIS complet en un coup (thématiques/couches/styles auto-extraits). */
  importQgisProject(instanceId: string, file: File): Observable<PersonalLayer[]> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiResponse<PersonalLayer[]>>(
        `${environment.apiUrl}/instances/${instanceId}/personal-layers/import/qgis-project`,
        formData,
      )
      .pipe(map((res) => res.data));
  }

  getFeatures(instanceId: string, personalLayerId: string): Observable<FeatureCollectionResponse> {
    return this.api.get<FeatureCollectionResponse>(
      `/instances/${instanceId}/personal-layers/${personalLayerId}/features`,
    );
  }

  applyStyle(
    instanceId: string,
    personalLayerId: string,
    dto: ApplyPersonalLayerStyleDTO,
  ): Observable<PersonalLayer> {
    return this.api.post<PersonalLayer>(
      `/instances/${instanceId}/personal-layers/${personalLayerId}/style`,
      dto,
    );
  }

  /** Multipart - style QML natif (exporté de QGIS Desktop), appliqué seulement à la publication
   * (voir UploadPersonalLayerQmlStyleUseCase côté backend). */
  uploadQmlStyle(
    instanceId: string,
    personalLayerId: string,
    file: File,
  ): Observable<PersonalLayer> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiResponse<PersonalLayer>>(
        `${environment.apiUrl}/instances/${instanceId}/personal-layers/${personalLayerId}/style/qml`,
        formData,
      )
      .pipe(map((res) => res.data));
  }

  delete(instanceId: string, personalLayerId: string): Observable<void> {
    return this.api.delete<void>(
      `/instances/${instanceId}/personal-layers/${personalLayerId}`,
    );
  }

  requestPublication(
    instanceId: string,
    personalLayerId: string,
    publicationNote?: string,
  ): Observable<PersonalLayer> {
    return this.api.post<PersonalLayer>(
      `/instances/${instanceId}/personal-layers/${personalLayerId}/request-publication`,
      { publicationNote },
    );
  }

  // --- Modération (admin) ---

  listPendingPublications(instanceId: string): Observable<PersonalLayer[]> {
    return this.api.get<PersonalLayer[]>(
      `/instances/${instanceId}/personal-layers/publications/pending`,
    );
  }

  reviewPublication(
    instanceId: string,
    personalLayerId: string,
    dto: ReviewPersonalLayerPublicationDTO,
  ): Observable<PersonalLayer> {
    return this.api.post<PersonalLayer>(
      `/instances/${instanceId}/personal-layers/${personalLayerId}/review`,
      dto,
    );
  }
}
