import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import { bbox as bboxLoadingStrategy } from 'ol/loadingstrategy';
import { transformExtent } from 'ol/proj';
import { Layer } from '../../../core/models/index';
import { MapService } from './map.service';
import { LayerService } from '../../../core/services/layer.service';
import { createClusterLayer, geoJsonToFeatures } from '../helpers/map.helper';
import { resolveLayerIconUrlOrDefault } from '../../../core/utils/layer-icon.util';

/**
 * Au-delà de ce nombre de features (metadata.featureCount), on garde le rendu
 * WMS raster classique plutôt que de charger toute la couche côté client -
 * le clustering OpenLayers reste fluide jusqu'à quelques milliers de points,
 * au-delà les tuiles WMS+cluster serveur restent plus adaptées.
 */
const VECTOR_MODE_FEATURE_CAP = 5000;
const VECTOR_LOAD_LIMIT = 5000;

export interface ActiveLayer {
  layer: Layer;
  olLayer: TileLayer<TileWMS> | VectorLayer<Cluster>;
  visible: boolean;
  opacity: number;
}

@Injectable({ providedIn: 'root' })
export class MapLayerService {
  private readonly mapService = inject(MapService);
  private readonly layerService = inject(LayerService);

  private readonly activeLayersSubject = new BehaviorSubject<ActiveLayer[]>([]);
  readonly activeLayers$ = this.activeLayersSubject.asObservable();

  getActiveLayers(): ActiveLayer[] {
    return this.activeLayersSubject.value;
  }

  addLayer(layer: Layer): void {
    const existing = this.activeLayersSubject.value.find(al => al.layer.id === layer.id);
    if (existing) return;

    const geometryType = (layer.geometryType || layer.metadata?.geometryType || '').toLowerCase();
    const featureCount = layer.metadata?.featureCount;
    const isPointLayer = geometryType === 'point' || geometryType === 'multipoint';
    const underCap = featureCount == null || featureCount <= VECTOR_MODE_FEATURE_CAP;

    const olLayer = isPointLayer && underCap
      ? this.createVectorClusterLayer(layer)
      : this.createWmsLayer(layer);

    this.mapService.addLayer(olLayer);

    const activeLayer: ActiveLayer = { layer, olLayer, visible: true, opacity: 1 };
    this.activeLayersSubject.next([...this.activeLayersSubject.value, activeLayer]);
  }

  private createWmsLayer(layer: Layer): TileLayer<TileWMS> {
    // Use sourceUrl (QGIS Server URL from backend env config) with fallback to url
    const wmsUrl = layer.sourceUrl || layer.url;
    // Use sourceLayer (e.g. "cameroon:cameroon_hopitaux") or tableName as WMS LAYERS param
    let wmsLayers = layer.sourceLayer || layer.tableName;
    if (wmsLayers?.includes(':')) {
      wmsLayers = wmsLayers.split(':').pop()!;
    }

    return new TileLayer({
      source: new TileWMS({
        url: wmsUrl,
        params: { LAYERS: wmsLayers, TILED: true, FORMAT: 'image/png', TRANSPARENT: true },
        serverType: 'qgis',
      }),
      opacity: 1,
      visible: true,
      properties: { name: layer.name, layerId: layer.id },
    });
  }

  /**
   * Charge les points réels de la couche via l'API (filtrés par emprise visible)
   * et les affiche/regroupe côté client avec OpenLayers - contrairement aux
   * tuiles WMS, ceci ne se découpe pas aux frontières de tuile et permet un
   * style de cluster personnalisé (icône de la couche + badge de comptage).
   */
  private createVectorClusterLayer(layer: Layer): VectorLayer<Cluster> {
    const source = new VectorSource({
      strategy: bboxLoadingStrategy,
      loader: (extent, _resolution, projection, success, failure) => {
        const bbox4326 = transformExtent(extent, projection, 'EPSG:4326');
        this.layerService
          .getFeatures(layer.id, { bbox: bbox4326.join(','), limit: VECTOR_LOAD_LIMIT })
          .subscribe({
            next: (response) => {
              const features = geoJsonToFeatures(response);
              // Nécessaire pour que la fiche descriptive (feature-info) sache de
              // quelle couche vient la feature cliquée (actions itinéraire/téléchargement).
              features.forEach((f) => f.set('layerId', layer.id, true));
              // Deux emprises voisines peuvent se recouvrir légèrement (panoramique) ;
              // on évite d'ajouter deux fois la même feature (osm_id) à la source.
              const newFeatures = features.filter((f) => {
                const id = f.get('id');
                if (id == null) return true;
                f.setId(id);
                return !source.getFeatureById(id);
              });
              source.addFeatures(newFeatures);
              success?.(newFeatures);
            },
            error: () => failure?.(),
          });
      },
    });

    const iconUrl = resolveLayerIconUrlOrDefault(layer);
    // Couleur du badge de comptage = couleur de la thématique de la couche
    // (cohérent avec le catalogue), plutôt qu'une couleur fixe arbitraire.
    const badgeColor = layer.metadata?.color || undefined;
    const clusterLayer = createClusterLayer(source, iconUrl, 40, undefined, badgeColor);
    clusterLayer.setProperties({ name: layer.name, layerId: layer.id });
    clusterLayer.setOpacity(1);
    clusterLayer.setVisible(true);
    return clusterLayer;
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

  setVisibility(layerId: string, visible: boolean): void {
    const current = this.activeLayersSubject.value.map(al => {
      if (al.layer.id === layerId) {
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
