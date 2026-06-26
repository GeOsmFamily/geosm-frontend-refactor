import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface MapillaryImage {
  id: string;
  thumb_1024_url: string;
  captured_at: number;
  geometry: { type: string; coordinates: [number, number] };
}

@Injectable({ providedIn: 'root' })
export class MapillaryService {
  private readonly accessToken = 'MLY|YOUR_ACCESS_TOKEN';
  private readonly http = inject(HttpClient);

  getImagesNearPoint(lon: number, lat: number, radius = 0.001): Observable<MapillaryImage[]> {
    const bbox = `${lon - radius},${lat - radius},${lon + radius},${lat + radius}`;
    const url = `https://graph.mapillary.com/images?access_token=${this.accessToken}&fields=id,thumb_1024_url,captured_at,geometry&bbox=${bbox}&limit=20`;
    return this.http.get<{ data: MapillaryImage[] }>(url).pipe(map(r => r.data));
  }

  getEmbedUrl(imageId: string): string {
    return `https://www.mapillary.com/embed?image_key=${imageId}&style=photo`;
  }
}
