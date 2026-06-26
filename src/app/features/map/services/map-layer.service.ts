import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import { Layer } from '../../../core/models/index';
import { MapService } from './map.service';

export interface ActiveLayer {
  layer: Layer;
  olLayer: TileLayer<TileWMS> | VectorLayer<VectorSource>;
  visible: boolean;
  opacity: number;
}

@Injectable({ providedIn: 'root' })
export class MapLayerService {
  private readonly mapService = inject(MapService);

  private readonly activeLayersSubject = new BehaviorSubject<ActiveLayer[]>([]);
  readonly activeLayers$ = this.activeLayersSubject.asObservable();

  addLayer(layer: Layer): void {
    const existing = this.activeLayersSubject.value.find(al => al.layer.id === layer.id);
    if (existing) return;

    const olLayer = new TileLayer({
      source: new TileWMS({
        url: layer.url,
        params: { LAYERS: layer.tableName, TILED: true },
        serverType: 'geoserver',
      }),
      opacity: 1,
      visible: true,
    });

    this.mapService.addLayer(olLayer);

    const activeLayer: ActiveLayer = { layer, olLayer, visible: true, opacity: 1 };
    this.activeLayersSubject.next([...this.activeLayersSubject.value, activeLayer]);
  }

  removeLayer(layerId: string): void {
    const current = this.activeLayersSubject.value;
    const found = current.find(al => al.layer.id === layerId);
    if (found) {
      this.mapService.removeLayer(found.olLayer);
      this.activeLayersSubject.next(current.filter(al => al.layer.id !== layerId));
    }
  }

  removeAll(): void {
    for (const al of this.activeLayersSubject.value) {
      this.mapService.removeLayer(al.olLayer);
    }
    this.activeLayersSubject.next([]);
  }

  toggleVisibility(layerId: string): void {
    const current = this.activeLayersSubject.value.map(al => {
      if (al.layer.id === layerId) {
        const visible = !al.visible;
        al.olLayer.setVisible(visible);
        return { ...al, visible };
      }
      return al;
    });
    this.activeLayersSubject.next(current);
  }

  setOpacity(layerId: string, opacity: number): void {
    const current = this.activeLayersSubject.value.map(al => {
      if (al.layer.id === layerId) {
        al.olLayer.setOpacity(opacity);
        return { ...al, opacity };
      }
      return al;
    });
    this.activeLayersSubject.next(current);
  }

  reorder(previousIndex: number, currentIndex: number): void {
    const layers = [...this.activeLayersSubject.value];
    const [moved] = layers.splice(previousIndex, 1);
    layers.splice(currentIndex, 0, moved);

    layers.forEach((al, i) => {
      al.olLayer.setZIndex(layers.length - i);
    });

    this.activeLayersSubject.next(layers);
  }

  isLayerActive(layerId: string): boolean {
    return this.activeLayersSubject.value.some(al => al.layer.id === layerId);
  }
}
