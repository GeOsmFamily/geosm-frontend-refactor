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
import { Subscription, firstValueFrom } from 'rxjs';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { MapService } from '../../map/services/map.service';
import { BaseMapService } from '../../../core/services/base-map.service';
import { InstanceService } from '../../../core/services/instance.service';
import { LayerService } from '../../../core/services/layer.service';
import { MapLayerService } from '../../map/services/map-layer.service';
import { geoJsonToFeatures } from '../../map/helpers/map.helper';
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
  /** Désactivé le 2026-08-07 à la demande utilisateur (repasser à true pour réactiver). */
  protected readonly vectorCompareEnabled = false;

  private readonly mapService = inject(MapService);
  private readonly baseMapService = inject(BaseMapService);
  private readonly instanceService = inject(InstanceService);
  private readonly layerService = inject(LayerService);
  private readonly mapLayerService = inject(MapLayerService);

  private map!: Map;
  private subscription!: Subscription;

  baseMaps: BaseMapOption[] = [];
  leftBaseMapId: string | null = null;
  rightBaseMapId: string | null = null;
  comparing = false;
  swipePosition = 50;

  // --- Comparateur temporel vecteur (voir plan "Partage enrichi : annotations persistantes +
  // comparateur temporel vecteur" du 2026-08-06) - mode alternatif comparant deux couches
  // vectorielles du catalogue au lieu de deux fonds de carte, même mécanisme de swipe. Limité
  // aux couches déjà ACTIVES sur la carte (pas de nouvelle UI de navigation du catalogue), voir
  // MapLayerService.getActiveLayers(). ---
  mode: 'basemap' | 'vector' = 'basemap';
  leftVectorLayerId: string | null = null;
  rightVectorLayerId: string | null = null;
  vectorCompareError: string | null = null;
  vectorCompareLoading = false;

  get vectorLayerOptions(): { id: string; name: string }[] {
    return this.mapLayerService
      .getActiveLayers()
      .map((al) => ({ id: al.layer.id, name: al.layer.name }));
  }

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
    this.subscription = this.instanceService.currentInstance$.subscribe(
      (instance: Instance | null) => {
        if (instance) {
          this.baseMapService.list(instance.id).subscribe({
            next: (maps: BaseMap[]) => {
              this.baseMaps = [
                ...this.defaultBaseMaps,
                ...[...maps]
                  .sort((a: BaseMap, b: BaseMap) => a.order - b.order)
                  .map((bm: BaseMap) => ({
                    id: bm.id,
                    name: bm.name,
                    thumbnail: bm.thumbnail,
                    baseMap: bm,
                  })),
              ];
            },
            error: () => {
              this.baseMaps = [...this.defaultBaseMaps];
            },
          });
        } else {
          this.baseMaps = [...this.defaultBaseMaps];
        }
      },
    );
  }

  ngOnDestroy(): void {
    this.resetCompare();
    this.subscription?.unsubscribe();
  }

  private createOlLayer(id: string): Layer {
    if (id === 'osm') {
      return new TileLayer({ source: new OSM() });
    }
    const option = this.baseMaps.find((bm) => bm.id === id);
    if (option?.baseMap) {
      return new TileLayer({
        source: new XYZ({
          url: option.baseMap.url,
          attributions: option.baseMap.attribution,
        }),
      });
    }
    return new TileLayer({ visible: false });
  }

  private createVectorOlLayer(color: string): VectorLayer<VectorSource> {
    return new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        stroke: new Stroke({ color, width: 3 }),
        fill: new Fill({ color: `${color}33` }),
        image: new CircleStyle({ radius: 6, fill: new Fill({ color }) }),
      }),
    });
  }

  startCompare(): void {
    if (this.mode === 'vector') {
      this.startVectorCompare();
      return;
    }
    if (!this.leftBaseMapId || !this.rightBaseMapId) return;

    this.leftLayer = this.createOlLayer(this.leftBaseMapId);
    this.rightLayer = this.createOlLayer(this.rightBaseMapId);

    // Hide original base layer
    this.mapService.getBaseLayer().setVisible(false);

    // Add comparison base layers
    this.map.getLayers().insertAt(0, this.leftLayer);
    this.map.getLayers().insertAt(1, this.rightLayer);

    this.comparing = true;
    this.attachClipHandlers();
  }

  /** Compare deux couches vectorielles déjà actives sur la carte (pas de fond de carte masqué,
   * contrairement au mode basemap - les deux couches sont des overlays). */
  private startVectorCompare(): void {
    if (!this.leftVectorLayerId || !this.rightVectorLayerId) return;
    this.vectorCompareError = null;
    this.vectorCompareLoading = true;

    Promise.all([
      firstValueFrom(this.layerService.getFeatures(this.leftVectorLayerId, { limit: 5000 })),
      firstValueFrom(this.layerService.getFeatures(this.rightVectorLayerId, { limit: 5000 })),
    ])
      .then(([leftFeatures, rightFeatures]) => {
        this.vectorCompareLoading = false;
        this.leftLayer = this.createVectorOlLayer('#023f5f');
        this.rightLayer = this.createVectorOlLayer('#e67e22');
        (this.leftLayer as VectorLayer<VectorSource>)
          .getSource()!
          .addFeatures(geoJsonToFeatures(leftFeatures));
        (this.rightLayer as VectorLayer<VectorSource>)
          .getSource()!
          .addFeatures(geoJsonToFeatures(rightFeatures));

        this.map.getLayers().insertAt(0, this.leftLayer);
        this.map.getLayers().insertAt(1, this.rightLayer);
        this.comparing = true;
        this.attachClipHandlers();
      })
      .catch(() => {
        this.vectorCompareLoading = false;
        this.vectorCompareError = 'Impossible de charger les entités des couches sélectionnées.';
      });
  }

  private attachClipHandlers(): void {
    if (!this.leftLayer || !this.rightLayer) return;
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

    this.leftLayer.on('prerender', this.leftPrerender);
    this.leftLayer.on('postrender', this.leftPostrender);
    this.rightLayer.on('prerender', this.rightPrerender);
    this.rightLayer.on('postrender', this.rightPostrender);

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
        this.leftLayer.un('prerender', this.leftPrerender);
        this.leftLayer.un('postrender', this.leftPostrender!);
      }
      this.map.removeLayer(this.leftLayer);
    }
    if (this.rightLayer) {
      if (this.rightPrerender) {
        this.rightLayer.un('prerender', this.rightPrerender);
        this.rightLayer.un('postrender', this.rightPostrender!);
      }
      this.map.removeLayer(this.rightLayer);
    }

    this.leftLayer = null;
    this.rightLayer = null;
    this.comparing = false;
    this.swipePosition = 50;
    this.vectorCompareError = null;

    // Restore original base layer - non pertinent en mode vecteur, où le fond de carte
    // n'a jamais été masqué (les deux couches comparées sont des overlays, pas des fonds).
    if (this.mode === 'basemap') {
      this.mapService.getBaseLayer().setVisible(true);
    }

    if (this.map) {
      this.map.render();
    }
  }

  setMode(mode: 'basemap' | 'vector'): void {
    if (this.mode === mode) return;
    this.resetCompare();
    this.mode = mode;
  }
}
