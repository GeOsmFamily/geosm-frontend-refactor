import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ShareMap } from '../models/index';

@Injectable({ providedIn: 'root' })
export class SharingService {
  private readonly api = inject(ApiService);

  createShare(dto: Partial<ShareMap>): Observable<ShareMap> {
    return this.api.post<ShareMap>('/shares', dto);
  }

  getShare(code: string): Observable<ShareMap> {
    return this.api.get<ShareMap>(`/shares/${code}`);
  }
}
