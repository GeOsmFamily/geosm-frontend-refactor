import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse, BoundaryDetail, BoundarySearchResult } from '../models/index';
import { environment } from '../../../environments/environment';

export interface ImportBoundariesDTO {
  file: File;
  nameField: string;
  adminLevel: number;
  mode: 'append' | 'replace';
}

export interface ImportBoundariesResult {
  importedCount: number;
}

/**
 * Recherche/consultation/import de limites administratives (GET/POST /geoportail/
 * admin-boundaries/*, réservé SUPER_ADMIN/ADMIN_INSTANCE, import réservé SUPER_ADMIN) - utilisé
 * par le sélecteur de limite administrative lors de la configuration de
 * Instance.boundaryTable/boundaryId (voir instance-form-dialog / boundary-picker-dialog).
 */
@Injectable({ providedIn: 'root' })
export class BoundaryService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  search(table: string, q?: string, limit = 20): Observable<BoundarySearchResult[]> {
    return this.api.get<BoundarySearchResult[]>('/geoportail/admin-boundaries/search', {
      table,
      q,
      limit,
    });
  }

  getDetail(table: string, id: number, geomCol?: string): Observable<BoundaryDetail> {
    return this.api.get<BoundaryDetail>(`/geoportail/admin-boundaries/${table}/${id}`, { geomCol });
  }

  /**
   * Upload multipart - contourne le wrapper JSON d'ApiService (FormData a besoin d'un
   * Content-Type différent que celui-ci fixe implicitement), seul endroit du projet à en avoir
   * besoin puisqu'aucun autre écran n'a encore d'UI d'upload de fichier.
   */
  importFile(dto: ImportBoundariesDTO): Observable<ImportBoundariesResult> {
    const formData = new FormData();
    formData.append('file', dto.file);
    formData.append('nameField', dto.nameField);
    formData.append('adminLevel', String(dto.adminLevel));
    formData.append('mode', dto.mode);

    return this.http
      .post<ApiResponse<ImportBoundariesResult>>(
        `${environment.apiUrl}/geoportail/admin-boundaries/import`,
        formData,
      )
      .pipe(map((res) => res.data));
  }
}
