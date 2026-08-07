import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';

import { MapViewComponent } from '../map/components/map-view/map-view.component';
import { MapService } from '../map/services/map.service';
import { ApiService } from '../../core/services/api.service';
import { CatalogService } from '../../core/services/catalog.service';
import { InstanceService } from '../../core/services/instance.service';
import { MapLayerService } from '../map/services/map-layer.service';
import { ShareMap, Layer, Instance, Group, SubGroup } from '../../core/models/index';

/** Formes brutes renvoyées par /catalog/:slug avant enrichissement local (bbox/tags peuvent
 * être absents) - voir CatalogBrowserComponent qui type la même réponse à l'identique. */
type RawCatalogLayer = Omit<Layer, 'instanceId' | 'subGroupId' | 'bbox' | 'tags'> & {
  bbox?: Layer['bbox'];
  tags?: Layer['tags'];
};
type RawCatalogSubGroup = SubGroup & { layers?: RawCatalogLayer[] };
type RawCatalogGroup = Group & { subGroups?: RawCatalogSubGroup[] };
interface RawCatalogInstance {
  id: string;
  groups?: RawCatalogGroup[];
}

@Component({
  selector: 'app-shared-map',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MapViewComponent,
    TranslateModule,
  ],
  templateUrl: './shared-map.component.html',
  styleUrl: './shared-map.component.scss',
})
export class SharedMapComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
  private readonly mapService = inject(MapService);
  private readonly catalogService = inject(CatalogService);
  private readonly instanceService = inject(InstanceService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly shareInfo = signal<ShareMap | null>(null);

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');
    if (!code) {
      this.error.set(this.translate.instant('sharing.errors.invalidLink'));
      this.loading.set(false);
      return;
    }

    // Corrected backend endpoint to /share/:code
    this.apiService.get<ShareMap>(`/share/${code}`).subscribe({
      next: (share) => {
        this.shareInfo.set(share);
        this.loadInstanceAndApply(share);
      },
      error: () => {
        this.error.set(this.translate.instant('sharing.errors.notFoundOrExpired'));
        this.loading.set(false);
      },
    });
  }

  private loadInstanceAndApply(share: ShareMap): void {
    if (!share.instanceSlug) {
      this.error.set(this.translate.instant('sharing.errors.instanceNotFound'));
      this.loading.set(false);
      return;
    }

    // Route publique (GET /instances/slug/:slug) - un visiteur non connecté doit pouvoir
    // ouvrir un lien de partage sans être redirigé vers /login (GET /instances/:id exige
    // une authentification et ne doit donc jamais être appelée depuis cette page).
    this.instanceService.getBySlug(share.instanceSlug).subscribe({
      next: (instance: Instance) => {
        this.instanceService.setCurrentInstance(instance);
        // Load the catalog to resolve layers
        this.catalogService.getCatalogByInstance(instance.slug).subscribe({
          next: (raw) => {
            const instances = raw as RawCatalogInstance[];
            const catalogInstance = instances?.[0];
            const allLayers = this.extractLayers(catalogInstance?.groups || []);
            this.applyMapState(share, allLayers);
            this.loading.set(false);
          },
          error: () => {
            // Apply coordinates anyway even if catalog fails
            this.applyMapCoordinates(share);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.applyMapCoordinates(share);
        this.loading.set(false);
      },
    });
  }

  private extractLayers(groups: RawCatalogGroup[]): Layer[] {
    const layers: Layer[] = [];
    if (!groups) return layers;
    for (const group of groups) {
      if (group.subGroups) {
        for (const sg of group.subGroups) {
          if (sg.layers) {
            for (const l of sg.layers) {
              layers.push({
                ...l,
                bbox: l.bbox || null,
                tags: l.tags || [],
                instanceId: group.instanceId || '',
                subGroupId: sg.id,
              });
            }
          }
        }
      }
    }
    return layers;
  }

  private applyMapCoordinates(share: ShareMap): void {
    const state = share.mapState;
    if (state && state['center'] && state['zoom']) {
      const center = state['center'] as [number, number];
      const zoom = state['zoom'] as number;
      setTimeout(() => {
        this.mapService.zoomTo(center, zoom);
      }, 500);
    }
    this.applyAnnotations(share);
  }

  /** Annotations tracées par le créateur du lien de partage (voir plan "Partage enrichi :
   * annotations persistantes" du 2026-08-06) - GeoJSON brut embarqué dans mapState.annotations,
   * rendu indépendamment de la résolution du catalogue (contrairement aux couches, une
   * annotation n'a pas besoin du catalogue pour s'afficher) - voir les 3 points d'appel de
   * applyMapCoordinates() dans loadInstanceAndApply(), qui couvrent aussi les deux cas d'échec
   * (instance/catalogue introuvable). */
  private applyAnnotations(share: ShareMap): void {
    const annotations = share.mapState?.['annotations'] as GeoJSON.FeatureCollection | undefined;
    if (!annotations || !Array.isArray(annotations.features) || annotations.features.length === 0) {
      return;
    }
    setTimeout(() => {
      this.mapLayerService.addAnalysisVectorLayer(
        'shared-annotations',
        annotations,
        () =>
          new Style({
            stroke: new Stroke({ color: '#e74c3c', width: 3 }),
            fill: new Fill({ color: 'rgba(231, 76, 60, 0.15)' }),
            image: new CircleStyle({
              radius: 7,
              stroke: new Stroke({ color: '#e74c3c', width: 2 }),
              fill: new Fill({ color: '#ffffff' }),
            }),
          }),
      );
    }, 500);
  }

  private applyMapState(share: ShareMap, catalogLayers: Layer[]): void {
    this.applyMapCoordinates(share);

    const state = share.mapState;
    if (state && Array.isArray(state['layers'])) {
      const layersState = state['layers'] as {
        layerId: string;
        opacity: number;
        visible: boolean;
      }[];
      setTimeout(() => {
        for (const layerEntry of layersState) {
          const catalogLayer = catalogLayers.find((l) => l.id === layerEntry.layerId);
          if (catalogLayer) {
            this.mapLayerService.addLayer(catalogLayer);
            this.mapLayerService.setOpacity(catalogLayer.id, layerEntry.opacity);
            this.mapLayerService.setVisibility(catalogLayer.id, layerEntry.visible);
          }
        }
      }, 600);
    }
  }
}
