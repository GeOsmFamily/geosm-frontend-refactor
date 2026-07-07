import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { LayerStyleModel } from '../models/index';

/** GET/PUT/POST /layers/:layerId/style - pas nesté sous instance (le layerId suffit). */
@Injectable({ providedIn: 'root' })
export class StyleService {
  private readonly api = inject(ApiService);

  getStyles(layerId: string): Observable<LayerStyleModel[]> {
    return this.api.get<LayerStyleModel[]>(`/layers/${layerId}/style`);
  }

  updateSld(layerId: string, sldBody: string): Observable<LayerStyleModel> {
    return this.api.put<LayerStyleModel>(`/layers/${layerId}/style/sld`, { sldBody });
  }

  updateMapbox(layerId: string, mapboxStyle: Record<string, unknown>): Observable<LayerStyleModel> {
    return this.api.put<LayerStyleModel>(`/layers/${layerId}/style/mapbox`, { mapboxStyle });
  }

  reset(layerId: string): Observable<void> {
    return this.api.post<void>(`/layers/${layerId}/style/reset`, {});
  }

  /** L'endpoint est enregistré sous le même préfixe /layers/:layerId/style que les autres bien
   * que ListDefaultStylesUseCase n'utilise pas layerId - un layerId reste requis dans l'URL. */
  listDefaults(layerId: string): Observable<LayerStyleModel[]> {
    return this.api.get<LayerStyleModel[]>(`/layers/${layerId}/style/defaults`);
  }
}
