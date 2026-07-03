import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MapillaryImage {
  id: string;
  thumb_1024_url: string;
  captured_at: number;
  sequence: string;
  compass_angle?: number;
  geometry: { type: string; coordinates: [number, number] };
}

@Injectable({ providedIn: 'root' })
export class MapillaryService {
  private readonly http = inject(HttpClient);

  // Token applicatif fourni par GeOSM - les utilisateurs n'ont pas à fournir le leur.
  getToken(): string {
    return environment.mapillaryToken;
  }

  getImagesNearPoint(lon: number, lat: number, radius = 0.001): Observable<MapillaryImage[]> {
    const bbox = `${lon - radius},${lat - radius},${lon + radius},${lat + radius}`;
    return this.getImagesInBbox(bbox, 50);
  }

  getImagesInBbox(bbox: string, limit = 500): Observable<MapillaryImage[]> {
    const url = `https://graph.mapillary.com/images?access_token=${this.getToken()}&fields=id,thumb_1024_url,captured_at,sequence,compass_angle,geometry&bbox=${bbox}&limit=${limit}`;
    return this.http.get<{ data: MapillaryImage[] }>(url).pipe(
      map(r => r.data || [])
    );
  }

  getSequenceImages(sequenceId: string, limit = 1000): Observable<MapillaryImage[]> {
    const url = `https://graph.mapillary.com/images?access_token=${this.getToken()}&fields=id,thumb_1024_url,captured_at,sequence,compass_angle,geometry&sequence_ids=${sequenceId}&limit=${limit}`;
    return this.http.get<{ data: MapillaryImage[] }>(url).pipe(
      map(r => r.data || [])
    );
  }

  getEmbedUrl(imageId: string): string {
    return `https://www.mapillary.com/embed?image_key=${imageId}&style=photo`;
  }

  getImageDetails(imageId: string): Observable<MapillaryImage> {
    const url = `https://graph.mapillary.com/${imageId}?access_token=${this.getToken()}&fields=id,thumb_1024_url,captured_at,sequence,compass_angle,geometry`;
    return this.http.get<MapillaryImage>(url);
  }
}
