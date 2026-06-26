import { Component, ElementRef, OnInit, OnDestroy, ViewChild, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import ScaleLine from 'ol/control/ScaleLine';
import { fromLonLat } from 'ol/proj';

import { MapService } from '../../services/map.service';
import { ApiService } from '../../../../core/services/api.service';
import { BaseMap } from '../../../../core/models/index';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss',
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private readonly mapService = inject(MapService);
  private readonly apiService = inject(ApiService);

  readonly baseMaps = signal<BaseMap[]>([]);

  ngAfterViewInit(): void {
    const map = this.mapService.initMap(
      this.mapContainer.nativeElement,
      environment.mapDefaults.center,
      environment.mapDefaults.zoom,
    );

    const scaleLine = new ScaleLine({ units: 'metric' });
    map.addControl(scaleLine);

    this.loadBaseMaps();
  }

  ngOnDestroy(): void {
    const map = this.mapService.getMap();
    if (map) {
      map.setTarget(undefined);
    }
  }

  private loadBaseMaps(): void {
    this.apiService.get<BaseMap[]>('/basemaps').subscribe({
      next: (basemaps) => {
        this.baseMaps.set(basemaps);
        const defaultMap = basemaps.find((bm) => bm.isDefault);
        if (defaultMap) {
          this.switchBaseMap(defaultMap);
        }
      },
      error: () => {
        // Keep the default OSM layer if API fails
      },
    });
  }

  switchBaseMap(baseMap: BaseMap): void {
    let layer: TileLayer<any>;

    switch (baseMap.type) {
      case 'xyz':
        layer = new TileLayer({
          source: new XYZ({
            url: baseMap.url,
            attributions: baseMap.attribution,
          }),
          properties: { name: baseMap.name },
        });
        break;
      case 'wms':
        layer = new TileLayer({
          source: new TileWMS({
            url: baseMap.url,
            params: { LAYERS: (baseMap.config['layers'] as string) || '', TILED: true },
            attributions: baseMap.attribution,
          }),
          properties: { name: baseMap.name },
        });
        break;
      default:
        layer = new TileLayer({
          source: new OSM(),
          properties: { name: 'OpenStreetMap' },
        });
        break;
    }

    this.mapService.setBaseLayer(layer);
  }
}
