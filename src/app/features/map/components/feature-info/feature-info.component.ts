import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import Overlay from 'ol/Overlay';
import { toLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';

import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-feature-info',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, TranslateModule],
  templateUrl: './feature-info.component.html',
  styleUrl: './feature-info.component.scss',
})
export class FeatureInfoComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly http = inject(HttpClient);

  readonly visible = signal(false);
  readonly loading = signal(false);
  readonly title = signal('');
  readonly properties = signal<Array<{ key: string; value: string }>>([]);

  private overlay!: Overlay;
  private subscription!: Subscription;
  private popupElement!: HTMLDivElement;

  ngOnInit(): void {
    this.subscription = this.mapService.mapReady$.subscribe((ready) => {
      if (ready) {
        this.setupOverlay();
        this.setupClickHandler();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.overlay) {
      this.mapService.getMap()?.removeOverlay(this.overlay);
    }
  }

  private setupOverlay(): void {
    this.popupElement = document.createElement('div');
    this.popupElement.className = 'feature-info-overlay';

    this.overlay = new Overlay({
      element: this.popupElement,
      autoPan: { animation: { duration: 250 } },
      positioning: 'bottom-center',
      offset: [0, -10],
    });

    this.mapService.getMap().addOverlay(this.overlay);
  }

  private setupClickHandler(): void {
    this.subscription.add(
      this.mapService.onClick$.subscribe((event) => {
        const map = this.mapService.getMap();
        const pixel = event.pixel;

        // Check vector features first
        const features = map.getFeaturesAtPixel(pixel);
        if (features && features.length > 0) {
          const feature = features[0];
          const props = feature.getProperties();
          delete props['geometry'];
          this.showProperties('Feature', props, event.coordinate);
          return;
        }

        // Check WMS layers
        const wmsLayers = map.getLayers().getArray().filter((l): l is TileLayer<TileWMS> => {
          return l instanceof TileLayer && l.getSource() instanceof TileWMS && l.getVisible();
        });

        if (wmsLayers.length > 0) {
          this.queryWmsLayers(wmsLayers, event.coordinate, map.getView().getResolution()!);
        } else {
          this.close();
        }
      })
    );
  }

  private queryWmsLayers(layers: TileLayer<TileWMS>[], coordinate: number[], resolution: number): void {
    this.loading.set(true);
    this.visible.set(true);
    this.overlay.setPosition(coordinate);

    const layer = layers[layers.length - 1];
    const source = layer.getSource()!;
    const url = source.getFeatureInfoUrl(coordinate, resolution, 'EPSG:3857', {
      INFO_FORMAT: 'application/json',
    });

    if (!url) {
      this.loading.set(false);
      this.close();
      return;
    }

    this.http.get<any>(url).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.features && response.features.length > 0) {
          const props = response.features[0].properties || {};
          this.showProperties(layer.get('name') || 'WMS Layer', props, coordinate);
        } else {
          this.properties.set([]);
          this.title.set('');
          this.visible.set(false);
          this.overlay.setPosition(undefined);
        }
      },
      error: () => {
        this.loading.set(false);
        this.close();
      },
    });
  }

  private showProperties(title: string, props: Record<string, any>, coordinate: number[]): void {
    this.title.set(title);
    this.properties.set(
      Object.entries(props)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([key, value]) => ({ key, value: String(value) }))
    );
    this.visible.set(true);
    this.overlay.setPosition(coordinate);
    this.updatePopupContent();
  }

  private updatePopupContent(): void {
    // The overlay element is updated via Angular template rendering in the host element
  }

  close(): void {
    this.visible.set(false);
    this.overlay?.setPosition(undefined);
  }
}
