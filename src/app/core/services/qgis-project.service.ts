import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse, Layer, QgisProjectLayerInfo, QgisProjectModel } from '../models/index';
import { environment } from '../../../environments/environment';

export interface UploadQgisProjectDTO {
  file: File;
  name: string;
  description?: string;
}

export interface QgisLayerSelection {
  layerName: string;
  displayName: string;
  geometryType: string;
}

@Injectable({ providedIn: 'root' })
export class QgisProjectService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  get(instanceId: string): Observable<QgisProjectModel[]> {
    return this.api.get<QgisProjectModel[]>(`/instances/${instanceId}/qgis-project`);
  }

  reload(instanceId: string): Observable<QgisProjectModel[]> {
    return this.api.post<QgisProjectModel[]>(`/instances/${instanceId}/qgis-project/reload`, {});
  }

  /** Multipart - héberge un projet QGIS fourni par l'admin (.qgz autonome, ou .zip
   * contenant un .qgs + ses données), voir UploadQgisProjectUseCase. */
  upload(instanceId: string, dto: UploadQgisProjectDTO): Observable<QgisProjectModel> {
    const formData = new FormData();
    formData.append('file', dto.file);
    formData.append('name', dto.name);
    if (dto.description) formData.append('description', dto.description);
    return this.http
      .post<ApiResponse<QgisProjectModel>>(`${environment.apiUrl}/instances/${instanceId}/qgis-project/upload`, formData)
      .pipe(map((res) => res.data));
  }

  listLayers(instanceId: string, qgisProjectId: string): Observable<QgisProjectLayerInfo[]> {
    return this.api.get<QgisProjectLayerInfo[]>(`/instances/${instanceId}/qgis-project/${qgisProjectId}/layers`);
  }

  confirmLayers(instanceId: string, qgisProjectId: string, subGroupId: string, layers: QgisLayerSelection[]): Observable<Layer[]> {
    return this.api.post<Layer[]>(`/instances/${instanceId}/qgis-project/${qgisProjectId}/layers/confirm`, { subGroupId, layers });
  }

  /** Empaquette le projet complet (données + styles) en une archive .zip autonome, ouvrable
   * directement dans QGIS Desktop - voir ExportQgisProjectBundleUseCase. */
  exportBundle(instanceId: string, qgisProjectId: string): Observable<{ name: string; url: string; convertedLayerCount: number; totalLayerCount: number }> {
    return this.api.get(`/instances/${instanceId}/qgis-project/${qgisProjectId}/export`);
  }
}
