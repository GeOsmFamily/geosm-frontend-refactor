import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiService);

  getCatalog(): Observable<unknown[]> {
    return this.api.get<unknown[]>('/catalog');
  }

  getCatalogByInstance(slug: string): Observable<unknown[]> {
    return this.api.get<unknown[]>(`/catalog/${slug}`);
  }
}
