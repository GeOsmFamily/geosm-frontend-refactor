import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { IconCatalogEntry } from '../models/index';

export interface GenerateIconOptions {
  color: string;
  shape: 'circle' | 'square' | 'triangle' | 'star' | 'pin';
  size: number;
  strokeColor?: string;
  strokeWidth?: number;
  iconKey?: string;
}

/** Catalogue d'icônes génériques + génération d'aperçu SVG à la volée, pour le sélecteur
 * d'icônes de l'assistant de création de couche (voir ICON_CATALOG côté backend). */
@Injectable({ providedIn: 'root' })
export class IconCatalogService {
  private readonly api = inject(ApiService);

  listCatalog(): Observable<IconCatalogEntry[]> {
    return this.api.get<IconCatalogEntry[]>('/admin/icons/catalog');
  }

  generatePreview(
    options: GenerateIconOptions | GenerateIconOptions[],
  ): Observable<{ svgs: string[] }> {
    return this.api.post<{ svgs: string[] }>('/admin/icons/generate', options);
  }
}
