import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import Map from 'ol/Map';
import { Subscription } from 'rxjs';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { MapService } from '../../map/services/map.service';
import { BaseMapService } from '../../../core/services/base-map.service';
import { InstanceService } from '../../../core/services/instance.service';
import { BaseMap, Instance } from '../../../core/models/index';
import type { Layer } from 'ol/layer';
import type RenderEvent from 'ol/render/Event';

interface BaseMapOption {
  id: string;
  name: string;
  thumbnail: string | null;
  baseMap: BaseMap | null;
}

@Component({
  selector: 'app-compare-tool',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDividerModule,
    TranslateModule,
  ],
  templateUrl: './compare-tool.component.html',
  styleUrl: './compare-tool.component.scss',
})
export class CompareToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly baseMapService = inject(BaseMapService);
  private readonly instanceService = inject(InstanceService);

  private map!: Map;
  private subscription!: Subscription;

  baseMaps: BaseMapOption[] = [];
  leftBaseMapId: string | null = null;
  rightBaseMapId: string | null = null;
  comparing = false;
  swipePosition = 50;

  private leftLayer: Layer | null = null;
  private rightLayer: Layer | null = null;
  private leftPrerender: ((evt: RenderEvent) => void) | null = null;
  private leftPostrender: ((evt: RenderEvent) => void) | null = null;
  private rightPrerender: ((evt: RenderEvent) => void) | null = null;
  private rightPostrender: ((evt: RenderEvent) => void) | null = null;

  private readonly defaultBaseMaps: BaseMapOption[] = [
    { id: 'osm', name: 'OpenStreetMap', thumbnail: null, baseMap: null },
  ];

  ngOnInit(): void {
    this.map = this.mapService.getMap();
    this.subscription = this.instanceService.currentInstance$.subscribe((instance: Instance | null) => {
      if (instance) {
        this.baseMapService.list(instance.id).subscribe({
          next: (maps: BaseMap[]) => {
            this.baseMaps = [
              ...this.defaultBaseMaps,
              ...[...maps].sort((a: BaseMap, b: BaseMap) => a.order - b.order).map((bm: BaseMap) => ({
                id: bm.id,
                name: bm.name,
                thumbnail: bm.thumbnail,
                baseMap: bm,
              })),

            ];
          },
          error: () => {
            this.baseMaps = [...this.defaultBaseMaps];
          }
        });
      } else {
        this.baseMaps = [...this.defaultBaseMaps];
      }
    });
  }


  ngOnDestroy(): void {
    this.resetCompare();
    this.subscription?.unsubscribe();
  }

  private createOlLayer(id: string): Layer {
    if (id === 'osm') {
      return new TileLayer({ source: new OSM() });
    }
    const option = this.baseMaps.find(bm => bm.id === id);
    if (option?.baseMap) {
      return new TileLayer({
        source: new XYZ({
          url: option.baseMap.url,
          attributions: option.baseMap.attribution,
        })
      });
    }
    return new TileLayer({ visible: false });
  }

  startCompare(): void {
    if (!this.leftBaseMapId || !this.rightBaseMapId) return;

    this.leftLayer = this.createOlLayer(this.leftBaseMapId);
    this.rightLayer = this.createOlLayer(this.rightBaseMapId);

    // Hide original base layer
    this.mapService.getBaseLayer().setVisible(false);

    // Add comparison base layers
    this.map.getLayers().insertAt(0, this.leftLayer);
    this.map.getLayers().insertAt(1, this.rightLayer);

    this.comparing = true;

    this.leftPrerender = (event: RenderEvent) => {
      const ctx = event.context as CanvasRenderingContext2D;
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const clipX = width * (this.swipePosition / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipX, height);
      ctx.clip();
    };
    this.leftPostrender = (event: RenderEvent) => {
      const ctx = event.context as CanvasRenderingContext2D;
      ctx.restore();
    };

    this.rightPrerender = (event: RenderEvent) => {
      const ctx = event.context as CanvasRenderingContext2D;
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const clipX = width * (this.swipePosition / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipX, 0, width - clipX, height);
      ctx.clip();
    };
    this.rightPostrender = (event: RenderEvent) => {
      const ctx = event.context as CanvasRenderingContext2D;
      ctx.restore();
    };

    this.leftLayer.on('prerender', this.leftPrerender as any);
    this.leftLayer.on('postrender', this.leftPostrender as any);
    this.rightLayer.on('prerender', this.rightPrerender as any);
    this.rightLayer.on('postrender', this.rightPostrender as any);

    this.map.render();
  }

  onSwipeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.swipePosition = Number(input.value);
    this.map.render();
  }

  resetCompare(): void {
    if (this.leftLayer) {
      if (this.leftPrerender) {
        this.leftLayer.un('prerender', this.leftPrerender as any);
        this.leftLayer.un('postrender', this.leftPostrender as any);
      }
      this.map.removeLayer(this.leftLayer);
    }
    if (this.rightLayer) {
      if (this.rightPrerender) {
        this.rightLayer.un('prerender', this.rightPrerender as any);
        this.rightLayer.un('postrender', this.rightPostrender as any);
      }
      this.map.removeLayer(this.rightLayer);
    }

    this.leftLayer = null;
    this.rightLayer = null;
    this.comparing = false;
    this.swipePosition = 50;

    // Restore original base layer
    this.mapService.getBaseLayer().setVisible(true);

    if (this.map) {
      this.map.render();
    }
  }
}
