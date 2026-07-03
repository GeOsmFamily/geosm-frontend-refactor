import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import Map from 'ol/Map';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import MVT from 'ol/format/MVT';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import { Fill, Stroke, Style, Circle as CircleStyle, RegularShape } from 'ol/style';
import { MapService } from '../../map/services/map.service';
import { MapillaryService, MapillaryImage } from '../../../core/services/mapillary.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-mapillary-tool',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSliderModule,
    TranslateModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './mapillary-tool.component.html',
  styleUrl: './mapillary-tool.component.scss',
})
export class MapillaryToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly mapillaryService = inject(MapillaryService);
  private readonly sanitizer = inject(DomSanitizer);

  private map!: Map;
  private clickListener: ((evt: any) => void) | null = null;
  private pointerMoveListener: ((evt: any) => void) | null = null;
  
  private vectorTileLayer!: VectorTileLayer;
  private readonly markerSource = new VectorSource();
  private markerLayer!: VectorLayer<VectorSource>;
  private popupOverlay!: Overlay;
  private popupElement!: HTMLElement;

  active = false;
  loadingSelected = false;

  selectedImage: MapillaryImage | null = null;
  viewerUrl: SafeResourceUrl | null = null;

  // Caching for hover thumbnail URLs with FIFO eviction to prevent memory leaks
  private readonly thumbnailCache: Record<number, string> = {};
  private readonly thumbnailCacheKeys: number[] = [];
  private hoveredImageId: number | null = null;

  // Playback / Live View Mode State
  playbackMode = false;
  playing = false;
  playbackLoading = false;
  sequenceImages: MapillaryImage[] = [];
  playbackIndex = 0;
  playbackSpeed = 800; // ms per frame
  isFullscreen = false;
  private playbackTimer: any = null;

  ngOnInit(): void {
    this.map = this.mapService.getMap();

    // Listen to fullscreen changes to sync state (ESC key exit)
    document.addEventListener('fullscreenchange', this.onFullscreenChange);

    // Marker Layer for selected active point
    this.markerLayer = new VectorLayer({
      source: this.markerSource,
      zIndex: 1001,
    });
    this.map.addLayer(this.markerLayer);

    // Style dynamically depending on selection state
    this.vectorTileLayer = new VectorTileLayer({
      source: new VectorTileSource({
        format: new MVT(),
        url: `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${this.mapillaryService.getToken()}`,
        cacheSize: 128, // Limit OpenLayers tile cache size to prevent memory leaks!
      }),
      style: (feature) => {
        const layerName = feature.get('layer') || '';
        
        if (layerName === 'image') {
          const isSelected = feature.get('id') === this.selectedImage?.id;
          
          if (isSelected) {
            const compassAngle = feature.get('compass_angle');
            if (compassAngle !== undefined && compassAngle !== null) {
              return new Style({
                image: new RegularShape({
                  fill: new Fill({ color: '#FF3B30' }),
                  stroke: new Stroke({ color: '#ffffff', width: 2 }),
                  points: 3,
                  radius: 12,
                  rotation: ((compassAngle - 180) * Math.PI) / 180, // Facing direction
                  angle: 0,
                }),
              });
            }
            return new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({ color: '#FF3B30' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 }),
              }),
            });
          }

          return new Style({
            image: new CircleStyle({
              radius: 5,
              fill: new Fill({ color: '#05CB63' }),
              stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
            }),
          });
        } else if (layerName === 'sequence') {
          return new Style({
            stroke: new Stroke({
              color: 'rgba(5, 203, 99, 0.4)',
              width: 2.5,
            }),
          });
        }
        return undefined;
      },
    });

    // Create dynamically the hover popup overlay
    const popupEl = document.createElement('div');
    popupEl.className = 'mapillary-hover-popup';
    popupEl.style.display = 'none';
    popupEl.style.position = 'absolute';
    popupEl.style.background = 'rgba(15, 23, 42, 0.9)';
    popupEl.style.color = '#ffffff';
    popupEl.style.padding = '6px';
    popupEl.style.borderRadius = '8px';
    popupEl.style.width = '140px';
    popupEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
    popupEl.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    popupEl.style.pointerEvents = 'none';
    popupEl.style.zIndex = '1000';
    this.popupElement = popupEl;

    this.popupOverlay = new Overlay({
      element: this.popupElement,
      positioning: 'bottom-center',
      stopEvent: false,
      offset: [0, -15],
    });
    this.map.addOverlay(this.popupOverlay);
  }

  private readonly onFullscreenChange = () => {
    this.isFullscreen = document.fullscreenElement !== null;
  };

  ngOnDestroy(): void {
    this.deactivate();
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    if (this.popupOverlay && this.map) {
      this.map.removeOverlay(this.popupOverlay);
    }
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
    this.map.addLayer(this.vectorTileLayer);

    // Map click selection
    this.clickListener = (evt: any) => {
      const pixel = this.map.getEventPixel(evt.originalEvent);
      const feature = this.map.forEachFeatureAtPixel(pixel, (f) => f, {
        layerFilter: (layer) => layer === this.vectorTileLayer,
      });

      if (feature && feature.get('layer') === 'image') {
        const imageId = feature.get('id');
        if (imageId !== undefined && imageId !== null) {
          const idStr = imageId.toString();
          this.loadingSelected = true;
          this.mapillaryService.getImageDetails(idStr).subscribe({
            next: (details) => {
              this.loadingSelected = false;
              if (this.playbackMode) {
                this.pausePlayback();
                this.selectedImage = details;
                this.playbackLoading = true;
                this.mapillaryService.getSequenceImages(details.sequence).subscribe({
                  next: (imgs) => {
                    this.playbackLoading = false;
                    const sorted = [...imgs].sort((a, b) => a.captured_at - b.captured_at);
                    this.sequenceImages = sorted;
                    this.playbackIndex = this.sequenceImages.findIndex(x => x.id === details.id);
                    if (this.playbackIndex === -1) this.playbackIndex = 0;
                    this.selectImage(details, true);
                    this.startPlayback();
                  },
                  error: () => {
                    this.playbackLoading = false;
                    this.playbackMode = false;
                    this.selectImage(details, true);
                  }
                });
              } else {
                this.selectImage(details, true);
              }
            },
            error: () => {
              this.loadingSelected = false;
            }
          });
        }
      }
    };
    this.map.on('singleclick', this.clickListener);

    // Hover popup handler
    this.pointerMoveListener = (evt: any) => {
      if (this.playing || evt.dragging) {
        this.popupOverlay.setPosition(undefined);
        return;
      }
      const pixel = this.map.getEventPixel(evt.originalEvent);
      const feature = this.map.forEachFeatureAtPixel(pixel, (f) => f, {
        layerFilter: (layer) => layer === this.vectorTileLayer,
      });

      if (feature && feature.get('layer') === 'image') {
        const imageId = feature.get('id');
        const capturedAt = feature.get('captured_at') as number;
        if (imageId !== undefined && imageId !== null) {
          const idNum = Number(imageId);
          const idStr = imageId.toString();
          this.hoveredImageId = idNum;
          const dateStr = capturedAt ? new Date(capturedAt).toLocaleDateString() : 'Inconnue';
          
          if (this.thumbnailCache[idNum]) {
            const url = this.thumbnailCache[idNum];
            this.popupElement.innerHTML = `
              <img src="${url}" style="width: 100%; height: 75px; object-fit: cover; border-radius: 4px;" />
              <div style="font-size: 10px; margin-top: 4px; text-align: center; font-weight: 500; font-family: sans-serif;">${dateStr}</div>
            `;
          } else {
            this.popupElement.innerHTML = `
              <div style="width: 100%; height: 75px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 9px; color: #aaa;">Chargement...</div>
              <div style="font-size: 10px; margin-top: 4px; text-align: center; font-weight: 500; font-family: sans-serif;">${dateStr}</div>
            `;
            
            this.mapillaryService.getImageDetails(idStr).subscribe({
              next: (details) => {
                this.thumbnailCache[idNum] = details.thumb_1024_url;
                if (this.hoveredImageId === idNum) {
                  this.popupElement.innerHTML = `
                    <img src="${details.thumb_1024_url}" style="width: 100%; height: 75px; object-fit: cover; border-radius: 4px;" />
                    <div style="font-size: 10px; margin-top: 4px; text-align: center; font-weight: 500; font-family: sans-serif;">${dateStr}</div>
                  `;
                }
              }
            });
          }
          
          this.popupElement.style.display = 'block';
          this.popupOverlay.setPosition(evt.coordinate);
          this.map.getTargetElement().style.cursor = 'pointer';
          return;
        }
      }

      this.hoveredImageId = null;
      this.popupOverlay.setPosition(undefined);
      this.popupElement.style.display = 'none';
      this.map.getTargetElement().style.cursor = '';
    };
    this.map.on('pointermove', this.pointerMoveListener);
  }

  private deactivate(): void {
    this.active = false;
    this.stopPlayback();

    if (this.clickListener) {
      this.map.un('singleclick', this.clickListener);
      this.clickListener = null;
    }
    if (this.pointerMoveListener) {
      this.map.un('pointermove', this.pointerMoveListener);
      this.pointerMoveListener = null;
    }

    if (this.vectorTileLayer) {
      this.vectorTileLayer.setSource(null as any); // Clear internal caches
      this.map.removeLayer(this.vectorTileLayer);
    }
    if (this.markerLayer) {
      this.map.removeLayer(this.markerLayer);
    }
    this.markerSource.clear();

    this.selectedImage = null;
    this.viewerUrl = null;
  }

  selectImage(img: MapillaryImage, centerMap = false): void {
    this.selectedImage = img;
    const url = this.mapillaryService.getEmbedUrl(img.id);
    this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

    // Update selection marker on map
    this.markerSource.clear();
    if (img.geometry && img.geometry.coordinates) {
      const coords = fromLonLat(img.geometry.coordinates);
      
      if (centerMap) {
        this.map.getView().setCenter(coords);
      }

      const markerFeature = new Feature(new Point(coords));
      const compassAngle = img.compass_angle;
      const markerStyle = new Style({
        image: new RegularShape({
          fill: new Fill({ color: '#ef4444' }), // Red triangle pointing compass direction
          stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
          points: 3,
          radius: 12,
          rotation: compassAngle !== undefined && compassAngle !== null ? ((compassAngle - 180) * Math.PI) / 180 : 0,
          angle: 0,
        }),
      });

      markerFeature.setStyle(markerStyle);
      this.markerSource.addFeature(markerFeature);
    }

    // Trigger Layer Style update for VectorTiles
    this.vectorTileLayer.changed();
  }

  closeViewer(): void {
    this.selectedImage = null;
    this.viewerUrl = null;
    this.stopPlayback();
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }

  downloadImage(): void {
    if (!this.selectedImage) return;
    window.open(this.selectedImage.thumb_1024_url, '_blank');
  }

  // --- PLAYBACK / LIVE VIEW MODE METHODS ---

  enterPlaybackMode(): void {
    if (!this.selectedImage) return;

    this.playbackMode = true;
    this.playbackLoading = true;

    this.mapillaryService.getSequenceImages(this.selectedImage.sequence).subscribe({
      next: (imgs) => {
        this.playbackLoading = false;
        const sorted = [...imgs].sort((a, b) => a.captured_at - b.captured_at);
        this.sequenceImages = sorted;

        this.playbackIndex = this.sequenceImages.findIndex(img => img.id === this.selectedImage?.id);
        if (this.playbackIndex === -1) this.playbackIndex = 0;

        this.startPlayback();
      },
      error: () => {
        this.playbackLoading = false;
        this.playbackMode = false;
      },
    });
  }

  startPlayback(): void {
    this.playing = true;
    this.clearPlaybackInterval();

    this.playbackTimer = setInterval(() => {
      if (this.playbackIndex < this.sequenceImages.length - 1) {
        this.playbackIndex++;
        const nextImg = this.sequenceImages[this.playbackIndex];
        this.selectImage(nextImg, true);
      } else {
        this.pausePlayback();
      }
    }, this.playbackSpeed);
  }

  pausePlayback(): void {
    this.playing = false;
    this.clearPlaybackInterval();
  }

  stopPlayback(): void {
    this.playing = false;
    this.playbackMode = false;
    this.clearPlaybackInterval();
    this.sequenceImages = [];

    if (this.isFullscreen) {
      this.toggleFullscreen(); // Restore elements to their container
    }

    if (this.vectorTileLayer) {
      this.vectorTileLayer.changed();
    }
  }

  prevFrame(): void {
    if (this.playbackIndex > 0) {
      this.pausePlayback();
      this.playbackIndex--;
      const nextImg = this.sequenceImages[this.playbackIndex];
      this.selectImage(nextImg, true);
    }
  }

  nextFrame(): void {
    if (this.playbackIndex < this.sequenceImages.length - 1) {
      this.pausePlayback();
      this.playbackIndex++;
      const nextImg = this.sequenceImages[this.playbackIndex];
      this.selectImage(nextImg, true);
    }
  }

  onSliderChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    if (!inputEl) return;
    const value = Number(inputEl.value);
    
    this.pausePlayback();
    this.playbackIndex = value;
    if (this.sequenceImages[value]) {
      this.selectImage(this.sequenceImages[value], true);
    }
  }

  setSpeed(speedMs: number): void {
    this.playbackSpeed = speedMs;
    if (this.playing) {
      this.startPlayback();
    }
  }

  toggleFullscreen(): void {
    const playerEl = document.querySelector('.playback-player') as HTMLElement;
    if (!playerEl) return;

    this.isFullscreen = !this.isFullscreen;

    if (this.isFullscreen) {
      // Append directly to body to make sure it overlays the entire webpage and map
      document.body.appendChild(playerEl);
    } else {
      // Restore to its placeholder container
      const container = document.querySelector('.playback-controls-section');
      if (container) {
        container.insertBefore(playerEl, container.firstChild);
      }
    }
  }

  private cacheThumbnail(id: number, url: string): void {
    if (this.thumbnailCacheKeys.length > 200) {
      const oldestKey = this.thumbnailCacheKeys.shift();
      if (oldestKey !== undefined) {
        delete this.thumbnailCache[oldestKey];
      }
    }
    this.thumbnailCache[id] = url;
    this.thumbnailCacheKeys.push(id);
  }

  private clearPlaybackInterval(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }
}
