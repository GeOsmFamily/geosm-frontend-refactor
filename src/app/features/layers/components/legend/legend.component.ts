import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';

import { MapLayerService, ActiveLayer } from '../../../map/services/map-layer.service';

interface LegendItem {
  layerName: string;
  layerId: string;
  type: 'wms' | 'vector';
  legendUrl?: string;
  color?: string;
  collapsed: boolean;
}

@Component({
  selector: 'app-legend',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatExpansionModule, TranslateModule],
  templateUrl: './legend.component.html',
  styleUrl: './legend.component.scss',
})
export class LegendComponent implements OnInit, OnDestroy {
  private readonly mapLayerService = inject(MapLayerService);

  readonly legendItems = signal<LegendItem[]>([]);
  private subscription!: Subscription;

  ngOnInit(): void {
    this.subscription = this.mapLayerService.activeLayers$.subscribe((layers) => {
      this.legendItems.set(layers.map((al) => this.buildLegendItem(al)));
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private buildLegendItem(al: ActiveLayer): LegendItem {
    const olLayer = al.olLayer;

    if (olLayer instanceof TileLayer) {
      const source = olLayer.getSource();
      if (source instanceof TileWMS) {
        const params = source.getParams();
        const baseUrl = source.getUrls()?.[0] || al.layer.url;
        const layerName = params['LAYERS'] || al.layer.tableName;
        const legendUrl = `${baseUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=${layerName}&FORMAT=image/png`;
        return {
          layerName: al.layer.name,
          layerId: al.layer.id,
          type: 'wms',
          legendUrl,
          collapsed: false,
        };
      }
    }

    // Vector layer fallback
    return {
      layerName: al.layer.name,
      layerId: al.layer.id,
      type: 'vector',
      color: '#3388ff',
      collapsed: false,
    };
  }

  toggleCollapse(item: LegendItem): void {
    this.legendItems.update((items) =>
      items.map((i) => (i.layerId === item.layerId ? { ...i, collapsed: !i.collapsed } : i))
    );
  }
}
