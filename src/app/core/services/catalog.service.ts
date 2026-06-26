import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiService);

  getCatalog(): Observable<any> {
    return this.api.get<any>('/catalog');
  }

  getCatalogByInstance(slug: string): Observable<any> {
    return this.api.get<any>(`/catalog/${slug}`);
  }
}
