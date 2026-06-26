import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import Map from 'ol/Map.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style.js';
import { MapService } from '../../map/services/map.service.js';
import { MapillaryService, MapillaryImage } from '../../../core/services/mapillary.service.js';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component.js';

@Component({
  selector: 'app-mapillary-tool',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslateModule, LoadingSpinnerComponent],
  templateUrl: './mapillary-tool.component.html',
  styleUrl: './mapillary-tool.component.scss',
})
export class MapillaryToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly mapillaryService = inject(MapillaryService);
  private readonly sanitizer = inject(DomSanitizer);
  private map!: Map;
  private clickListener: ((evt: any) => void) | null = null;
  private markerSource = new VectorSource();
  private markerLayer!: VectorLayer<VectorSource>;

  active = false;
  loading = false;
  images: MapillaryImage[] = [];
  selectedImage: MapillaryImage | null = null;
  viewerUrl: SafeResourceUrl | null = null;

  ngOnInit(): void {
    this.map = this.mapService.getMap();
    this.markerLayer = new VectorLayer({
      source: this.markerSource,
      style: new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#05CB63' }),
          stroke: new Stroke({ color: '#fff', width: 1.5 }),
        }),
      }),
    });
  }

  ngOnDestroy(): void {
    this.deactivate();
  }

  toggle(): void {
    if (this.active) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  private activate(): void {
    this.active = true;
    this.map.addLayer(this.markerLayer);
    this.clickListener = (evt: any) => {
      const lonLat = toLonLat(evt.coordinate) as [number, number];
      this.fetchImages(lonLat[0], lonLat[1]);
    };
    this.map.on('singleclick', this.clickListener);
  }

  private deactivate(): void {
    this.active = false;
    if (this.clickListener) {
      this.map.un('singleclick', this.clickListener);
      this.clickListener = null;
    }
    this.markerSource.clear();
    if (this.markerLayer) {
      this.map.removeLayer(this.markerLayer);
    }
    this.images = [];
    this.selectedImage = null;
    this.viewerUrl = null;
  }

  private fetchImages(lon: number, lat: number): void {
    this.loading = true;
    this.images = [];
    this.selectedImage = null;
    this.viewerUrl = null;
    this.markerSource.clear();

    this.mapillaryService.getImagesNearPoint(lon, lat).subscribe({
      next: (imgs) => {
        this.images = imgs;
        this.loading = false;
        imgs.forEach(img => {
          const f = new Feature(new Point(fromLonLat(img.geometry.coordinates)));
          f.set('imageId', img.id);
          this.markerSource.addFeature(f);
        });
        if (imgs.length > 0) {
          this.selectImage(imgs[0]);
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  selectImage(img: MapillaryImage): void {
    this.selectedImage = img;
    const url = this.mapillaryService.getEmbedUrl(img.id);
    this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  closeViewer(): void {
    this.selectedImage = null;
    this.viewerUrl = null;
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }
}
