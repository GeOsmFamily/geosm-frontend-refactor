import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiResponse, RasterImportResult } from '../models/index';
import { environment } from '../../../environments/environment';

export interface UploadRasterDTO {
  file: File;
  tableName: string;
  name: string;
  description?: string;
  instanceId: string;
  subGroupId: string;
  srid?: number;
}

/** POST /rasters/upload (multipart) - reservé SUPER_ADMIN/ADMIN_INSTANCE. Enregistre aussi le
 * raster dans le projet QGIS de l'instance et crée une vraie couche (voir UploadRasterUseCase) -
 * sans ça le raster importé restait invisible sur le portail. Pas d'endpoint de listing (aucune
 * vue "tous les rasters" possible côté API), donc pas de CRUD complet ici - seulement l'upload. */
@Injectable({ providedIn: 'root' })
export class RasterService {
  private readonly http = inject(HttpClient);

  upload(dto: UploadRasterDTO): Observable<RasterImportResult> {
    const formData = new FormData();
    formData.append('file', dto.file);
    formData.append('tableName', dto.tableName);
    formData.append('name', dto.name);
    if (dto.description) formData.append('description', dto.description);
    formData.append('instanceId', dto.instanceId);
    formData.append('subGroupId', dto.subGroupId);
    if (dto.srid !== undefined) formData.append('srid', String(dto.srid));

    return this.http
      .post<ApiResponse<RasterImportResult>>(`${environment.apiUrl}/rasters/upload`, formData)
      .pipe(map((res) => res.data));
  }
}
